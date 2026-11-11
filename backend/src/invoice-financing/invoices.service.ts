import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { CustomersService } from '../customers/customers.service';
import { LoanProductsService } from '../loan-products/loan-products.service';
import { daysBetween } from '../common/dates/calendar-date';
import { ConflictError, fieldError, NotFoundError } from '../common/errors/app-errors';
import { IdempotencyContext, IdempotencyService } from '../common/idempotency/idempotency.service';
import { asKobo } from '../common/money';
import { credit, debit, prepareLinesForPosting } from '../ledger/domain/journal';
import { JournalEntry } from '../ledger/ledger.repository';
import { LedgerService } from '../ledger/ledger.service';
import {
  buildSettlementLines,
  calculateAdvance,
  calculateDiscountFeeKobo,
  calculateLatePenaltyKobo,
  calculateSettlement,
} from './domain/invoice-financing';
import { FinanceInvoiceDto, QuoteInvoiceDto, SettleInvoiceDto } from './dto/invoice.dto';
import { InvoiceListFilter, InvoicesRepository, StoredInvoice } from './invoices.repository';

export interface InvoiceQuote {
  tenorDays: number;
  advanceKobo: number;
  reserveKobo: number;
  discountFeeKobo: number;
  latePenaltyPerDayKobo: number;
}

