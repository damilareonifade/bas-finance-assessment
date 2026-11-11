import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { addDays, addMonths, CalendarDate, daysBetween, startOfMonth } from '../common/dates/calendar-date';
import { fieldError } from '../common/errors/app-errors';
import { addKobo, asKobo, Kobo, ZERO_KOBO } from '../common/money';
import { CustomersService } from '../customers/customers.service';
import { StoredCustomer } from '../customers/customers.repository';
import { InvoicesService } from '../invoice-financing/invoices.service';
import { StoredInvoice } from '../invoice-financing/invoices.repository';
import { LedgerRepository } from '../ledger/ledger.repository';
import { LoanProductsService } from '../loan-products/loan-products.service';
import { StoredLoanProduct } from '../loan-products/loan-products.repository';
import { outstandingOnInstalment, outstandingPrincipalKobo, overdueKobo } from '../term-loans/term-loan.view';
import { StoredTermLoan } from '../term-loans/term-loans.repository';
import { TermLoansService } from '../term-loans/term-loans.service';
import { InvitationsService } from '../users/invitations.service';
import { UsersService } from '../users/users.service';
import { DailyTotals, DashboardTrendsRepository } from './dashboard-trends.repository';
import {
  CollectionRowView,
  CollectionsView,
  CustomerDetailView,
  CustomerSummaryView,
  DashboardTrends,
  LoanProductDetailView,
  MonthToDate,
  PeriodComparison,
  OfficerRef,
  ProductCustomerView,
} from './admin.views';

/** Read-side aggregation across customers, loans, invoices, products and the ledger. */
@Injectable()
export class PortfolioService {
  constructor(
    private readonly customers: CustomersService,
    private readonly termLoans: TermLoansService,
    private readonly invoices: InvoicesService,
    private readonly products: LoanProductsService,
    private readonly users: UsersService,
    private readonly invitations: InvitationsService,
    private readonly ledger: LedgerRepository,
    private readonly clock: Clock,
    private readonly trendsRepository: DashboardTrendsRepository,
  ) {}

  /* ---------------- customers ---------------- */

  async listCustomers(actor: AuthenticatedUser, filter: { search?: string; officerId?: string; unassignedOnly?: boolean }): Promise<CustomerSummaryView[]> {
    const visible = await this.customers.listVisibleTo(actor, {
      search: filter.search,
      assignedOfficerId: filter.officerId,
      unassignedOnly: filter.unassignedOnly,
    });
    const book = await this.loadBook();
    return visible.map((customer) => this.summarise(customer, book));
  }

  async customerDetail(actor: AuthenticatedUser, customerId: string): Promise<CustomerDetailView> {
    const customer = await this.customers.getStored(customerId);
    await this.customers.assertCanView(actor, customerId);
    const book = await this.loadBook({ customerId });
    const today = this.clock.today();
    const productNames = new Map((await this.products.list()).map((product) => [product.productId, product.name]));
    return {
      customer: this.summarise(customer, book),
      loans: (book.loansByCustomer.get(customerId) ?? []).map((loan) => ({
        loanId: loan.loanId,
        productName: loan.loanProductId ? (productNames.get(loan.loanProductId) ?? null) : null,
        principalKobo: loan.principalKobo,
        outstandingPrincipalKobo: outstandingPrincipalKobo(loan),
        overdueKobo: overdueKobo(loan, today),
        disbursedOn: loan.disbursedOn,
      })),
      invoices: (book.invoicesByCustomer.get(customerId) ?? []).map((invoice) => ({
        invoiceId: invoice.invoiceId,
        productName: invoice.loanProductId ? (productNames.get(invoice.loanProductId) ?? null) : null,
        faceValueKobo: invoice.faceValueKobo,
        advanceKobo: invoice.advanceKobo,
        dueDate: invoice.dueDate,
        status: invoice.status,
        isOverdue: invoice.status === 'ADVANCED' && invoice.dueDate < today,
      })),
    };
  }

  /* ---------------- loan products ---------------- */

  async productDetail(productId: string): Promise<LoanProductDetailView> {
    const product = await this.products.getStored(productId);
    return this.describeProduct(product, await this.productCustomerRows(product, await this.loadBook()));
  }

  private describeProduct(product: StoredLoanProduct, rows: ProductCustomerView[]): LoanProductDetailView {
    return {
      product,
      stats: {
        customerCount: rows.length,
        facilityCount: rows.reduce((total, row) => total + row.facilityCount, 0),
        outstandingKobo: addKobo(...rows.map((row) => row.outstandingKobo)),
      },
    };
  }

