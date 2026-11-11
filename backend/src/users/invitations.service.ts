import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuthenticatedUser, UserRole } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { BadRequestError, ConflictError, NotFoundError } from '../common/errors/app-errors';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { PrismaService } from '../database/prisma.service';
import { StoredInvitation, StoredUser, UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const INVITATION_LIFETIME_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;

export interface InvitationView {
  invitationId: string;
  email: string;
  role: UserRole;
  status: StoredInvitation['status'] | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface CreatedInvitation {
  invitation: InvitationView;
  /** Shown once. There is no email service in this scope: the admin shares the link. */
  inviteLink: string;
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class InvitationsService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Revoking the previous link and issuing the new one happen together, so there is never zero or two live links. */
  async invite(email: string, role: UserRole, invitedBy: AuthenticatedUser): Promise<CreatedInvitation> {
    const normalisedEmail = email.toLowerCase();
    const token = randomBytes(32).toString('base64url');
    return this.prisma.transaction(async () => {
      if (await this.users.findByEmail(normalisedEmail)) throw new ConflictError('USER_ALREADY_EXISTS', 'A team member with this email already exists');
      await this.repository.revokePendingInvitationsFor(normalisedEmail); // re-inviting replaces the old link
      const now = this.clock.nowIso();
      const invitation = await this.repository.insertInvitation({
        email: normalisedEmail,
        role,
        tokenHash: hashToken(token),
        invitedBy: invitedBy.userId,
        expiresAt: new Date(new Date(now).getTime() + INVITATION_LIFETIME_DAYS * MILLISECONDS_PER_DAY).toISOString(),
        createdAt: now,
      });
      return { invitation: this.toView(invitation), inviteLink: `${this.config.FRONTEND_ORIGIN}/accept-invite?token=${token}` };
    });
  }

  async list(): Promise<InvitationView[]> {
    return (await this.repository.listInvitations()).map((invitation) => this.toView(invitation));
  }

  async revoke(invitationId: string): Promise<InvitationView> {
    return this.prisma.transaction(async () => {
      const invitation = await this.repository.findInvitationById(invitationId);
      if (!invitation) throw new NotFoundError('INVITATION_NOT_FOUND', `Invitation ${invitationId} does not exist`);
      if (!(await this.repository.closePendingInvitation(invitationId, 'REVOKED'))) {
        throw new ConflictError('INVITATION_NOT_PENDING', 'Only pending invitations can be revoked');
      }
      return this.toView({ ...invitation, status: 'REVOKED' });
    });
  }

  /** Looks up a usable invitation from the emailed token (public — used by the accept screen). */
  async describe(token: string): Promise<{ email: string; role: UserRole }> {
    const invitation = await this.requireUsable(token);
    return { email: invitation.email, role: invitation.role };
  }

  /**
   * One transaction: the invitation is claimed (PENDING → ACCEPTED, compare-and-set) and the user created together.
   * Two clicks on the same link create one account; a link revoked a moment earlier creates none.
   */
  async accept(token: string, fullName: string, password: string): Promise<StoredUser> {
    await this.requireUsable(token); // friendly errors before the slow password hash
    const passwordHash = this.users.hashPassword(password);
    return this.prisma.transaction(async () => {
      const invitation = await this.requireUsable(token);
      if (!(await this.repository.closePendingInvitation(invitation.invitationId, 'ACCEPTED', this.clock.nowIso()))) {
        throw new BadRequestError('INVITATION_INVALID', 'This invitation link is not valid any more');
      }
      return this.users.createUser({ email: invitation.email, fullName, role: invitation.role, passwordHash });
    });
  }

  private async requireUsable(token: string): Promise<StoredInvitation> {
    const invitation = await this.repository.findInvitationByTokenHash(hashToken(token));
    if (!invitation || invitation.status !== 'PENDING') throw new BadRequestError('INVITATION_INVALID', 'This invitation link is not valid any more');
    if (this.isExpired(invitation)) throw new BadRequestError('INVITATION_EXPIRED', 'This invitation has expired — ask your administrator for a new one');
    return invitation;
  }

  private isExpired(invitation: StoredInvitation): boolean {
    return new Date(invitation.expiresAt).getTime() < new Date(this.clock.nowIso()).getTime();
  }

  private toView(invitation: StoredInvitation): InvitationView {
    const isExpired = invitation.status === 'PENDING' && this.isExpired(invitation);
    return {
      invitationId: invitation.invitationId,
      email: invitation.email,
      role: invitation.role,
      status: isExpired ? 'EXPIRED' : invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }
}
