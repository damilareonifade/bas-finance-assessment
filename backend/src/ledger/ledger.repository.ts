import { Injectable } from '@nestjs/common';
import { Kobo } from '../common/money';
import { fromKoboColumn, fromKoboSum, toKoboColumn } from '../database/kobo-column';
import { PrismaService } from '../database/prisma.service';
import { AccountCode } from './domain/account';
import { JournalLine } from './domain/journal';

export interface JournalEntry {
  readonly entryId: string;
  readonly event: string;
  readonly postedOn: string;
  readonly loanId: string | null;
  readonly invoiceId: string | null;
  readonly customerId: string | null;
  readonly reversesEntryId: string | null;
  readonly lines: readonly JournalLine[];
}

export interface NewJournalEntry {
  readonly event: string;
  readonly postedOn: string;
  readonly loanId?: string;
  readonly invoiceId?: string;
  readonly customerId?: string;
  readonly reversesEntryId?: string;
  readonly lines: readonly JournalLine[];
}

export interface LedgerStatementLine {
  readonly entryId: string;
  readonly postedOn: string;
  readonly event: string;
  readonly account: AccountCode;
  readonly debitKobo: Kobo;
  readonly creditKobo: Kobo;
}

export interface LedgerEntryFilter {
  readonly customerId?: string;
  readonly facilities?: { readonly loanIds: readonly string[]; readonly invoiceIds: readonly string[] };
  /** Inclusive calendar dates (YYYY-MM-DD). */
  readonly from?: string;
  readonly to?: string;
}

interface StoredLine {
  account: string;
  debitKobo: bigint;
  creditKobo: bigint;
}

const toJournalLine = (line: StoredLine): JournalLine => ({
  account: line.account as AccountCode,
  debitKobo: fromKoboColumn(line.debitKobo),
  creditKobo: fromKoboColumn(line.creditKobo),
});

@Injectable()
export class LedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes the entry and its lines together. Only LedgerService calls this, always inside a transaction. */
  async insert(entry: NewJournalEntry, createdAt: string): Promise<JournalEntry> {
    const transaction = this.prisma.requireTransaction('Posting a journal entry');
    const entryId = await this.prisma.nextId('JE');
    await transaction.journalEntry.create({
      data: {
        id: entryId,
        event: entry.event,
        postedOn: entry.postedOn,
        loanId: entry.loanId ?? null,
        invoiceId: entry.invoiceId ?? null,
        customerId: entry.customerId ?? null,
        reversesEntryId: entry.reversesEntryId ?? null,
        createdAt,
        lines: {
          create: entry.lines.map((line, index) => ({
            lineNo: index + 1,
            account: line.account,
            debitKobo: toKoboColumn(line.debitKobo),
            creditKobo: toKoboColumn(line.creditKobo),
          })),
        },
      },
    });
    return {
      entryId,
      event: entry.event,
      postedOn: entry.postedOn,
      loanId: entry.loanId ?? null,
      invoiceId: entry.invoiceId ?? null,
      customerId: entry.customerId ?? null,
      reversesEntryId: entry.reversesEntryId ?? null,
      lines: entry.lines,
    };
  }

  async findById(entryId: string): Promise<JournalEntry | undefined> {
    const row = await this.prisma.db.journalEntry.findUnique({ where: { id: entryId }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
    if (!row) return undefined;
    return {
      entryId: row.id,
      event: row.event,
      postedOn: row.postedOn,
      loanId: row.loanId,
      invoiceId: row.invoiceId,
      customerId: row.customerId,
      reversesEntryId: row.reversesEntryId,
      lines: row.lines.map(toJournalLine),
    };
  }

  async hasReversal(entryId: string): Promise<boolean> {
    return (await this.prisma.db.journalEntry.count({ where: { reversesEntryId: entryId } })) > 0;
  }

  /** Every ledger line attached to a loan's entries, oldest first — the source of the borrower statement. */
  async linesForLoan(loanId: string): Promise<LedgerStatementLine[]> {
    const entries = await this.prisma.db.journalEntry.findMany({
      where: { loanId },
      orderBy: { id: 'asc' },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    return entries.flatMap((entry) =>
      entry.lines.map((line) => ({ entryId: entry.id, postedOn: entry.postedOn, event: entry.event, ...toJournalLine(line) })),
    );
  }

  /**
   * Journal entries (with their lines) in a scope, oldest first. `facilities` narrows to entries of those loans / invoices
   * (how a product's ledger is found: entries carry the loan or invoice, which carries the product).
   */
  async entriesMatching(filter: LedgerEntryFilter): Promise<JournalEntry[]> {
    if (filter.facilities && filter.facilities.loanIds.length === 0 && filter.facilities.invoiceIds.length === 0) return [];
    const rows = await this.prisma.db.journalEntry.findMany({
      where: {
        ...(filter.customerId ? { customerId: filter.customerId } : {}),
        ...(filter.facilities
          ? { OR: [{ loanId: { in: [...filter.facilities.loanIds] } }, { invoiceId: { in: [...filter.facilities.invoiceIds] } }] }
          : {}),
        ...(filter.from || filter.to ? { postedOn: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } } : {}),
      },
      orderBy: [{ postedOn: 'asc' }, { id: 'asc' }],
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    return rows.map((row) => ({
      entryId: row.id,
      event: row.event,
      postedOn: row.postedOn,
      loanId: row.loanId,
      invoiceId: row.invoiceId,
      customerId: row.customerId,
      reversesEntryId: row.reversesEntryId,
      lines: row.lines.map(toJournalLine),
    }));
  }

  /** Which customer a journal entry was posted for (search by entry id). */
  async customerOfEntry(entryId: string): Promise<string | null> {
    return (await this.prisma.db.journalEntry.findUnique({ where: { id: entryId }, select: { customerId: true } }))?.customerId ?? null;
  }

  /** Net debit balance (debits − credits) for one account, optionally for a single customer. */
  async accountBalanceKobo(account: AccountCode, customerId?: string): Promise<Kobo> {
    const totals = await this.prisma.db.journalLine.aggregate({
      where: { account, ...(customerId ? { entry: { customerId } } : {}) },
      _sum: { debitKobo: true, creditKobo: true },
    });
    return fromKoboColumn(fromKoboSum(totals._sum.debitKobo) - fromKoboSum(totals._sum.creditKobo));
  }
}