  /** One load of the book for every product on the page. */
  async listProducts(status?: 'ACTIVE' | 'ARCHIVED'): Promise<LoanProductDetailView[]> {
    const [products, book] = await Promise.all([this.products.list(status), this.loadBook()]);
    return Promise.all(products.map(async (product) => this.describeProduct(product, await this.productCustomerRows(product, book))));
  }

  /** Everyone with a loan or invoice written under this product. */
  async productCustomers(productId: string): Promise<ProductCustomerView[]> {
    return this.productCustomerRows(await this.products.getStored(productId), await this.loadBook());
  }

  /* ---------------- collections ---------------- */

  /** An officer's book: assigned customers ranked by what is overdue — who to call first. */
  async collections(actor: AuthenticatedUser, requestedOfficerId?: string): Promise<CollectionsView> {
    const officerId = actor.role === 'LOAN_OFFICER' ? actor.userId : requestedOfficerId;
    if (actor.role === 'ADMIN' && requestedOfficerId) {
      const officer = await this.users.getStoredOrUndefined(requestedOfficerId);
      if (!officer || officer.role !== 'LOAN_OFFICER') throw fieldError('officerId', 'Choose a loan officer');
    }
    const assigned = await this.customers.listVisibleTo(actor, { assignedOfficerId: officerId });
    const customersInBook = officerId ? assigned : assigned.filter((customer) => customer.assignedOfficerId !== null);
    const book = await this.loadBook();
    const today = this.clock.today();

    const rows: CollectionRowView[] = customersInBook.map((customer) => {
      const summary = this.summarise(customer, book);
      const loans = book.loansByCustomer.get(customer.customerId) ?? [];
      const overdueDueDates = loans.flatMap((loan) =>
        loan.schedule
          .filter((instalment) => instalment.dueDate < today && this.stillOwed(instalment))
          .map((instalment) => instalment.dueDate),
      );
      const upcomingDueDates = loans.flatMap((loan) =>
        loan.schedule.filter((instalment) => instalment.dueDate >= today && this.stillOwed(instalment)).map((instalment) => instalment.dueDate),
      );
      const earliestOverdue = [...overdueDueDates].sort()[0];
      return {
        ...summary,
        needsFollowUp: summary.overdueKobo > 0 || summary.overdueInvoiceCount > 0,
        overdueInstalments: overdueDueDates.length,
        oldestOverdueDays: earliestOverdue ? daysBetween(earliestOverdue, today) : 0,
        nextDueDate: [...upcomingDueDates].sort()[0] ?? null,
      };
    });
    rows.sort((left, right) => right.overdueKobo - left.overdueKobo || right.oldestOverdueDays - left.oldestOverdueDays || left.fullName.localeCompare(right.fullName));

    const officerRecord = officerId ? await this.users.getStoredOrUndefined(officerId) : undefined;
    return {
      asOf: today,
      officer: officerRecord ? { userId: officerRecord.userId, fullName: officerRecord.fullName } : null,
      totals: {
        customers: rows.length,
        customersToChase: rows.filter((row) => row.needsFollowUp).length,
        overdueKobo: addKobo(...rows.map((row) => row.overdueKobo)),
        outstandingPrincipalKobo: addKobo(...rows.map((row) => row.outstandingPrincipalKobo)),
      },
      customers: rows,
    };
  }

  /* ---------------- dashboard ---------------- */