export interface InvoiceSettlementResult {
  daysOverdue: number;
  discountFeeKobo: number;
  latePenaltyKobo: number;
  totalChargesKobo: number;
  clientReceivesKobo: number;
  clientOwesKobo: number;
  journalEntry: JournalEntry;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly repository: InvoicesRepository,
    private readonly ledger: LedgerService,
    private readonly idempotency: IdempotencyService,
    private readonly clock: Clock,
    private readonly customers: CustomersService,
    private readonly products: LoanProductsService,
  ) {}

  /** The quote shown before the advance is paid, checked exactly like the advance will be (customer access, product limits). */
  async quoteFor(request: QuoteInvoiceDto, actor: AuthenticatedUser): Promise<InvoiceQuote> {
    if (request.customerId) await this.customers.assertCanTransactFor(actor, request.customerId);
    if (request.loanProductId) await this.products.assertFacilityFits(request.loanProductId, 'INVOICE_FINANCING', { principalKobo: request.faceValueKobo });
    return this.quote(request);
  }

  quote(request: QuoteInvoiceDto): InvoiceQuote {
    const tenorDays = this.tenorDaysFor(request);
    const { advanceKobo, reserveKobo } = calculateAdvance(asKobo(request.faceValueKobo));
    return {
      tenorDays,
      advanceKobo,
      reserveKobo,
      discountFeeKobo: calculateDiscountFeeKobo(advanceKobo, tenorDays),
      latePenaltyPerDayKobo: calculateLatePenaltyKobo(advanceKobo, 1),
    };
  }

  /** Pays the advance: Dr Invoice Receivables / Cr Cash — once per Idempotency-Key, in one transaction. */
  finance(request: FinanceInvoiceDto, idempotency: IdempotencyContext, actor: AuthenticatedUser): Promise<{ invoice: StoredInvoice; journalEntry: JournalEntry }> {
    return this.idempotency.execute(idempotency, request, async () => {
      await this.customers.assertCanTransactFor(actor, request.customerId);
      if (request.loanProductId) await this.products.assertFacilityFits(request.loanProductId, 'INVOICE_FINANCING', { principalKobo: request.faceValueKobo });
      const tenorDays = this.tenorDaysFor(request);
      const faceValueKobo = asKobo(request.faceValueKobo);
      const { advanceKobo, reserveKobo } = calculateAdvance(faceValueKobo);
      const invoiceId = await this.repository.insert({
        customerId: request.customerId ?? null,
        loanProductId: request.loanProductId ?? null,
        faceValueKobo,
        issueDate: request.issueDate,
        dueDate: request.dueDate,
        tenorDays,
        advanceKobo,
        reserveKobo,
        discountFeeKobo: calculateDiscountFeeKobo(advanceKobo, tenorDays),
        createdBy: actor.userId,
        createdAt: this.clock.nowIso(),
      });
      const journalEntry = await this.ledger.post({
        event: 'Invoice advance',
        postedOn: request.issueDate,
        invoiceId,
        customerId: request.customerId,
        lines: [debit('INVOICE_RECEIVABLES', advanceKobo), credit('CASH', advanceKobo)],
      });
      return { invoice: await this.getStored(invoiceId), journalEntry };
    });
  }

  async getStored(invoiceId: string): Promise<StoredInvoice> {
    const invoice = await this.repository.findById(invoiceId);
    if (!invoice) throw new NotFoundError('INVOICE_NOT_FOUND', `Invoice ${invoiceId} does not exist`);
    return invoice;
  }

  list(filter: InvoiceListFilter = {}): Promise<StoredInvoice[]> {
    return this.repository.list(filter);
  }

  async getVisibleTo(actor: AuthenticatedUser, invoiceId: string): Promise<StoredInvoice> {
    const invoice = await this.getStored(invoiceId);
    await this.customers.assertCanView(actor, invoice.customerId);
    return invoice;
  }

  async listVisibleTo(actor: AuthenticatedUser): Promise<StoredInvoice[]> {
    if (actor.role === 'ADMIN') return this.repository.list();
    return this.repository.list({ customerIds: await this.customers.idsInBookOf(actor.userId) });
  }

  /** What settlement would look like on a date. Nothing is persisted. */
  async previewSettlement(invoiceId: string, request: SettleInvoiceDto, actor: AuthenticatedUser): Promise<InvoiceSettlementResult> {
    const invoice = await this.getVisibleTo(actor, invoiceId);
    this.assertSettlementAllowed(invoice, request.settlementDate);
    const outcome = this.outcomeFor(invoice, request.settlementDate);
    const lines = prepareLinesForPosting(buildSettlementLines(invoice.faceValueKobo, outcome));
    return {
      ...this.toResult(outcome, request.settlementDate, invoice),
      journalEntry: { entryId: 'PREVIEW', event: 'Invoice settlement', postedOn: request.settlementDate, loanId: null, invoiceId, customerId: invoice.customerId, reversesEntryId: null, lines },
    };
  }

  /**
   * Posts the settlement journal and closes the invoice — once per Idempotency-Key, in one transaction. The invoice is
   * claimed first (ADVANCED → SETTLED, compare-and-set), so two settlements racing with different keys post once.
   */
  settle(invoiceId: string, request: SettleInvoiceDto, idempotency: IdempotencyContext, actor: AuthenticatedUser): Promise<InvoiceSettlementResult> {
    return this.idempotency.execute(idempotency, { invoiceId, ...request }, async () => {
      const invoice = await this.getVisibleTo(actor, invoiceId);
      this.assertSettlementAllowed(invoice, request.settlementDate);
      if (!(await this.repository.claimForSettlement(invoiceId))) {
        throw new ConflictError('INVOICE_ALREADY_SETTLED', `Invoice ${invoiceId} is already settled`);
      }
      const outcome = this.outcomeFor(invoice, request.settlementDate);
      const journalEntry = await this.ledger.post({
        event: 'Invoice settlement',
        postedOn: request.settlementDate,
        invoiceId,
        customerId: invoice.customerId ?? undefined,
        lines: buildSettlementLines(invoice.faceValueKobo, outcome),
      });
      const result = this.toResult(outcome, request.settlementDate, invoice);
      await this.repository.insertSettlement({
        invoiceId,
        settlementDate: request.settlementDate,
        daysOverdue: result.daysOverdue,
        discountFeeKobo: outcome.discountFeeKobo,
        latePenaltyKobo: outcome.latePenaltyKobo,
        totalChargesKobo: outcome.totalChargesKobo,
        clientReceivesKobo: outcome.clientReceivesKobo,
        clientOwesKobo: outcome.clientOwesKobo,
        journalEntryId: journalEntry.entryId,
        createdAt: this.clock.nowIso(),
      });
      return { ...result, journalEntry };
    });
  }

  private tenorDaysFor(request: QuoteInvoiceDto): number {
    const tenorDays = daysBetween(request.issueDate, request.dueDate);
    if (tenorDays <= 0) throw fieldError('dueDate', 'Due date must be after the advance date');
    return tenorDays;
  }

  private assertSettlementAllowed(invoice: StoredInvoice, settlementDate: string): void {
    if (invoice.status === 'SETTLED') throw new ConflictError('INVOICE_ALREADY_SETTLED', `Invoice ${invoice.invoiceId} is already settled`);
    if (settlementDate < invoice.issueDate) throw fieldError('settlementDate', `Settlement date cannot be before the advance date (${invoice.issueDate})`);
  }

  private outcomeFor(invoice: StoredInvoice, settlementDate: string) {
    const daysOverdue = Math.max(0, daysBetween(invoice.dueDate, settlementDate));
    return calculateSettlement({ faceValueKobo: invoice.faceValueKobo, tenorDays: invoice.tenorDays, daysOverdue });
  }

  private toResult(outcome: ReturnType<typeof calculateSettlement>, settlementDate: string, invoice: StoredInvoice): Omit<InvoiceSettlementResult, 'journalEntry'> {
    return {
      daysOverdue: Math.max(0, daysBetween(invoice.dueDate, settlementDate)),
      discountFeeKobo: outcome.discountFeeKobo,
      latePenaltyKobo: outcome.latePenaltyKobo,
      totalChargesKobo: outcome.totalChargesKobo,
      clientReceivesKobo: outcome.clientReceivesKobo,
      clientOwesKobo: outcome.clientOwesKobo,
    };
  }
}
