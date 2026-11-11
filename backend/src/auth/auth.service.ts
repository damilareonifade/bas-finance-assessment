import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, UserRole } from '../common/auth/authenticated-user';
import { ForbiddenError, UnauthorizedError } from '../common/errors/app-errors';
import { PasswordService } from '../users/password.service';
import { StoredUser } from '../users/users.repository';
import { toAuthenticatedUser, UsersService } from '../users/users.service';

interface SessionPayload {
  sub: string;
  role: UserRole;
  /** 'staff' on every staff token; customer-portal tokens carry 'customer' and are refused here. */
  kind?: 'staff' | 'customer';
}

export const SESSION_COOKIE_NAME = 'access_token';
export const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
/** "Remember me" keeps the session for 30 days instead of a working day. */
export const REMEMBERED_SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

export const sessionLifetimeSeconds = (rememberMe: boolean): number => (rememberMe ? REMEMBERED_SESSION_LIFETIME_SECONDS : SESSION_LIFETIME_SECONDS);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, rememberMe = false): Promise<{ user: AuthenticatedUser; token: string }> {
    const stored = await this.users.findByEmail(email);
    // Same error for "no such user" and "wrong password" so accounts cannot be enumerated.
    if (!stored || !this.passwords.verify(password, stored.passwordHash)) throw new UnauthorizedError('Incorrect email or password', 'INVALID_CREDENTIALS');
    if (stored.status !== 'ACTIVE') throw new ForbiddenError('This account has been disabled', 'ACCOUNT_DISABLED');
    return { user: toAuthenticatedUser(stored), token: this.issueToken(stored, rememberMe) };
  }

  issueToken(user: StoredUser, rememberMe = false): string {
    const payload: SessionPayload = { sub: user.userId, role: user.role, kind: 'staff' };
    return this.jwt.sign(payload, { expiresIn: sessionLifetimeSeconds(rememberMe) });
  }

  /** Resolves a token to a live, active user (so disabling an account takes effect immediately). */
  async authenticate(token: string): Promise<AuthenticatedUser> {
    let payload: SessionPayload;
    try {
      payload = this.jwt.verify<SessionPayload>(token);
    } catch {
      throw new UnauthorizedError('Your session has expired — please sign in again', 'SESSION_EXPIRED');
    }
    if (payload.kind === 'customer') throw new UnauthorizedError('Your session is no longer valid', 'SESSION_INVALID');
    const stored = await this.users.getStoredOrUndefined(payload.sub);
    if (!stored || stored.status !== 'ACTIVE') throw new UnauthorizedError('Your session is no longer valid', 'SESSION_INVALID');
    return toAuthenticatedUser(stored);
  }
}
