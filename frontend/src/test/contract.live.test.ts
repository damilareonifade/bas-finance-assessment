// @vitest-environment node
// (Talks to a real server: Node's fetch, FormData and Blob — jsdom's FormData is not understood by Node's fetch.)
/**
 * Contract test: drives a RUNNING backend and parses every response with the frontend's own zod schemas,
 * so a field renamed on either side fails here instead of in a browser.
 *
 *   (backend, fresh DB)  npm run dev -w backend
 *   (frontend)           CONTRACT_API_URL=http://localhost:3000 npm run test:contract
 *
 * Skipped unless CONTRACT_API_URL is set, so the normal `npm test` never needs a server.
 */
import { ledgerSearchResultSchema, ledgerViewSchema } from '@/features/ledger/schemas/ledgerBook';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { collectionsSchema } from '@/features/collections/schemas/collections';
import { customerDetailSchema, customerSummarySchema } from '@/features/customers/schemas/customer';
import { dashboardSchema } from '@/features/admin-dashboard/schemas/dashboard';
import { financedInvoiceSchema, invoiceQuoteSchema, invoiceSchema, invoiceSettlementSchema } from '@/features/invoice-financing/schemas/invoice';
import { loanProductDetailSchema, productCustomerSchema } from '@/features/loan-products/schemas/loanProduct';
import { confirmedRepaymentSchema, repaymentAllocationSchema } from '@/features/repayments/schemas/repayment';
import { loanStatementSchema } from '@/features/statements/schemas/statement';
import { buildStatementRows, calculateScheduleOutstandingPrincipalKobo, calculateTieOut, statementClosingBalanceKobo } from '@/features/statements/statementMath';
import { createdInvitationSchema, invitationSchema, teamMemberSchema } from '@/features/team/schemas/team';
import { originatedLoanSchema, termLoanListSchema, termLoanQuoteSchema, termLoanSchema } from '@/features/term-loans/schemas/termLoan';
import { invitationPreviewSchema, sessionResponseSchema } from '@/features/auth/schemas/auth';
import { buildAmortisationSchedule, asKobo } from '@/lib/money';

// Only this opt-in test reads the environment; the app tsconfig deliberately excludes Node types.
declare const process: { env: Record<string, string | undefined> };

const apiUrl = process.env.CONTRACT_API_URL;

interface Session {
  call: <T extends z.ZodType>(method: string, path: string, schema: T, body?: unknown, key?: string, expectedStatus?: number) => Promise<z.output<T>>;
}

async function rawCall(cookie: string | null, method: string, path: string, body?: unknown, key?: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (key) headers['Idempotency-Key'] = key;
  return fetch(`${apiUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

function sessionWith(cookie: string | null): Session {
  return {
    call: async (method, path, schema, body, key, expectedStatus) => {
      const response = await rawCall(cookie, method, path, body, key);
      const text = await response.text();
      if (expectedStatus ? response.status !== expectedStatus : !response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`);
      return schema.parse(text ? JSON.parse(text) : null);
    },
  };
}

async function login(email: string, password: string): Promise<{ session: Session; cookie: string }> {
  const response = await rawCall(null, 'POST', '/auth/login', { email, password });
  expect(response.status).toBe(200);
  sessionResponseSchema.parse(await response.json());
  const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  return { session: sessionWith(cookie), cookie };
}

