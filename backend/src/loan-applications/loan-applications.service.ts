import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { ConflictError, fieldError, ForbiddenError, NotFoundError } from '../common/errors/app-errors';
import { IdempotencyContext, IdempotencyService } from '../common/idempotency/idempotency.service';
import { asKobo, formatKoboForMessage, Kobo } from '../common/money';
import { CustomerDocumentsService, VerificationSummary } from '../customer-documents/customer-documents.service';
import { CustomerNotificationsService } from '../customer-notifications/customer-notifications.service';
import { CustomersService } from '../customers/customers.service';
import { PrismaService } from '../database/prisma.service';
import { JournalEntry } from '../ledger/ledger.repository';
import { LoanProductsService } from '../loan-products/loan-products.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TermLoanView } from '../term-loans/term-loan.view';
import { PersonLookup, PersonRef, UsersService } from '../users/users.service';
import { TermLoanQuote, TermLoansService } from '../term-loans/term-loans.service';
import { ApproveApplicationDto, CreateLoanApplicationDto } from './dto/loan-application.dto';
import { ApplicationChannel, ApplicationFilter, ApplicationStatus, LoanApplicationsRepository, OPEN_APPLICATION_STATUSES, StoredApplication } from './loan-applications.repository';

export interface ApplicationView {
  applicationId: string;
  status: ApplicationStatus;
  customer: { customerId: string; fullName: string; email: string | null; phone: string | null };
  product: { productId: string; name: string } | null;
  principalKobo: Kobo;
  annualRatePercent: number;
  termMonths: number;
  purpose: string | null;
  assignedOfficer: PersonRef | null;
  /** STAFF: entered by submittedBy. PORTAL: the applicant applied online themselves. */
  channel: ApplicationChannel;
  submittedBy: PersonRef | null;
  submittedAt: string;
  reviewedBy: PersonRef | null;
  reviewStartedAt: string | null;
  /** Who approved or rejected it, and when. */
  decidedBy: PersonRef | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  loanId: string | null;
}

export interface ApplicationDetail extends ApplicationView {
  /** The applicant's KYC documents, by status. */
  verification: VerificationSummary;
  /** The customer's own loan officer (may differ from the application's). */
  customerOfficer: PersonRef | null;
  /** Server-computed schedule for the requested terms. */
  quote: TermLoanQuote;
}

export interface ApprovedApplication {
  application: ApplicationDetail;
  loan: TermLoanView;
  journalEntry: JournalEntry;
}

export interface ApplicationListQuery {
  readonly statuses?: readonly ApplicationStatus[];
  readonly assignedOfficerId?: string;
  readonly decidedBy?: string;
  readonly customerId?: string;
  readonly search?: string;
}

/** What a customer sees about their own applications in the portal (no staff names). */
export interface PortalApplicationView {
  applicationId: string;
  status: ApplicationStatus;
  product: { productId: string; name: string } | null;
  principalKobo: Kobo;
  annualRatePercent: number;
  termMonths: number;
  purpose: string | null;
  submittedAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
  loanId: string | null;
}

/** A customer's own application from the portal: they pick a product, the amount and the term; the rate is the product's. */
export interface PortalApplicationRequest {
  readonly loanProductId: string;
  readonly principalKobo: number;
  readonly termMonths: number;
  readonly purpose?: string;
}

