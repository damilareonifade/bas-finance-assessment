import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/auth.decorators';
import { Idempotency } from '../common/idempotency/idempotency-key.decorator';
import type { IdempotencyContext } from '../common/idempotency/idempotency.service';
import { LoanListQueryDto, OriginateTermLoanDto, QuoteTermLoanDto } from './dto/term-loan.dto';
import { TermLoansService } from './term-loans.service';

@Controller('term-loans')
export class TermLoansController {
  constructor(private readonly termLoans: TermLoansService) {}

  @Post('quote')
  @HttpCode(200)
  quote(@Body() body: QuoteTermLoanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.termLoans.quoteFor(body, user);
  }

  @Post()
  originate(@Body() body: OriginateTermLoanDto, @Idempotency() idempotency: IdempotencyContext, @CurrentUser() user: AuthenticatedUser) {
    return this.termLoans.originate(body, idempotency, user);
  }

  /** ?approvedBy=me|<userId>&officerId=me|<userId>&customerId= */
  @Get()
  list(@Query() query: LoanListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const resolve = (value: string | undefined) => (value === 'me' ? user.userId : value);
    return this.termLoans.listVisibleTo(user, { approvedBy: resolve(query.approvedBy), assignedOfficerId: resolve(query.officerId), customerId: query.customerId });
  }

  @Get(':loanId')
  get(@Param('loanId') loanId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.termLoans.getVisibleTo(user, loanId);
  }
}
