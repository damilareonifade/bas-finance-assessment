import { Injectable } from '@nestjs/common';
import { Clock } from '../common/clock/clock';
import { fieldError, NotFoundError } from '../common/errors/app-errors';
import { addKobo, Kobo, subtractKobo, ZERO_KOBO } from '../common/money';
import { CustomerDocumentsService } from '../customer-documents/customer-documents.service';
import { CustomersService } from '../customers/customers.service';
import { LedgerRepository } from '../ledger/ledger.repository';
import { LoanApplicationsService, PortalApplicationView } from '../loan-applications/loan-applications.service';
import { LoanProductsService } from '../loan-products/loan-products.service';
import { StoredLoanProduct } from '../loan-products/loan-products.repository';
import { outstandingOnInstalment, outstandingPrincipalKobo, overdueKobo, TermLoanView, toTermLoanView } from '../term-loans/term-loan.view';
import { StoredTermLoan } from '../term-loans/term-loans.repository';
import { TermLoanQuote, TermLoansService } from '../term-loans/term-loans.service';
import { InvoicesRepository, StoredInvoice } from '../invoice-financing/invoices.repository';
import { PersonContact, UsersService } from '../users/users.service';
import { PortalInvoiceView, toPortalInvoiceView } from './portal-invoice.view';

export interface PortalLoanSummary {
  loanId: string;
  productName: string | null;
  principalKobo: Kobo;
  annualRatePercent: number;
  termMonths: number;
  instalmentKobo: Kobo;
  disbursedOn: string;
  outstandingPrincipalKobo: Kobo;
  overdueKobo: Kobo;
  /** The next instalment with something still owed, and how much is still owed on it. */
  nextPayment: { instalmentNumber: number; dueDate: string; amountDueKobo: Kobo } | null;
  status: 'ACTIVE' | 'PAID_OFF';
}

/** One line per posting, in the customer's terms (not the ledger's accounts). */
export interface PortalStatementRow {
  entryId: string;
  postedOn: string;
  kind: 'DISBURSEMENT' | 'PAYMENT' | 'OTHER';
  description: string;
  /** Money that moved: paid out to you (disbursement) or received from you (payment). */
  amountKobo: Kobo;
  principalKobo: Kobo;
  interestKobo: Kobo;
  /** Paid beyond everything owed — held as credit for you. */
  creditKobo: Kobo;
  /** Principal still owed after this line. */
  balanceAfterKobo: Kobo;
}

export interface PortalLoanDetail extends PortalLoanSummary {
  schedule: TermLoanView['schedule'];
  unappliedCreditKobo: Kobo;
  officer: PersonContact | null;
  statement: PortalStatementRow[];
}

export interface PortalProductView {
  productId: string;
  name: string;
  description: string | null;
  annualRatePercent: number;
  minPrincipalKobo: Kobo;
  maxPrincipalKobo: Kobo;
  minTermMonths: number;
  maxTermMonths: number;
}

export interface PortalOverview {
  customer: { customerId: string; fullName: string; email: string | null; phone: string | null };
  /** The customer's loan officer — who to contact. */
  officer: PersonContact | null;
  loans: PortalLoanSummary[];
  invoices: PortalInvoiceView[];
  applications: PortalApplicationView[];
  documents: { toProvide: number; awaitingReview: number; needsAttention: number; verified: number };
}

