import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

/** The signed-in portal customer. Every portal query is scoped by `customerId` from here — never from the request. */
export interface PortalSession {
  readonly accountId: string;
  readonly customerId: string;
  readonly fullName: string;
  readonly email: string;
}

export const IS_PORTAL_ROUTE_KEY = 'isPortalRoute';
export const PORTAL_COOKIE_NAME = 'portal_session';
export const PORTAL_SESSION_SECONDS = 8 * 60 * 60;
export const PORTAL_REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60;
/** Marks customer tokens so a portal session can never pass the staff guard (and vice versa). */
export const CUSTOMER_TOKEN_KIND = 'customer';

/**
 * A customer-portal route: the staff guard ignores it and the portal guard authenticates the customer from the
 * `portal_session` cookie instead. Combine with @Public() for the signed-out portal screens (login, invitation).
 */
export const PortalRoute = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PORTAL_ROUTE_KEY, true);

export type RequestWithCustomer = Request & { customer?: PortalSession };

export const CurrentCustomer = createParamDecorator((_data: unknown, context: ExecutionContext): PortalSession => {
  const customer = context.switchToHttp().getRequest<RequestWithCustomer>().customer;
  if (!customer) throw new Error('CurrentCustomer used on a route without a portal session');
  return customer;
});
