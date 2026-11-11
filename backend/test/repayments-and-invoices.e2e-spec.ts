import { INestApplication } from '@nestjs/common';
import { createTestApp, HttpClient } from './test-app';

const goldenBody = { principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 };
let keyCounter = 0;
const nextKey = (): string => `key-${(keyCounter += 1)}`;

describe('repayments, statements and invoices (e2e)', () => {
  let app: INestApplication;
  let http: HttpClient;

  beforeEach(async () => {
    ({ app, http } = await createTestApp());
  });
  afterEach(async () => {
    await app.close();
  });

  async function disburseGoldenLoan(): Promise<string> {
    const response = await http.post('/term-loans').set('Idempotency-Key', nextKey()).send(goldenBody).expect(201);
    return response.body.loan.loanId as string;
  }

  function repay(loanId: string, amountKobo: number, paymentDate = '2026-02-15', key = nextKey()) {
    return http.post(`/term-loans/${loanId}/repayments`).set('Idempotency-Key', key).send({ amountKobo, paymentDate });
  }

  it('a full instalment: server preview equals what is posted, schedule and statement tie out', async () => {
    const loanId = await disburseGoldenLoan();
    const preview = await http.post(`/term-loans/${loanId}/repayments/preview`).send({ amountKobo: 21_063_026, paymentDate: '2026-02-15' }).expect(200);
    expect(preview.body.allocations).toEqual([{ instalmentNumber: 1, penaltyKobo: 0, feeKobo: 0, interestKobo: 1_800_000, principalKobo: 19_263_026 }]);

    const confirmed = await repay(loanId, 21_063_026).expect(201);
    expect(confirmed.body.allocation).toEqual(preview.body);
    expect(confirmed.body.journalEntry.lines).toEqual([
      { account: 'CASH', debitKobo: 21_063_026, creditKobo: 0 },
      { account: 'LOANS_RECEIVABLE', debitKobo: 0, creditKobo: 19_263_026 },
      { account: 'INTEREST_INCOME', debitKobo: 0, creditKobo: 1_800_000 },
    ]);

    const loan = (await http.get(`/term-loans/${loanId}`).expect(200)).body;
    expect(loan.schedule[0].status).toBe('PAID');
    expect(loan.schedule[1].status).toBe('UNPAID');
    expect(loan.outstandingPrincipalKobo).toBe(100_736_974);

    const statement = (await http.get(`/term-loans/${loanId}/statement`).expect(200)).body;
    const loansReceivableNet = statement.lines
      .filter((line: { account: string }) => line.account === 'LOANS_RECEIVABLE')
      .reduce((net: number, line: { debitKobo: number; creditKobo: number }) => net + line.debitKobo - line.creditKobo, 0);
    expect(loansReceivableNet).toBe(loan.outstandingPrincipalKobo);
  });

  it('a partial payment goes to interest first and leaves the instalment part-paid; zero lines are not posted', async () => {
    const loanId = await disburseGoldenLoan();
    const response = await repay(loanId, 1_000_000).expect(201);
    expect(response.body.journalEntry.lines).toEqual([
      { account: 'CASH', debitKobo: 1_000_000, creditKobo: 0 },
      { account: 'INTEREST_INCOME', debitKobo: 0, creditKobo: 1_000_000 },
    ]);
    const loan = (await http.get(`/term-loans/${loanId}`)).body;
    expect(loan.schedule[0].status).toBe('PARTIALLY_PAID');
  });

  it('a payment covering two instalments clears the oldest first', async () => {
    const loanId = await disburseGoldenLoan();
    const response = await repay(loanId, 2 * 21_063_026).expect(201);
    expect(response.body.allocation.allocations.map((row: { instalmentNumber: number }) => row.instalmentNumber)).toEqual([1, 2]);
  });

  it('early payoff and over-payment: everything is cleared and the surplus becomes unapplied credit', async () => {
    const loanId = await disburseGoldenLoan();
    const totalOwed = 5 * 21_063_026 + 21_063_024;
    const response = await repay(loanId, totalOwed + 5_000).expect(201);
    expect(response.body.allocation.unappliedCreditKobo).toBe(5_000);
    expect(response.body.journalEntry.lines).toContainEqual({ account: 'UNAPPLIED_CREDIT', debitKobo: 0, creditKobo: 5_000 });

    const loan = (await http.get(`/term-loans/${loanId}`)).body;
    expect(loan.outstandingPrincipalKobo).toBe(0);
    expect(loan.unappliedCreditKobo).toBe(5_000);
    expect(loan.schedule.every((row: { status: string }) => row.status === 'PAID')).toBe(true);
  });

  it('a double-clicked confirm with the same key posts once', async () => {
    const loanId = await disburseGoldenLoan();
    const key = nextKey();
    const [first, second] = await Promise.all([repay(loanId, 21_063_026, '2026-02-15', key), repay(loanId, 21_063_026, '2026-02-15', key)]);
    expect(second.body.repaymentId).toBe(first.body.repaymentId);
    const statement = (await http.get(`/term-loans/${loanId}/statement`)).body;
    expect(statement.lines.filter((line: { event: string; account: string }) => line.event === 'Repayment' && line.account === 'CASH')).toHaveLength(1);
  });

  it('validates the amount and date and names the right field', async () => {
    const loanId = await disburseGoldenLoan();
    const zero = await repay(loanId, 0).expect(422);
    expect(zero.body.errors[0].field).toBe('amountKobo');
    const early = await repay(loanId, 100, '2025-12-31').expect(422);
    expect(early.body.errors[0].field).toBe('paymentDate');
    const impossible = await repay(loanId, 100, '2026-02-30').expect(422);
    expect(impossible.body.errors[0].field).toBe('paymentDate');
  });

  describe('invoice financing', () => {
    async function financeInvoice(): Promise<string> {
      const response = await http
        .post('/invoices')
        .set('Idempotency-Key', nextKey())
        .send({ faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02' })
        .expect(201);
      return response.body.invoice.invoiceId as string;
    }

    it('quotes and pays the advance', async () => {
      const quote = await http.post('/invoices/quote').send({ faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02' }).expect(200);
      expect(quote.body).toEqual({ tenorDays: 60, advanceKobo: 80_000_000, reserveKobo: 20_000_000, discountFeeKobo: 4_734_247, latePenaltyPerDayKobo: 160_000 });
      const invoiceId = await financeInvoice();
      expect(invoiceId).toMatch(/^INV-/);
    });

    it.each([
      { settlementDate: '2026-03-02', receives: 15_265_753, owes: 0 },
      { settlementDate: '2026-06-05', receives: 65_753, owes: 0 },
      { settlementDate: '2026-06-06', receives: 0, owes: 94_247 },
    ])('settles on $settlementDate', async ({ settlementDate, receives, owes }) => {
      const invoiceId = await financeInvoice();
      const response = await http.post(`/invoices/${invoiceId}/settlement`).set('Idempotency-Key', nextKey()).send({ settlementDate }).expect(201);
      expect(response.body.clientReceivesKobo).toBe(receives);
      expect(response.body.clientOwesKobo).toBe(owes);
      const { lines } = response.body.journalEntry;
      const debits = lines.reduce((sum: number, line: { debitKobo: number }) => sum + line.debitKobo, 0);
      const credits = lines.reduce((sum: number, line: { creditKobo: number }) => sum + line.creditKobo, 0);
      expect(debits).toBe(credits);
    });

    it('the 96-days-overdue settlement posts the exact shortfall journal', async () => {
      const invoiceId = await financeInvoice();
      const response = await http.post(`/invoices/${invoiceId}/settlement`).set('Idempotency-Key', nextKey()).send({ settlementDate: '2026-06-06' }).expect(201);
      expect(response.body.daysOverdue).toBe(96);
      expect(response.body.journalEntry.lines).toEqual([
        { account: 'CASH', debitKobo: 100_000_000, creditKobo: 0 },
        { account: 'CLIENT_RECEIVABLE', debitKobo: 94_247, creditKobo: 0 },
        { account: 'INVOICE_RECEIVABLES', debitKobo: 0, creditKobo: 80_000_000 },
        { account: 'FEE_INCOME', debitKobo: 0, creditKobo: 4_734_247 },
        { account: 'PENALTY_INCOME', debitKobo: 0, creditKobo: 15_360_000 },
      ]);
    });

    it('previews without posting, then refuses a second settlement', async () => {
      const invoiceId = await financeInvoice();
      const preview = await http.post(`/invoices/${invoiceId}/settlement/preview`).send({ settlementDate: '2026-06-06' }).expect(200);
      expect(preview.body.clientOwesKobo).toBe(94_247);
      expect((await http.get(`/invoices/${invoiceId}`)).body.status).toBe('ADVANCED');

      await http.post(`/invoices/${invoiceId}/settlement`).set('Idempotency-Key', nextKey()).send({ settlementDate: '2026-06-06' }).expect(201);
      const again = await http.post(`/invoices/${invoiceId}/settlement`).set('Idempotency-Key', nextKey()).send({ settlementDate: '2026-06-06' }).expect(409);
      expect(again.body.code).toBe('INVOICE_ALREADY_SETTLED');
    });

    it('rejects a due date on or before the advance date against dueDate', async () => {
      const response = await http.post('/invoices/quote').send({ faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-01-01' }).expect(422);
      expect(response.body.errors[0].field).toBe('dueDate');
    });
  });

  it('a reversing entry mirrors the original once and cannot be repeated', async () => {
    await disburseGoldenLoan();
    const { LedgerService } = await import('../src/ledger/ledger.service');
    const ledger = app.get(LedgerService);
    const reversal = await ledger.reverse('JE-000001', 'posted in error', '2026-01-16');
    expect(reversal.lines).toEqual([
      { account: 'LOANS_RECEIVABLE', debitKobo: 0, creditKobo: 120_000_000 },
      { account: 'CASH', debitKobo: 120_000_000, creditKobo: 0 },
    ]);
    await expect(ledger.reverse('JE-000001', 'again', '2026-01-16')).rejects.toThrow(/already reversed/);
    await expect(ledger.reverse(reversal.entryId, 'reverse the reversal', '2026-01-16')).rejects.toThrow(/cannot itself be reversed/);
  });
});
