// Brings the local database up to date: `npm run db:migrate` (npm run dev runs it first).
//
// 1. A database created before the move to Prisma (it has `schema_migrations`, no `_prisma_migrations`) is upgraded once:
//    it is moved aside as a timestamped backup, a fresh database is built from the Prisma migrations, and every row is
//    copied across. Foreign keys are checked before the new file replaces the old one; on any problem nothing is replaced.
// 2. `prisma migrate deploy` applies any pending migrations (and creates the database on a clean clone).
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// A fresh clone has no .env (it is git-ignored). Start from the example so `npm run dev` works straight away and seeds the
// admin from it — never in production, where configuration must be supplied on purpose.
if (!existsSync('.env') && existsSync('.env.example') && process.env.NODE_ENV !== 'production') {
  copyFileSync('.env.example', '.env');
  console.log('Created backend/.env from .env.example (admin login: see SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD — change the password after signing in).');
}
if (existsSync('.env')) process.loadEnvFile('.env');
const databasePath = resolve(process.env.DATABASE_PATH ?? './data/lending.db');
mkdirSync(dirname(databasePath), { recursive: true });

const migrate = (path) =>
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_PATH: path }, stdio: ['ignore', 'pipe', 'inherit'] });

/** Tables in dependency order (parents before children). */
const TABLES = [
  'sequences', 'idempotency_keys', 'users', 'invitations', 'customers', 'loan_products', 'journal_entries', 'journal_lines',
  'term_loans', 'loan_instalments', 'repayments', 'invoices', 'invoice_settlements', 'loan_applications', 'customer_documents', 'notifications',
];

function isLegacy(path) {
  if (!existsSync(path)) return false;
  const database = new Database(path, { readonly: true });
  try {
    const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
    return tables.has('schema_migrations') && !tables.has('_prisma_migrations');
  } finally {
    database.close();
  }
}

function upgradeLegacy(path) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${path}.pre-prisma-${stamp}.bak`;
  const stagingPath = `${path}.upgrading`;

  // Fold the WAL into the main file so the backup is one self-contained file.
  const legacy = new Database(path);
  legacy.pragma('wal_checkpoint(TRUNCATE)');
  legacy.close();

  rmSync(stagingPath, { force: true });
  migrate(stagingPath);

  const target = new Database(stagingPath);
  try {
    target.pragma('foreign_keys = OFF');
    target.prepare('ATTACH DATABASE ? AS legacy').run(path);
    const copied = target.transaction(() => {
      const counts = {};
      for (const table of TABLES) {
        const legacyColumns = new Set(target.prepare(`SELECT name FROM pragma_table_info('${table}', 'legacy')`).all().map((row) => row.name));
        if (legacyColumns.size === 0) continue;
        const columns = target.prepare(`SELECT name FROM pragma_table_info('${table}', 'main')`).all().map((row) => row.name).filter((name) => legacyColumns.has(name));
        const list = columns.map((name) => `"${name}"`).join(', ');
        counts[table] = target.prepare(`INSERT INTO main."${table}" (${list}) SELECT ${list} FROM legacy."${table}"`).run().changes;
      }
      return counts;
    })();
    const brokenReferences = target.prepare('PRAGMA main.foreign_key_check').all();
    if (brokenReferences.length > 0) throw new Error(`Foreign key check failed after copying: ${JSON.stringify(brokenReferences.slice(0, 5))}`);
    target.prepare('DETACH DATABASE legacy').run();
    console.log('Copied rows:', copied);
  } catch (error) {
    target.close();
    rmSync(stagingPath, { force: true });
    throw error;
  }
  target.close();

  for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) renameSync(path + suffix, backupPath + suffix);
  renameSync(stagingPath, path);
  console.log(`Upgraded ${path} to the Prisma schema. The previous database is kept at ${backupPath}`);
}

if (isLegacy(databasePath)) upgradeLegacy(databasePath);
migrate(databasePath);
console.log(`Database ready: ${databasePath}`);