describe.skipIf(!apiUrl)('frontend schemas parse the live backend', () => {
  it('covers every endpoint the UI calls', async () => {
    const { session: admin } = await login('admin@lender.test', 'ChangeMe123!');
    const run = Date.now().toString(36);

    // ----- team -----
    const invite = await admin.call('POST', '/team/invitations', createdInvitationSchema, { email: `ada-${run}@lender.test`, role: 'LOAN_OFFICER' }, undefined, 201);
    const token = new URL(invite.inviteLink).searchParams.get('token') ?? '';
    await sessionWith(null).call('GET', `/auth/invitations/${token}`, invitationPreviewSchema);
    const acceptResponse = await rawCall(null, 'POST', '/auth/accept-invitation', { token, fullName: 'Ada Officer', password: 'OfficerPass1!' });
    expect(acceptResponse.status).toBe(201);
    const officerCookie = acceptResponse.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const officer = sessionWith(officerCookie);
    const officerUser = (await officer.call('GET', '/auth/me', sessionResponseSchema)).user;
    await admin.call('GET', '/team/members', z.array(teamMemberSchema));
    await admin.call('GET', '/team/invitations', z.array(invitationSchema));

    // ----- products & customers -----
    const termProduct = await admin.call('POST', '/loan-products', loanProductDetailSchema, { name: `Term ${run}`, type: 'TERM_LOAN', minAnnualRatePercent: 10, maxAnnualRatePercent: 30 }, undefined, 201);
    const invoiceProduct = await admin.call('POST', '/loan-products', loanProductDetailSchema, { name: `Invoices ${run}`, type: 'INVOICE_FINANCING' }, undefined, 201);
    await admin.call('GET', '/loan-products?status=ACTIVE', z.array(loanProductDetailSchema));
    await admin.call('GET', `/loan-products/${termProduct.product.productId}`, loanProductDetailSchema);

    const created = await admin.call('POST', '/customers', customerDetailSchema, { fullName: `Chidi ${run}`, email: `chidi-${run}@example.com`, phone: '+2348012345678' }, undefined, 201);
    const customerId = created.customer.customerId;
    const assigned = await admin.call('PATCH', `/customers/${customerId}/assignment`, customerDetailSchema, { officerId: officerUser.userId });
    expect(assigned.customer.assignedOfficer?.userId).toBe(officerUser.userId);

    // ----- term loan: quote parity, origination, repayment, statement tie-out -----
    const terms = { principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 };
    const quote = await officer.call('POST', '/term-loans/quote', termLoanQuoteSchema, terms, undefined, 200);
    const clientSchedule = buildAmortisationSchedule({ ...terms, principalKobo: asKobo(terms.principalKobo) });
    expect(quote.schedule.map(({ paymentKobo, interestKobo, principalKobo, closingBalanceKobo }) => ({ paymentKobo, interestKobo, principalKobo, closingBalanceKobo }))).toEqual(
      clientSchedule.map(({ paymentKobo, interestKobo, principalKobo, closingBalanceKobo }) => ({ paymentKobo, interestKobo, principalKobo, closingBalanceKobo })),
    );

    const originated = await officer.call(
      'POST', '/term-loans', originatedLoanSchema,
      { ...terms, customerId, loanProductId: termProduct.product.productId, disbursedOn: '2026-08-01' },
      `loan-${run}`, 201,
    );
    const loanId = originated.loan.loanId;
    const repaymentBody = { amountKobo: 21_063_026, paymentDate: '2026-09-01' };
    const preview = await officer.call('POST', `/term-loans/${loanId}/repayments/preview`, repaymentAllocationSchema, repaymentBody, undefined, 200);
    const confirmed = await officer.call('POST', `/term-loans/${loanId}/repayments`, confirmedRepaymentSchema, repaymentBody, `repay-${run}`, 201);
    expect(confirmed.allocation).toEqual(preview);

    const loan = await officer.call('GET', `/term-loans/${loanId}`, termLoanSchema);
    const statement = await officer.call('GET', `/term-loans/${loanId}/statement`, loanStatementSchema);
    const closing = statementClosingBalanceKobo(buildStatementRows(statement.lines));
    expect(calculateTieOut(closing, calculateScheduleOutstandingPrincipalKobo(loan.schedule)).isTiedOut).toBe(true);
    await officer.call('GET', '/term-loans', termLoanListSchema);

    // ----- invoice financing incl. shortfall -----
    const invoiceBody = { faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02' };
    await officer.call('POST', '/invoices/quote', invoiceQuoteSchema, invoiceBody, undefined, 200);
    const financed = await officer.call('POST', '/invoices', financedInvoiceSchema, { ...invoiceBody, customerId, loanProductId: invoiceProduct.product.productId }, `inv-${run}`, 201);
    const invoiceId = financed.invoice.invoiceId;
    await officer.call('GET', `/invoices/${invoiceId}`, invoiceSchema);
    const settlementPreview = await officer.call('POST', `/invoices/${invoiceId}/settlement/preview`, invoiceSettlementSchema, { settlementDate: '2026-06-06' }, undefined, 200);
    expect(settlementPreview.clientOwesKobo).toBe(94_247);
    const settled = await officer.call('POST', `/invoices/${invoiceId}/settlement`, invoiceSettlementSchema, { settlementDate: '2026-06-06' }, `settle-${run}`, 201);
    expect(settled.clientOwesKobo).toBe(94_247);

    // ----- admin views -----
    await admin.call('GET', '/customers', z.array(customerSummarySchema));
    await admin.call('GET', `/customers/${customerId}`, customerDetailSchema);
    await admin.call('GET', `/loan-products/${termProduct.product.productId}/customers`, z.array(productCustomerSchema));
    const book = await officer.call('GET', '/collections/portfolio', collectionsSchema);
    expect(book.customers.some((row) => row.customerId === customerId)).toBe(true);
    await admin.call('GET', `/collections/portfolio?officerId=${officerUser.userId}`, collectionsSchema);
    const dashboard = await admin.call('GET', '/admin/dashboard', dashboardSchema);
    expect(dashboard.ledger.loansReceivableTiesToSchedules).toBe(true);

    // ----- admin ledger: search a customer, then every debit and credit attributed to them -----
    const found = await admin.call('GET', `/ledger/search?q=${encodeURIComponent(loanId)}`, z.array(ledgerSearchResultSchema));
    expect(found.map((result) => result.customerId)).toEqual([customerId]);
    const customerLedger = await admin.call('GET', `/ledger?customerId=${customerId}`, ledgerViewSchema);
    expect(customerLedger.totals.isBalanced).toBe(true);
    expect(customerLedger.totals.entryCount).toBe(4); // disbursement, repayment, invoice advance, settlement
    const productLedger = await admin.call('GET', `/ledger?loanProductId=${termProduct.product.productId}`, ledgerViewSchema);
    expect(productLedger.totals.isBalanced).toBe(true);
  });
});

function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** The brief's parity requirement: client preview == server schedule, kobo for kobo, over 250 generated cases. */
describe.skipIf(!apiUrl)('client/server parity over generated cases', () => {
  it('matches the server schedule for 250 random loans', async () => {
    const { session } = await login('admin@lender.test', 'ChangeMe123!');
    const random = createSeededRandom(7);
    const mismatches: string[] = [];

    for (let caseNumber = 0; caseNumber < 250; caseNumber += 1) {
      const terms = {
        principalKobo: 100_000 + Math.floor(random() * (500_000_000_000 - 100_000)),
        annualRatePercent: Math.round((0.5 + random() * 59.5) * 100) / 100,
        termMonths: 1 + Math.floor(random() * 60),
      };
      const serverQuote = await session.call('POST', '/term-loans/quote', termLoanQuoteSchema, terms, undefined, 200);
      const clientSchedule = buildAmortisationSchedule({ ...terms, principalKobo: asKobo(terms.principalKobo) });
      const clientRows = clientSchedule.map(({ paymentKobo, interestKobo, principalKobo, closingBalanceKobo }) => [paymentKobo, interestKobo, principalKobo, closingBalanceKobo]);
      const serverRows = serverQuote.schedule.map(({ paymentKobo, interestKobo, principalKobo, closingBalanceKobo }) => [paymentKobo, interestKobo, principalKobo, closingBalanceKobo]);
      if (JSON.stringify(clientRows) !== JSON.stringify(serverRows)) mismatches.push(JSON.stringify(terms));
    }
    expect(mismatches).toEqual([]);
  });
});

describe.skipIf(!apiUrl)('applications, documents and notifications parse the live backend', () => {
  it('covers the applicant workflow end to end', async () => {
    const { applicationDetailSchema, applicationSchema, approvedApplicationSchema } = await import('@/features/applications/schemas/application');
    const { customerDocumentSchema, revealedDocumentSchema } = await import('@/features/customer-documents/schemas/document');
    const { inboxSchema } = await import('@/features/notifications/schemas/notification');
    const { session: admin, cookie } = await login('admin@lender.test', 'ChangeMe123!');
    const run = Date.now().toString(36);

    const customer = await admin.call('POST', '/customers', customerDetailSchema, { fullName: `Applicant ${run}` }, undefined, 201);
    const customerId = customer.customer.customerId;

    // documents: request, then upload a statement (multipart), then reveal a BVN
    await admin.call('POST', `/customers/${customerId}/documents/requests`, customerDocumentSchema, { type: 'BVN' }, undefined, 201);
    const form = new FormData();
    form.set('type', 'BANK_STATEMENT');
    form.set('file', new Blob(['%PDF-1.4 contract'], { type: 'application/pdf' }), 'statement.pdf');
    const upload = await fetch(`${apiUrl}/customers/${customerId}/documents`, { method: 'POST', headers: { Cookie: cookie }, body: form });
    expect(upload.status).toBe(201);
    customerDocumentSchema.parse(await upload.json());
    const bvn = await admin.call('POST', `/customers/${customerId}/documents/requests`, z.unknown(), { type: 'NIN' }, undefined, 201);
    void bvn;
    const documents = await admin.call('GET', `/customers/${customerId}/documents`, z.array(customerDocumentSchema));
    await admin.call('GET', `/customers/${customerId}/documents/${documents[0]?.documentId ?? ''}`, revealedDocumentSchema);

    // application: submit, list, review, approve (with an officer left unset), check the loan carries the approver
    const application = await admin.call('POST', '/loan-applications', applicationDetailSchema, { customerId, principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 }, undefined, 201);
    await admin.call('GET', '/loan-applications?status=OPEN', z.array(applicationSchema));
    await admin.call('POST', `/loan-applications/${application.applicationId}/review`, applicationDetailSchema, undefined, undefined, 200);
    const approved = await admin.call('POST', `/loan-applications/${application.applicationId}/approve`, approvedApplicationSchema, {}, `approve-${run}`, 201);
    expect(approved.loan.approvedBy?.fullName).toBeTruthy();
    expect(approved.application.loanId).toBe(approved.loan.loanId);
    const mine = await admin.call('GET', '/term-loans?approvedBy=me', termLoanListSchema);
    expect(mine.some((loan) => loan.loanId === approved.loan.loanId)).toBe(true);

    await admin.call('GET', '/notifications', inboxSchema);
  });
});

describe.skipIf(!apiUrl)('the customer portal parses the live backend', () => {
  it('covers invite → sign-in → overview, loan, products, quote, apply, documents and notifications', async () => {
    const portal = await import('@/features/portal/schemas/portal');
    const { portalAccessSchema } = await import('@/features/customers/api/customerApi');
    const { session: admin } = await login('admin@lender.test', 'ChangeMe123!');
    const run = Date.now().toString(36);
    const email = `portal-${run}@example.com`;

    const customerId = (await admin.call('POST', '/customers', customerDetailSchema, { fullName: `Portal ${run}`, email }, undefined, 201)).customer.customerId;
    const product = await admin.call('POST', '/loan-products', loanProductDetailSchema, { name: `Portal product ${run}`, type: 'TERM_LOAN', minAnnualRatePercent: 18, maxAnnualRatePercent: 24 }, undefined, 201);
    const loan = await admin.call('POST', '/term-loans', originatedLoanSchema, { customerId, principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 }, `portal-loan-${run}`, 201);
    await admin.call('POST', `/customers/${customerId}/documents/requests`, z.unknown(), { type: 'BVN' }, undefined, 201);

    const invite = await admin.call('POST', `/customers/${customerId}/portal-access/invitation`, z.object({ access: portalAccessSchema, inviteLink: z.string() }), {}, undefined, 201);
    const token = new URL(invite.inviteLink).searchParams.get('token') ?? '';
    const anonymous = sessionWith(null);
    await anonymous.call('GET', `/portal/auth/invitations/${token}`, portal.portalInvitationPreviewSchema);
    const accepted = await rawCall(null, 'POST', '/portal/auth/accept-invitation', { token, password: 'CustomerPass1!' });
    expect(accepted.status).toBe(201);
    portal.portalSessionResponseSchema.parse(await accepted.json());

    const signIn = await rawCall(null, 'POST', '/portal/auth/login', { email, password: 'CustomerPass1!' });
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const customer = sessionWith(cookie);

    await customer.call('GET', '/portal/auth/me', portal.portalSessionResponseSchema);
    await customer.call('GET', '/portal/overview', portal.portalOverviewSchema);
    const detail = await customer.call('GET', `/portal/loans/${loan.loan.loanId}`, portal.portalLoanDetailSchema);
    expect(detail.statement[0]?.kind).toBe('DISBURSEMENT');
    await customer.call('GET', '/portal/products', z.array(portal.portalProductSchema));
    const quote = await customer.call('POST', '/portal/quote', portal.portalQuoteSchema, { loanProductId: product.product.productId, principalKobo: 120_000_000, termMonths: 6 }, undefined, 200);
    expect(quote.instalmentKobo).toBe(21_063_026);
    await customer.call('POST', '/portal/applications', portal.portalApplicationSchema, { loanProductId: product.product.productId, principalKobo: 120_000_000, termMonths: 6 }, undefined, 201);
    const documents = await customer.call('GET', '/portal/documents', z.array(portal.portalDocumentSchema));
    expect(documents[0]?.status).toBe('REQUESTED');
    const inbox = await customer.call('GET', '/portal/notifications', portal.portalInboxSchema);
    expect(inbox.unreadCount).toBeGreaterThan(0);
    await customer.call('POST', '/portal/notifications/read-all', portal.portalInboxSchema, undefined, undefined, 200);
    await admin.call('GET', `/customers/${customerId}/portal-access`, portalAccessSchema);
  });
});
