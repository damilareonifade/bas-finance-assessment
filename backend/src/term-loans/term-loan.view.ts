import { addKobo, Kobo, subtractKobo, ZERO_KOBO } from '../common/money';
import type { PersonLookup, PersonRef } from '../users/users.service';
import { StoredInstalment, StoredTermLoan } from './term-loans.repository';

export type { PersonLookup, PersonRef };

export type InstalmentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface InstalmentOutstanding {
  readonly penaltyKobo: Kobo;
  readonly feeKobo: Kobo;
  readonly interestKobo: Kobo;
  readonly principalKobo: Kobo;
}

/** What is still owed on an instalment. Term loans carry no penalty/fee in this scope, so those are 0. */
export function outstandingOnInstalment(instalment: StoredInstalment): InstalmentOutstanding {
  return {
    penaltyKobo: ZERO_KOBO,
    feeKobo: ZERO_KOBO,
    interestKobo: subtractKobo(instalment.interestKobo, instalment.interestPaidKobo),
    principalKobo: subtractKobo(instalment.principalKobo, instalment.principalPaidKobo),
  };
}

export function instalmentStatus(instalment: StoredInstalment): InstalmentStatus {
  const outstanding = outstandingOnInstalment(instalment);
  const totalOutstanding = addKobo(outstanding.interestKobo, outstanding.principalKobo);
  if (totalOutstanding === 0) return 'PAID';
  return instalment.interestPaidKobo + instalment.principalPaidKobo > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
}

export function outstandingPrincipalKobo(loan: StoredTermLoan): Kobo {
  return loan.schedule.reduce<Kobo>((total, row) => addKobo(total, subtractKobo(row.principalKobo, row.principalPaidKobo)), ZERO_KOBO);
}

/** Amount past due as of `asOf` (instalments whose due date is before `asOf` and are not fully paid). */
export function overdueKobo(loan: StoredTermLoan, asOf: string): Kobo {
  return loan.schedule
    .filter((row) => row.dueDate < asOf)
    .reduce<Kobo>((total, row) => {
      const outstanding = outstandingOnInstalment(row);
      return addKobo(total, outstanding.interestKobo, outstanding.principalKobo);
    }, ZERO_KOBO);
}

export interface TermLoanView {
  loanId: string;
  approvedBy: PersonRef | null;
  approvedAt: string | null;
  assignedOfficer: PersonRef | null;
  applicationId: string | null;
  customerId: string | null;
  loanProductId: string | null;
  principalKobo: Kobo;
  annualRatePercent: number;
  termMonths: number;
  instalmentKobo: Kobo;
  disbursedOn: string;
  unappliedCreditKobo: Kobo;
  outstandingPrincipalKobo: Kobo;
  schedule: Array<{
    instalmentNumber: number;
    dueDate: string;
    paymentKobo: Kobo;
    interestKobo: Kobo;
    principalKobo: Kobo;
    closingBalanceKobo: Kobo;
    principalPaidKobo: Kobo;
    status: InstalmentStatus;
  }>;
}

export function toTermLoanView(loan: StoredTermLoan, people: PersonLookup = () => null): TermLoanView {
  return {
    loanId: loan.loanId,
    approvedBy: people(loan.approvedBy),
    approvedAt: loan.approvedAt,
    assignedOfficer: people(loan.assignedOfficerId),
    applicationId: loan.applicationId,
    customerId: loan.customerId,
    loanProductId: loan.loanProductId,
    principalKobo: loan.principalKobo,
    annualRatePercent: loan.annualRatePercent,
    termMonths: loan.termMonths,
    instalmentKobo: loan.instalmentKobo,
    disbursedOn: loan.disbursedOn,
    unappliedCreditKobo: loan.unappliedCreditKobo,
    outstandingPrincipalKobo: outstandingPrincipalKobo(loan),
    schedule: loan.schedule.map((row) => ({
      instalmentNumber: row.instalmentNumber,
      dueDate: row.dueDate,
      paymentKobo: row.paymentKobo,
      interestKobo: row.interestKobo,
      principalKobo: row.principalKobo,
      closingBalanceKobo: row.closingBalanceKobo,
      principalPaidKobo: row.principalPaidKobo,
      status: instalmentStatus(row),
    })),
  };
}
