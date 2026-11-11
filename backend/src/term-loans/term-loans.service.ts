import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { CustomersService } from '../customers/customers.service';
import { LoanProductsService } from '../loan-products/loan-products.service';
import { asCalendarDate } from '../common/dates/calendar-date';
import { ForbiddenError, NotFoundError } from '../common/errors/app-errors';
import { PersonLookup, UsersService } from '../users/users.service';
import { IdempotencyContext, IdempotencyService } from '../common/idempotency/idempotency.service';
import { asKobo } from '../common/money';
import { PrismaService } from '../database/prisma.service';
import { credit, debit } from '../ledger/domain/journal';
import { JournalEntry } from '../ledger/ledger.repository';
import { LedgerService } from '../ledger/ledger.service';
import { buildSchedule, calculateInstalmentKobo, dueDateForInstalment, sumInterestKobo } from './domain/term-loan-schedule';
import { OriginateTermLoanDto, QuoteTermLoanDto, TermLoanTermsDto } from './dto/term-loan.dto';
import { TermLoanView, toTermLoanView } from './term-loan.view';
import { LoanListFilter, StoredTermLoan, TermLoansRepository } from './term-loans.repository';

export interface TermLoanQuote {
  instalmentKobo: number;
  totalInterestKobo: number;
  schedule: ReturnType<typeof buildSchedule>;
}

export interface OriginatedTermLoan {
  loan: TermLoanView;
  journalEntry: JournalEntry;
}

export interface DisbursementContext {
  /** Officer following the loan up. Officers can only assign themselves. */
  readonly assignedOfficerId?: string;
  /** When the loan comes from an approved application. */
  readonly applicationId?: string;
}

export interface LoanListQuery {
  readonly approvedBy?: string;
  readonly assignedOfficerId?: string;
  readonly customerId?: string;
}

@Injectable()
export class TermLoansService {
  constructor(
    private readonly repository: TermLoansRepository,
    private readonly ledger: LedgerService,
    private readonly idempotency: IdempotencyService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly customers: CustomersService,
    private readonly products: LoanProductsService,
    private readonly users: UsersService,
  ) {}

  /**
   * The quote shown before approval. It runs the same customer and product checks as disbursement, so a schedule is never
   * offered for a loan that approval would then refuse.
   */
  async quoteFor(request: QuoteTermLoanDto, actor: AuthenticatedUser): Promise<TermLoanQuote> {
    // Without a customer the quote is a calculator; approval still insists on one (for officers) and says so on the field.
    if (request.customerId) await this.customers.assertCanTransactFor(actor, request.customerId);
    if (request.loanProductId) {
      await this.products.assertFacilityFits(request.loanProductId, 'TERM_LOAN', {
        principalKobo: request.principalKobo,
        annualRatePercent: request.annualRatePercent,
        termMonths: request.termMonths,
      });
    }
    return this.quote(request);
  }

  quote(request: TermLoanTermsDto): TermLoanQuote {
    const terms = { principalKobo: asKobo(request.principalKobo), annualRatePercent: request.annualRatePercent, termMonths: request.termMonths };
    const schedule = buildSchedule(terms);
    return { instalmentKobo: calculateInstalmentKobo(terms), totalInterestKobo: sumInterestKobo(schedule), schedule };
  }

  /** Approve and disburse directly (no application) — once per Idempotency-Key. The approver is the caller. */
  originate(request: OriginateTermLoanDto, idempotency: IdempotencyContext, actor: AuthenticatedUser): Promise<OriginatedTermLoan> {
    return this.idempotency.execute(idempotency, request, () => this.disburse(request, actor, { assignedOfficerId: request.assignedOfficerId }));
  }

