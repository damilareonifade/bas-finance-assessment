import { Alert } from '@/components/ui/Alert';
import { INVOICE_ADVANCE_RATE, INVOICE_ANNUAL_DISCOUNT_RATE, INVOICE_DAILY_PENALTY_RATE, MoneyDecimal } from '@/lib/money';

/** "0.8" → "80%", "0.002" → "0.2%" — read from the money kernel so the note can never drift from the maths. */
function asPercent(rate: string): string {
  return `${new MoneyDecimal(rate).times(100).toString()}%`;
}

const ADVANCE = asPercent(INVOICE_ADVANCE_RATE);
const RESERVE = asPercent(new MoneyDecimal(1).minus(INVOICE_ADVANCE_RATE).toString());
const DISCOUNT = asPercent(INVOICE_ANNUAL_DISCOUNT_RATE);
const PENALTY = asPercent(INVOICE_DAILY_PENALTY_RATE);

/** Tells whoever sets up an invoice financing product which terms are fixed and cannot be configured per product. */
export function InvoiceFinancingTermsNote() {
  return (
    <Alert title="Invoice financing terms are fixed">
      <p className="mt-1">These apply to every invoice financing product and can't be changed here. You only set the face value limits below.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <span className="font-semibold">Advance: {ADVANCE}</span> of the invoice face value is paid to the client. The other {RESERVE} is held as a
          reserve and released when the invoice is settled.
        </li>
        <li>
          <span className="font-semibold">Discount fee: {DISCOUNT} a year</span> on the advance, charged for the invoice's tenor (actual days ÷ 365).
        </li>
        <li>
          <span className="font-semibold">Late penalty: {PENALTY} of the advance per day</span> overdue, starting the day after the due date.
        </li>
      </ul>
      <p className="mt-2">Fees and penalties come out of the reserve. If they are more than the reserve, the client owes the difference.</p>
    </Alert>
  );
}
