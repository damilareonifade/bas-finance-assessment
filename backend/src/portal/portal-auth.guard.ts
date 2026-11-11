import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/auth/auth.decorators';
import { UnauthorizedError } from '../common/errors/app-errors';
import { readCookie } from '../auth/auth.guards';
import { PortalAuthService } from './portal-auth.service';
import { IS_PORTAL_ROUTE_KEY, PORTAL_COOKIE_NAME, RequestWithCustomer } from './portal-session';

/**
 * Global guard for @PortalRoute() handlers (it ignores every other route). Reads only the portal cookie, so the staff
 * session cookie is never consulted on portal routes and a portal session never reaches staff routes.
 */
@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly portalAuth: PortalAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (!this.reflector.getAllAndOverride<boolean>(IS_PORTAL_ROUTE_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const request = context.switchToHttp().getRequest<RequestWithCustomer>();
    const token = readCookie(request.headers.cookie, PORTAL_COOKIE_NAME);
    if (!token) throw new UnauthorizedError();
    request.customer = await this.portalAuth.authenticate(token);
    return true;
  }
}
