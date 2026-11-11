import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CustomerAccount as AccountRow, CustomerPortalInvitation as InvitationRow } from '../generated/prisma/client';

export type CustomerAccountStatus = 'ACTIVE' | 'DISABLED';
export type PortalInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

export interface StoredCustomerAccount {
  readonly accountId: string;
  readonly customerId: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly status: CustomerAccountStatus;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
}

export interface StoredPortalInvitation {
  readonly invitationId: string;
  readonly customerId: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly invitedBy: string;
  readonly status: PortalInvitationStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
}

const toAccount = (row: AccountRow): StoredCustomerAccount => ({
  accountId: row.id,
  customerId: row.customerId,
  email: row.email,
  passwordHash: row.passwordHash,
  status: row.status as CustomerAccountStatus,
  createdAt: row.createdAt,
  lastLoginAt: row.lastLoginAt,
});

const toInvitation = (row: InvitationRow): StoredPortalInvitation => ({
  invitationId: row.id,
  customerId: row.customerId,
  email: row.email,
  tokenHash: row.tokenHash,
  invitedBy: row.invitedBy,
  status: row.status as PortalInvitationStatus,
  expiresAt: row.expiresAt,
  createdAt: row.createdAt,
});

@Injectable()
export class CustomerAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAccountById(accountId: string): Promise<StoredCustomerAccount | undefined> {
    const row = await this.prisma.db.customerAccount.findUnique({ where: { id: accountId } });
    return row ? toAccount(row) : undefined;
  }

  async findAccountByEmail(email: string): Promise<StoredCustomerAccount | undefined> {
    const row = await this.prisma.db.customerAccount.findUnique({ where: { email } });
    return row ? toAccount(row) : undefined;
  }

  async findAccountForCustomer(customerId: string): Promise<StoredCustomerAccount | undefined> {
    const row = await this.prisma.db.customerAccount.findUnique({ where: { customerId } });
    return row ? toAccount(row) : undefined;
  }

  async insertAccount(input: { customerId: string; email: string; passwordHash: string; createdAt: string }): Promise<StoredCustomerAccount> {
    const id = await this.prisma.nextId('CAC');
    return toAccount(await this.prisma.db.customerAccount.create({ data: { id, ...input, status: 'ACTIVE' } }));
  }

  async setAccountStatus(accountId: string, status: CustomerAccountStatus): Promise<void> {
    await this.prisma.db.customerAccount.update({ where: { id: accountId }, data: { status } });
  }

  async setPasswordHash(accountId: string, passwordHash: string): Promise<void> {
    await this.prisma.db.customerAccount.update({ where: { id: accountId }, data: { passwordHash } });
  }

  async recordLogin(accountId: string, at: string): Promise<void> {
    await this.prisma.db.customerAccount.update({ where: { id: accountId }, data: { lastLoginAt: at } });
  }

  async insertInvitation(input: { customerId: string; email: string; tokenHash: string; invitedBy: string; expiresAt: string; createdAt: string }): Promise<StoredPortalInvitation> {
    const id = await this.prisma.nextId('CINV');
    return toInvitation(await this.prisma.db.customerPortalInvitation.create({ data: { id, ...input, status: 'PENDING' } }));
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<StoredPortalInvitation | undefined> {
    const row = await this.prisma.db.customerPortalInvitation.findUnique({ where: { tokenHash } });
    return row ? toInvitation(row) : undefined;
  }

  async latestPendingInvitation(customerId: string): Promise<StoredPortalInvitation | undefined> {
    const row = await this.prisma.db.customerPortalInvitation.findFirst({ where: { customerId, status: 'PENDING' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return row ? toInvitation(row) : undefined;
  }

  async revokePendingInvitations(customerId: string): Promise<void> {
    await this.prisma.db.customerPortalInvitation.updateMany({ where: { customerId, status: 'PENDING' }, data: { status: 'REVOKED' } });
  }

  /** Compare-and-set PENDING → ACCEPTED. False when the link was already used or revoked a moment earlier. */
  async claimInvitation(invitationId: string, acceptedAt: string): Promise<boolean> {
    const { count } = await this.prisma.db.customerPortalInvitation.updateMany({ where: { id: invitationId, status: 'PENDING' }, data: { status: 'ACCEPTED', acceptedAt } });
    return count === 1;
  }
}