  async dashboard() {
    const today = this.clock.today();
    const [allCustomers, book, officers, admins, invitations, activeProducts, archivedProducts] = await Promise.all([
      this.customers.listAll(),
      this.loadBook(),
      this.users.list('LOAN_OFFICER'),
      this.users.list('ADMIN'),
      this.invitations.list(),
      this.products.list('ACTIVE'),
      this.products.list('ARCHIVED'),
    ]);
    const balance = (account: Parameters<LedgerRepository['accountBalanceKobo']>[0]) => this.ledger.accountBalanceKobo(account);
    const [loansReceivableKobo, invoiceReceivablesKobo, clientReceivableKobo, unappliedCreditKobo, interestIncomeKobo, feeIncomeKobo, penaltyIncomeKobo] = await Promise.all([
      balance('LOANS_RECEIVABLE'),
      balance('INVOICE_RECEIVABLES'),
      balance('CLIENT_RECEIVABLE'),
      balance('UNAPPLIED_CREDIT'),
      balance('INTEREST_INCOME'),
      balance('FEE_INCOME'),
      balance('PENALTY_INCOME'),
    ]);
    const loans = [...book.allLoans];
    const outstandingTotal = addKobo(...loans.map((loan) => outstandingPrincipalKobo(loan)));
    const overdueTotal = addKobo(...loans.map((loan) => overdueKobo(loan, today)));
    const advancedInvoices = book.allInvoices.filter((invoice) => invoice.status === 'ADVANCED');

    return {
      asOf: today,
      customers: { total: allCustomers.length, unassigned: allCustomers.filter((customer) => customer.assignedOfficerId === null).length },
      team: {
        officers: officers.filter((officer) => officer.status === 'ACTIVE').length,
        admins: admins.length,
        pendingInvitations: invitations.filter((invitation) => invitation.status === 'PENDING').length,
      },
      products: { active: activeProducts.length, archived: archivedProducts.length },
      loans: {
        count: loans.length,
        outstandingPrincipalKobo: outstandingTotal,
        overdueKobo: overdueTotal,
        overdueLoanCount: loans.filter((loan) => overdueKobo(loan, today) > 0).length,
      },
      invoices: {
        advancedCount: advancedInvoices.length,
        outstandingAdvanceKobo: addKobo(...advancedInvoices.map((invoice) => invoice.advanceKobo)),
        overdueCount: advancedInvoices.filter((invoice) => invoice.dueDate < today).length,
      },
      ledger: {
        loansReceivableKobo,
        invoiceReceivablesKobo,
        clientReceivableKobo,
        unappliedCreditKobo: asKobo(-unappliedCreditKobo),
        interestIncomeKobo: asKobo(-interestIncomeKobo),
        feeIncomeKobo: asKobo(-feeIncomeKobo),
        penaltyIncomeKobo: asKobo(-penaltyIncomeKobo),
        /** Integrity check: the general ledger's Loans Receivable must equal the schedules' outstanding principal. */
        loansReceivableTiesToSchedules: loansReceivableKobo === outstandingTotal,
      },
      ...(await this.trendsFor(today)),
      officerWorkload: officers.map((officer) => {
        const assigned = allCustomers.filter((customer) => customer.assignedOfficerId === officer.userId);
        return {
          officer: { userId: officer.userId, fullName: officer.fullName },
          status: officer.status,
          customerCount: assigned.length,
          overdueKobo: addKobo(...assigned.map((customer) => this.summarise(customer, book).overdueKobo)),
        };
      }),
    };
  }

  /** Last-30-days series (sparklines + chart) and month-to-date vs the same days last month. */
  private async trendsFor(today: CalendarDate): Promise<{ trends: DashboardTrends; monthToDate: MonthToDate }> {
    const windowStart = addDays(today, -29);
    const thisMonthStart = startOfMonth(today);
    const lastMonthStart = addMonths(thisMonthStart, -1);
    const lastMonthEnd = addDays(thisMonthStart, -1);
    const fetchFrom = [windowStart, lastMonthStart].sort()[0] as string;

    const [disbursed, collected, advances, newCustomers] = await Promise.all([
      this.trendsRepository.disbursedByDay(fetchFrom, today),
      this.trendsRepository.collectedByDay(fetchFrom, today),
      this.trendsRepository.invoiceAdvancesByDay(fetchFrom, today),
      this.trendsRepository.newCustomersByDay(fetchFrom, today),
    ]);

    const days = Array.from({ length: 30 }, (_, index) => addDays(windowStart, index));
    const dailyKobo = (source: DailyTotals) => days.map((day) => asKobo(source.get(day) ?? 0));

    const dayOfMonth = Number(today.slice(8, 10));
    const previousEnd = [addDays(lastMonthStart, dayOfMonth - 1), lastMonthEnd].sort()[0] as string;
    const sumBetween = (source: DailyTotals, start: string, end: string): number =>
      [...source.entries()].reduce((total, [day, value]) => (day >= start && day <= end ? total + value : total), 0);
    const compare = (source: DailyTotals): PeriodComparison => {
      const current = sumBetween(source, thisMonthStart, today);
      const previous = sumBetween(source, lastMonthStart, previousEnd);
      return { current, previous, changePercent: previous === 0 ? null : Math.round(((current - previous) * 1000) / previous) / 10 };
    };
    const compareKobo = (source: DailyTotals): PeriodComparison<Kobo> => {
      const { current, previous, changePercent } = compare(source);
      return { current: asKobo(current), previous: asKobo(previous), changePercent };
    };

    return {
      trends: { days, disbursedKobo: dailyKobo(disbursed), collectedKobo: dailyKobo(collected), invoiceAdvancesKobo: dailyKobo(advances), newCustomers: days.map((day) => newCustomers.get(day) ?? 0) },
      monthToDate: { disbursed: compareKobo(disbursed), collected: compareKobo(collected), invoiceAdvances: compareKobo(advances), newCustomers: compare(newCustomers) },
    };
  }