  /**
   * Creates the loan + schedule and posts Dr Loans Receivable / Cr Cash, recording who approved it — all in one transaction
   * (joining the caller's: origination's idempotency transaction, or application approval's).
   * NOT idempotent on its own: callers wrap it.
   */
  async disburse(request: OriginateTermLoanDto, actor: AuthenticatedUser, context: DisbursementContext = {}): Promise<OriginatedTermLoan> {
    return this.prisma.transaction(async () => {
      // An approved application was already access-checked by the applications module (officers may hold an application
      // assigned to them for a customer who is not in their book); direct origination is checked here.
      if (!context.applicationId) await this.customers.assertCanTransactFor(actor, request.customerId);
      if (request.loanProductId) {
        await this.products.assertFacilityFits(request.loanProductId, 'TERM_LOAN', {
          principalKobo: request.principalKobo,
          annualRatePercent: request.annualRatePercent,
          termMonths: request.termMonths,
        });
      }
      if (context.assignedOfficerId) {
        await this.customers.assertActiveOfficer(context.assignedOfficerId, 'assignedOfficerId');
        if (actor.role === 'LOAN_OFFICER' && context.assignedOfficerId !== actor.userId) throw new ForbiddenError('Loan officers can only assign loans to themselves');
      }
      const terms = { principalKobo: asKobo(request.principalKobo), annualRatePercent: request.annualRatePercent, termMonths: request.termMonths };
      const disbursedOn = request.disbursedOn ? asCalendarDate(request.disbursedOn) : this.clock.today();
      const schedule = buildSchedule(terms).map((row) => ({ ...row, dueDate: dueDateForInstalment(disbursedOn, row.instalmentNumber) }));

      const loanId = await this.repository.insert({
        customerId: request.customerId,
        loanProductId: request.loanProductId,
        ...terms,
        instalmentKobo: calculateInstalmentKobo(terms),
        disbursedOn,
        createdBy: actor.userId,
        createdAt: this.clock.nowIso(),
        assignedOfficerId: context.assignedOfficerId,
        applicationId: context.applicationId,
        schedule,
      });
      const journalEntry = await this.ledger.post({
        event: 'Disbursement',
        postedOn: disbursedOn,
        loanId,
        customerId: request.customerId,
        lines: [debit('LOANS_RECEIVABLE', terms.principalKobo), credit('CASH', terms.principalKobo)],
      });
      return { loan: await this.view(await this.getStored(loanId)), journalEntry };
    });
  }

  /** Admins see every loan; officers see their customers' loans and loans assigned to them. */
  async canView(actor: AuthenticatedUser, loan: StoredTermLoan): Promise<boolean> {
    return actor.role === 'ADMIN' || loan.assignedOfficerId === actor.userId || (await this.customers.canView(actor, loan.customerId));
  }

  async assertCanView(actor: AuthenticatedUser, loan: StoredTermLoan): Promise<void> {
    if (!(await this.canView(actor, loan))) throw new ForbiddenError('This loan is not in your book');
  }

  async getStored(loanId: string): Promise<StoredTermLoan> {
    const loan = await this.repository.findById(loanId);
    if (!loan) throw new NotFoundError('LOAN_NOT_FOUND', `Loan ${loanId} does not exist`);
    return loan;
  }

  /** Locks the loan for the rest of the current transaction and returns its fresh state (see TermLoansRepository.lockForUpdate). */
  async lockForUpdate(loanId: string): Promise<StoredTermLoan> {
    const loan = await this.repository.lockForUpdate(loanId);
    if (!loan) throw new NotFoundError('LOAN_NOT_FOUND', `Loan ${loanId} does not exist`);
    return loan;
  }

  /** Approver / officer names for a set of loans, in one query. */
  peopleFor(loans: readonly StoredTermLoan[]): Promise<PersonLookup> {
    return this.users.people(loans.flatMap((loan) => [loan.approvedBy, loan.assignedOfficerId]));
  }

  async view(loan: StoredTermLoan): Promise<TermLoanView> {
    return toTermLoanView(loan, await this.peopleFor([loan]));
  }

  async get(loanId: string): Promise<TermLoanView> {
    return this.view(await this.getStored(loanId));
  }

  /** Loans the actor may see, optionally narrowed (e.g. "approved by me"). */
  async listVisibleTo(actor: AuthenticatedUser, query: LoanListQuery = {}): Promise<TermLoanView[]> {
    const filter: LoanListFilter = {
      approvedBy: query.approvedBy,
      assignedOfficerId: query.assignedOfficerId,
      customerId: query.customerId,
      ...(actor.role === 'ADMIN' ? {} : { visibleTo: { customerIds: await this.customers.idsInBookOf(actor.userId), officerId: actor.userId } }),
    };
    const loans = await this.repository.list(filter);
    const people = await this.peopleFor(loans);
    return loans.map((loan) => toTermLoanView(loan, people));
  }

  async getVisibleTo(actor: AuthenticatedUser, loanId: string): Promise<TermLoanView> {
    const loan = await this.getStored(loanId);
    await this.assertCanView(actor, loan);
    return this.view(loan);
  }

  listStored(filter: LoanListFilter = {}): Promise<StoredTermLoan[]> {
    return this.repository.list(filter);
  }
}
