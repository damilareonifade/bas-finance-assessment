import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuthenticatedUser, UserRole } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { ConflictError, fieldError, NotFoundError } from '../common/errors/app-errors';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { StoredUser, UsersRepository } from './users.repository';

export interface TeamMemberView {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: StoredUser['status'];
  createdAt: string;
}

export interface PersonRef {
  userId: string;
  fullName: string;
}

/** Resolves a user id to a name for display (null when unknown or not set). Built once per response by `UsersService.people`. */
export interface PersonContact extends PersonRef {
  email: string;
}

export type PersonLookup = (userId: string | null | undefined) => PersonRef | null;

export const toTeamMemberView = (user: StoredUser): TeamMemberView => ({
  userId: user.userId,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
});

export const toAuthenticatedUser = (user: StoredUser): AuthenticatedUser => ({
  userId: user.userId,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
});

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly repository: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** First run only: create the initial administrator from SEED_ADMIN_* so someone can sign in and invite the team. */
  async onModuleInit(): Promise<void> {
    if (!this.config.SEED_ADMIN_EMAIL || !this.config.SEED_ADMIN_PASSWORD) {
      if ((await this.repository.count()) === 0) this.logger.warn('No users exist and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set — nobody can sign in.');
      return;
    }
    const email = this.config.SEED_ADMIN_EMAIL.toLowerCase();
    const passwordHash = this.passwords.hash(this.config.SEED_ADMIN_PASSWORD);
    // Count + insert in one transaction, so two instances starting together cannot both seed.
    const seeded = await this.prisma.transaction(async () => {
      if ((await this.repository.count()) > 0) return false;
      await this.repository.insertUser({ email, fullName: 'Administrator', role: 'ADMIN', passwordHash, createdAt: this.clock.nowIso() });
      return true;
    });
    if (seeded) this.logger.log(`Seeded administrator ${email}`);
  }

  async getStored(userId: string): Promise<StoredUser> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundError('USER_NOT_FOUND', `User ${userId} does not exist`);
    return user;
  }

  getStoredOrUndefined(userId: string): Promise<StoredUser | undefined> {
    return this.repository.findUserById(userId);
  }

  findByEmail(email: string): Promise<StoredUser | undefined> {
    return this.repository.findUserByEmail(email.toLowerCase());
  }

  /** Loads every named user in one query and returns a synchronous lookup for view mappers. */
  async people(userIds: ReadonlyArray<string | null | undefined>): Promise<PersonLookup> {
    const ids = userIds.filter((userId): userId is string => Boolean(userId));
    const byId = new Map((await this.repository.findUsersByIds(ids)).map((user) => [user.userId, { userId: user.userId, fullName: user.fullName }]));
    return (userId) => (userId ? (byId.get(userId) ?? null) : null);
  }

  /** Like people(), plus the email — for showing a customer how to reach their loan officer. */
  async contacts(userIds: ReadonlyArray<string | null | undefined>): Promise<(userId: string | null | undefined) => PersonContact | null> {
    const ids = userIds.filter((userId): userId is string => Boolean(userId));
    const byId = new Map((await this.repository.findUsersByIds(ids)).map((user) => [user.userId, { userId: user.userId, fullName: user.fullName, email: user.email }]));
    return (userId) => (userId ? (byId.get(userId) ?? null) : null);
  }

  /** scrypt is deliberately slow: hash before entering a transaction so the write lock is not held while hashing. */
  hashPassword(plainPassword: string): string {
    return this.passwords.hash(plainPassword);
  }

  /** Joins the caller's transaction when there is one (invitation acceptance claims the invitation and creates the user together). */
  async createUser(input: { email: string; fullName: string; role: UserRole; passwordHash: string }): Promise<StoredUser> {
    const email = input.email.toLowerCase();
    return this.prisma.transaction(async () => {
      if (await this.repository.findUserByEmail(email)) throw new ConflictError('USER_ALREADY_EXISTS', 'A team member with this email already exists');
      return this.repository.insertUser({ email, fullName: input.fullName, role: input.role, passwordHash: input.passwordHash, createdAt: this.clock.nowIso() });
    });
  }

  /** Self-service password change. A wrong current password is a 422 on that field (never a 401, which means "signed out"). */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.getStored(userId);
    if (!this.passwords.verify(currentPassword, user.passwordHash)) throw fieldError('currentPassword', 'Current password is incorrect');
    if (currentPassword === newPassword) throw fieldError('newPassword', 'Choose a password you have not used just now');
    const passwordHash = this.passwords.hash(newPassword);
    await this.prisma.transaction(() => this.repository.setPasswordHash(userId, passwordHash));
  }

  async list(role?: UserRole): Promise<TeamMemberView[]> {
    return (await this.repository.listUsers(role)).map(toTeamMemberView);
  }

  async setStatus(userId: string, status: StoredUser['status'], actingUserId: string): Promise<TeamMemberView> {
    if (userId === actingUserId) throw new ConflictError('CANNOT_DISABLE_SELF', 'You cannot disable your own account');
    return this.prisma.transaction(async () => {
      const user = await this.getStored(userId);
      await this.repository.setUserStatus(userId, status);
      return toTeamMemberView({ ...user, status });
    });
  }
}
