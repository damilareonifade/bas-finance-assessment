import { INestApplication } from '@nestjs/common';
import { createTestApp, HttpClient } from './test-app';

describe('term loans (e2e)', () => {
  let app: INestApplication;
  let http: HttpClient;
  const goldenBody = { principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 };

  beforeEach(async () => {
    ({ app, http } = await createTestApp());
  });
  afterEach(async () => {
    await app.close();
  });

  it('quotes the golden schedule', async () => {
    const response = await http.post('/term-loans/quote').send(goldenBody).expect(200);
    expect(response.body.instalmentKobo).toBe(21_063_026);
    expect(response.body.totalInterestKobo).toBe(6_378_154);
    expect(response.body.schedule).toHaveLength(6);
    expect(response.body.schedule[5]).toMatchObject({ paymentKobo: 21_063_024, closingBalanceKobo: 0 });
  });

  it('disburses: posts a balanced Dr Loans Receivable / Cr Cash entry', async () => {
    const response = await http.post('/term-loans').set('Idempotency-Key', 'k-1').send(goldenBody).expect(201);
    expect(response.body.loan.loanId).toMatch(/^LN-\d{6}$/);
    expect(response.body.loan.schedule[0]).toMatchObject({ dueDate: '2026-02-15', status: 'UNPAID', principalPaidKobo: 0 });
    expect(response.body.journalEntry.lines).toEqual([
      { account: 'LOANS_RECEIVABLE', debitKobo: 120_000_000, creditKobo: 0 },
      { account: 'CASH', debitKobo: 0, creditKobo: 120_000_000 },
    ]);
  });

  it('double submit with the same key disburses once and returns the same response', async () => {
    const server = http;
    const [first, second] = await Promise.all([
      server.post('/term-loans').set('Idempotency-Key', 'dup-1').send(goldenBody),
      server.post('/term-loans').set('Idempotency-Key', 'dup-1').send(goldenBody),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.loan.loanId).toBe(first.body.loan.loanId);
    const list = await server.get('/term-loans').expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects the same key with a different payload (409)', async () => {
    const server = http;
    await server.post('/term-loans').set('Idempotency-Key', 'k-2').send(goldenBody).expect(201);
    const response = await server.post('/term-loans').set('Idempotency-Key', 'k-2').send({ ...goldenBody, termMonths: 12 }).expect(409);
    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('requires the Idempotency-Key header', async () => {
    const response = await http.post('/term-loans').send(goldenBody).expect(400);
    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('returns field-level validation errors in the uniform envelope', async () => {
    const response = await http
      .post('/term-loans/quote')
      .send({ principalKobo: 1200.5, annualRatePercent: 75, termMonths: 61 })
      .expect(422);
    expect(response.body).toMatchObject({ statusCode: 422, code: 'VALIDATION_FAILED' });
    expect(response.body.errors.map((error: { field: string }) => error.field).sort()).toEqual(['annualRatePercent', 'principalKobo', 'termMonths']);
  });

  it('rejects money sent as a string', async () => {
    const response = await http.post('/term-loans/quote').send({ ...goldenBody, principalKobo: '120000000' }).expect(422);
    expect(response.body.errors[0].field).toBe('principalKobo');
  });

  it('returns 404 with a stable code for an unknown loan', async () => {
    const response = await http.get('/term-loans/LN-999999').expect(404);
    expect(response.body.code).toBe('LOAN_NOT_FOUND');
  });
});
