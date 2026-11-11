import { Injectable } from '@nestjs/common';
import { Kobo } from '../common/money';
import { fromKoboColumn, toKoboColumn } from '../database/kobo-column';
import { PrismaService } from '../database/prisma.service';
import type { Invoice as InvoiceRow } from '../generated/prisma/client';

export type InvoiceStatus = 'ADVANCED' | 'SETTLED';

export interface StoredInvoice {
  readonly invoiceId: string;
  readonly customerId: string | null;
  readonly loanProductId: string | null;
  readonly faceValueKobo: Kobo;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly tenorDays: number;
  readonly advanceKobo: Kobo;
  readonly reserveKobo: Kobo;
  readonly discountFeeKobo: Kobo;
  readonly status: InvoiceStatus;
}

const toInvoice = (row: InvoiceRow): StoredInvoice => ({
  invoiceId: row.id,
  customerId: row.customerId,
  loanProductId: row.loanProductId,
  faceValueKobo: fromKoboColumn(row.faceValueKobo),
  issueDate: row.issueDate,
  dueDate: row.dueDate,
  tenorDays: row.tenorDays,
  advanceKobo: fromKoboColumn(row.advanceKobo),
  reserveKobo: fromKoboColumn(row.reserveKobo),
  discountFeeKobo: fromKoboColumn(row.discountFeeKobo),
  status: row.status as InvoiceStatus,
});

export interface StoredSettlement {
  readonly invoiceId: string;
  readonly settlementDate: string;
  readonly daysOverdue: number;
  readonly discountFeeKobo: Kobo;
  readonly latePenaltyKobo: Kobo;
  readonly totalChargesKobo: Kobo;
  readonly clientReceivesKobo: Kobo;
  readonly clientOwesKobo: Kobo;
}

export interface InvoiceListFilter {
  readonly customerId?: string;
  readonly loanProductId?: string;
  readonly customerIds?: readonly string[];
}

@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(invoice: Omit<StoredInvoice, 'invoiceId' | 'status'> & { createdBy?: string; createdAt: string }): Promise<string> {
    const id = await this.prisma.nextId('INV');
    await this.prisma.db.invoice.create({
      data: {
        id,
        customerId: invoice.customerId,
        loanProductId: invoice.loanProductId,
        faceValueKobo: toKoboColumn(invoice.faceValueKobo),
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        tenorDays: invoice.tenorDays,
        advanceKobo: toKoboColumn(invoice.advanceKobo),
        reserveKobo: toKoboColumn(invoice.reserveKobo),
        discountFeeKobo: toKoboColumn(invoice.discountFeeKobo),
        status: 'ADVANCED',
        createdBy: invoice.createdBy ?? null,
        createdAt: invoice.createdAt,
      },
    });
    return id;
  }

  async findById(invoiceId: string): Promise<StoredInvoice | undefined> {
    const row = await this.prisma.db.invoice.findUnique({ where: { id: invoiceId } });
    return row ? toInvoice(row) : undefined;
  }

  async list(filter: InvoiceListFilter = {}): Promise<StoredInvoice[]> {
    if (filter.customerIds && filter.customerIds.length === 0) return [];
    const rows = await this.prisma.db.invoice.findMany({
      where: {
        ...(filter.customerId ? { customerId: filter.customerId } : {}),
        ...(filter.loanProductId ? { loanProductId: filter.loanProductId } : {}),
        ...(filter.customerIds ? { customerId: { in: [...filter.customerIds] } } : {}),
      },
      orderBy: { id: 'desc' },
    });
    return rows.map(toInvoice);
  }

  /**
   * Compare-and-set ADVANCED → SETTLED: the lock for a settlement. Only one request can win it; the loser gets false and
   * posts nothing. On Postgres this UPDATE also holds the row lock until commit.
   */
  async claimForSettlement(invoiceId: string): Promise<boolean> {
    const transaction = this.prisma.requireTransaction('Claiming an invoice for settlement');
    const { count } = await transaction.invoice.updateMany({ where: { id: invoiceId, status: 'ADVANCED' }, data: { status: 'SETTLED' } });
    return count === 1;
  }

  /** Settlements of the given invoices, keyed by invoice id (an invoice still ADVANCED has none). */
  async settlementsFor(invoiceIds: readonly string[]): Promise<Map<string, StoredSettlement>> {
    if (invoiceIds.length === 0) return new Map();
    const rows = await this.prisma.db.invoiceSettlement.findMany({ where: { invoiceId: { in: [...invoiceIds] } } });
    return new Map(
      rows.map((row) => [
        row.invoiceId,
        {
          invoiceId: row.invoiceId,
          settlementDate: row.settlementDate,
          daysOverdue: row.daysOverdue,
          discountFeeKobo: fromKoboColumn(row.discountFeeKobo),
          latePenaltyKobo: fromKoboColumn(row.latePenaltyKobo),
          totalChargesKobo: fromKoboColumn(row.totalChargesKobo),
          clientReceivesKobo: fromKoboColumn(row.clientReceivesKobo),
          clientOwesKobo: fromKoboColumn(row.clientOwesKobo),
        },
      ]),
    );
  }

  async insertSettlement(input: {
    invoiceId: string;
    settlementDate: string;
    daysOverdue: number;
    discountFeeKobo: Kobo;
    latePenaltyKobo: Kobo;
    totalChargesKobo: Kobo;
    clientReceivesKobo: Kobo;
    clientOwesKobo: Kobo;
    journalEntryId: string;
    createdAt: string;
  }): Promise<void> {
    const id = await this.prisma.nextId('ST');
    await this.prisma.db.invoiceSettlement.create({
      data: {
        id,
        invoiceId: input.invoiceId,
        settlementDate: input.settlementDate,
        daysOverdue: input.daysOverdue,
        discountFeeKobo: toKoboColumn(input.discountFeeKobo),
        latePenaltyKobo: toKoboColumn(input.latePenaltyKobo),
        totalChargesKobo: toKoboColumn(input.totalChargesKobo),
        clientReceivesKobo: toKoboColumn(input.clientReceivesKobo),
        clientOwesKobo: toKoboColumn(input.clientOwesKobo),
        journalEntryId: input.journalEntryId,
        createdAt: input.createdAt,
      },
    });
  }
}
