import { asKobo } from '../common/money';
import type { StoredInvoice, StoredSettlement } from '../invoice-financing/invoices.repository';
import { toPortalInvoiceView } from './portal-invoice.view';

// Golden invoice example: face 100,000,000; advance 80,000,000; reserve 20,000,000; 60 days at 36% → fee 4,734,247; penalty 160,000/day.
const invoice: StoredInvoice = {
  invoiceId: 'INV-000001',
  customerId: 'CUS-000001',
  loanProductId: null,
  faceValueKobo: asKobo(100_000_000),
  issueDate: '2026-01-01',
  dueDate: '2026-03-02',
  tenorDays: 60,
  advanceKobo: asKobo(80_000_000),
  reserveKobo: asKobo(20_000_000),
  discountFeeKobo: asKobo(4_734_247),
  status: 'ADVANCED',
};

describe('toPortalInvoiceView', () => {
  it('open and not yet due: the advance is all that has been paid; the full reserve less the fee would come back today', () => {
    const view = toPortalInvoiceView(invoice, undefined, null, '2026-02-01');
    expect(view).toMatchObject({
      status: 'OPEN',
      daysOverdue: 0,
      latePenaltyKobo: 0,
      latePenaltyPerDayKobo: 160_000,
      reserveReleasedKobo: 0,
      totalPaidToYouKobo: 80_000_000,
      youOweKobo: 0,
      settledOn: null,
      ifSettledToday: { reserveReleasedKobo: 15_265_753, youOweKobo: 0 },
    });
  });

  it('the due date itself is not overdue; the day after is', () => {
    expect(toPortalInvoiceView(invoice, undefined, null, '2026-03-02')).toMatchObject({ status: 'OPEN', daysOverdue: 0 });
    expect(toPortalInvoiceView(invoice, undefined, null, '2026-03-03')).toMatchObject({ status: 'OVERDUE', daysOverdue: 1, latePenaltyKobo: 160_000 });
  });

  it('96 days overdue and still open: the projection shows the shortfall, never a negative payout', () => {
    const view = toPortalInvoiceView(invoice, undefined, null, '2026-06-06'); // 2026-03-02 + 96 days
    expect(view).toMatchObject({ status: 'OVERDUE', daysOverdue: 96, latePenaltyKobo: 15_360_000, ifSettledToday: { reserveReleasedKobo: 0, youOweKobo: 94_247 } });
  });

  it('settled: reports what was actually paid out at settlement, from the stored settlement', () => {
    const settlement: StoredSettlement = {
      invoiceId: invoice.invoiceId,
      settlementDate: '2026-06-05',
      daysOverdue: 95,
      discountFeeKobo: asKobo(4_734_247),
      latePenaltyKobo: asKobo(15_200_000),
      totalChargesKobo: asKobo(19_934_247),
      clientReceivesKobo: asKobo(65_753),
      clientOwesKobo: asKobo(0),
    };
    const view = toPortalInvoiceView({ ...invoice, status: 'SETTLED' }, settlement, 'Invoice discounting', '2026-07-01');
    expect(view).toMatchObject({
      status: 'SETTLED',
      productName: 'Invoice discounting',
      daysOverdue: 95,
      latePenaltyKobo: 15_200_000,
      reserveReleasedKobo: 65_753,
      totalPaidToYouKobo: 80_065_753,
      youOweKobo: 0,
      settledOn: '2026-06-05',
      ifSettledToday: null,
    });
  });
});
