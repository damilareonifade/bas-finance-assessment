import type { Invoice } from '@/features/invoice-financing';
import type { TermLoan } from '@/features/term-loans';
import { addKobo, formatKobo, ZERO_KOBO, type Kobo } from '@/lib/money';

/* These read server data and only arrange it for display — nothing here decides or posts money. */

export type LoanHealth = 'current' | 'overdue' | 'repaid';

/** Repaid when nothing is outstanding; overdue when an instalment due before today is not fully paid. */
export function loanHealth(loan: Pick<TermLoan, 'outstandingPrincipalKobo' | 'schedule'>, today: string): LoanHealth {
  if (loan.outstandingPrincipalKobo === 0) return 'repaid';
  return loan.schedule.some((instalment) => instalment.dueDate < today && instalment.status !== 'PAID') ? 'overdue' : 'current';
}

export type ActivityKind = 'loan-disbursed' | 'invoice-advanced' | 'invoice-settled';

export interface ActivityItem {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly date: string;
  readonly title: string;
  readonly detail: string;
  readonly to: string;
}

/** Newest first: loans disbursed and invoices advanced, with who and how much. */
export function recentActivity(
  loans: readonly Pick<TermLoan, 'loanId' | 'customerId' | 'principalKobo' | 'disbursedOn'>[],
  invoices: readonly Pick<Invoice, 'invoiceId' | 'customerId' | 'advanceKobo' | 'issueDate' | 'status'>[],
  nameOf: (customerId: string | null) => string | null,
  limit = 6,
): ActivityItem[] {
  const who = (customerId: string | null) => nameOf(customerId) ?? 'No customer';
  const items: ActivityItem[] = [
    ...loans.map((loan) => ({
      id: loan.loanId,
      kind: 'loan-disbursed' as const,
      date: loan.disbursedOn,
      title: `Loan ${loan.loanId} disbursed`,
      detail: `${who(loan.customerId)}, ${formatKobo(loan.principalKobo)}`,
      to: `/loans/${loan.loanId}`,
    })),
    ...invoices.map((invoice) => ({
      id: invoice.invoiceId,
      kind: invoice.status === 'SETTLED' ? ('invoice-settled' as const) : ('invoice-advanced' as const),
      date: invoice.issueDate,
      title: invoice.status === 'SETTLED' ? `Invoice ${invoice.invoiceId} settled` : `Invoice ${invoice.invoiceId} advanced`,
      detail: `${who(invoice.customerId)}, ${formatKobo(invoice.advanceKobo)} advance`,
      to: `/invoices/${invoice.invoiceId}`,
    })),
  ];
  return items.sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id)).slice(0, limit);
}

export interface PortfolioSlice {
  readonly label: string;
  readonly valueKobo: Kobo;
}

/** What is out with customers right now, by product: loan principal still owed + advances on open invoices. Largest first. */
export function portfolioByProduct(
  loans: readonly Pick<TermLoan, 'loanProductId' | 'outstandingPrincipalKobo'>[],
  invoices: readonly Pick<Invoice, 'loanProductId' | 'advanceKobo' | 'status'>[],
  productName: (productId: string | null) => string,
): PortfolioSlice[] {
  const totals = new Map<string, Kobo>();
  const add = (label: string, amount: Kobo) => totals.set(label, addKobo(totals.get(label) ?? ZERO_KOBO, amount));
  for (const loan of loans) if (loan.outstandingPrincipalKobo > 0) add(productName(loan.loanProductId), loan.outstandingPrincipalKobo);
  for (const invoice of invoices) if (invoice.status === 'ADVANCED') add(productName(invoice.loanProductId), invoice.advanceKobo);
  return [...totals.entries()].map(([label, valueKobo]) => ({ label, valueKobo })).sort((left, right) => right.valueKobo - left.valueKobo);
}
