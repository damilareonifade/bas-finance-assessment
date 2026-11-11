import { Injectable } from '@nestjs/common';
import { UserRole } from '../common/auth/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import type { Invitation as InvitationRow, User as UserRow } from '../generated/prisma/client';

export type UserStatus = 'ACTIVE' | 'DISABLED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

export interface StoredUser {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: UserRole;
  readonly passwordHash: string;
  readonly status: UserStatus;
  readonly createdAt: string;
}

export interface StoredInvitation {
  readonly invitationId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly tokenHash: string;
  readonly invitedBy: string;
  readonly status: InvitationStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
}

const toUser = (row: UserRow): StoredUser => ({
  userId: row.id,
  email: row.email,
  fullName: row.fullName,
  role: row.role as UserRole,
  passwordHash: row.passwordHash,
  status: row.status as UserStatus,
  createdAt: row.createdAt,
});

const toInvitation = (row: InvitationRow): StoredInvitation => ({
  invitationId: row.id,
  email: row.email,
  role: row.role as UserRole,
  tokenHash: row.tokenHash,
  invitedBy: row.invitedBy,
  status: row.status as InvitationStatus,
  expiresAt: row.expiresAt,
  createdAt: row.createdAt,
  acceptedAt: row.acceptedAt,
});

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  count(): Promise<number> {
    return this.prisma.db.user.count();
  }

  async insertUser(input: { email: string; fullName: string; role: UserRole; passwordHash: string; createdAt: string }): Promise<StoredUser> {
    const id = await this.prisma.nextId('USR');
    return toUser(await this.prisma.db.user.create({ data: { id, ...input, status: 'ACTIVE' } }));
  }

  async findUserById(userId: string): Promise<StoredUser | undefined> {
    const row = await this.prisma.db.user.findUnique({ where: { id: userId } });
    return row ? toUser(row) : undefined;
  }

  /** One query for many ids (view mappers resolve approver / officer names with this). */
  async findUsersByIds(userIds: readonly string[]): Promise<StoredUser[]> {
    if (userIds.length === 0) return [];
    return (await this.prisma.db.user.findMany({ where: { id: { in: [...new Set(userIds)] } } })).map(toUser);
  }

  async findUserByEmail(email: string): Promise<StoredUser | undefined> {
    const row = await this.prisma.db.user.findUnique({ where: { email } });
    return row ? toUser(row) : undefined;
  }

  async listUsers(role?: UserRole): Promise<StoredUser[]> {
    return (await this.prisma.db.user.findMany({ where: role ? { role } : {}, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(toUser);
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.db.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async setUserStatus(userId: string, status: UserStatus): Promise<void> {
    await this.prisma.db.user.update({ where: { id: userId }, data: { status } });
  }

  async insertInvitation(input: { email: string; role: UserRole; tokenHash: string; invitedBy: string; expiresAt: string; createdAt: string }): Promise<StoredInvitation> {
    const id = await this.prisma.nextId('INVT');
    return toInvitation(await this.prisma.db.invitation.create({ data: { id, ...input, status: 'PENDING' } }));
  }

  async findInvitationById(invitationId: string): Promise<StoredInvitation | undefined> {
    const row = await this.prisma.db.invitation.findUnique({ where: { id: invitationId } });
    return row ? toInvitation(row) : undefined;
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<StoredInvitation | undefined> {
    const row = await this.prisma.db.invitation.findUnique({ where: { tokenHash } });
    return row ? toInvitation(row) : undefined;
  }

  async listInvitations(): Promise<StoredInvitation[]> {
    return (await this.prisma.db.invitation.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map(toInvitation);
  }

  async revokePendingInvitationsFor(email: string): Promise<void> {
    await this.prisma.db.invitation.updateMany({ where: { email, status: 'PENDING' }, data: { status: 'REVOKED' } });
  }

  /**
   * Compare-and-set: moves the invitation out of PENDING only if it is still PENDING.
   * Returns false when another request (accept / revoke) got there first.
   */
  async closePendingInvitation(invitationId: string, status: Exclude<InvitationStatus, 'PENDING'>, acceptedAt?: string): Promise<boolean> {
    const { count } = await this.prisma.db.invitation.updateMany({
      where: { id: invitationId, status: 'PENDING' },
      data: { status, acceptedAt: acceptedAt ?? null },
    });
    return count === 1;
  }
}
