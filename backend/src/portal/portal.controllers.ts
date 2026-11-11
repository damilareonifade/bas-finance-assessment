import { Body, Controller, Get, HttpCode, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, Public, Roles } from '../common/auth/auth.decorators';
import { CustomerNotificationsService } from '../customer-notifications/customer-notifications.service';
import { CustomerDocumentsService, UploadedDocumentFile } from '../customer-documents/customer-documents.service';
import { MAX_DOCUMENT_BYTES } from '../customer-documents/document-rules';
import { LoanApplicationsService } from '../loan-applications/loan-applications.service';
import {
  InviteCustomerToPortalDto,
  PortalAcceptInvitationDto,
  PortalApplicationDto,
  PortalChangePasswordDto,
  PortalLoginDto,
  PortalQuoteDto,
  PortalSubmitDocumentDto,
  SetPortalAccessDto,
} from './dto/portal.dto';
import { PortalAuthService, portalSessionSeconds } from './portal-auth.service';
import { CurrentCustomer, PORTAL_COOKIE_NAME, PortalRoute, PortalSession } from './portal-session';
import { PortalService } from './portal.service';

function setPortalCookie(response: Response, token: string, rememberMe: boolean): void {
  response.cookie(PORTAL_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: portalSessionSeconds(rememberMe) * 1000,
    path: '/',
  });
}

/** Customer sign-in. Separate cookie from staff (`access_token`), so both can be open in one browser without mixing. */
@Controller('portal/auth')
@PortalRoute()
export class PortalAuthController {
  constructor(private readonly portalAuth: PortalAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: PortalLoginDto, @Res({ passthrough: true }) response: Response): Promise<{ customer: PortalSession }> {
    const rememberMe = body.rememberMe === true;
    const { session, token } = await this.portalAuth.login(body.email, body.password, rememberMe);
    setPortalCookie(response, token, rememberMe);
    return { customer: session };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(PORTAL_COOKIE_NAME, { path: '/' });
  }

  @Get('me')
  me(@CurrentCustomer() customer: PortalSession): { customer: PortalSession } {
    return { customer };
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(@Body() body: PortalChangePasswordDto, @CurrentCustomer() customer: PortalSession): Promise<void> {
    await this.portalAuth.changePassword(customer, body.currentPassword, body.newPassword);
  }

  @Public()
  @Get('invitations/:token')
  describeInvitation(@Param('token') token: string) {
    return this.portalAuth.describeInvitation(token);
  }

  @Public()
  @Post('accept-invitation')
  async acceptInvitation(@Body() body: PortalAcceptInvitationDto, @Res({ passthrough: true }) response: Response): Promise<{ customer: PortalSession }> {
    const { session, token } = await this.portalAuth.acceptInvitation(body.token, body.password);
    setPortalCookie(response, token, false);
    return { customer: session };
  }
}

/** Everything a signed-in customer can do. The customer id always comes from the session. */
@Controller('portal')
@PortalRoute()
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly applications: LoanApplicationsService,
    private readonly documents: CustomerDocumentsService,
    private readonly notifications: CustomerNotificationsService,
  ) {}

  @Get('overview')
  overview(@CurrentCustomer() customer: PortalSession) {
    return this.portal.overview(customer.customerId);
  }

  @Get('loans')
  loans(@CurrentCustomer() customer: PortalSession) {
    return this.portal.loans(customer.customerId);
  }

  @Get('loans/:loanId')
  loan(@Param('loanId') loanId: string, @CurrentCustomer() customer: PortalSession) {
    return this.portal.loan(customer.customerId, loanId);
  }

  @Get('invoices')
  invoices(@CurrentCustomer() customer: PortalSession) {
    return this.portal.invoices(customer.customerId);
  }

  @Get('invoices/:invoiceId')
  invoice(@Param('invoiceId') invoiceId: string, @CurrentCustomer() customer: PortalSession) {
    return this.portal.invoice(customer.customerId, invoiceId);
  }

  @Get('products')
  products() {
    return this.portal.productsOnOffer();
  }

  @Post('quote')
  @HttpCode(200)
  quote(@Body() body: PortalQuoteDto) {
    return this.portal.quote(body);
  }

  @Get('applications')
  listApplications(@CurrentCustomer() customer: PortalSession) {
    return this.applications.listForCustomer(customer.customerId);
  }

  @Post('applications')
  apply(@Body() body: PortalApplicationDto, @CurrentCustomer() customer: PortalSession) {
    return this.applications.submitFromPortal(customer.customerId, body);
  }

  @Get('documents')
  listDocuments(@CurrentCustomer() customer: PortalSession) {
    return this.documents.listForPortal(customer.customerId);
  }

  /** multipart/form-data: type, identifier?, file? — same rules as staff submissions. */
  @Post('documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES + 1024 * 1024, files: 1 } }))
  submitDocument(@Body() body: PortalSubmitDocumentDto, @UploadedFile() file: UploadedDocumentFile | undefined, @CurrentCustomer() customer: PortalSession) {
    return this.documents.submitFromPortal(customer.customerId, body.type, body.identifier, file);
  }

  @Get('notifications')
  inbox(@CurrentCustomer() customer: PortalSession) {
    return this.notifications.inbox(customer.customerId);
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  markAllRead(@CurrentCustomer() customer: PortalSession) {
    return this.notifications.markAllRead(customer.customerId);
  }

  @Post('notifications/:notificationId/read')
  @HttpCode(200)
  markRead(@Param('notificationId') notificationId: string, @CurrentCustomer() customer: PortalSession) {
    return this.notifications.markRead(customer.customerId, notificationId);
  }
}

/** Staff side: a customer's portal sign-in, on their profile. Admins and the customer's own officer. */
@Controller('customers/:customerId/portal-access')
export class CustomerPortalAccessController {
  constructor(private readonly portalAuth: PortalAuthService) {}

  @Get()
  access(@Param('customerId') customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.portalAuth.access(user, customerId);
  }

  /** Returns the one-time link to share with the customer (no email is sent in this scope). */
  @Post('invitation')
  invite(@Param('customerId') customerId: string, @Body() body: InviteCustomerToPortalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.portalAuth.invite(user, customerId, body.email);
  }

  @Patch()
  @Roles('ADMIN')
  setStatus(@Param('customerId') customerId: string, @Body() body: SetPortalAccessDto) {
    return this.portalAuth.setStatus(customerId, body.status);
  }
}
