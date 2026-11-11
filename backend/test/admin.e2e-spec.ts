import { INestApplication } from '@nestjs/common';
import { ADMIN_EMAIL, ADMIN_PASSWORD, createTestApp, HttpClient, TestApp } from './test-app';

let keyCounter = 0;
const nextKey = (): string => `admin-key-${(keyCounter += 1)}`;
const goldenLoan = { principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 };

describe('admin, auth and team (e2e)', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let admin: HttpClient;

  beforeEach(async () => {
    testApp = await createTestApp();
    ({ app, http: admin } = testApp);
  });
  afterEach(async () => {
    await app.close();
  });

  /** Invites an officer as admin, accepts the invitation, returns a signed-in client + the new user id. */
  async function createOfficer(email: string, fullName = 'Ada Officer'): Promise<{ client: HttpClient; userId: string }> {
    const invite = await admin.post('/team/invitations').send({ email, role: 'LOAN_OFFICER' }).expect(201);
    const token = new URL(invite.body.inviteLink).searchParams.get('token') ?? '';
    await testApp.anonymous.post('/auth/accept-invitation').send({ token, fullName, password: 'OfficerPass1!' }).expect(201);
    const client = await testApp.loginAs(email, 'OfficerPass1!');
    const me = await client.get('/auth/me').expect(200);
    return { client, userId: me.body.user.userId as string };
  }

  describe('authentication', () => {
    it('rejects unauthenticated requests with the uniform envelope', async () => {
      const response = await testApp.anonymous.get('/customers').expect(401);
      expect(response.body).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' });
    });

    it('logs in with an HttpOnly cookie, never exposing the token in the body', async () => {
      const response = await testApp.anonymous.post('/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }).expect(200);
      expect(response.body.user).toMatchObject({ email: ADMIN_EMAIL, role: 'ADMIN' });
      expect(JSON.stringify(response.body)).not.toMatch(/eyJ/);
      const cookie = (response.headers['set-cookie'] as unknown as string[])[0] ?? '';
      expect(cookie).toMatch(/access_token=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
    });

    it('"Remember me" extends the session cookie from 8 hours to 30 days', async () => {
      const maxAgeOf = async (rememberMe?: boolean): Promise<number> => {
        const response = await testApp.anonymous.post('/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, rememberMe }).expect(200);
        const cookie = (response.headers['set-cookie'] as unknown as string[])[0] ?? '';
        return Number(/Max-Age=(\d+)/i.exec(cookie)?.[1]);
      };
      expect(await maxAgeOf()).toBe(8 * 60 * 60);
      expect(await maxAgeOf(false)).toBe(8 * 60 * 60);
      expect(await maxAgeOf(true)).toBe(30 * 24 * 60 * 60);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const wrongPassword = await testApp.anonymous.post('/auth/login').send({ email: ADMIN_EMAIL, password: 'nope-nope' }).expect(401);
      const unknownEmail = await testApp.anonymous.post('/auth/login').send({ email: 'ghost@lender.test', password: 'nope-nope' }).expect(401);
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('returns the current user from /auth/me', async () => {
      const response = await admin.get('/auth/me').expect(200);
      expect(response.body.user.role).toBe('ADMIN');
    });
  });

  describe('change password', () => {
    it('changes the password: old one stops working, new one works', async () => {
      const { client } = await createOfficer('ada@lender.test');
      await client.post('/auth/change-password').send({ currentPassword: 'OfficerPass1!', newPassword: 'BrandNewPass2!' }).expect(204);
      await testApp.anonymous.post('/auth/login').send({ email: 'ada@lender.test', password: 'OfficerPass1!' }).expect(401);
      await testApp.anonymous.post('/auth/login').send({ email: 'ada@lender.test', password: 'BrandNewPass2!' }).expect(200);
    });

    it('reports problems against the right field and never answers 401 (which means "signed out")', async () => {
      const { client } = await createOfficer('ada@lender.test');
      const wrong = await client.post('/auth/change-password').send({ currentPassword: 'not-my-password', newPassword: 'BrandNewPass2!' }).expect(422);
      expect(wrong.body.errors[0].field).toBe('currentPassword');
      const same = await client.post('/auth/change-password').send({ currentPassword: 'OfficerPass1!', newPassword: 'OfficerPass1!' }).expect(422);
      expect(same.body.errors[0].field).toBe('newPassword');
      const short = await client.post('/auth/change-password').send({ currentPassword: 'OfficerPass1!', newPassword: 'short' }).expect(422);
      expect(short.body.errors[0].field).toBe('newPassword');
      await testApp.anonymous.post('/auth/change-password').send({ currentPassword: 'x', newPassword: 'BrandNewPass2!' }).expect(401);
    });
  });

  describe('team invitations', () => {
    it('admin invites an officer, who accepts and signs in; the link works once', async () => {
      const invite = await admin.post('/team/invitations').send({ email: 'Ada@Lender.test', role: 'LOAN_OFFICER' }).expect(201);
      expect(invite.body.invitation).toMatchObject({ email: 'ada@lender.test', role: 'LOAN_OFFICER', status: 'PENDING' });
      const token = new URL(invite.body.inviteLink).searchParams.get('token') ?? '';

      const described = await testApp.anonymous.get(`/auth/invitations/${token}`).expect(200);
      expect(described.body).toEqual({ email: 'ada@lender.test', role: 'LOAN_OFFICER' });

      const accepted = await testApp.anonymous.post('/auth/accept-invitation').send({ token, fullName: 'Ada Officer', password: 'OfficerPass1!' }).expect(201);
      expect(accepted.body.user).toMatchObject({ email: 'ada@lender.test', role: 'LOAN_OFFICER', fullName: 'Ada Officer' });

      const reused = await testApp.anonymous.post('/auth/accept-invitation').send({ token, fullName: 'Someone Else', password: 'OfficerPass1!' }).expect(400);
      expect(reused.body.code).toBe('INVITATION_INVALID');
      const members = await admin.get('/team/members').expect(200);
      expect(members.body.map((member: { email: string }) => member.email).sort()).toEqual(['ada@lender.test', ADMIN_EMAIL]);
    });

    it('re-inviting replaces the old link; a revoked link stops working', async () => {
      const first = await admin.post('/team/invitations').send({ email: 'bola@lender.test', role: 'LOAN_OFFICER' }).expect(201);
      const firstToken = new URL(first.body.inviteLink).searchParams.get('token') ?? '';
      const second = await admin.post('/team/invitations').send({ email: 'bola@lender.test', role: 'LOAN_OFFICER' }).expect(201);
      await testApp.anonymous.get(`/auth/invitations/${firstToken}`).expect(400);

      await admin.delete(`/team/invitations/${second.body.invitation.invitationId}`).expect(200);
      const secondToken = new URL(second.body.inviteLink).searchParams.get('token') ?? '';
      await testApp.anonymous.get(`/auth/invitations/${secondToken}`).expect(400);
    });

    it('refuses to invite an existing member, and validates the email', async () => {
      const existing = await admin.post('/team/invitations').send({ email: ADMIN_EMAIL, role: 'LOAN_OFFICER' }).expect(409);
      expect(existing.body.code).toBe('USER_ALREADY_EXISTS');
      const invalid = await admin.post('/team/invitations').send({ email: 'not-an-email', role: 'LOAN_OFFICER' }).expect(422);
      expect(invalid.body.errors[0].field).toBe('email');
    });

    it('rejects a weak password on acceptance against the password field', async () => {
      const invite = await admin.post('/team/invitations').send({ email: 'weak@lender.test', role: 'LOAN_OFFICER' }).expect(201);
      const token = new URL(invite.body.inviteLink).searchParams.get('token') ?? '';
      const response = await testApp.anonymous.post('/auth/accept-invitation').send({ token, fullName: 'Weak Pass', password: 'short' }).expect(422);
      expect(response.body.errors.map((error: { field: string }) => error.field)).toContain('password');
    });

    it('officers cannot manage the team (403), and a disabled officer is locked out immediately', async () => {
      const { client, userId } = await createOfficer('ada@lender.test');
      await client.get('/team/members').expect(403);
      await client.post('/team/invitations').send({ email: 'x@lender.test', role: 'ADMIN' }).expect(403);

      await admin.patch(`/team/members/${userId}/status`).send({ status: 'DISABLED' }).expect(200);
      await client.get('/auth/me').expect(401);
      const relogin = await testApp.anonymous.post('/auth/login').send({ email: 'ada@lender.test', password: 'OfficerPass1!' }).expect(403);
      expect(relogin.body.code).toBe('ACCOUNT_DISABLED');
    });

    it('an admin cannot disable themselves', async () => {
      const me = await admin.get('/auth/me');
      await admin.patch(`/team/members/${me.body.user.userId}/status`).send({ status: 'DISABLED' }).expect(409);
    });
  });

  describe('customers and officer assignment', () => {
    it('admin creates a customer, assigns an officer; the officer sees only their own customers', async () => {
      const { client: ada, userId: adaId } = await createOfficer('ada@lender.test', 'Ada Officer');
      const { client: bola } = await createOfficer('bola@lender.test', 'Bola Officer');

      const created = await admin.post('/customers').send({ fullName: 'Chidi Okafor', email: 'chidi@example.com', phone: '+2348012345678' }).expect(201);
      const customerId = created.body.customer.customerId as string;
      expect(created.body.customer.assignedOfficer).toBeNull();
      await admin.post('/customers').send({ fullName: 'Unassigned Person' }).expect(201);

      const assigned = await admin.patch(`/customers/${customerId}/assignment`).send({ officerId: adaId }).expect(200);
      expect(assigned.body.customer.assignedOfficer).toMatchObject({ userId: adaId, fullName: 'Ada Officer' });

      expect((await ada.get('/customers').expect(200)).body.map((row: { fullName: string }) => row.fullName)).toEqual(['Chidi Okafor']);
      expect((await bola.get('/customers').expect(200)).body).toEqual([]);
      expect((await admin.get('/customers').expect(200)).body).toHaveLength(2);
      expect((await admin.get('/customers?unassigned=true').expect(200)).body).toHaveLength(1);
      expect((await admin.get('/customers?search=chidi').expect(200)).body).toHaveLength(1);

      await ada.get(`/customers/${customerId}`).expect(200);
      await bola.get(`/customers/${customerId}`).expect(403);
    });

    it('only admins can assign; assignment must target an active loan officer; null un-assigns', async () => {
      const { client: ada, userId: adaId } = await createOfficer('ada@lender.test');
      const customer = (await admin.post('/customers').send({ fullName: 'Chidi Okafor' }).expect(201)).body.customer.customerId as string;

      await ada.patch(`/customers/${customer}/assignment`).send({ officerId: adaId }).expect(403);
      const me = await admin.get('/auth/me');
      const toAdmin = await admin.patch(`/customers/${customer}/assignment`).send({ officerId: me.body.user.userId }).expect(422);
      expect(toAdmin.body.errors[0].field).toBe('officerId');

      await admin.patch(`/customers/${customer}/assignment`).send({ officerId: adaId }).expect(200);
      const cleared = await admin.patch(`/customers/${customer}/assignment`).send({ officerId: null }).expect(200);
      expect(cleared.body.customer.assignedOfficer).toBeNull();
    });

    it('an officer-created customer is assigned to that officer automatically', async () => {
      const { client: ada, userId: adaId } = await createOfficer('ada@lender.test');
      const created = await ada.post('/customers').send({ fullName: 'Walk-in Customer', assignedOfficerId: 'someone-else' }).expect(201);
      expect(created.body.customer.assignedOfficer.userId).toBe(adaId);
    });

    it('validates customer input', async () => {
      const response = await admin.post('/customers').send({ fullName: 'A', email: 'nope', phone: 'abc' }).expect(422);
      expect(response.body.errors.map((error: { field: string }) => error.field).sort()).toEqual(['email', 'fullName', 'phone']);
    });
  });

  describe('officers originate only for their own customers', () => {
    it('requires a named, assigned customer', async () => {
      const { client: ada, userId: adaId } = await createOfficer('ada@lender.test');
      const mine = (await admin.post('/customers').send({ fullName: 'Mine', assignedOfficerId: adaId }).expect(201)).body.customer.customerId as string;
      const notMine = (await admin.post('/customers').send({ fullName: 'Not Mine' }).expect(201)).body.customer.customerId as string;

      const noCustomer = await ada.post('/term-loans').set('Idempotency-Key', nextKey()).send(goldenLoan).expect(422);
      expect(noCustomer.body.errors[0].field).toBe('customerId');
      await ada.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, customerId: notMine }).expect(403);
      const ok = await ada.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, customerId: mine }).expect(201);

      await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, customerId: notMine }).expect(201);
      expect((await ada.get('/term-loans').expect(200)).body).toHaveLength(1);
      expect((await admin.get('/term-loans').expect(200)).body).toHaveLength(2);

      const loanId = ok.body.loan.loanId as string;
      await ada.get(`/term-loans/${loanId}/statement`).expect(200);
      const foreignLoan = (await admin.get('/term-loans').expect(200)).body.find((loan: { customerId: string }) => loan.customerId === notMine).loanId;
      await ada.get(`/term-loans/${foreignLoan}`).expect(403);
      await ada.get(`/term-loans/${foreignLoan}/statement`).expect(403);
      await ada
        .post(`/term-loans/${foreignLoan}/repayments`)
        .set('Idempotency-Key', nextKey())
        .send({ amountKobo: 1000, paymentDate: '2026-02-15' })
        .expect(403);
    });
  });

  describe('loan products', () => {
    const termProduct = {
      name: 'SME Term Loan',
      type: 'TERM_LOAN',
      minPrincipalKobo: 10_000_000,
      maxPrincipalKobo: 200_000_000,
      minAnnualRatePercent: 12,
      maxAnnualRatePercent: 24,
      minTermMonths: 3,
      maxTermMonths: 12,
    };

    it('admin creates and lists products; officers can read but not write', async () => {
      const { client: ada } = await createOfficer('ada@lender.test');
      const created = await admin.post('/loan-products').send(termProduct).expect(201);
      expect(created.body.product).toMatchObject({ name: 'SME Term Loan', status: 'ACTIVE', minAnnualRatePercent: 12 });
      expect(created.body.stats).toEqual({ customerCount: 0, facilityCount: 0, outstandingKobo: 0 });

      expect((await ada.get('/loan-products?status=ACTIVE').expect(200)).body).toHaveLength(1);
      await ada.post('/loan-products').send({ ...termProduct, name: 'Other' }).expect(403);
      const duplicate = await admin.post('/loan-products').send(termProduct).expect(409);
      expect(duplicate.body.code).toBe('PRODUCT_NAME_TAKEN');
    });

    it('defaults invoice products and rejects inconsistent limits against the right field', async () => {
      const invoiceProduct = await admin.post('/loan-products').send({ name: 'Invoice Advance', type: 'INVOICE_FINANCING' }).expect(201);
      expect(invoiceProduct.body.product).toMatchObject({ minAnnualRatePercent: null, minTermMonths: null });

      const bad = await admin.post('/loan-products').send({ ...termProduct, name: 'Bad', minPrincipalKobo: 500_000, maxPrincipalKobo: 100_000 }).expect(422);
      expect(bad.body.errors[0].field).toBe('minPrincipalKobo');
      const badRate = await admin.post('/loan-products').send({ ...termProduct, name: 'Bad Rate', minAnnualRatePercent: 30, maxAnnualRatePercent: 20 }).expect(422);
      expect(badRate.body.errors[0].field).toBe('minAnnualRatePercent');
    });

    it('enforces product limits and the archived state when originating', async () => {
      const product = (await admin.post('/loan-products').send(termProduct).expect(201)).body.product.productId as string;
      const customerId = (await admin.post('/customers').send({ fullName: 'Chidi Okafor' }).expect(201)).body.customer.customerId as string;
      const inside = { principalKobo: 50_000_000, annualRatePercent: 18, termMonths: 6, customerId, loanProductId: product };

      const outside = await admin
        .post('/term-loans')
        .set('Idempotency-Key', nextKey())
        .send({ ...inside, principalKobo: 500_000_000, annualRatePercent: 40, termMonths: 24 })
        .expect(422);
      expect(outside.body.errors.map((error: { field: string }) => error.field).sort()).toEqual(['annualRatePercent', 'principalKobo', 'termMonths']);

      await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send(inside).expect(201);

      await admin.patch(`/loan-products/${product}`).send({ status: 'ARCHIVED' }).expect(200);
      const archived = await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send(inside).expect(422);
      expect(archived.body.errors[0]).toMatchObject({ field: 'loanProductId' });

      const invoiceProduct = (await admin.post('/loan-products').send({ name: 'Invoices', type: 'INVOICE_FINANCING' }).expect(201)).body.product.productId as string;
      const wrongType = await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...inside, loanProductId: invoiceProduct }).expect(422);
      expect(wrongType.body.errors[0].field).toBe('loanProductId');
    });

    it('quotes are checked like postings: a quote outside the product is refused, in naira, against the right field', async () => {
      const product = (await admin.post('/loan-products').send(termProduct).expect(201)).body.product.productId as string;
      const customerId = (await admin.post('/customers').send({ fullName: 'Chidi Okafor' }).expect(201)).body.customer.customerId as string;

      const tooBig = await admin.post('/term-loans/quote').send({ principalKobo: 500_000_000, annualRatePercent: 18, termMonths: 6, customerId, loanProductId: product }).expect(422);
      expect(tooBig.body.errors).toEqual([{ field: 'principalKobo', message: 'SME Term Loan lends ₦100,000.00 to ₦2,000,000.00. ₦5,000,000.00 is above that.' }]);
      const badTerms = await admin.post('/term-loans/quote').send({ principalKobo: 50_000_000, annualRatePercent: 30, termMonths: 2, customerId, loanProductId: product }).expect(422);
      expect(badTerms.body.errors).toEqual(
        expect.arrayContaining([
          { field: 'annualRatePercent', message: 'SME Term Loan charges 12% to 24% a year. 30% is outside that.' },
          { field: 'termMonths', message: 'SME Term Loan runs for 3 to 12 months. 2 months is outside that.' },
        ]),
      );
      await admin.post('/term-loans/quote').send({ principalKobo: 50_000_000, annualRatePercent: 18, termMonths: 6, customerId, loanProductId: product }).expect(200);
      await admin.post('/term-loans/quote').send({ principalKobo: 500_000_000, annualRatePercent: 18, termMonths: 6 }).expect(200); // no product: platform limits only

      // An officer cannot even quote for someone else's customer.
      const { client: ada } = await createOfficer('ada@lender.test');
      await ada.post('/term-loans/quote').send({ principalKobo: 50_000_000, annualRatePercent: 18, termMonths: 6, customerId }).expect(403);

      const invoiceProduct = (await admin.post('/loan-products').send({ name: 'Invoice Advance', type: 'INVOICE_FINANCING', maxPrincipalKobo: 10_000_000 }).expect(201)).body.product.productId as string;
      const bigInvoice = await admin.post('/invoices/quote').send({ faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02', customerId, loanProductId: invoiceProduct }).expect(422);
      expect(bigInvoice.body.errors[0]).toMatchObject({ field: 'faceValueKobo', message: expect.stringContaining('Invoice Advance finances invoices of') });
    });

    it('lists every customer associated with a product, with exposure — admin only', async () => {
      const { client: ada } = await createOfficer('ada@lender.test');
      const product = (await admin.post('/loan-products').send(termProduct).expect(201)).body.product.productId as string;
      const invoiceProduct = (await admin.post('/loan-products').send({ name: 'Invoices', type: 'INVOICE_FINANCING' }).expect(201)).body.product.productId as string;
      const chidi = (await admin.post('/customers').send({ fullName: 'Chidi Okafor' }).expect(201)).body.customer.customerId as string;
      const amaka = (await admin.post('/customers').send({ fullName: 'Amaka Eze' }).expect(201)).body.customer.customerId as string;

      await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ principalKobo: 50_000_000, annualRatePercent: 18, termMonths: 6, customerId: chidi, loanProductId: product }).expect(201);
      await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ principalKobo: 30_000_000, annualRatePercent: 18, termMonths: 6, customerId: chidi, loanProductId: product }).expect(201);
      await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ principalKobo: 20_000_000, annualRatePercent: 18, termMonths: 6, customerId: amaka, loanProductId: product }).expect(201);
      await admin.post('/invoices').set('Idempotency-Key', nextKey()).send({ faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02', customerId: amaka, loanProductId: invoiceProduct }).expect(201);

      const members = (await admin.get(`/loan-products/${product}/customers`).expect(200)).body;
      expect(members).toHaveLength(2);
      expect(members.find((row: { customerId: string }) => row.customerId === chidi)).toMatchObject({ facilityCount: 2, outstandingKobo: 80_000_000 });
      expect(members.find((row: { customerId: string }) => row.customerId === amaka)).toMatchObject({ facilityCount: 1, outstandingKobo: 20_000_000 });

      const invoiceMembers = (await admin.get(`/loan-products/${invoiceProduct}/customers`).expect(200)).body;
      expect(invoiceMembers[0]).toMatchObject({ customerId: amaka, facilityCount: 1, outstandingKobo: 80_000_000 });

      expect((await admin.get(`/loan-products/${product}`).expect(200)).body.stats).toEqual({ customerCount: 2, facilityCount: 3, outstandingKobo: 100_000_000 });
      await ada.get(`/loan-products/${product}/customers`).expect(403);
    });
  });

  describe('dashboard trends', () => {
    it('returns 30 daily points and compares month to date with the same days last month', async () => {
      // today is 2026-01-15
      const customer = (await admin.post('/customers').send({ fullName: 'Chidi' }).expect(201)).body.customer.customerId as string;
      await admin.post('/customers').send({ fullName: 'Amaka' }).expect(201);
      const loanA = await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, customerId: customer, disbursedOn: '2026-01-10' }).expect(201);
      await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, principalKobo: 60_000_000, customerId: customer, disbursedOn: '2025-12-05' }).expect(201);
      await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, principalKobo: 40_000_000, customerId: customer, disbursedOn: '2025-12-20' }).expect(201);
      await admin.post(`/term-loans/${loanA.body.loan.loanId}/repayments`).set('Idempotency-Key', nextKey()).send({ amountKobo: 1_000_000, paymentDate: '2026-01-12' }).expect(201);

      const { trends, monthToDate } = (await admin.get('/admin/dashboard').expect(200)).body;
      expect(trends.days).toHaveLength(30);
      expect(trends.days[29]).toBe('2026-01-15');
      expect(trends.days[0]).toBe('2025-12-17');
      for (const series of [trends.disbursedKobo, trends.collectedKobo, trends.invoiceAdvancesKobo, trends.newCustomers]) expect(series).toHaveLength(30);
      expect(trends.disbursedKobo[24]).toBe(120_000_000); // 2026-01-10
      expect(trends.disbursedKobo[3]).toBe(40_000_000); // 2025-12-20
      expect(trends.collectedKobo[26]).toBe(1_000_000); // 2026-01-12
      expect(trends.newCustomers[29]).toBe(2);

      // 1–15 Jan vs 1–15 Dec: the 20 Dec loan is outside the comparison window
      expect(monthToDate.disbursed).toEqual({ current: 120_000_000, previous: 60_000_000, changePercent: 100 });
      expect(monthToDate.collected).toEqual({ current: 1_000_000, previous: 0, changePercent: null });
      expect(monthToDate.newCustomers).toEqual({ current: 2, previous: 0, changePercent: null });
    });
  });

  describe('collections portfolio and dashboard', () => {
    it("ranks an officer's customers by what is overdue so they know who to chase", async () => {
      const { client: ada, userId: adaId } = await createOfficer('ada@lender.test');
      const late = (await admin.post('/customers').send({ fullName: 'Late Payer', assignedOfficerId: adaId }).expect(201)).body.customer.customerId as string;
      const current = (await admin.post('/customers').send({ fullName: 'Current Payer', assignedOfficerId: adaId }).expect(201)).body.customer.customerId as string;
      const other = (await admin.post('/customers').send({ fullName: 'Not Adas' }).expect(201)).body.customer.customerId as string;

      // today is 2026-01-15; first three instalments (1 Nov, 1 Dec, 1 Jan) of a loan disbursed 2025-10-01 are overdue.
      await ada.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, customerId: late, disbursedOn: '2025-10-01' }).expect(201);
      await ada.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, customerId: current, disbursedOn: '2026-01-10' }).expect(201);
      await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, customerId: other, disbursedOn: '2025-10-01' }).expect(201);

      const book = (await ada.get('/collections/portfolio').expect(200)).body;
      expect(book.asOf).toBe('2026-01-15');
      expect(book.officer).toMatchObject({ userId: adaId });
      expect(book.customers.map((row: { fullName: string }) => row.fullName)).toEqual(['Late Payer', 'Current Payer']);
      expect(book.customers[0]).toMatchObject({ needsFollowUp: true, overdueKobo: 3 * 21_063_026, overdueInstalments: 3, oldestOverdueDays: 75 });
      expect(book.customers[1]).toMatchObject({ needsFollowUp: false, overdueKobo: 0, nextDueDate: '2026-02-10' });
      expect(book.totals).toMatchObject({ customers: 2, customersToChase: 1, overdueKobo: 3 * 21_063_026 });

      // paying the overdue instalments clears the chase
      for (const paymentDate of ['2026-01-15']) {
        const loanId = (await ada.get('/term-loans').expect(200)).body.find((loan: { customerId: string }) => loan.customerId === late).loanId;
        await ada.post(`/term-loans/${loanId}/repayments`).set('Idempotency-Key', nextKey()).send({ amountKobo: 3 * 21_063_026, paymentDate }).expect(201);
      }
      const after = (await ada.get('/collections/portfolio').expect(200)).body;
      expect(after.totals.customersToChase).toBe(0);

      const adminView = (await admin.get(`/collections/portfolio?officerId=${adaId}`).expect(200)).body;
      expect(adminView.customers).toHaveLength(2);
    });

    it('admin dashboard totals tie to the ledger; officers are refused', async () => {
      const { client: ada, userId: adaId } = await createOfficer('ada@lender.test');
      await admin.post('/loan-products').send({ name: 'Term', type: 'TERM_LOAN' }).expect(201);
      const customer = (await admin.post('/customers').send({ fullName: 'Chidi', assignedOfficerId: adaId }).expect(201)).body.customer.customerId as string;
      await admin.post('/customers').send({ fullName: 'Floating' }).expect(201);
      const loan = await admin.post('/term-loans').set('Idempotency-Key', nextKey()).send({ ...goldenLoan, customerId: customer, disbursedOn: '2025-10-01' }).expect(201);
      await admin.post(`/term-loans/${loan.body.loan.loanId}/repayments`).set('Idempotency-Key', nextKey()).send({ amountKobo: 21_063_026, paymentDate: '2025-11-01' }).expect(201);
      await admin.post('/invoices').set('Idempotency-Key', nextKey()).send({ faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-01-10', customerId: customer }).expect(201);
      await admin.post('/team/invitations').send({ email: 'pending@lender.test', role: 'LOAN_OFFICER' }).expect(201);

      const dashboard = (await admin.get('/admin/dashboard').expect(200)).body;
      expect(dashboard.customers).toEqual({ total: 2, unassigned: 1 });
      expect(dashboard.team).toEqual({ officers: 1, admins: 1, pendingInvitations: 1 });
      expect(dashboard.products.active).toBe(1);
      expect(dashboard.loans).toMatchObject({ count: 1, outstandingPrincipalKobo: 100_736_974, overdueLoanCount: 1 });
      expect(dashboard.loans.overdueKobo).toBe(2 * 21_063_026);
      expect(dashboard.invoices).toEqual({ advancedCount: 1, outstandingAdvanceKobo: 80_000_000, overdueCount: 1 });
      expect(dashboard.ledger.loansReceivableKobo).toBe(100_736_974);
      expect(dashboard.ledger.loansReceivableTiesToSchedules).toBe(true);
      expect(dashboard.ledger.interestIncomeKobo).toBe(1_800_000);
      expect(dashboard.officerWorkload[0]).toMatchObject({ customerCount: 1, officer: { userId: adaId } });

      await ada.get('/admin/dashboard').expect(403);
    });
  });
});
