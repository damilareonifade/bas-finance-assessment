import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { BadRequestError, ConflictError, fieldError, ForbiddenError, NotFoundError, UnauthorizedError } from '../common/errors/app-errors';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { CustomersService } from '../customers/customers.service';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from '../users/password.service';
import { CustomerAccountsRepository, CustomerAccountStatus, StoredCustomerAccount } from './customer-accounts.repository';
import { CUSTOMER_TOKEN_KIND, PORTAL_REMEMBERED_SESSION_SECONDS, PORTAL_SESSION_SECONDS, PortalSession } from './portal-session';

const INVITATION_LIFETIME_MS = 7 * 86_400_000;
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

interface CustomerTokenPayload {
  sub: string;
  kind: typeof CUSTOMER_TOKEN_KIND;
}

/** What staff see on a customer's profile about their portal sign-in. */
export interface PortalAccessView {
  status: 'NONE' | 'INVITED' | 'ACTIVE' | 'DISABLED';
  email: string | null;
  invitationExpiresAt: string | null;
  lastLoginAt: string | null;
}

export const portalSessionSeconds = (rememberMe: boolean): number => (rememberMe ? PORTAL_REMEMBERED_SESSION_SECONDS : PORTAL_SESSION_SECONDS);

@Injectable()
export class PortalAuthService {
  constructor(
    private readonly accounts: CustomerAccountsRepository,
    private readonly customers: CustomersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /* ───────────── staff side ───────────── */

  async access(actor: AuthenticatedUser, customerId: string): Promise<PortalAccessView> {
    await this.customers.getStored(customerId);
    await this.customers.assertCanView(actor, customerId);
    return this.accessFor(customerId);
  }

  /**
   * Staff (admin or the customer's officer) invite the customer. Re-inviting replaces the previous link.
   * No email is sent in this scope: the link is returned once for staff to share.
   */
  async invite(actor: AuthenticatedUser, customerId: string, emailInput?: string): Promise<{ access: PortalAccessView; inviteLink: string }> {
    const customer = await this.customers.getStored(customerId);
    await this.customers.assertCanView(actor, customerId);
    const email = (emailInput ?? customer.email ?? '').trim().toLowerCase();
    if (!email) throw fieldError('email', 'Add the customer’s email address to invite them');
    const token = randomBytes(32).toString('base64url');

    await this.prisma.transaction(async () => {
      if (await this.accounts.findAccountForCustomer(customerId)) throw new ConflictError('PORTAL_ACCOUNT_EXISTS', 'This customer already has a portal sign-in');
      if (await this.accounts.findAccountByEmail(email)) throw fieldError('email', 'Another customer already signs in with this email');
      await this.accounts.revokePendingInvitations(customerId);
      const now = this.clock.nowIso();
      await this.accounts.insertInvitation({
        customerId,
        email,
        tokenHash: hashToken(token),
        invitedBy: actor.userId,
        expiresAt: new Date(new Date(now).getTime() + INVITATION_LIFETIME_MS).toISOString(),
        createdAt: now,
      });
    });
    return { access: await this.accessFor(customerId), inviteLink: `${this.config.FRONTEND_ORIGIN}/portal/accept-invite?token=${token}` };
  }

  /** Admin only (enforced by the controller). Disabling signs the customer out on their next request. */
  async setStatus(customerId: string, status: CustomerAccountStatus): Promise<PortalAccessView> {
    await this.prisma.transaction(async () => {
      const account = await this.accounts.findAccountForCustomer(customerId);
      if (!account) throw new NotFoundError('PORTAL_ACCOUNT_NOT_FOUND', 'This customer has no portal sign-in yet');
      await this.accounts.setAccountStatus(account.accountId, status);
    });
    return this.accessFor(customerId);
  }

  /* ───────────── customer side ───────────── */

  async describeInvitation(token: string): Promise<{ email: string; fullName: string }> {
    const invitation = await this.requireUsableInvitation(token);
    const customer = await this.customers.getStored(invitation.customerId);
    return { email: invitation.email, fullName: customer.fullName };
  }

  /** Claims the link (compare-and-set) and creates the sign-in in one transaction: a double click creates one account. */
  async acceptInvitation(token: string, password: string): Promise<{ session: PortalSession; token: string }> {
    await this.requireUsableInvitation(token);
    const passwordHash = this.passwords.hash(password); // slow: before the transaction
    const account = await this.prisma.transaction(async () => {
      const invitation = await this.requireUsableInvitation(token);
      if (!(await this.accounts.claimInvitation(invitation.invitationId, this.clock.nowIso()))) {
        throw new BadRequestError('INVITATION_INVALID', 'This invitation link is not valid any more');
      }
      if (await this.accounts.findAccountForCustomer(invitation.customerId)) throw new ConflictError('PORTAL_ACCOUNT_EXISTS', 'You already have a sign-in — use the sign-in page');
      return this.accounts.insertAccount({ customerId: invitation.customerId, email: invitation.email, passwordHash, createdAt: this.clock.nowIso() });
    });
    return { session: await this.sessionFor(account), token: this.issueToken(account, false) };
  }

  async login(email: string, password: string, rememberMe: boolean): Promise<{ session: PortalSession; token: string }> {
    const account = await this.accounts.findAccountByEmail(email.trim().toLowerCase());
    // Same answer for "no such account" and "wrong password", so accounts cannot be enumerated.
    if (!account || !this.passwords.verify(password, account.passwordHash)) throw new UnauthorizedError('Incorrect email or password', 'INVALID_CREDENTIALS');
    if (account.status !== 'ACTIVE') throw new ForbiddenError('Your sign-in has been switched off — contact BAS Finance', 'ACCOUNT_DISABLED');
    await this.prisma.transaction(() => this.accounts.recordLogin(account.accountId, this.clock.nowIso()));
    return { session: await this.sessionFor(account), token: this.issueToken(account, rememberMe) };
  }

  /** Token → live, active customer. A staff token (no customer kind) is rejected here. */
  async authenticate(token: string): Promise<PortalSession> {
    let payload: Partial<CustomerTokenPayload>;
    try {
      payload = this.jwt.verify<CustomerTokenPayload>(token);
    } catch {
      throw new UnauthorizedError('Your session has expired — please sign in again', 'SESSION_EXPIRED');
    }
    if (payload.kind !== CUSTOMER_TOKEN_KIND || !payload.sub) throw new UnauthorizedError('Your session is no longer valid', 'SESSION_INVALID');
    const account = await this.accounts.findAccountById(payload.sub);
    if (!account || account.status !== 'ACTIVE') throw new UnauthorizedError('Your session is no longer valid', 'SESSION_INVALID');
    return this.sessionFor(account);
  }

  async changePassword(session: PortalSession, currentPassword: string, newPassword: string): Promise<void> {
    const account = await this.accounts.findAccountById(session.accountId);
    if (!account || !this.passwords.verify(currentPassword, account.passwordHash)) throw fieldError('currentPassword', 'Current password is incorrect');
    if (currentPassword === newPassword) throw fieldError('newPassword', 'Choose a password you have not used just now');
    const passwordHash = this.passwords.hash(newPassword);
    await this.prisma.transaction(() => this.accounts.setPasswordHash(account.accountId, passwordHash));
  }

  private issueToken(account: StoredCustomerAccount, rememberMe: boolean): string {
    const payload: CustomerTokenPayload = { sub: account.accountId, kind: CUSTOMER_TOKEN_KIND };
    return this.jwt.sign(payload, { expiresIn: portalSessionSeconds(rememberMe) });
  }

  private async sessionFor(account: StoredCustomerAccount): Promise<PortalSession> {
    const customer = await this.customers.getStored(account.customerId);
    return { accountId: account.accountId, customerId: customer.customerId, fullName: customer.fullName, email: account.email };
  }

  private async accessFor(customerId: string): Promise<PortalAccessView> {
    const account = await this.accounts.findAccountForCustomer(customerId);
    if (account) return { status: account.status, email: account.email, invitationExpiresAt: null, lastLoginAt: account.lastLoginAt };
    const invitation = await this.accounts.latestPendingInvitation(customerId);
    if (invitation && !this.isExpired(invitation.expiresAt)) return { status: 'INVITED', email: invitation.email, invitationExpiresAt: invitation.expiresAt, lastLoginAt: null };
    return { status: 'NONE', email: null, invitationExpiresAt: null, lastLoginAt: null };
  }

  private async requireUsableInvitation(token: string) {
    const invitation = await this.accounts.findInvitationByTokenHash(hashToken(token));
    if (!invitation || invitation.status !== 'PENDING') throw new BadRequestError('INVITATION_INVALID', 'This invitation link is not valid any more');
    if (this.isExpired(invitation.expiresAt)) throw new BadRequestError('INVITATION_EXPIRED', 'This invitation has expired — ask BAS Finance for a new one');
    return invitation;
  }

  private isExpired(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() < new Date(this.clock.nowIso()).getTime();
  }
}
