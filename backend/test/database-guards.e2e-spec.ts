import { INestApplication } from '@nestjs/common';
import { execFileSync } from 'node:child_process';
import { PrismaService } from '../src/database/prisma.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { createTestApp, HttpClient } from './test-app';

/**
 * The guards Prisma cannot express live in the migration SQL (CHECK constraints and triggers). If a future migration
 * redefines one of these tables and drops a guard, a test here fails. Raw SQL is used on purpose: these tests go
 * around the services to prove the database itself refuses bad data.
 */
describe('database guards (e2e)', () => {
  let app: INestApplication;
  let http: HttpClient;
  let prisma: PrismaService;
  let keyCounter = 0;
  const nextKey = (): string => `guard-key-${(keyCounter += 1)}`;

  beforeEach(async () => {
    ({ app, http } = await createTestApp());
    prisma = app.get(PrismaService);
  });
  afterEach(async () => {
    await app.close();
  });

  const execute = (sql: string) => prisma.transaction(() => prisma.db.$executeRawUnsafe(sql));

  async function disburseGoldenLoan(): Promise<string> {
    const response = await http.post('/term-loans').set('Idempotency-Key', nextKey()).send({ principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 }).expect(201);
    return response.body.loan.loanId as string;
  }

  it('the journal is append-only: UPDATE and DELETE are refused by the database', async () => {
    await disburseGoldenLoan();
    await expect(execute("UPDATE journal_lines SET debit_kobo = 1 WHERE entry_id = 'JE-000001'")).rejects.toThrow(/JOURNAL_IMMUTABLE/);
    await expect(execute("DELETE FROM journal_lines WHERE entry_id = 'JE-000001'")).rejects.toThrow(/JOURNAL_IMMUTABLE/);
    await expect(execute("UPDATE journal_entries SET event = 'edited' WHERE id = 'JE-000001'")).rejects.toThrow(/JOURNAL_IMMUTABLE/);
    await expect(execute("DELETE FROM journal_entries WHERE id = 'JE-000001'")).rejects.toThrow(/JOURNAL_IMMUTABLE/);
  });

  it('a journal line carries exactly one positive side', async () => {
    await disburseGoldenLoan();
    await expect(execute("INSERT INTO journal_lines (entry_id, line_no, account, debit_kobo, credit_kobo) VALUES ('JE-000001', 9, 'CASH', 0, 0)")).rejects.toThrow(/CHECK/);
    await expect(execute("INSERT INTO journal_lines (entry_id, line_no, account, debit_kobo, credit_kobo) VALUES ('JE-000001', 9, 'CASH', 5, 5)")).rejects.toThrow(/CHECK/);
  });

  it('an instalment can never be over-collected, and unapplied credit never goes negative', async () => {
    const loanId = await disburseGoldenLoan();
    await expect(execute(`UPDATE loan_instalments SET principal_paid_kobo = principal_kobo + 1 WHERE loan_id = '${loanId}' AND instalment_number = 1`)).rejects.toThrow(/CHECK/);
    await expect(execute(`UPDATE loan_instalments SET interest_paid_kobo = -1 WHERE loan_id = '${loanId}' AND instalment_number = 1`)).rejects.toThrow(/CHECK/);
    await expect(execute(`UPDATE term_loans SET unapplied_credit_kobo = -1 WHERE id = '${loanId}'`)).rejects.toThrow(/CHECK/);
  });

  it('decided applications, settled invoices and reviewed documents keep their final status', async () => {
    const customerId = (await http.post('/customers').send({ fullName: 'Ngozi Umeh' }).expect(201)).body.customer.customerId as string;
    const application = (await http.post('/loan-applications').send({ customerId, principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 }).expect(201)).body;
    await http.post(`/loan-applications/${application.applicationId}/reject`).send({ reason: 'Incomplete' }).expect(200);
    await expect(execute(`UPDATE loan_applications SET status = 'APPROVED' WHERE id = '${application.applicationId}'`)).rejects.toMatchObject({ statusCode: 409, code: 'APPLICATION_ALREADY_DECIDED' });

    const invoice = (await http.post('/invoices').set('Idempotency-Key', nextKey()).send({ customerId, faceValueKobo: 100_000_000, issueDate: '2026-01-01', dueDate: '2026-03-02' }).expect(201)).body.invoice;
    await http.post(`/invoices/${invoice.invoiceId}/settlement`).set('Idempotency-Key', nextKey()).send({ settlementDate: '2026-03-02' }).expect(201);
    await expect(execute(`UPDATE invoices SET status = 'ADVANCED' WHERE id = '${invoice.invoiceId}'`)).rejects.toMatchObject({ statusCode: 409, code: 'INVOICE_ALREADY_SETTLED' });

    const document = (await http.post(`/customers/${customerId}/documents`).field('type', 'BVN').field('identifier', '22212345678').expect(201)).body;
    await http.post(`/customers/${customerId}/documents/${document.documentId}/review`).send({ decision: 'VERIFIED' }).expect(200);
    await expect(execute(`UPDATE customer_documents SET status = 'SUBMITTED' WHERE id = '${document.documentId}'`)).rejects.toMatchObject({ statusCode: 409, code: 'DOCUMENT_ALREADY_REVIEWED' });
  });

  it('one open document per customer and type, even when inserted behind the service', async () => {
    const customerId = (await http.post('/customers').send({ fullName: 'Halima Sani' }).expect(201)).body.customer.customerId as string;
    await http.post(`/customers/${customerId}/documents/requests`).send({ type: 'NIN' }).expect(201);
    const insert = (id: string, status: string) =>
      execute(`INSERT INTO customer_documents (id, customer_id, type, status, created_at) VALUES ('${id}', '${customerId}', 'NIN', '${status}', '2026-01-15T09:00:00.000Z')`);
    await expect(insert('DOC-X1', 'SUBMITTED')).rejects.toMatchObject({ statusCode: 409, code: 'DOCUMENT_ALREADY_OPEN' });
    await expect(insert('DOC-X2', 'VERIFIED')).resolves.toBe(1); // closed records of the same type are fine
  });

  it('loan product names are unique ignoring case', async () => {
    await http.post('/loan-products').send({ name: 'SME Loan', type: 'TERM_LOAN' }).expect(201);
    await expect(
      execute("INSERT INTO loan_products (id, name, type, min_principal_kobo, max_principal_kobo, status, created_at) VALUES ('PRD-X', 'sme LOAN', 'TERM_LOAN', 1, 2, 'ACTIVE', '2026-01-15')"),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PRODUCT_NAME_TAKEN' });
  });

  it('portal records stay consistent: who submitted matches the channel, account statuses are known values', async () => {
    const customerId = (await http.post('/customers').send({ fullName: 'Tunde Bakare' }).expect(201)).body.customer.customerId as string;
    const application = (await http.post('/loan-applications').send({ customerId, principalKobo: 120_000_000, annualRatePercent: 18, termMonths: 6 }).expect(201)).body;
    await expect(execute(`UPDATE loan_applications SET channel = 'PORTAL' WHERE id = '${application.applicationId}'`)).rejects.toThrow(/CHECK/); // staff-entered keeps its submitter
    await expect(execute(`UPDATE loan_applications SET submitted_by = NULL WHERE id = '${application.applicationId}'`)).rejects.toThrow(/CHECK/);
    await expect(
      execute(`INSERT INTO customer_accounts (id, customer_id, email, password_hash, status, created_at) VALUES ('CAC-X', '${customerId}', 'x@example.com', 'h', 'LOCKED', '2026-01-15')`),
    ).rejects.toThrow(/CHECK/);
  });

  it('a transaction holds the write lock from its first statement: another server cannot write until it commits', async () => {
    // A separate OS process stands in for a second API server on the same file (SQLite's file locks only separate
    // processes). It must not be able to write while our transaction is open — even before the transaction has written
    // anything of its own — otherwise reads inside the transaction could go stale before its writes.
    const otherServerWrites = (busyTimeoutMs: number): string =>
      execFileSync(
        process.execPath,
        [
          '-e',
          "try { new (require('better-sqlite3'))(process.argv[1], { timeout: Number(process.argv[2]) }).prepare('UPDATE users SET full_name = full_name').run(); console.log('wrote') } catch (e) { console.log(e.code) }",
          process.env.DATABASE_PATH as string,
          String(busyTimeoutMs),
        ],
        { cwd: __dirname, encoding: 'utf8' },
      ).trim();

    await prisma.transaction(async () => {
      await prisma.db.user.count(); // this transaction has only read so far
      expect(otherServerWrites(0)).toBe('SQLITE_BUSY'); // no waiting: the lock is held right now
    });
    expect(otherServerWrites(5_000)).toBe('wrote'); // free again once committed
  });

  it('writes outside a transaction are refused: the connection used outside transactions is read-only', async () => {
    await expect(prisma.db.$executeRawUnsafe("UPDATE users SET full_name = 'x'")).rejects.toThrow(/readonly|read-only/i);
  });

  it('postings and notifications refuse to run outside a transaction', async () => {
    await expect(app.get(LedgerService).post({ event: 'Stray', postedOn: '2026-01-15', lines: [] })).rejects.toThrow(/inside PrismaService.transaction/);
    await expect(app.get(NotificationsService).notify(['USR-000001'], { kind: 'CUSTOMER_ASSIGNED', title: 't', body: 'b' })).rejects.toThrow(/inside PrismaService.transaction/);
  });
});
