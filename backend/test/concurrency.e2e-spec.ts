import { PrismaService } from '../src/database/prisma.service';
import { createTestApp, HttpClient, inviteOfficer, TestApp } from './test-app';

/**
 * Races: the same money movement fired several times at the same moment (double clicks, two tabs, two staff members).
 * Every request below is in flight at once (Promise.all over real HTTP calls). Whatever the interleaving, money must move
 * exactly once and the ledger must still tie to the schedules.
 */
describe('concurrency: double submits and races (e2e)', () => {
  let testApp: TestApp;
  let admin: HttpClient;
  let prisma: PrismaService;
  let keyCounter = 0;
  const nextKey = (): string => `race-key-${(keyCounter += 1)}`;
  const goldenTerms = { principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 };

  beforeEach(async () => {
    testApp = await createTestApp();
    admin = testApp.http;
    prisma = testApp.app.get(PrismaService);
  });
  afterEach(async () => {
    await testApp.app.close();
  });

  const statuses = (responses: ReadonlyArray<{ status: number }>) => responses.map((response) => response.status).sort();

  async function disburseGoldenLoan(): Promise<string> {
    return (await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send(goldenTerms).expect(201)).body.loan.loanId as string;
  }

  async function ledgerTiesToSchedules(): Promise<void> {
    const dashboard = (await admin.get('/admin/dashboard').expect(200)).body;
    expect(dashboard.ledger.loansReceivableTiesToSchedules).toBe(true);
  }

  it('the same Idempotency-Key fired five times at once posts one repayment and returns the same body to all', async () => {
    const loanId = await disburseGoldenLoan();
    const key = nextKey();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => admin.post(`/term-loans/${loanId}/repayments`).set('Idempotency-Key', key).send({ amountKobo: 21_063_026, paymentDate: '2026-02-15' })),
    );
    expect(statuses(responses)).toEqual([201, 201, 201, 201, 201]);
    expect(new Set(responses.map((response) => response.body.repaymentId)).size).toBe(1);
    expect(await prisma.db.repayment.count({ where: { loanId } })).toBe(1);
    await ledgerTiesToSchedules();
  });

  it('two different payments on the same loan at once are applied one after the other, never against the same balance', async () => {
    const loanId = await disburseGoldenLoan();
    const pay = () => admin.post(`/term-loans/${loanId}/repayments`).set('Idempotency-Key', nextKey()).send({ amountKobo: 21_063_026, paymentDate: '2026-02-15' });
    const responses = await Promise.all([pay(), pay(), pay()]);
    expect(statuses(responses)).toEqual([201, 201, 201]);

    // Each payment cleared a different instalment: 1, 2 and 3 — none was allocated twice.
    const cleared = responses.map((response) => response.body.allocation.allocations[0].instalmentNumber).sort();
    expect(cleared).toEqual([1, 2, 3]);
    const loan = (await admin.get(`/term-loans/${loanId}`).expect(200)).body;
    expect(loan.schedule.map((row: { status: string }) => row.status)).toEqual(['PAID', 'PAID', 'PAID', 'UNPAID', 'UNPAID', 'UNPAID']);
    expect(loan.outstandingPrincipalKobo).toBe(61_339_752);
    await ledgerTiesToSchedules();
  });

  it('an over-payment racing a payment never over-collects an instalment; the surplus becomes unapplied credit once', async () => {
    const loanId = await disburseGoldenLoan();
    const pay = (amountKobo: number) => admin.post(`/term-loans/${loanId}/repayments`).set('Idempotency-Key', nextKey()).send({ amountKobo, paymentDate: '2026-02-15' });
    const responses = await Promise.all([pay(126_378_154), pay(1_000_000)]); // full payoff (principal + all interest) and a small extra
    expect(statuses(responses)).toEqual([201, 201]);
    const loan = (await admin.get(`/term-loans/${loanId}`).expect(200)).body;
    expect(loan.outstandingPrincipalKobo).toBe(0);
    expect(loan.unappliedCreditKobo).toBe(1_000_000);
    await ledgerTiesToSchedules();
  });

  it('two settlements of one invoice with different keys: one posts, the other is a 409', async () => {
    const invoiceId = (await admin.post('/invoices').set('Idempotency-Key', nextKey()).send({ faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02' }).expect(201)).body
      .invoice.invoiceId as string;
    const settle = () => admin.post(`/invoices/${invoiceId}/settlement`).set('Idempotency-Key', nextKey()).send({ settlementDate: '2026-06-06' });
    const responses = await Promise.all([settle(), settle(), settle()]);
    expect(statuses(responses)).toEqual([201, 409, 409]);
    expect(responses.filter((response) => response.status === 409).every((response) => response.body.code === 'INVOICE_ALREADY_SETTLED')).toBe(true);
    expect(await prisma.db.invoiceSettlement.count({ where: { invoiceId } })).toBe(1);
    expect(await prisma.db.journalEntry.count({ where: { invoiceId } })).toBe(2); // the advance + one settlement
  });

  describe('applications', () => {
    let ada: { client: HttpClient; userId: string };
    let applicationId: string;

    beforeEach(async () => {
      ada = await inviteOfficer(testApp, 'ada@lender.test', 'Ada Okoye');
      const customerId = (await admin.post('/customers').send({ fullName: 'Chidi Okafor', assignedOfficerId: ada.userId }).expect(201)).body.customer.customerId;
      applicationId = (await ada.client.post('/loan-applications').send({ ...goldenTerms, customerId }).expect(201)).body.applicationId;
    });

    it('approve (two staff, two keys) at once disburses exactly one loan', async () => {
      const approve = (client: HttpClient) => client.post(`/loan-applications/${applicationId}/approve`).set('Idempotency-Key', nextKey()).send({});
      const responses = await Promise.all([approve(admin), approve(ada.client), approve(admin)]);
      expect(statuses(responses)).toEqual([201, 409, 409]);
      expect(await prisma.db.termLoan.count({ where: { applicationId } })).toBe(1);
      expect(await prisma.db.journalEntry.count({ where: { event: 'Disbursement' } })).toBe(1);
      await ledgerTiesToSchedules();
    });

    it('approve and reject at the same moment: exactly one decision wins, and the application matches it', async () => {
      const [approved, rejected] = await Promise.all([
        admin.post(`/loan-applications/${applicationId}/approve`).set('Idempotency-Key', nextKey()).send({}),
        ada.client.post(`/loan-applications/${applicationId}/reject`).send({ reason: 'Missing documents' }),
      ]);
      expect([approved.status, rejected.status].filter((status) => status === 409)).toHaveLength(1);
      const application = (await admin.get(`/loan-applications/${applicationId}`).expect(200)).body;
      const loans = await prisma.db.termLoan.count({ where: { applicationId } });
      if (approved.status === 201) {
        expect(application.status).toBe('APPROVED');
        expect(loans).toBe(1);
      } else {
        expect(application.status).toBe('REJECTED');
        expect(loans).toBe(0);
      }
    });
  });

  it('two reviewers deciding one document at once: one decision is recorded, the other is a 409', async () => {
    const customerId = (await admin.post('/customers').send({ fullName: 'Ngozi Umeh' }).expect(201)).body.customer.customerId;
    const documentId = (await admin.post(`/customers/${customerId}/documents`).field('type', 'NIN').field('identifier', '12345678901').expect(201)).body.documentId;
    const review = (decision: 'VERIFIED' | 'REJECTED') => admin.post(`/customers/${customerId}/documents/${documentId}/review`).send({ decision, note: 'Checked' });
    const responses = await Promise.all([review('VERIFIED'), review('REJECTED')]);
    expect(statuses(responses)).toEqual([200, 409]);
  });

  it('the same invitation link accepted twice at once creates one account', async () => {
    const invite = await admin.post('/team/invitations').send({ email: 'tunde@lender.test', role: 'LOAN_OFFICER' }).expect(201);
    const token = new URL(invite.body.inviteLink).searchParams.get('token') ?? '';
    const accept = () => testApp.anonymous.post('/auth/accept-invitation').send({ token, fullName: 'Tunde Bakare', password: 'OfficerPass1!' });
    const responses = await Promise.all([accept(), accept()]);
    expect(statuses(responses)).toEqual([201, 400]);
    expect(await prisma.db.user.count({ where: { email: 'tunde@lender.test' } })).toBe(1);
  });
});