/**
 * Read side of the customer portal. Every method takes the customer id from the portal session; records belonging to
 * another customer answer 404 (not 403), so a customer cannot even learn that another id exists.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly customers: CustomersService,
    private readonly termLoans: TermLoansService,
    private readonly products: LoanProductsService,
    private readonly applications: LoanApplicationsService,
    private readonly documents: CustomerDocumentsService,
    private readonly ledger: LedgerRepository,
    private readonly invoiceStore: InvoicesRepository,
    private readonly users: UsersService,
    private readonly clock: Clock,
  ) {}

  async overview(customerId: string): Promise<PortalOverview> {
    const [customer, loans, invoices, applications, documents] = await Promise.all([
      this.customers.getStored(customerId),
      this.loans(customerId),
      this.invoices(customerId),
      this.applications.listForCustomer(customerId),
      this.documents.listForPortal(customerId),
    ]);
    const contacts = await this.users.contacts([customer.assignedOfficerId]);
    const count = (status: string) => documents.filter((document) => document.status === status).length;
    return {
      customer: { customerId: customer.customerId, fullName: customer.fullName, email: customer.email, phone: customer.phone },
      officer: contacts(customer.assignedOfficerId),
      loans,
      invoices,
      applications,
      documents: { toProvide: count('REQUESTED'), awaitingReview: count('SUBMITTED'), needsAttention: count('REJECTED'), verified: count('VERIFIED') },
    };
  }

  async loans(customerId: string): Promise<PortalLoanSummary[]> {
    const [loans, productNames] = await Promise.all([this.termLoans.listStored({ customerId }), this.productNames()]);
    return loans.map((loan) => this.summarise(loan, productNames));
  }

  async loan(customerId: string, loanId: string): Promise<PortalLoanDetail> {
    const loan = await this.ownLoan(customerId, loanId);
    const customer = await this.customers.getStored(customerId);
    // Who to contact about this loan: its own officer, otherwise the customer's officer.
    const officerId = loan.assignedOfficerId ?? customer.assignedOfficerId;
    const [productNames, lines, contacts] = await Promise.all([this.productNames(), this.ledger.linesForLoan(loanId), this.users.contacts([officerId])]);
    return {
      ...this.summarise(loan, productNames),
      schedule: toTermLoanView(loan).schedule,
      unappliedCreditKobo: loan.unappliedCreditKobo,
      officer: contacts(officerId),
      statement: this.statementRows(lines),
    };
  }

  /** Invoices the customer has financed with us, newest first, with what has been paid to them. */
  async invoices(customerId: string): Promise<PortalInvoiceView[]> {
    const invoices = await this.invoiceStore.list({ customerId });
    return this.toInvoiceViews(invoices);
  }

  async invoice(customerId: string, invoiceId: string): Promise<PortalInvoiceView> {
    const invoice = await this.invoiceStore.findById(invoiceId);
    if (!invoice || invoice.customerId !== customerId) throw new NotFoundError('INVOICE_NOT_FOUND', 'We could not find that invoice');
    const [view] = await this.toInvoiceViews([invoice]);
    if (!view) throw new NotFoundError('INVOICE_NOT_FOUND', 'We could not find that invoice');
    return view;
  }

  private async toInvoiceViews(invoices: readonly StoredInvoice[]): Promise<PortalInvoiceView[]> {
    const [settlements, productNames] = await Promise.all([this.invoiceStore.settlementsFor(invoices.map((invoice) => invoice.invoiceId)), this.productNames()]);
    const today = this.clock.today();
    return invoices.map((invoice) =>
      toPortalInvoiceView(invoice, settlements.get(invoice.invoiceId), invoice.loanProductId ? (productNames.get(invoice.loanProductId) ?? null) : null, today),
    );
  }

  async productsOnOffer(): Promise<PortalProductView[]> {
    return (await this.products.list('ACTIVE'))
      .filter((product): product is StoredLoanProduct & { minAnnualRatePercent: number; minTermMonths: number; maxTermMonths: number } =>
        product.type === 'TERM_LOAN' && product.minAnnualRatePercent !== null && product.minTermMonths !== null && product.maxTermMonths !== null,
      )
      .map((product) => ({
        productId: product.productId,
        name: product.name,
        description: product.description,
        annualRatePercent: product.minAnnualRatePercent,
        minPrincipalKobo: product.minPrincipalKobo,
        maxPrincipalKobo: product.maxPrincipalKobo,
        minTermMonths: product.minTermMonths,
        maxTermMonths: product.maxTermMonths,
      }));
  }

  /** The server's schedule for what the customer is about to apply for (same maths the loan will use). */
  async quote(request: { loanProductId: string; principalKobo: number; termMonths: number }): Promise<TermLoanQuote & { annualRatePercent: number }> {
    const product = (await this.productsOnOffer()).find((candidate) => candidate.productId === request.loanProductId);
    if (!product) throw fieldError('loanProductId', 'Choose one of the loans on offer');
    await this.products.assertFacilityFits(product.productId, 'TERM_LOAN', { principalKobo: request.principalKobo, annualRatePercent: product.annualRatePercent, termMonths: request.termMonths });
    return { ...this.termLoans.quote({ principalKobo: request.principalKobo, annualRatePercent: product.annualRatePercent, termMonths: request.termMonths }), annualRatePercent: product.annualRatePercent };
  }

  private async ownLoan(customerId: string, loanId: string): Promise<StoredTermLoan> {
    const loan = await this.termLoans.getStored(loanId).catch(() => undefined);
    if (!loan || loan.customerId !== customerId) throw new NotFoundError('LOAN_NOT_FOUND', 'We could not find that loan');
    return loan;
  }

  private async productNames(): Promise<Map<string, string>> {
    return new Map((await this.products.list()).map((product) => [product.productId, product.name]));
  }

  private summarise(loan: StoredTermLoan, productNames: ReadonlyMap<string, string>): PortalLoanSummary {
    const today = this.clock.today();
    const outstanding = outstandingPrincipalKobo(loan);
    const next = loan.schedule
      .map((instalment) => ({ instalment, owed: outstandingOnInstalment(instalment) }))
      .find(({ owed }) => owed.interestKobo + owed.principalKobo > 0);
    return {
      loanId: loan.loanId,
      productName: loan.loanProductId ? (productNames.get(loan.loanProductId) ?? null) : null,
      principalKobo: loan.principalKobo,
      annualRatePercent: loan.annualRatePercent,
      termMonths: loan.termMonths,
      instalmentKobo: loan.instalmentKobo,
      disbursedOn: loan.disbursedOn,
      outstandingPrincipalKobo: outstanding,
      overdueKobo: overdueKobo(loan, today),
      nextPayment: next
        ? { instalmentNumber: next.instalment.instalmentNumber, dueDate: next.instalment.dueDate, amountDueKobo: addKobo(next.owed.interestKobo, next.owed.principalKobo) }
        : null,
      status: outstanding === 0 ? 'PAID_OFF' : 'ACTIVE',
    };
  }

  /** Ledger lines → customer statement rows; the running balance is the loan's Loans Receivable. */
  private statementRows(lines: Awaited<ReturnType<LedgerRepository['linesForLoan']>>): PortalStatementRow[] {
    const byEntry = new Map<string, typeof lines>();
    for (const line of lines) byEntry.set(line.entryId, [...(byEntry.get(line.entryId) ?? []), line]);
    let balance: Kobo = ZERO_KOBO;
    return [...byEntry.entries()].map(([entryId, entryLines]) => {
      const sum = (account: string, side: 'debitKobo' | 'creditKobo') => addKobo(...entryLines.filter((line) => line.account === account).map((line) => line[side]));
      const receivableDebit = sum('LOANS_RECEIVABLE', 'debitKobo');
      const receivableCredit = sum('LOANS_RECEIVABLE', 'creditKobo');
      balance = subtractKobo(addKobo(balance, receivableDebit), receivableCredit);
      const first = entryLines[0];
      const isDisbursement = first?.event === 'Disbursement';
      const isPayment = first?.event === 'Repayment';
      return {
        entryId,
        postedOn: first?.postedOn ?? '',
        kind: isDisbursement ? 'DISBURSEMENT' : isPayment ? 'PAYMENT' : 'OTHER',
        description: isDisbursement ? 'Loan paid out to you' : isPayment ? 'Payment received — thank you' : (first?.event ?? ''),
        amountKobo: isDisbursement ? receivableDebit : sum('CASH', 'debitKobo'),
        principalKobo: receivableCredit,
        interestKobo: sum('INTEREST_INCOME', 'creditKobo'),
        creditKobo: sum('UNAPPLIED_CREDIT', 'creditKobo'),
        balanceAfterKobo: balance,
      };
    });
  }
}
