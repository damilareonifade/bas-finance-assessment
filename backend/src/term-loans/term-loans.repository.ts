import { Injectable } from '@nestjs/common';
import { Kobo } from '../common/money';
import { fromKoboColumn, toKoboColumn } from '../database/kobo-column';
import { PrismaService } from '../database/prisma.service';
import type { LoanInstalment as InstalmentRow, Prisma, TermLoan as TermLoanRow } from '../generated/prisma/client';
import { ScheduledInstalment } from './domain/term-loan-schedule';

export interface StoredInstalment extends ScheduledInstalment {
  readonly dueDate: string;
  readonly penaltyPaidKobo: Kobo;
  readonly feePaidKobo: Kobo;
  readonly interestPaidKobo: Kobo;
  readonly principalPaidKobo: Kobo;
}

export interface StoredTermLoan {
  readonly loanId: string;
  readonly customerId: string | null;
  readonly loanProductId: string | null;
  readonly principalKobo: Kobo;
  readonly annualRatePercent: number;
  readonly termMonths: number;
  readonly instalmentKobo: Kobo;
  readonly disbursedOn: string;
  readonly unappliedCreditKobo: Kobo;
  /** Who approved (and so disbursed) the loan, and when. */
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  /** The loan officer following this loan up, set at approval. */
  readonly assignedOfficerId: string | null;
  /** The application this loan came from, if any. */
  readonly applicationId: string | null;
  readonly schedule: readonly StoredInstalment[];
}

export interface NewTermLoan {
  readonly customerId?: string;
  readonly loanProductId?: string;
  readonly principalKobo: Kobo;
  readonly annualRatePercent: number;
  readonly termMonths: number;
  readonly instalmentKobo: Kobo;
  readonly disbursedOn: string;
  readonly createdBy?: string;
  readonly createdAt: string;
  readonly assignedOfficerId?: string;
  readonly applicationId?: string;
  readonly schedule: ReadonlyArray<ScheduledInstalment & { dueDate: string }>;
}

export interface InstalmentPaymentDelta {
  readonly instalmentNumber: number;
  readonly penaltyKobo: Kobo;
  readonly feeKobo: Kobo;
  readonly interestKobo: Kobo;
  readonly principalKobo: Kobo;
}

type LoanRow = TermLoanRow & { instalments: InstalmentRow[] };

function toInstalment(row: InstalmentRow): StoredInstalment {
  return {
    instalmentNumber: row.instalmentNumber,
    dueDate: row.dueDate,
    paymentKobo: fromKoboColumn(row.paymentKobo),
    interestKobo: fromKoboColumn(row.interestKobo),
    principalKobo: fromKoboColumn(row.principalKobo),
    closingBalanceKobo: fromKoboColumn(row.closingBalanceKobo),
    penaltyPaidKobo: fromKoboColumn(row.penaltyPaidKobo),
    feePaidKobo: fromKoboColumn(row.feePaidKobo),
    interestPaidKobo: fromKoboColumn(row.interestPaidKobo),
    principalPaidKobo: fromKoboColumn(row.principalPaidKobo),
  };
}

function toLoan(row: LoanRow): StoredTermLoan {
  return {
    loanId: row.id,
    customerId: row.customerId,
    loanProductId: row.loanProductId,
    principalKobo: fromKoboColumn(row.principalKobo),
    annualRatePercent: row.annualRatePercent,
    termMonths: row.termMonths,
    instalmentKobo: fromKoboColumn(row.instalmentKobo),
    disbursedOn: row.disbursedOn,
    unappliedCreditKobo: fromKoboColumn(row.unappliedCreditKobo),
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    assignedOfficerId: row.assignedOfficerId,
    applicationId: row.applicationId,
    schedule: row.instalments.map(toInstalment),
  };
}

const WITH_SCHEDULE = { instalments: { orderBy: { instalmentNumber: 'asc' } } } satisfies Prisma.TermLoanInclude;

export interface LoanListFilter {
  readonly customerId?: string;
  readonly loanProductId?: string;
  readonly customerIds?: readonly string[];
  readonly approvedBy?: string;
  readonly assignedOfficerId?: string;
  /** Officer scope: loans of these customers OR loans assigned to this officer. */
  readonly visibleTo?: { readonly customerIds: readonly string[]; readonly officerId: string };
}

