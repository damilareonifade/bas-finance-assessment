import { Injectable } from '@nestjs/common';
import { addKobo, Kobo, ZERO_KOBO } from '../common/money';
import { CustomersRepository } from '../customers/customers.repository';
import { CustomersService } from '../customers/customers.service';
import { InvoicesRepository } from '../invoice-financing/invoices.repository';
import { AccountCode } from '../ledger/domain/account';
import { AccountSummary, CustomerPosition, customerPosition, LedgerTotals, ledgerTotals, summariseAccounts } from '../ledger/domain/ledger-summary';
import { LedgerRepository } from '../ledger/ledger.repository';
import { LoanProductsService } from '../loan-products/loan-products.service';
import { TermLoansRepository } from '../term-loans/term-loans.repository';
import { PersonRef, UsersService } from '../users/users.service';

/** Most lines returned in one response; totals and summaries always cover the whole scope. */
export const LEDGER_LINE_LIMIT = 2000;
const SEARCH_RESULT_LIMIT = 10;

export interface LedgerSearchResult {
  customerId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  /** Why this customer came up, when it was not their own name / id / contact (e.g. "Loan LN-000003"). */
  matchedOn: string | null;
}

export interface LedgerLineView {
  entryId: string;
  postedOn: string;
  event: string;
  /** Set on a reversing entry: the entry it cancels. */
  reversesEntryId: string | null;
  account: AccountCode;
  debitKobo: Kobo;
  creditKobo: Kobo;
  customer: { customerId: string; fullName: string } | null;
  facility: { kind: 'LOAN' | 'INVOICE'; id: string } | null;
  product: { productId: string; name: string } | null;
}

export interface LedgerProductSummary {
  /** null = facilities written without a product. */
  product: { productId: string; name: string } | null;
  debitKobo: Kobo;
  creditKobo: Kobo;
  entryCount: number;
}

export interface LedgerView {
  customer: { customerId: string; fullName: string; email: string | null; phone: string | null; assignedOfficer: PersonRef | null } | null;
  product: { productId: string; name: string; type: string } | null;
  period: { from: string | null; to: string | null };
  totals: LedgerTotals;
  accounts: AccountSummary[];
  products: LedgerProductSummary[];
  /** Only when a customer is chosen: what they owe, what is held for them, what they have paid in income. */
  position: CustomerPosition | null;
  /** Oldest first; the most recent LEDGER_LINE_LIMIT when `truncated`. */
  lines: LedgerLineView[];
  truncated: boolean;
}

export interface LedgerQuery {
  customerId?: string;
  loanProductId?: string;
  from?: string;
  to?: string;
}

/**
 * The admin ledger: every debit and credit, scoped to a customer and/or a loan product and/or a period. Read-only — it
 * only reads journal lines and labels them with who and what they belong to. Entries carry the customer and the loan or
 * invoice; the loan or invoice carries the product.
 */
@Injectable()
export class LedgerBookService {
  constructor(
    private readonly ledger: LedgerRepository,
    private readonly customers: CustomersService,
    private readonly customerStore: CustomersRepository,
    private readonly loans: TermLoansRepository,
    private readonly invoices: InvoicesRepository,
    private readonly products: LoanProductsService,
    private readonly users: UsersService,
  ) {}

  /** Find a customer by name, customer id, email or phone — or by the id of one of their loans, invoices or journal entries. */
  async search(query: string): Promise<LedgerSearchResult[]> {
    const text = query.trim();
    if (text === '') return [];
    const results = new Map<string, LedgerSearchResult>();
    const add = (customer: { customerId: string; fullName: string; email: string | null; phone: string | null }, matchedOn: string | null) => {
      if (!results.has(customer.customerId)) results.set(customer.customerId, { ...customer, matchedOn });
    };

    // A reference that points at exactly one record goes first.
    const reference = text.toUpperCase();
    const viaReference = await this.customerForReference(reference);
    if (viaReference) {
      const customer = await this.customerStore.findById(viaReference.customerId);
      if (customer) add(customer, viaReference.label);
    }
    for (const customer of await this.customerStore.list({ search: text })) add(customer, null);
    return [...results.values()].slice(0, SEARCH_RESULT_LIMIT);
  }

