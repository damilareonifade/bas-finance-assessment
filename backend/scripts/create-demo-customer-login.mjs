// Dev convenience: gives one existing customer a portal sign-in so you can try /portal/login straight away.
//
//   npm run db:demo-customer                       → the oldest customer that has an email
//   npm run db:demo-customer -- CUS-000003         → a specific customer
//   DEMO_CUSTOMER_PASSWORD=… npm run db:demo-customer
//
// In the real flow staff invite the customer from their profile (Customer portal → Invite) and the customer sets their own
// password. This script skips the invitation for local testing only, and refuses to run with NODE_ENV=production.
import Database from 'better-sqlite3';
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (process.env.NODE_ENV === 'production') throw new Error('create-demo-customer-login is for local development only');
if (existsSync('.env')) process.loadEnvFile('.env');
const databasePath = resolve(process.env.DATABASE_PATH ?? './data/lending.db');
const password = process.env.DEMO_CUSTOMER_PASSWORD ?? 'CustomerPass1!';
const requestedCustomerId = process.argv[2];

/** Same format as PasswordService.hash: "<salt hex>:<scrypt-64 hex>". */
function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(plain, salt, 64).toString('hex')}`;
}

const database = new Database(databasePath, { fileMustExist: true, timeout: 10_000 });
try {
  const hasPortal = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'customer_accounts'").get();
  if (!hasPortal) throw new Error('The database has no portal tables yet — run "npm run db:migrate" (or restart npm run dev) first.');

  const customer = requestedCustomerId
    ? database.prepare('SELECT id, full_name, email FROM customers WHERE id = ?').get(requestedCustomerId)
    : database.prepare("SELECT id, full_name, email FROM customers WHERE email IS NOT NULL AND email <> '' ORDER BY created_at, id LIMIT 1").get();
  if (!customer) throw new Error(requestedCustomerId ? `No customer ${requestedCustomerId}` : 'No customer with an email address — add one in the app first.');
  if (!customer.email) throw new Error(`${customer.id} has no email address — add one to their profile first.`);
  const email = customer.email.toLowerCase();

  const result = database.transaction(() => {
    const existing = database.prepare('SELECT id FROM customer_accounts WHERE customer_id = ?').get(customer.id);
    if (existing) {
      database.prepare("UPDATE customer_accounts SET password_hash = ?, status = 'ACTIVE' WHERE id = ?").run(hashPassword(password), existing.id);
      return 'updated';
    }
    const taken = database.prepare('SELECT customer_id FROM customer_accounts WHERE email = ?').get(email);
    if (taken) throw new Error(`${email} already signs in for ${taken.customer_id}`);
    database.prepare("INSERT INTO sequences (name, value) VALUES ('CAC', 1) ON CONFLICT(name) DO UPDATE SET value = value + 1").run();
    const { value } = database.prepare("SELECT value FROM sequences WHERE name = 'CAC'").get();
    database
      .prepare("INSERT INTO customer_accounts (id, customer_id, email, password_hash, status, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)")
      .run(`CAC-${String(value).padStart(6, '0')}`, customer.id, email, hashPassword(password), new Date().toISOString());
    return 'created';
  })();

  console.log(`Portal sign-in ${result} for ${customer.full_name} (${customer.id})`);
  console.log(`  URL:      http://localhost:5173/portal/login`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
} finally {
  database.close();
}
