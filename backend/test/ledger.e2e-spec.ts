import { createTestApp, HttpClient, inviteOfficer, TestApp } from './test-app';

/** The admin ledger: search a customer, then every debit and credit attributed to them — by product, account and period. */
describe('admin ledger (e2e)', () => {
  let testApp: TestApp;
  let admin: HttpClient;
  let keyCounter = 0;
  const nextKey = (): string => `ledger-key-${(keyCounter += 1)}`;
  let chidi: string;
  let amaka: string;
  let termProduct: string;
  let invoiceProduct: string;
  let chidiLoan: string;
  let chidiInvoice: string;

  beforeEach(async () => {
    testApp = await createTestApp();
    admin = testApp.http;
    termProduct = (await admin.post('/loan-products').send({ name: 'SME Growth', type: 'TERM_LOAN', minAnnualRatePercent: 10, maxAnnualRatePercent: 30 }).expect(201)).body.product.productId;
    invoiceProduct = (await admin.post('/loan-products').send({ name: 'Invoice Advance', type: 'INVOICE_FINANCING' }).expect(201)).body.product.productId;
    chidi = (await admin.post('/customers').send({ fullName: 'Chidi Okafor', email: 'chidi@example.com', phone: '+2348011112222' }).expect(201)).body.customer.customerId;
    amaka = (await admin.post('/customers').send({ fullName: 'Amaka Eze' }).expect(201)).body.customer.customerId;

    // Chidi: golden term loan on SME Growth + first instalment; golden invoice on Invoice Advance settled 96 days late (shortfall).
    chidiLoan = (await admin.post('/term-loans').set('Idempotency-Key', nextKey())
      .send({ principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6, customerId: chidi, loanProductId: termProduct, disbursedOn: '2026-01-15' }).expect(201)).body.loan.loanId;
    await admin.post(`/term-loans/${chidiLoan}/repayments`).set('Idempotency-Key', nextKey()).send({ amountKobo: 21_063_026, paymentDate: '2026-02-15' }).expect(201);
    chidiInvoice = (await admin.post('/invoices').set('Idempotency-Key', nextKey())
      .send({ faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02', customerId: chidi, loanProductId: invoiceProduct }).expect(201)).body.invoice.invoiceId;
    await admin.post(`/invoices/${chidiInvoice}/settlement`).set('Idempotency-Key', nextKey()).send({ settlementDate: '2026-06-06' }).expect(201);
    // Amaka: a loan with no product.
    await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ principalKobo: 50_000_000, annualRatePercent: 18, termMonths: 6, customerId: amaka }).expect(201);
  });
  afterEach(async () => {
    await testApp.app.close();
  });

  it('finds a customer by name, id, email, phone — or by one of their loans, invoices or journal entries', async () => {
    const find = async (q: string) => (await admin.get('/ledger/search').query({ q }).expect(200)).body as Array<{ customerId: string; matchedOn: string | null }>;
    expect((await find('chidi')).map((result) => result.customerId)).toEqual([chidi]);
    expect((await find(chidi.toLowerCase())).map((result) => result.customerId)).toEqual([chidi]);
    expect((await find('chidi@example')).map((result) => result.customerId)).toEqual([chidi]);
    expect((await find('2348011112222')).map((result) => result.customerId)).toEqual([chidi]);
    expect(await find(chidiLoan)).toEqual([expect.objectContaining({ customerId: chidi, matchedOn: `Loan ${chidiLoan}` })]);
    expect(await find(chidiInvoice.toLowerCase())).toEqual([expect.objectContaining({ customerId: chidi, matchedOn: `Invoice ${chidiInvoice}` })]);
    expect(await find('nobody-like-this')).toEqual([]);
  });

  it("shows every debit and credit attributed to a customer, balanced, with their position and a split by product", async () => {
    const ledger = (await admin.get('/ledger').query({ customerId: chidi }).expect(200)).body;
    expect(ledger.customer).toMatchObject({ customerId: chidi, fullName: 'Chidi Okafor' });
    expect(ledger.totals).toMatchObject({ entryCount: 4, isBalanced: true });
    expect(ledger.totals.debitKobo).toBe(ledger.totals.creditKobo);
    expect(new Set(ledger.lines.map((line: { customer: { customerId: string } }) => line.customer.customerId))).toEqual(new Set([chidi]));
    expect(ledger.position).toEqual({ owedByCustomerKobo: 100_736_974 + 94_247, owedToCustomerKobo: 0, incomeEarnedKobo: 1_800_000 + 4_734_247 + 15_360_000, netCashKobo: -78_936_974 });
    expect(ledger.products.map((summary: { product: { name: string } | null; entryCount: number }) => [summary.product?.name ?? null, summary.entryCount])).toEqual([
      ['Invoice Advance', 2],
      ['SME Growth', 2],
    ]);
    const repaymentLines = ledger.lines.filter((line: { event: string }) => line.event === 'Repayment');
    expect(repaymentLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account: 'CASH', debitKobo: 21_063_026, creditKobo: 0, facility: { kind: 'LOAN', id: chidiLoan }, product: { productId: termProduct, name: 'SME Growth' } }),
        expect.objectContaining({ account: 'INTEREST_INCOME', debitKobo: 0, creditKobo: 1_800_000 }),
      ]),
    );
  });

  it('narrows to one loan product, for a customer or across the whole book, and to a period', async () => {
    const chidiTerm = (await admin.get('/ledger').query({ customerId: chidi, loanProductId: termProduct }).expect(200)).body;
    expect(chidiTerm.product).toMatchObject({ name: 'SME Growth' });
    expect(new Set(chidiTerm.lines.map((line: { facility: { id: string } }) => line.facility.id))).toEqual(new Set([chidiLoan]));
    expect(chidiTerm.totals).toMatchObject({ entryCount: 2, isBalanced: true });

    const invoiceBook = (await admin.get('/ledger').query({ loanProductId: invoiceProduct }).expect(200)).body;
    expect(invoiceBook.customer).toBeNull();
    expect(invoiceBook.position).toBeNull();
    expect(invoiceBook.accounts.map((account: { account: string }) => account.account)).toContain('CLIENT_RECEIVABLE');

    const wholeBook = (await admin.get('/ledger').expect(200)).body;
    expect(wholeBook.totals).toMatchObject({ entryCount: 5, isBalanced: true });
    expect(wholeBook.products.at(-1)).toMatchObject({ product: null, entryCount: 1 }); // Amaka's loan has no product

    const january = (await admin.get('/ledger').query({ customerId: chidi, from: '2026-01-01', to: '2026-01-31' }).expect(200)).body;
    expect(january.lines.map((line: { event: string }) => line.event)).not.toContain('Repayment');
    expect(january.totals.isBalanced).toBe(true);
  });

  it('is admin only, validates its filters, and 404s an unknown customer or product', async () => {
    const officer = await inviteOfficer(testApp, 'ada@lender.test', 'Ada Okoye');
    await officer.client.get('/ledger').expect(403);
    await officer.client.get('/ledger/search').query({ q: 'chidi' }).expect(403);
    const backwards = await admin.get('/ledger').query({ from: '2026-02-01', to: '2026-01-01' }).expect(422);
    expect(backwards.body.errors[0].field).toBe('to');
    await admin.get('/ledger').query({ from: '2026-02-30' }).expect(422);
    await admin.get('/ledger').query({ customerId: 'CUS-999999' }).expect(404);
    await admin.get('/ledger').query({ loanProductId: 'PRD-999999' }).expect(404);
  });
});