  async view(query: LedgerQuery): Promise<LedgerView> {
    const [customer, product, allProducts] = await Promise.all([
      query.customerId ? this.customers.getStored(query.customerId) : Promise.resolve(null),
      query.loanProductId ? this.products.getStored(query.loanProductId) : Promise.resolve(null),
      this.products.list(),
    ]);
    const productNames = new Map(allProducts.map((stored) => [stored.productId, stored.name]));
    const facilityFilter = query.customerId ? { customerId: query.customerId } : {};
    const [loans, invoices] = await Promise.all([this.loans.list(facilityFilter), this.invoices.list(facilityFilter)]);
    const productOfLoan = new Map(loans.map((loan) => [loan.loanId, loan.loanProductId]));
    const productOfInvoice = new Map(invoices.map((invoice) => [invoice.invoiceId, invoice.loanProductId]));

    const entries = await this.ledger.entriesMatching({
      customerId: query.customerId,
      facilities: product
        ? {
            loanIds: loans.filter((loan) => loan.loanProductId === product.productId).map((loan) => loan.loanId),
            invoiceIds: invoices.filter((invoice) => invoice.loanProductId === product.productId).map((invoice) => invoice.invoiceId),
          }
        : undefined,
      from: query.from,
      to: query.to,
    });

    const customerIds = [...new Set(entries.map((entry) => entry.customerId).filter((id): id is string => id !== null))];
    const customerNames = new Map((await this.customers.findByIds(customerIds)).map((stored) => [stored.customerId, stored.fullName]));

    const lines: LedgerLineView[] = entries.flatMap((entry) => {
      const productId = entry.loanId ? productOfLoan.get(entry.loanId) : entry.invoiceId ? productOfInvoice.get(entry.invoiceId) : null;
      const lineProduct = productId ? { productId, name: productNames.get(productId) ?? productId } : null;
      const lineCustomer = entry.customerId ? { customerId: entry.customerId, fullName: customerNames.get(entry.customerId) ?? entry.customerId } : null;
      const facility = entry.loanId ? { kind: 'LOAN' as const, id: entry.loanId } : entry.invoiceId ? { kind: 'INVOICE' as const, id: entry.invoiceId } : null;
      return entry.lines.map((line) => ({
        entryId: entry.entryId,
        postedOn: entry.postedOn,
        event: entry.event,
        reversesEntryId: entry.reversesEntryId,
        account: line.account,
        debitKobo: line.debitKobo,
        creditKobo: line.creditKobo,
        customer: lineCustomer,
        facility,
        product: lineProduct,
      }));
    });

    const accounts = summariseAccounts(lines);
    const officer = customer ? (await this.users.people([customer.assignedOfficerId]))(customer.assignedOfficerId) : null;
    return {
      customer: customer
        ? { customerId: customer.customerId, fullName: customer.fullName, email: customer.email, phone: customer.phone, assignedOfficer: officer }
        : null,
      product: product ? { productId: product.productId, name: product.name, type: product.type } : null,
      period: { from: query.from ?? null, to: query.to ?? null },
      totals: ledgerTotals(lines),
      accounts,
      products: summariseByProduct(lines),
      position: customer ? customerPosition(accounts) : null,
      lines: lines.length > LEDGER_LINE_LIMIT ? lines.slice(-LEDGER_LINE_LIMIT) : lines,
      truncated: lines.length > LEDGER_LINE_LIMIT,
    };
  }

  private async customerForReference(reference: string): Promise<{ customerId: string; label: string } | null> {
    let customerId: string | null = null;
    let label = reference;
    if (reference.startsWith('LN-')) {
      customerId = (await this.loans.findById(reference))?.customerId ?? null;
      label = `Loan ${reference}`;
    } else if (reference.startsWith('INV-')) {
      customerId = (await this.invoices.findById(reference))?.customerId ?? null;
      label = `Invoice ${reference}`;
    } else if (reference.startsWith('JE-')) {
      customerId = await this.ledger.customerOfEntry(reference);
      label = `Journal entry ${reference}`;
    }
    return customerId ? { customerId, label } : null;
  }
}

/** Debits and credits per product, products in name order, "no product" last. */
function summariseByProduct(lines: readonly LedgerLineView[]): LedgerProductSummary[] {
  const groups = new Map<string, { product: LedgerProductSummary['product']; debitKobo: Kobo; creditKobo: Kobo; entries: Set<string> }>();
  for (const line of lines) {
    const key = line.product?.productId ?? '';
    const group = groups.get(key) ?? { product: line.product, debitKobo: ZERO_KOBO, creditKobo: ZERO_KOBO, entries: new Set<string>() };
    group.debitKobo = addKobo(group.debitKobo, line.debitKobo);
    group.creditKobo = addKobo(group.creditKobo, line.creditKobo);
    group.entries.add(line.entryId);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((first, second) => (first.product === null ? 1 : second.product === null ? -1 : first.product.name.localeCompare(second.product.name)))
    .map((group) => ({ product: group.product, debitKobo: group.debitKobo, creditKobo: group.creditKobo, entryCount: group.entries.size }));
}
