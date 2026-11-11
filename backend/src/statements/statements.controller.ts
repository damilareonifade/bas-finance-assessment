import { Controller, Get, Param } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/auth.decorators';
import { LedgerRepository } from '../ledger/ledger.repository';
import { TermLoansService } from '../term-loans/term-loans.service';

@Controller('term-loans/:loanId/statement')
export class StatementsController {
  constructor(
    private readonly termLoans: TermLoansService,
    private readonly ledger: LedgerRepository,
  ) {}

  /** The borrower statement is the loan's ledger lines. The UI derives the running balance and the tie-out. */
  @Get()
  async statement(@Param('loanId') loanId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.termLoans.getVisibleTo(user, loanId);
    return { loanId, lines: await this.ledger.linesForLoan(loanId) };
  }
}
