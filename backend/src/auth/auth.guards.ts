import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, RequestWithUser, ROLES_KEY } from '../common/auth/auth.decorators';
import { IS_PORTAL_ROUTE_KEY } from '../portal/portal-session';
import { UserRole } from '../common/auth/authenticated-user';
import { ForbiddenError, UnauthorizedError } from '../common/errors/app-errors';
import { AuthService, SESSION_COOKIE_NAME } from './auth.service';

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  return cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/** Global guard: every route needs a valid session unless marked @Public(). Token comes from the HttpOnly cookie (or a Bearer header for API tools). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    // Customer-portal routes are authenticated by PortalAuthGuard from the portal cookie, never by a staff session.
    if (this.reflector.getAllAndOverride<boolean>(IS_PORTAL_ROUTE_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const bearer = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : undefined;
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME) ?? bearer;
    if (!token) throw new UnauthorizedError();

    request.user = await this.auth.authenticate(token);
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) return true;
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user || !requiredRoles.includes(user.role)) throw new ForbiddenError('You do not have permission to do this');
    return true;
  }
}