  /* ---------------- helpers ---------------- */

  private stillOwed(instalment: StoredTermLoan['schedule'][number]): boolean {
    const outstanding = outstandingOnInstalment(instalment);
    return outstanding.interestKobo + outstanding.principalKobo > 0;
  }

  /** Loans, invoices and every team member's name, loaded once per request (optionally for one customer). */
  private async loadBook(scope: { customerId?: string } = {}) {
    const [allLoans, allInvoices, team] = await Promise.all([
      this.termLoans.listStored(scope.customerId ? { customerId: scope.customerId } : {}),
      this.invoices.list(scope.customerId ? { customerId: scope.customerId } : {}),
      this.users.list(),
    ]);
    const loansByCustomer = new Map<string, StoredTermLoan[]>();
    const invoicesByCustomer = new Map<string, StoredInvoice[]>();
    for (const loan of allLoans) {
      if (loan.customerId) loansByCustomer.set(loan.customerId, [...(loansByCustomer.get(loan.customerId) ?? []), loan]);
    }
    for (const invoice of allInvoices) {
      if (invoice.customerId) invoicesByCustomer.set(invoice.customerId, [...(invoicesByCustomer.get(invoice.customerId) ?? []), invoice]);
    }
    const people = new Map(team.map((member) => [member.userId, { userId: member.userId, fullName: member.fullName }]));
    return { allLoans, allInvoices, loansByCustomer, invoicesByCustomer, people };
  }

  private officerRef(officerId: string | null, book: Book): OfficerRef | null {
    return officerId ? (book.people.get(officerId) ?? null) : null;
  }

  private summarise(customer: StoredCustomer, book: Book): CustomerSummaryView {
    const today = this.clock.today();
    const loans = book.loansByCustomer.get(customer.customerId) ?? [];
    const invoices = book.invoicesByCustomer.get(customer.customerId) ?? [];
    return {
      customerId: customer.customerId,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      assignedOfficer: this.officerRef(customer.assignedOfficerId, book),
      createdAt: customer.createdAt,
      loanCount: loans.length,
      invoiceCount: invoices.length,
      outstandingPrincipalKobo: addKobo(...loans.map((loan) => outstandingPrincipalKobo(loan))),
      overdueKobo: addKobo(...loans.map((loan) => overdueKobo(loan, today))),
      overdueInvoiceCount: invoices.filter((invoice) => invoice.status === 'ADVANCED' && invoice.dueDate < today).length,
    };
  }

  private async productCustomerRows(product: StoredLoanProduct, book: Book): Promise<ProductCustomerView[]> {
    const byCustomer = new Map<string, { facilityCount: number; outstandingKobo: Kobo }>();
    const bump = (customerId: string | null, outstandingKobo: Kobo) => {
      if (!customerId) return;
      const current = byCustomer.get(customerId) ?? { facilityCount: 0, outstandingKobo: ZERO_KOBO };
      byCustomer.set(customerId, { facilityCount: current.facilityCount + 1, outstandingKobo: addKobo(current.outstandingKobo, outstandingKobo) });
    };
    for (const loan of book.allLoans) if (loan.loanProductId === product.productId) bump(loan.customerId, outstandingPrincipalKobo(loan));
    for (const invoice of book.allInvoices) {
      if (invoice.loanProductId === product.productId) bump(invoice.customerId, invoice.status === 'ADVANCED' ? invoice.advanceKobo : ZERO_KOBO);
    }
    const customers = new Map((await this.customers.findByIds([...byCustomer.keys()])).map((customer) => [customer.customerId, customer]));
    return [...byCustomer.entries()].flatMap(([customerId, totals]) => {
      const customer = customers.get(customerId);
      return customer ? [{ customerId, fullName: customer.fullName, assignedOfficer: this.officerRef(customer.assignedOfficerId, book), ...totals }] : [];
    });
  }
}

type Book = Awaited<ReturnType<PortfolioService['loadBook']>>;
