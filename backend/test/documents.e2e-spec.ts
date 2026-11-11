import { HttpClient, inviteOfficer, TestApp, createTestApp } from './test-app';

const PDF_BYTES = Buffer.from('%PDF-1.4\n% test statement\n');

describe('customer documents / KYC (e2e)', () => {
  let testApp: TestApp;
  let admin: HttpClient;
  let ada: { client: HttpClient; userId: string };
  let customerId: string;
  const base = () => `/customers/${customerId}/documents`;

  beforeEach(async () => {
    testApp = await createTestApp();
    admin = testApp.http;
    ada = await inviteOfficer(testApp, 'ada@lender.test', 'Ada Okoye');
    customerId = (await admin.post('/customers').send({ fullName: 'Chidi Okafor', assignedOfficerId: ada.userId }).expect(201)).body.customer.customerId;
  });
  afterEach(async () => {
    await testApp.app.close();
  });

  it('requests a BVN, records it (fulfilling the request), masks it in lists and reveals it on its own', async () => {
    const requested = await admin.post(`${base()}/requests`).send({ type: 'BVN', note: 'Needed before approval' }).expect(201);
    expect(requested.body).toMatchObject({ type: 'BVN', status: 'REQUESTED', requestNote: 'Needed before approval', requestedBy: { fullName: 'Administrator' } });
    expect((await admin.post(`${base()}/requests`).send({ type: 'BVN' }).expect(409)).body.code).toBe('DOCUMENT_ALREADY_OPEN');

    const tooShort = await ada.client.post(base()).field('type', 'BVN').field('identifier', '12345').expect(422);
    expect(tooShort.body.errors[0]).toMatchObject({ field: 'identifier', message: 'BVN must be exactly 11 digits' });

    const submitted = await ada.client.post(base()).field('type', 'BVN').field('identifier', '222 1234 5678').expect(201);
    expect(submitted.body).toMatchObject({ documentId: requested.body.documentId, status: 'SUBMITTED', identifierMasked: '222••••••78', submittedBy: { userId: ada.userId } });
    expect(JSON.stringify(submitted.body)).not.toContain('22212345678');

    const listed = (await admin.get(base()).expect(200)).body;
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain('22212345678');
    expect((await admin.get(`${base()}/${requested.body.documentId}`).expect(200)).body.identifier).toBe('22212345678');

    // the admin hears that something is waiting to be verified
    const notifications = (await admin.get('/notifications').expect(200)).body.items;
    expect(notifications[0]).toMatchObject({ kind: 'DOCUMENT_SUBMITTED', link: `/customers/${customerId}?tab=documents` });
  });

  it('uploads a bank statement, serves it back only to people who may see the customer', async () => {
    const noFile = await admin.post(base()).field('type', 'BANK_STATEMENT').expect(422);
    expect(noFile.body.errors[0].field).toBe('file');
    const wrongType = await admin.post(base()).field('type', 'BANK_STATEMENT').attach('file', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' }).expect(422);
    expect(wrongType.body.errors[0]).toMatchObject({ field: 'file', message: 'Upload a PDF, PNG or JPEG file' });

    const uploaded = await admin.post(base()).field('type', 'BANK_STATEMENT').attach('file', PDF_BYTES, { filename: 'statement.pdf', contentType: 'application/pdf' }).expect(201);
    expect(uploaded.body).toMatchObject({ status: 'SUBMITTED', hasFile: true, fileName: 'statement.pdf', fileSize: PDF_BYTES.length });

    const file = await ada.client.get(`${base()}/${uploaded.body.documentId}/file`).buffer(true).parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(file.body as Buffer, PDF_BYTES)).toBe(0);

    const bola = await inviteOfficer(testApp, 'bola@lender.test', 'Bola Adeyemi');
    await bola.client.get(base()).expect(403);
    await bola.client.get(`${base()}/${uploaded.body.documentId}/file`).expect(403);
    await testApp.anonymous.get(`${base()}/${uploaded.body.documentId}/file`).expect(401);
  });

  it('verifies or rejects a submitted document; rejection needs a reason; decisions are final', async () => {
    const nin = (await admin.post(base()).field('type', 'NIN').field('identifier', '12345678901').expect(201)).body;
    const noReason = await admin.post(`${base()}/${nin.documentId}/review`).send({ decision: 'REJECTED' }).expect(422);
    expect(noReason.body.errors[0].field).toBe('note');
    const verified = await ada.client.post(`${base()}/${nin.documentId}/review`).send({ decision: 'VERIFIED' }).expect(200);
    expect(verified.body).toMatchObject({ status: 'VERIFIED', reviewedBy: { userId: ada.userId } });
    expect((await admin.post(`${base()}/${nin.documentId}/review`).send({ decision: 'REJECTED', note: 'x' }).expect(409)).body.code).toBe('DOCUMENT_NOT_AWAITING_REVIEW');

    const passport = (await admin.post(base()).field('type', 'PASSPORT').field('identifier', 'A01234567').expect(201)).body;
    const rejected = await admin.post(`${base()}/${passport.documentId}/review`).send({ decision: 'REJECTED', note: 'Expired' }).expect(200);
    expect(rejected.body).toMatchObject({ status: 'REJECTED', reviewNote: 'Expired' });

    // the application screen summarises verification
    const application = await ada.client.post('/loan-applications').send({ principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6, customerId }).expect(201);
    expect(application.body.verification).toEqual({ requested: 0, awaitingReview: 0, verified: 1, rejected: 1 });
  });

  it('will not take a second document of a type while one is waiting for review', async () => {
    await admin.post(base()).field('type', 'NIN').field('identifier', '12345678901').expect(201);
    expect((await admin.post(base()).field('type', 'NIN').field('identifier', '10987654321').expect(409)).body.code).toBe('DOCUMENT_AWAITING_REVIEW');
  });
});
