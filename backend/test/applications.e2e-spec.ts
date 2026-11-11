import { HttpClient, inviteOfficer, TestApp, createTestApp } from './test-app';

let keyCounter = 0;
const nextKey = (): string => `app-key-${(keyCounter += 1)}`;
const goldenTerms = { principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 };

interface Notification {
  kind: string;
  link: string | null;
  readAt: string | null;
}

describe('loan applications, approvals and notifications (e2e)', () => {
  let testApp: TestApp;
  let admin: HttpClient;
  let ada: { client: HttpClient; userId: string };
  let bola: { client: HttpClient; userId: string };
  let adminId: string;
  let customerId: string;

  beforeEach(async () => {
    testApp = await createTestApp();
    admin = testApp.http;
    adminId = (await admin.get('/auth/me')).body.user.userId;
    ada = await inviteOfficer(testApp, 'ada@lender.test', 'Ada Okoye');
    bola = await inviteOfficer(testApp, 'bola@lender.test', 'Bola Adeyemi');
    customerId = (await admin.post('/customers').send({ fullName: 'Chidi Okafor', assignedOfficerId: ada.userId }).expect(201)).body.customer.customerId;
  });
  afterEach(async () => {
    await testApp.app.close();
  });

  const inbox = async (client: HttpClient): Promise<{ unreadCount: number; items: Notification[] }> => (await client.get('/notifications').expect(200)).body;

  it('an officer submits an application for their customer; admins are notified, the submitter is not', async () => {
    const created = await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId, purpose: 'Stock for the shop' }).expect(201);
    expect(created.body).toMatchObject({
      applicationId: expect.stringMatching(/^APP-\d{6}$/),
      status: 'SUBMITTED',
      customer: { customerId, fullName: 'Chidi Okafor' },
      assignedOfficer: { userId: ada.userId },
      submittedBy: { userId: ada.userId },
      purpose: 'Stock for the shop',
      verification: { requested: 0, awaitingReview: 0, verified: 0, rejected: 0 },
    });
    expect(created.body.quote.instalmentKobo).toBe(21_063_026);

    const adminInbox = await inbox(admin);
    expect(adminInbox.unreadCount).toBe(1);
    expect(adminInbox.items[0]).toMatchObject({ kind: 'APPLICATION_SUBMITTED', link: `/applications/${created.body.applicationId}`, readAt: null });
    expect((await inbox(ada.client)).unreadCount).toBe(0);
  });

  it('keeps applications inside the book: other officers cannot see them until assigned', async () => {
    const applicationId = (await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(201)).body.applicationId;
    expect((await bola.client.get('/loan-applications').expect(200)).body).toEqual([]);
    await bola.client.get(`/loan-applications/${applicationId}`).expect(403);
    await bola.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(403);

    await bola.client.patch(`/loan-applications/${applicationId}/assignment`).send({ officerId: bola.userId }).expect(403); // admin only
    const assigned = await admin.patch(`/loan-applications/${applicationId}/assignment`).send({ officerId: bola.userId }).expect(200);
    expect(assigned.body.assignedOfficer.userId).toBe(bola.userId);
    expect((await inbox(bola.client)).items[0]).toMatchObject({ kind: 'APPLICATION_ASSIGNED' });
    await bola.client.get(`/loan-applications/${applicationId}`).expect(200);
  });

  it('review → approve with an officer: disburses once, records the approver on the loan and the application', async () => {
    const applicationId = (await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(201)).body.applicationId;
    expect((await admin.post(`/loan-applications/${applicationId}/review`).expect(200)).body).toMatchObject({ status: 'UNDER_REVIEW', reviewedBy: { userId: adminId } });
    await admin.post(`/loan-applications/${applicationId}/review`).expect(409);

    const key = nextKey();
    const [first, second] = await Promise.all([
      admin.post(`/loan-applications/${applicationId}/approve`).set('Idempotency-Key', key).send({ officerId: bola.userId, disbursedOn: '2026-01-15' }),
      admin.post(`/loan-applications/${applicationId}/approve`).set('Idempotency-Key', key).send({ officerId: bola.userId, disbursedOn: '2026-01-15' }),
    ]);
    expect(first.status).toBe(201);
    expect(second.body.loan.loanId).toBe(first.body.loan.loanId);
    const { application, loan, journalEntry } = first.body;
    expect(application).toMatchObject({ status: 'APPROVED', decidedBy: { userId: adminId }, loanId: loan.loanId, assignedOfficer: { userId: bola.userId } });
    expect(application.decidedAt).toBeTruthy();
    expect(loan).toMatchObject({ approvedBy: { userId: adminId, fullName: 'Administrator' }, assignedOfficer: { userId: bola.userId }, applicationId, principalKobo: 120_000_000 });
    expect(journalEntry.lines).toEqual([
      { account: 'LOANS_RECEIVABLE', debitKobo: 120_000_000, creditKobo: 0 },
      { account: 'CASH', debitKobo: 0, creditKobo: 120_000_000 },
    ]);
    expect((await admin.get('/term-loans').expect(200)).body).toHaveLength(1);

    const again = await admin.post(`/loan-applications/${applicationId}/approve`).set('Idempotency-Key', nextKey()).send({}).expect(409);
    expect(again.body.code).toBe('APPLICATION_ALREADY_DECIDED');

    // the submitter and the new officer hear about it
    expect((await inbox(ada.client)).items[0]).toMatchObject({ kind: 'APPLICATION_APPROVED', link: `/loans/${loan.loanId}` });
    expect((await inbox(bola.client)).items.map((item) => item.kind)).toContain('APPLICATION_APPROVED');
    // the assigned officer can open the loan, even though the customer is in Ada's book
    await bola.client.get(`/term-loans/${loan.loanId}`).expect(200);
    await bola.client.get(`/term-loans/${loan.loanId}/statement`).expect(200);
  });

  it('filters loans by who approved them and by officer, on the server', async () => {
    const appA = (await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(201)).body.applicationId;
    const appB = (await ada.client.post('/loan-applications').send({ ...goldenTerms, principalKobo: 50_000_000, customerId }).expect(201)).body.applicationId;
    const approvedByAdmin = (await admin.post(`/loan-applications/${appA}/approve`).set('Idempotency-Key', nextKey()).send({ officerId: bola.userId }).expect(201)).body.loan.loanId;
    const approvedByAda = (await ada.client.post(`/loan-applications/${appB}/approve`).set('Idempotency-Key', nextKey()).send({}).expect(201)).body.loan;
    expect(approvedByAda).toMatchObject({ approvedBy: { userId: ada.userId }, assignedOfficer: { userId: ada.userId } });

    const ids = (body: Array<{ loanId: string }>) => body.map((loan) => loan.loanId).sort();
    expect(ids((await admin.get('/term-loans?approvedBy=me').expect(200)).body)).toEqual([approvedByAdmin]);
    expect(ids((await ada.client.get('/term-loans?approvedBy=me').expect(200)).body)).toEqual([approvedByAda.loanId]);
    expect(ids((await admin.get(`/term-loans?approvedBy=${ada.userId}`).expect(200)).body)).toEqual([approvedByAda.loanId]);
    expect(ids((await bola.client.get('/term-loans?officerId=me').expect(200)).body)).toEqual([approvedByAdmin]);

    // and applications by who decided them
    expect((await admin.get('/loan-applications?decidedBy=me').expect(200)).body.map((app: { applicationId: string }) => app.applicationId)).toEqual([appA]);
    expect((await admin.get('/loan-applications?status=APPROVED').expect(200)).body).toHaveLength(2);
    expect((await admin.get('/loan-applications?status=OPEN').expect(200)).body).toHaveLength(0);
  });

  it('officers can only assign the loan to themselves when they approve', async () => {
    const applicationId = (await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(201)).body.applicationId;
    await ada.client.post(`/loan-applications/${applicationId}/approve`).set('Idempotency-Key', nextKey()).send({ officerId: bola.userId }).expect(403);
    expect((await admin.get(`/loan-applications/${applicationId}`).expect(200)).body.status).toBe('SUBMITTED');
    expect((await admin.get('/term-loans').expect(200)).body).toHaveLength(0);
  });

  it('rejects with a reason and tells the submitter', async () => {
    const applicationId = (await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(201)).body.applicationId;
    const missing = await admin.post(`/loan-applications/${applicationId}/reject`).send({ reason: '' }).expect(422);
    expect(missing.body.errors[0].field).toBe('reason');
    const rejected = await admin.post(`/loan-applications/${applicationId}/reject`).send({ reason: 'BVN could not be verified' }).expect(200);
    expect(rejected.body).toMatchObject({ status: 'REJECTED', rejectionReason: 'BVN could not be verified', decidedBy: { userId: adminId }, loanId: null });
    expect((await inbox(ada.client)).items[0]).toMatchObject({ kind: 'APPLICATION_REJECTED' });
    await admin.post(`/loan-applications/${applicationId}/approve`).set('Idempotency-Key', nextKey()).send({}).expect(409);
  });

  it('checks the requested terms against the product when the application is submitted', async () => {
    const productId = (await admin.post('/loan-products').send({ name: 'Small loan', type: 'TERM_LOAN', maxPrincipalKobo: 10_000_000 }).expect(201)).body.product.productId;
    const response = await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId, loanProductId: productId }).expect(422);
    expect(response.body.errors[0].field).toBe('principalKobo');
  });

  it('search finds applications by applicant name or id', async () => {
    const applicationId = (await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(201)).body.applicationId;
    expect((await admin.get('/loan-applications?search=chidi').expect(200)).body).toHaveLength(1);
    expect((await admin.get(`/loan-applications?search=${applicationId}`).expect(200)).body).toHaveLength(1);
    expect((await admin.get('/loan-applications?search=nobody').expect(200)).body).toHaveLength(0);
  });

  describe('notifications inbox', () => {
    it('marks one or all as read, and nobody can touch another user’s notification', async () => {
      await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(201);
      await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(201);
      const { items } = await inbox(admin);
      expect(items).toHaveLength(2);
      const firstId = (items[0] as unknown as { notificationId: string }).notificationId;

      await ada.client.post(`/notifications/${firstId}/read`).expect(404);
      const afterOne = (await admin.post(`/notifications/${firstId}/read`).expect(200)).body;
      expect(afterOne.unreadCount).toBe(1);
      expect((await admin.get('/notifications?unreadOnly=true').expect(200)).body.items).toHaveLength(1);
      expect((await admin.post('/notifications/read-all').expect(200)).body.unreadCount).toBe(0);
    });

    it('tells an officer when a customer is assigned to them', async () => {
      await admin.patch(`/customers/${customerId}/assignment`).send({ officerId: bola.userId }).expect(200);
      expect((await inbox(bola.client)).items[0]).toMatchObject({ kind: 'CUSTOMER_ASSIGNED', link: `/customers/${customerId}` });
    });
  });
});