@Injectable()
export class TermLoansRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Loan + full schedule in one go. Called inside the disbursement transaction. */
  async insert(loan: NewTermLoan): Promise<string> {
    const id = await this.prisma.nextId('LN');
    await this.prisma.db.termLoan.create({
      data: {
        id,
        customerId: loan.customerId ?? null,
        loanProductId: loan.loanProductId ?? null,
        principalKobo: toKoboColumn(loan.principalKobo),
        annualRatePercent: loan.annualRatePercent,
        termMonths: loan.termMonths,
        instalmentKobo: toKoboColumn(loan.instalmentKobo),
        disbursedOn: loan.disbursedOn,
        createdBy: loan.createdBy ?? null,
        createdAt: loan.createdAt,
        approvedBy: loan.createdBy ?? null,
        approvedAt: loan.createdAt,
        assignedOfficerId: loan.assignedOfficerId ?? null,
        applicationId: loan.applicationId ?? null,
        instalments: {
          create: loan.schedule.map((row) => ({
            instalmentNumber: row.instalmentNumber,
            dueDate: row.dueDate,
            paymentKobo: toKoboColumn(row.paymentKobo),
            interestKobo: toKoboColumn(row.interestKobo),
            principalKobo: toKoboColumn(row.principalKobo),
            closingBalanceKobo: toKoboColumn(row.closingBalanceKobo),
          })),
        },
      },
    });
    return id;
  }

  async findById(loanId: string): Promise<StoredTermLoan | undefined> {
    const row = await this.prisma.db.termLoan.findUnique({ where: { id: loanId }, include: WITH_SCHEDULE });
    return row ? toLoan(row) : undefined;
  }

  /**
   * Pessimistic lock on one loan for the rest of the current transaction, then its fresh state.
   *
   * Bumping lock_version is a write, so on SQLite the transaction already holds the database write lock and on Postgres
   * this UPDATE takes the row lock (the equivalent of SELECT … FOR UPDATE). Everything read after it — the schedule,
   * what is already paid — cannot change until commit, so two repayments can never both allocate against the same
   * unpaid instalment. Returns undefined when the loan does not exist.
   */
  async lockForUpdate(loanId: string): Promise<StoredTermLoan | undefined> {
    const transaction = this.prisma.requireTransaction('Locking a loan');
    const { count } = await transaction.termLoan.updateMany({ where: { id: loanId }, data: { lockVersion: { increment: 1 } } });
    return count === 1 ? this.findById(loanId) : undefined;
  }

  async list(filter: LoanListFilter = {}): Promise<StoredTermLoan[]> {
    if (filter.customerIds && filter.customerIds.length === 0) return [];
    const where: Prisma.TermLoanWhereInput = {
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.loanProductId ? { loanProductId: filter.loanProductId } : {}),
      ...(filter.approvedBy ? { approvedBy: filter.approvedBy } : {}),
      ...(filter.assignedOfficerId ? { assignedOfficerId: filter.assignedOfficerId } : {}),
      AND: [
        ...(filter.customerIds ? [{ customerId: { in: [...filter.customerIds] } }] : []),
        ...(filter.visibleTo
          ? [{ OR: [{ customerId: { in: [...filter.visibleTo.customerIds] } }, { assignedOfficerId: filter.visibleTo.officerId }] }]
          : []),
      ],
    };
    const rows = await this.prisma.db.termLoan.findMany({ where, include: WITH_SCHEDULE, orderBy: { id: 'desc' } });
    return rows.map(toLoan);
  }

  /**
   * Records what a repayment collected against each instalment and any new unapplied credit.
   * Call only after lockForUpdate() in the same transaction; CHECK constraints refuse any over-collection as a last line.
   */
  async applyPayment(loanId: string, deltas: readonly InstalmentPaymentDelta[], unappliedCreditAddedKobo: Kobo): Promise<void> {
    const transaction = this.prisma.requireTransaction('Applying a payment');
    for (const delta of deltas) {
      await transaction.loanInstalment.update({
        where: { loanId_instalmentNumber: { loanId, instalmentNumber: delta.instalmentNumber } },
        data: {
          penaltyPaidKobo: { increment: toKoboColumn(delta.penaltyKobo) },
          feePaidKobo: { increment: toKoboColumn(delta.feeKobo) },
          interestPaidKobo: { increment: toKoboColumn(delta.interestKobo) },
          principalPaidKobo: { increment: toKoboColumn(delta.principalKobo) },
        },
      });
    }
    if (unappliedCreditAddedKobo > 0) {
      await transaction.termLoan.update({ where: { id: loanId }, data: { unappliedCreditKobo: { increment: toKoboColumn(unappliedCreditAddedKobo) } } });
    }
  }
}
