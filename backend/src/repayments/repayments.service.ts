import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { fieldError } from '../common/errors/app-errors';
import { IdempotencyContext, IdempotencyService } from '../common/idempotency/idempotency.service';
import { asKobo } from '../common/money';
import { credit, debit } from '../ledger/domain/journal';
import { JournalEntry } from '../ledger/ledger.repository';
import { LedgerService } from '../ledger/ledger.service';
import { outstandingOnInstalment } from '../term-loans/term-loan.view';
import { StoredTermLoan, TermLoansRepository } from '../term-loans/term-loans.repository';
import { TermLoansService } from '../term-loans/term-loans.service';
import { allocatePayment, PaymentAllocation, sumAllocation } from './domain/allocate-payment';
import { RepaymentDto } from './dto/repayment.dto';
import { RepaymentsRepository } from './repayments.repository';

export interface ConfirmedRepayment {
  repaymentId: string;
  allocation: PaymentAllocation;
  journalEntry: JournalEntry;
}

@Injectable()
export class RepaymentsService {
  constructor(
    private readonly termLoans: TermLoansService,
    private readonly termLoansRepository: TermLoansRepository,
    private readonly repayments: RepaymentsRepository,
    private readonly ledger: LedgerService,
    private readonly idempotency: IdempotencyService,
    private readonly clock: Clock,
  ) {}

  /** Server-computed allocation. Nothing is persisted. */
  async preview(loanId: string, request: RepaymentDto, actor: AuthenticatedUser): Promise<PaymentAllocation> {
    const loan = await this.termLoans.getStored(loanId);
    await this.termLoans.assertCanView(actor, loan);
    this.assertPaymentDateAllowed(loan, request.paymentDate);
    return this.allocate(loan, asKobo(request.amountKobo));
  }

  /**
   * Posts the payment using the same allocation logic as the preview — once per Idempotency-Key, in one transaction:
   * lock the loan → re-read its schedule → allocate → journal → instalment totals → repayment row → idempotency key.
   * Two different payments on the same loan at the same moment are applied one after the other, never against the same
   * stale balance.
   */
  confirm(loanId: string, request: RepaymentDto, idempotency: IdempotencyContext, actor: AuthenticatedUser): Promise<ConfirmedRepayment> {
    return this.idempotency.execute(idempotency, { loanId, ...request }, async () => {
      const loan = await this.termLoans.lockForUpdate(loanId);
      await this.termLoans.assertCanView(actor, loan);
      this.assertPaymentDateAllowed(loan, request.paymentDate);
      const amountKobo = asKobo(request.amountKobo);
      const allocation = this.allocate(loan, amountKobo);

      const journalEntry = await this.ledger.post({
        event: 'Repayment',
        postedOn: request.paymentDate,
        loanId,
        customerId: loan.customerId ?? undefined,
        lines: [
          debit('CASH', amountKobo),
          credit('LOANS_RECEIVABLE', sumAllocation(allocation.allocations, 'principalKobo')),
          credit('INTEREST_INCOME', sumAllocation(allocation.allocations, 'interestKobo')),
          credit('PENALTY_INCOME', sumAllocation(allocation.allocations, 'penaltyKobo')),
          credit('FEE_INCOME', sumAllocation(allocation.allocations, 'feeKobo')),
          credit('UNAPPLIED_CREDIT', allocation.unappliedCreditKobo),
        ],
      });
      await this.termLoansRepository.applyPayment(loanId, allocation.allocations, allocation.unappliedCreditKobo);
      const repaymentId = await this.repayments.insert({
        loanId,
        amountKobo,
        paymentDate: request.paymentDate,
        allocation,
        journalEntryId: journalEntry.entryId,
        createdBy: actor.userId,
        createdAt: this.clock.nowIso(),
      });
      return { repaymentId, allocation, journalEntry };
    });
  }

  /** Every instalment with something still owed is eligible, oldest first (see NOTES.md assumption A3). */
  private allocate(loan: StoredTermLoan, amountKobo: ReturnType<typeof asKobo>): PaymentAllocation {
    const owing = loan.schedule
      .map((instalment) => ({ instalmentNumber: instalment.instalmentNumber, outstanding: outstandingOnInstalment(instalment) }))
      .filter(({ outstanding }) => outstanding.interestKobo + outstanding.principalKobo > 0);
    return allocatePayment(amountKobo, owing);
  }

  private assertPaymentDateAllowed(loan: StoredTermLoan, paymentDate: string): void {
    if (paymentDate < loan.disbursedOn) throw fieldError('paymentDate', `Payment date cannot be before the loan was disbursed (${loan.disbursedOn})`);
  }
}