@Injectable()
export class LoanApplicationsService {
  constructor(
    private readonly repository: LoanApplicationsRepository,
    private readonly customers: CustomersService,
    private readonly products: LoanProductsService,
    private readonly termLoans: TermLoansService,
    private readonly documents: CustomerDocumentsService,
    private readonly notifications: NotificationsService,
    private readonly customerNotifications: CustomerNotificationsService,
    private readonly idempotency: IdempotencyService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /** The application and its notifications commit together. */
  async submit(request: CreateLoanApplicationDto, actor: AuthenticatedUser): Promise<ApplicationDetail> {
    const applicationId = await this.prisma.transaction(async () => {
      await this.customers.assertCanTransactFor(actor, request.customerId);
      const customer = await this.customers.getStored(request.customerId);
      if (request.loanProductId) {
        await this.products.assertFacilityFits(request.loanProductId, 'TERM_LOAN', {
          principalKobo: request.principalKobo,
          annualRatePercent: request.annualRatePercent,
          termMonths: request.termMonths,
        });
      }
      const newId = await this.repository.insert({
        customerId: request.customerId,
        loanProductId: request.loanProductId ?? null,
        principalKobo: asKobo(request.principalKobo),
        annualRatePercent: request.annualRatePercent,
        termMonths: request.termMonths,
        purpose: request.purpose?.trim() || null,
        assignedOfficerId: customer.assignedOfficerId,
        channel: 'STAFF',
        submittedBy: actor.userId,
        submittedAt: this.clock.nowIso(),
      });
      await this.notifications.notify(
        [...(await this.notifications.activeAdminIds()), customer.assignedOfficerId],
        {
          kind: 'APPLICATION_SUBMITTED',
          title: 'New loan application',
          body: `${customer.fullName} applied for ${formatKoboForMessage(asKobo(request.principalKobo))} over ${request.termMonths} months.`,
          link: `/applications/${newId}`,
        },
        actor.userId,
      );
      await this.notifyCustomerReceived(request.customerId, newId, asKobo(request.principalKobo));
      return newId;
    });
    return this.detail(await this.mustFind(applicationId));
  }

  /**
   * The applicant applies online. The customer is the signed-in portal customer (never taken from the request).
   * Rate = the product's advertised (minimum) rate; staff see the application in their queue like any other.
   */
  async submitFromPortal(customerId: string, request: PortalApplicationRequest): Promise<PortalApplicationView> {
    const applicationId = await this.prisma.transaction(async () => {
      const customer = await this.customers.getStored(customerId);
      const product = await this.products.getStored(request.loanProductId).catch(() => undefined);
      if (!product || product.type !== 'TERM_LOAN' || product.status !== 'ACTIVE' || product.minAnnualRatePercent === null) {
        throw fieldError('loanProductId', 'Choose one of the loans on offer');
      }
      const annualRatePercent = product.minAnnualRatePercent;
      await this.products.assertFacilityFits(product.productId, 'TERM_LOAN', { principalKobo: request.principalKobo, annualRatePercent, termMonths: request.termMonths });
      const newId = await this.repository.insert({
        customerId,
        loanProductId: product.productId,
        principalKobo: asKobo(request.principalKobo),
        annualRatePercent,
        termMonths: request.termMonths,
        purpose: request.purpose?.trim() || null,
        assignedOfficerId: customer.assignedOfficerId,
        channel: 'PORTAL',
        submittedBy: null,
        submittedAt: this.clock.nowIso(),
      });
      await this.notifications.notify([...(await this.notifications.activeAdminIds()), customer.assignedOfficerId], {
        kind: 'APPLICATION_SUBMITTED',
        title: 'New online loan application',
        body: `${customer.fullName} applied online for ${formatKoboForMessage(asKobo(request.principalKobo))} over ${request.termMonths} months.`,
        link: `/applications/${newId}`,
      });
      await this.notifyCustomerReceived(customerId, newId, asKobo(request.principalKobo));
      return newId;
    });
    return (await this.listForCustomer(customerId)).find((application) => application.applicationId === applicationId) as PortalApplicationView;
  }

  async listForCustomer(customerId: string): Promise<PortalApplicationView[]> {
    const [applications, products] = await Promise.all([this.repository.list({ customerId }), this.products.list()]);
    const productById = new Map(products.map((product) => [product.productId, product]));
    return applications.map((application) => {
      const product = application.loanProductId ? productById.get(application.loanProductId) : undefined;
      return {
        applicationId: application.applicationId,
        status: application.status,
        product: product ? { productId: product.productId, name: product.name } : null,
        principalKobo: application.principalKobo,
        annualRatePercent: application.annualRatePercent,
        termMonths: application.termMonths,
        purpose: application.purpose,
        submittedAt: application.submittedAt,
        decidedAt: application.decidedAt,
        rejectionReason: application.rejectionReason,
        loanId: application.loanId,
      };
    });
  }

  private notifyCustomerReceived(customerId: string, applicationId: string, principalKobo: Kobo): Promise<void> {
    return this.customerNotifications.notify(customerId, {
      kind: 'APPLICATION_RECEIVED',
      title: 'We received your loan application',
      body: `Application ${applicationId} for ${formatKoboForMessage(principalKobo)} is with our team. We will let you know when it is decided.`,
      link: '/portal',
    });
  }

  async list(actor: AuthenticatedUser, query: ApplicationListQuery = {}): Promise<ApplicationView[]> {
    const filter: ApplicationFilter = {
      ...query,
      ...(actor.role === 'ADMIN' ? {} : { visibleTo: { customerIds: await this.customers.idsInBookOf(actor.userId), officerId: actor.userId } }),
    };
    return this.views(await this.repository.list(filter));
  }

  async get(actor: AuthenticatedUser, applicationId: string): Promise<ApplicationDetail> {
    return this.detail(await this.requireVisible(actor, applicationId));
  }

  async startReview(actor: AuthenticatedUser, applicationId: string): Promise<ApplicationDetail> {
    await this.prisma.transaction(async () => {
      await this.requireVisible(actor, applicationId);
      if (!(await this.repository.startReview(applicationId, actor.userId, this.clock.nowIso()))) {
        throw new ConflictError('APPLICATION_NOT_SUBMITTED', 'Only a newly submitted application can be put under review');
      }
    });
    return this.detail(await this.mustFind(applicationId));
  }

  async assignOfficer(actor: AuthenticatedUser, applicationId: string, officerId: string | null): Promise<ApplicationDetail> {
    await this.prisma.transaction(async () => {
      const application = await this.requireVisible(actor, applicationId);
      this.assertOpen(application);
      if (officerId !== null) await this.customers.assertActiveOfficer(officerId, 'officerId');
      if (!(await this.repository.setOfficerWhileOpen(applicationId, officerId))) throw this.alreadyDecided(applicationId);
      if (officerId && officerId !== application.assignedOfficerId) {
        const customer = await this.customers.getStored(application.customerId);
        await this.notifications.notify(
          [officerId],
          { kind: 'APPLICATION_ASSIGNED', title: 'Loan application assigned to you', body: `${customer.fullName}'s application ${applicationId} is yours to review.`, link: `/applications/${applicationId}` },
          actor.userId,
        );
      }
    });
    return this.detail(await this.mustFind(applicationId));
  }

  /**
   * Approve = disburse. One transaction, once per Idempotency-Key:
   * claim the application (open → APPROVED, compare-and-set — a concurrent approve or reject loses here and posts nothing)
   * → write the loan with this approver and officer → post the disbursement → link the loan → assign the customer an officer
   * if they had none → notify.
   */
  approve(actor: AuthenticatedUser, applicationId: string, request: ApproveApplicationDto, idempotency: IdempotencyContext): Promise<ApprovedApplication> {
    return this.idempotency.execute(idempotency, { applicationId, ...request }, async () => {
      const application = await this.requireVisible(actor, applicationId);
      this.assertOpen(application);
      if (actor.role === 'LOAN_OFFICER' && request.officerId && request.officerId !== actor.userId) throw new ForbiddenError('Loan officers can only assign loans to themselves');
      const officerId = request.officerId ?? application.assignedOfficerId ?? (actor.role === 'LOAN_OFFICER' ? actor.userId : undefined) ?? undefined;

      if (!(await this.repository.claimForApproval(applicationId, { decidedBy: actor.userId, decidedAt: this.clock.nowIso(), officerId: officerId ?? null }))) {
        throw this.alreadyDecided(applicationId);
      }
      const { loan, journalEntry } = await this.termLoans.disburse(
        {
          principalKobo: application.principalKobo,
          annualRatePercent: application.annualRatePercent,
          termMonths: application.termMonths,
          customerId: application.customerId,
          loanProductId: application.loanProductId ?? undefined,
          disbursedOn: request.disbursedOn,
        },
        actor,
        { assignedOfficerId: officerId, applicationId },
      );
      await this.repository.attachLoan(applicationId, loan.loanId);

      // A customer with no officer yet gets the loan's officer, so someone follows them up for repayment.
      const customer = await this.customers.getStored(application.customerId);
      if (officerId && !customer.assignedOfficerId) await this.customers.assignOfficer(application.customerId, officerId, actor);

      await this.notifications.notify(
        [application.submittedBy, officerId],
        {
          kind: 'APPLICATION_APPROVED',
          title: 'Loan application approved',
          body: `${customer.fullName}'s application ${applicationId} was approved and ${loan.loanId} disbursed.`,
          link: `/loans/${loan.loanId}`,
        },
        actor.userId,
      );
      await this.customerNotifications.notify(application.customerId, {
        kind: 'APPLICATION_APPROVED',
        title: 'Your loan was approved',
        body: `Application ${applicationId} was approved and ${formatKoboForMessage(application.principalKobo)} disbursed as loan ${loan.loanId}.`,
        link: `/portal/loans/${loan.loanId}`,
      });
      return { application: await this.detail(await this.mustFind(applicationId)), loan, journalEntry };
    });
  }

  async reject(actor: AuthenticatedUser, applicationId: string, reason: string): Promise<ApplicationDetail> {
    await this.prisma.transaction(async () => {
      const application = await this.requireVisible(actor, applicationId);
      this.assertOpen(application);
      if (!(await this.repository.reject(applicationId, { decidedBy: actor.userId, decidedAt: this.clock.nowIso(), reason: reason.trim() }))) {
        throw this.alreadyDecided(applicationId);
      }
      const customer = await this.customers.getStored(application.customerId);
      await this.notifications.notify(
        [application.submittedBy, application.assignedOfficerId],
        { kind: 'APPLICATION_REJECTED', title: 'Loan application rejected', body: `${customer.fullName}'s application ${applicationId}: ${reason.trim()}`, link: `/applications/${applicationId}` },
        actor.userId,
      );
      await this.customerNotifications.notify(application.customerId, {
        kind: 'APPLICATION_REJECTED',
        title: 'Update on your loan application',
        body: `Application ${applicationId} was not approved: ${reason.trim()}`,
        link: '/portal',
      });
    });
    return this.detail(await this.mustFind(applicationId));
  }

  private assertOpen(application: StoredApplication): void {
    if (!OPEN_APPLICATION_STATUSES.includes(application.status)) {
      throw new ConflictError('APPLICATION_ALREADY_DECIDED', `Application ${application.applicationId} was already ${application.status.toLowerCase()}`);
    }
  }

  private alreadyDecided(applicationId: string): ConflictError {
    return new ConflictError('APPLICATION_ALREADY_DECIDED', `Application ${applicationId} was decided by someone else a moment ago`);
  }

  private async requireVisible(actor: AuthenticatedUser, applicationId: string): Promise<StoredApplication> {
    const application = await this.repository.findById(applicationId);
    if (!application) throw new NotFoundError('APPLICATION_NOT_FOUND', `Application ${applicationId} does not exist`);
    const isVisible = actor.role === 'ADMIN' || application.assignedOfficerId === actor.userId || (await this.customers.canView(actor, application.customerId));
    if (!isVisible) throw new ForbiddenError('This application is not in your book');
    return application;
  }

  private async mustFind(applicationId: string): Promise<StoredApplication> {
    const application = await this.repository.findById(applicationId);
    if (!application) throw new NotFoundError('APPLICATION_NOT_FOUND', `Application ${applicationId} does not exist`);
    return application;
  }

  /** Customers, products and people for a page of applications — three queries, not three per row. */
  private async views(applications: readonly StoredApplication[]): Promise<ApplicationView[]> {
    const [customers, products, person] = await Promise.all([
      this.customers.findByIds(applications.map((application) => application.customerId)),
      this.products.list(),
      this.users.people(applications.flatMap((application) => [application.assignedOfficerId, application.submittedBy, application.reviewedBy, application.decidedBy])),
    ]);
    const customerById = new Map(customers.map((customer) => [customer.customerId, customer]));
    const productById = new Map(products.map((product) => [product.productId, product]));
    return applications.map((application) => {
      const customer = customerById.get(application.customerId);
      if (!customer) throw new NotFoundError('CUSTOMER_NOT_FOUND', `Customer ${application.customerId} does not exist`);
      const product = application.loanProductId ? productById.get(application.loanProductId) : undefined;
      return this.toView(application, customer, product ? { productId: product.productId, name: product.name } : null, person);
    });
  }

  private toView(
    application: StoredApplication,
    customer: { customerId: string; fullName: string; email: string | null; phone: string | null },
    product: { productId: string; name: string } | null,
    person: PersonLookup,
  ): ApplicationView {
    return {
      applicationId: application.applicationId,
      status: application.status,
      customer: { customerId: customer.customerId, fullName: customer.fullName, email: customer.email, phone: customer.phone },
      product,
      principalKobo: application.principalKobo,
      annualRatePercent: application.annualRatePercent,
      termMonths: application.termMonths,
      purpose: application.purpose,
      assignedOfficer: person(application.assignedOfficerId),
      channel: application.channel,
      submittedBy: person(application.submittedBy),
      submittedAt: application.submittedAt,
      reviewedBy: person(application.reviewedBy),
      reviewStartedAt: application.reviewStartedAt,
      decidedBy: person(application.decidedBy),
      decidedAt: application.decidedAt,
      rejectionReason: application.rejectionReason,
      loanId: application.loanId,
    };
  }

  private async detail(application: StoredApplication): Promise<ApplicationDetail> {
    const [[view], customer, verification] = await Promise.all([
      this.views([application]),
      this.customers.getStored(application.customerId),
      this.documents.summaryFor(application.customerId),
    ]);
    const person = await this.users.people([customer.assignedOfficerId]);
    return {
      ...(view as ApplicationView),
      verification,
      customerOfficer: person(customer.assignedOfficerId),
      quote: this.termLoans.quote({ principalKobo: application.principalKobo, annualRatePercent: application.annualRatePercent, termMonths: application.termMonths }),
    };
  }
}
