import { createTestApp, HttpClient, inviteOfficer, TestApp } from './test-app';
import request from 'supertest';

/** The customer self-service portal: invitation → sign-in → own loans / applications / documents, and nothing else. */
describe('customer portal (e2e)', () => {
  let testApp: TestApp;
  let admin: HttpClient;
  let ada: { client: HttpClient; userId: string };
  let customerId: string;
  let keyCounter = 0;
  const nextKey = (): string => `portal-key-${(keyCounter += 1)}`;
  const CUSTOMER_PASSWORD = 'CustomerPass1!';

  beforeEach(async () => {
    testApp = await createTestApp();
    admin = testApp.http;
    ada = await inviteOfficer(testApp, 'ada@lender.test', 'Ada Okoye');
    customerId = (await admin.post('/customers').send({ fullName: 'Chidi Okafor', email: 'chidi@example.com', assignedOfficerId: ada.userId }).expect(201)).body.customer.customerId;
  });
  afterEach(async () => {
    await testApp.app.close();
  });

  /** A client carrying only the portal cookie. */
  function portalClientFor(cookieHeader: string): HttpClient {
    const server = testApp.app.getHttpServer();
    return {
      get: (path) => request(server).get(path).set('Cookie', cookieHeader),
      post: (path) => request(server).post(path).set('Cookie', cookieHeader),
      patch: (path) => request(server).patch(path).set('Cookie', cookieHeader),
      delete: (path) => request(server).delete(path).set('Cookie', cookieHeader),
    };
  }
  const cookieFrom = (response: request.Response): string =>
    (response.headers['set-cookie'] as unknown as string[]).map((cookie) => cookie.split(';')[0]).join('; ');

  async function inviteAndJoin(): Promise<HttpClient> {
    const invite = await ada.client.post(`/customers/${customerId}/portal-access/invitation`).send({}).expect(201);
    expect(invite.body.access).toMatchObject({ status: 'INVITED', email: 'chidi@example.com' });
    const token = new URL(invite.body.inviteLink).searchParams.get('token') ?? '';
    expect(invite.body.inviteLink).toContain('/portal/accept-invite?token=');
    expect((await testApp.anonymous.get(`/portal/auth/invitations/${token}`).expect(200)).body).toEqual({ email: 'chidi@example.com', fullName: 'Chidi Okafor' });
    const joined = await testApp.anonymous.post('/portal/auth/accept-invitation').send({ token, password: CUSTOMER_PASSWORD }).expect(201);
    expect(joined.body.customer).toMatchObject({ customerId, fullName: 'Chidi Okafor', email: 'chidi@example.com' });
    return portalClientFor(cookieFrom(joined));
  }

  it('invite → set password → sign in with email and password; the link works once', async () => {
    await inviteAndJoin();
    expect((await admin.get(`/customers/${customerId}/portal-access`).expect(200)).body).toMatchObject({ status: 'ACTIVE', email: 'chidi@example.com' });
    await ada.client.post(`/customers/${customerId}/portal-access/invitation`).send({}).expect(409); // already has a sign-in

    await testApp.anonymous.post('/portal/auth/login').send({ email: 'chidi@example.com', password: 'wrong-password' }).expect(401);
    const login = await testApp.anonymous.post('/portal/auth/login').send({ email: 'CHIDI@example.com', password: CUSTOMER_PASSWORD }).expect(200);
    const customer = portalClientFor(cookieFrom(login));
    expect((await customer.get('/portal/auth/me').expect(200)).body.customer.customerId).toBe(customerId);
  });

  it('sessions never cross: a customer cannot use staff routes, staff cannot use portal routes', async () => {
    const customer = await inviteAndJoin();
    await customer.get('/customers').expect(401);
    await customer.get('/term-loans').expect(401);
    await customer.get('/auth/me').expect(401);
    await admin.get('/portal/overview').expect(401);
    await testApp.anonymous.get('/portal/overview').expect(401);
  });

  it('shows only the customer’s own loans, with a statement in plain terms; another customer’s loan is a 404', async () => {
    const customer = await inviteAndJoin();
    const ownLoanId = (await ada.client.post('/term-loans').set('Idempotency-Key', nextKey()).send({ customerId, principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 }).expect(201)).body.loan.loanId;
    const otherCustomerId = (await admin.post('/customers').send({ fullName: 'Amaka Eze' }).expect(201)).body.customer.customerId;
    const otherLoanId = (await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ customerId: otherCustomerId, principalKobo: 50_000_000, annualRatePercent: 18, termMonths: 6 }).expect(201)).body.loan.loanId;
    await admin.post(`/term-loans/${ownLoanId}/repayments`).set('Idempotency-Key', nextKey()).send({ amountKobo: 21_063_026, paymentDate: '2026-02-15' }).expect(201);

    const loans = (await customer.get('/portal/loans').expect(200)).body;
    expect(loans.map((loan: { loanId: string }) => loan.loanId)).toEqual([ownLoanId]);
    expect(loans[0]).toMatchObject({ outstandingPrincipalKobo: 100_736_974, nextPayment: { instalmentNumber: 2, amountDueKobo: 21_063_026 }, status: 'ACTIVE' });

    const detail = (await customer.get(`/portal/loans/${ownLoanId}`).expect(200)).body;
    expect(detail.schedule).toHaveLength(6);
    expect(detail.officer).toEqual({ userId: ada.userId, fullName: 'Ada Okoye', email: 'ada@lender.test' });
    expect(detail.statement).toEqual([
      expect.objectContaining({ kind: 'DISBURSEMENT', amountKobo: 120_000_000, balanceAfterKobo: 120_000_000 }),
      expect.objectContaining({ kind: 'PAYMENT', amountKobo: 21_063_026, principalKobo: 19_263_026, interestKobo: 1_800_000, creditKobo: 0, balanceAfterKobo: 100_736_974 }),
    ]);
    await customer.get(`/portal/loans/${otherLoanId}`).expect(404);
  });

  it('shows the customer their invoices and what has been paid to them; their officer is on the overview; another customer’s invoice is a 404', async () => {
    const customer = await inviteAndJoin();
    const finance = (forCustomerId: string, client: HttpClient) =>
      client.post('/invoices').set('Idempotency-Key', nextKey()).send({ customerId: forCustomerId, faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02' }).expect(201);
    const invoiceId = (await finance(customerId, ada.client)).body.invoice.invoiceId as string;
    const otherCustomerId = (await admin.post('/customers').send({ fullName: 'Amaka Eze' }).expect(201)).body.customer.customerId;
    const otherInvoiceId = (await finance(otherCustomerId, admin)).body.invoice.invoiceId as string;

    // Open (today is 2026-01-15): the advance is what has been paid so far.
    const open = (await customer.get('/portal/invoices').expect(200)).body;
    expect(open.map((invoice: { invoiceId: string }) => invoice.invoiceId)).toEqual([invoiceId]);
    expect(open[0]).toMatchObject({ status: 'OPEN', advanceKobo: 80_000_000, reserveKobo: 20_000_000, discountFeeKobo: 4_734_247, totalPaidToYouKobo: 80_000_000, reserveReleasedKobo: 0 });

    const overview = (await customer.get('/portal/overview').expect(200)).body;
    expect(overview.officer).toEqual({ userId: ada.userId, fullName: 'Ada Okoye', email: 'ada@lender.test' });
    expect(overview.invoices).toHaveLength(1);

    // Settled 95 days late: the reserve less fee and penalty (65,753) is paid out on top of the advance.
    await ada.client.post(`/invoices/${invoiceId}/settlement`).set('Idempotency-Key', nextKey()).send({ settlementDate: '2026-06-05' }).expect(201);
    expect((await customer.get(`/portal/invoices/${invoiceId}`).expect(200)).body).toMatchObject({
      status: 'SETTLED',
      settledOn: '2026-06-05',
      daysOverdue: 95,
      latePenaltyKobo: 15_200_000,
      reserveReleasedKobo: 65_753,
      totalPaidToYouKobo: 80_065_753,
      youOweKobo: 0,
    });
    await customer.get(`/portal/invoices/${otherInvoiceId}`).expect(404);
  });

  it('applies online at the product’s rate; staff see it in their queue and the customer hears the decision', async () => {
    const customer = await inviteAndJoin();
    const product = (await admin.post('/loan-products').send({ name: 'SME Growth', type: 'TERM_LOAN', minAnnualRatePercent: 18, maxAnnualRatePercent: 30, minTermMonths: 3, maxTermMonths: 12 }).expect(201)).body.product;
    expect((await customer.get('/portal/products').expect(200)).body).toEqual([expect.objectContaining({ productId: product.productId, annualRatePercent: 18 })]);

    const quote = await customer.post('/portal/quote').send({ loanProductId: product.productId, principalKobo: 120_000_000, termMonths: 6 }).expect(200);
    expect(quote.body).toMatchObject({ annualRatePercent: 18, instalmentKobo: 21_063_026 });
    const outOfRange = await customer.post('/portal/applications').send({ loanProductId: product.productId, principalKobo: 120_000_000, termMonths: 24 }).expect(422);
    expect(outOfRange.body.errors[0].field).toBe('termMonths');

    const applied = await customer.post('/portal/applications').send({ loanProductId: product.productId, principalKobo: 120_000_000, termMonths: 6, purpose: 'Stock' }).expect(201);
    expect(applied.body).toMatchObject({ status: 'SUBMITTED', annualRatePercent: 18, product: { name: 'SME Growth' } });

    const staffView = (await ada.client.get(`/loan-applications/${applied.body.applicationId}`).expect(200)).body;
    expect(staffView).toMatchObject({ channel: 'PORTAL', submittedBy: null, assignedOfficer: { userId: ada.userId } });
    expect((await ada.client.get('/notifications').expect(200)).body.items[0]).toMatchObject({ kind: 'APPLICATION_SUBMITTED' });

    await admin.post(`/loan-applications/${applied.body.applicationId}/approve`).set('Idempotency-Key', nextKey()).send({}).expect(201);
    const inbox = (await customer.get('/portal/notifications').expect(200)).body;
    expect(inbox.items.map((item: { kind: string }) => item.kind)).toEqual(['APPLICATION_APPROVED', 'APPLICATION_RECEIVED']);
    expect((await customer.get('/portal/overview').expect(200)).body.loans).toHaveLength(1);
  });

  it('uploads a requested document; staff see it was the customer, and a rejection reason comes back to them', async () => {
    const customer = await inviteAndJoin();
    await ada.client.post(`/customers/${customerId}/documents/requests`).send({ type: 'BANK_STATEMENT', note: 'Last 6 months' }).expect(201);
    const requested = (await customer.get('/portal/documents').expect(200)).body;
    expect(requested).toEqual([expect.objectContaining({ type: 'BANK_STATEMENT', status: 'REQUESTED', requestNote: 'Last 6 months' })]);
    expect((await customer.get('/portal/notifications').expect(200)).body.items[0]).toMatchObject({ kind: 'DOCUMENT_REQUESTED', link: '/portal/documents' });

    await customer.post('/portal/documents').field('type', 'BANK_STATEMENT').expect(422); // a statement needs a file
    const uploaded = await customer.post('/portal/documents').field('type', 'BANK_STATEMENT').attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'statement.pdf', contentType: 'application/pdf' }).expect(201);
    expect(uploaded.body).toMatchObject({ documentId: requested[0].documentId, status: 'SUBMITTED', hasFile: true });

    const staffDocuments = (await ada.client.get(`/customers/${customerId}/documents`).expect(200)).body;
    expect(staffDocuments[0]).toMatchObject({ submittedByCustomer: true, submittedBy: null });
    await ada.client.post(`/customers/${customerId}/documents/${uploaded.body.documentId}/review`).send({ decision: 'REJECTED', note: 'Page 2 is missing' }).expect(200);
    expect((await customer.get('/portal/documents').expect(200)).body[0]).toMatchObject({ status: 'REJECTED', reviewNote: 'Page 2 is missing' });
  });

  it('an admin can switch a customer’s sign-in off; their open session stops working at once', async () => {
    const customer = await inviteAndJoin();
    await ada.client.patch(`/customers/${customerId}/portal-access`).send({ status: 'DISABLED' }).expect(403); // admins only
    await admin.patch(`/customers/${customerId}/portal-access`).send({ status: 'DISABLED' }).expect(200);
    await customer.get('/portal/overview').expect(401);
    await testApp.anonymous.post('/portal/auth/login').send({ email: 'chidi@example.com', password: CUSTOMER_PASSWORD }).expect(403);
  });

  it('officers can only invite customers in their own book', async () => {
    const bola = await inviteOfficer(testApp, 'bola@lender.test', 'Bola Adeyemi');
    await bola.client.post(`/customers/${customerId}/portal-access/invitation`).send({}).expect(403);
    const noEmail = (await admin.post('/customers').send({ fullName: 'No Email' }).expect(201)).body.customer.customerId;
    expect((await admin.post(`/customers/${noEmail}/portal-access/invitation`).send({}).expect(422)).body.errors[0].field).toBe('email');
  });
});
