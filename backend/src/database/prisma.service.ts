import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { translateDatabaseError } from './database-errors';

/** What repositories query through: the open transaction, or the read-only connection outside one. */
export type DatabaseClient = Prisma.TransactionClient;

/** How long a transaction may wait for the single writer slot, and how long it may then run. */
const TRANSACTION_MAX_WAIT_MS = 10_000;
const TRANSACTION_TIMEOUT_MS = 20_000;

/**
 * Prisma over SQLite, with two connections:
 *
 * - **writer** — used only inside `transaction()`. The Prisma SQLite adapter runs one interactive transaction at a time on it,
 *   and every transaction starts with a write so it holds SQLite's write lock from its first statement (the equivalent of
 *   `BEGIN IMMEDIATE`): reads inside it can never go stale, and nothing else can write until it commits or rolls back.
 * - **reader** — opened read-only for everything outside a transaction. It only ever sees committed data, and an accidental
 *   write outside a transaction fails loudly instead of slipping into somebody else's open transaction on the shared writer.
 *
 * Rule: every write goes through `transaction()`. Repositories call `this.prisma.db`, which is the current transaction
 * (propagated with AsyncLocalStorage, so services never pass a `tx` around) or the reader.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly writer: PrismaClient;
  private readonly reader: PrismaClient;
  private readonly currentTransaction = new AsyncLocalStorage<DatabaseClient>();
  private readonly databasePath: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.databasePath = resolve(config.DATABASE_PATH);
    const url = `file:${this.databasePath}`;
    this.writer = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url, fileMustExist: true, timeout: TRANSACTION_MAX_WAIT_MS }) });
    this.reader = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url, fileMustExist: true, readonly: true, timeout: TRANSACTION_MAX_WAIT_MS }) });
  }

  async onModuleInit(): Promise<void> {
    if (!existsSync(this.databasePath)) {
      throw new Error(`No database at ${this.databasePath}. Run "npm run db:migrate" (npm run dev does it for you).`);
    }
    const migrationsTable = await this.writer.$queryRaw<Array<{ name: string }>>`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'`;
    if (migrationsTable.length === 0) {
      throw new Error(`The database at ${this.databasePath} is not managed by Prisma yet. Run "npm run db:migrate" — it upgrades an older database and keeps a backup.`);
    }
    await this.writer.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    this.logger.log(`Using ${this.databasePath}`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.writer.$disconnect(), this.reader.$disconnect()]);
  }

  /** The open transaction if there is one, otherwise the read-only connection. */
  get db(): DatabaseClient {
    return this.currentTransaction.getStore() ?? this.reader;
  }

  get isInTransaction(): boolean {
    return this.currentTransaction.getStore() !== undefined;
  }

  /** The open transaction, for operations that are only correct inside one (locks, ids, journal postings). */
  requireTransaction(operation: string): DatabaseClient {
    const transaction = this.currentTransaction.getStore();
    if (!transaction) throw new Error(`${operation} must run inside PrismaService.transaction()`);
    return transaction;
  }

  /**
   * Runs `work` atomically: everything it writes commits together or not at all. Nested calls join the outer transaction.
   * Known constraint / trigger failures are translated into domain errors (409s) after the rollback.
   */
  async transaction<TResult>(work: () => Promise<TResult>): Promise<TResult> {
    if (this.isInTransaction) return work();
    try {
      return await this.writer.$transaction(
        async (transaction) => {
          await transaction.$executeRaw`UPDATE "sequences" SET "value" = "value" WHERE 0`; // take the write lock now
          return this.currentTransaction.run(transaction, work);
        },
        { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: TRANSACTION_TIMEOUT_MS },
      );
    } catch (error) {
      throw translateDatabaseError(error);
    }
  }

  /** Next readable id for `prefix` (LN-000001). Inside a transaction, so an id is never handed out for a rolled-back row. */
  async nextId(prefix: string): Promise<string> {
    const transaction = this.requireTransaction('nextId');
    const sequence = await transaction.sequence.upsert({
      where: { name: prefix },
      create: { name: prefix, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${prefix}-${String(sequence.value).padStart(6, '0')}`;
  }
}
