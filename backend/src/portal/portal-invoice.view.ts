import { daysBetween } from '../common/dates/calendar-date';
import { addKobo, Kobo, ZERO_KOBO } from '../common/money';
import { calculateLatePenaltyKobo, calculateSettlement } from '../invoice-financing/domain/invoice-financing';
import type { StoredInvoice, StoredSettlement } from '../invoice-financing/invoices.repository';

/**
 * An invoice the customer sold us, in their terms: what we paid them, what we are holding, what it costs.
 * OPEN = waiting for their customer (the debtor) to pay; OVERDUE = past the due date and still unpaid; SETTLED = closed.
 */
export interface PortalInvoiceView {
  invoiceId: string;
  productName: string | null;
  status: 'OPEN' | 'OVERDUE' | 'SETTLED';
  faceValueKobo: Kobo;
  issueDate: string;
  dueDate: string;
  tenorDays: number;
  /** Paid to the customer when the invoice was financed (80% of face value). */
  advanceKobo: Kobo;
  /** Held back until settlement (face value − advance). */
  reserveKobo: Kobo;
  discountFeeKobo: Kobo;
  latePenaltyPerDayKobo: Kobo;
  /** Days past the due date: today for an open invoice, at settlement for a settled one. */
  daysOverdue: number;
  /** Late penalty so far (open) or charged (settled). */
  latePenaltyKobo: Kobo;
  /** What is left of the reserve after charges, paid to the customer at settlement (0 until then). */
  reserveReleasedKobo: Kobo;
  /** Everything paid to the customer so far: advance + reserve released. */
  totalPaidToYouKobo: Kobo;
  /** Charges beyond the reserve that the customer owes us (settled with a shortfall only). */
  youOweKobo: Kobo;
  settledOn: string | null;
  /** Open invoices only: what settlement would look like if the debtor paid today — so the customer sees where it is heading. */
  ifSettledToday: { reserveReleasedKobo: Kobo; youOweKobo: Kobo } | null;
}

export function toPortalInvoiceView(invoice: StoredInvoice, settlement: StoredSettlement | undefined, productName: string | null, today: string): PortalInvoiceView {
  const base = {
    invoiceId: invoice.invoiceId,
    productName,
    faceValueKobo: invoice.faceValueKobo,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    tenorDays: invoice.tenorDays,
    advanceKobo: invoice.advanceKobo,
    reserveKobo: invoice.reserveKobo,
    discountFeeKobo: invoice.discountFeeKobo,
    latePenaltyPerDayKobo: calculateLatePenaltyKobo(invoice.advanceKobo, 1),
  };

  if (settlement) {
    return {
      ...base,
      status: 'SETTLED',
      daysOverdue: settlement.daysOverdue,
      latePenaltyKobo: settlement.latePenaltyKobo,
      reserveReleasedKobo: settlement.clientReceivesKobo,
      totalPaidToYouKobo: addKobo(invoice.advanceKobo, settlement.clientReceivesKobo),
      youOweKobo: settlement.clientOwesKobo,
      settledOn: settlement.settlementDate,
      ifSettledToday: null,
    };
  }

  // Same rule as settlement: overdue starts the day after the due date.
  const daysOverdue = Math.max(0, daysBetween(invoice.dueDate, today));
  const projected = calculateSettlement({ faceValueKobo: invoice.faceValueKobo, tenorDays: invoice.tenorDays, daysOverdue });
  return {
    ...base,
    status: daysOverdue > 0 ? 'OVERDUE' : 'OPEN',
    daysOverdue,
    latePenaltyKobo: projected.latePenaltyKobo,
    reserveReleasedKobo: ZERO_KOBO,
    totalPaidToYouKobo: invoice.advanceKobo,
    youOweKobo: ZERO_KOBO,
    settledOn: null,
    ifSettledToday: { reserveReleasedKobo: projected.clientReceivesKobo, youOweKobo: projected.clientOwesKobo },
  };
}
