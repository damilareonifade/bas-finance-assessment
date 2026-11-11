import { addKobo, subtractKobo, ZERO_KOBO, type Kobo } from '@/lib/money';
import type { StatementLine } from './schemas/statement';

export interface StatementRow extends StatementLine {
  /** Loans Receivable debits minus credits for this loan, after this line. */
  readonly runningPrincipalBalanceKobo: Kobo;
}

/** Builds statement rows from ledger lines. Only Loans Receivable lines move the principal balance. */
export function buildStatementRows(lines: readonly StatementLine[]): readonly StatementRow[] {
  let runningPrincipalBalanceKobo: Kobo = ZERO_KOBO;
  return lines.map((line) => {
    if (line.account === 'LOANS_RECEIVABLE') {
      runningPrincipalBalanceKobo = subtractKobo(addKobo(runningPrincipalBalanceKobo, line.debitKobo), line.creditKobo);
    }
    return { ...line, runningPrincipalBalanceKobo };
  });
}

export function statementClosingBalanceKobo(rows: readonly StatementRow[]): Kobo {
  return rows.at(-1)?.runningPrincipalBalanceKobo ?? ZERO_KOBO;
}

interface ScheduleRowForOutstanding {
  readonly principalKobo: Kobo;
  readonly principalPaidKobo: Kobo;
}

/** Outstanding principal according to the schedule: scheduled principal minus principal already collected. */
export function calculateScheduleOutstandingPrincipalKobo(schedule: readonly ScheduleRowForOutstanding[]): Kobo {
  return schedule.reduce<Kobo>((total, row) => addKobo(total, subtractKobo(row.principalKobo, row.principalPaidKobo)), ZERO_KOBO);
}

export interface TieOutResult {
  readonly isTiedOut: boolean;
  /** statement closing balance − schedule outstanding principal (0 when tied out). */
  readonly differenceKobo: Kobo;
}

export function calculateTieOut(statementClosingKobo: Kobo, scheduleOutstandingKobo: Kobo): TieOutResult {
  const differenceKobo = subtractKobo(statementClosingKobo, scheduleOutstandingKobo);
  return { isTiedOut: differenceKobo === 0, differenceKobo };
}
