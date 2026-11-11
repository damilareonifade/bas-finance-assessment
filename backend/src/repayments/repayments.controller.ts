import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/auth.decorators';
import { Idempotency } from '../common/idempotency/idempotency-key.decorator';
import type { IdempotencyContext } from '../common/idempotency/idempotency.service';
import { RepaymentDto } from './dto/repayment.dto';
import { RepaymentsService } from './repayments.service';

@Controller('term-loans/:loanId/repayments')
export class RepaymentsController {
  constructor(private readonly repayments: RepaymentsService) {}

  @Post('preview')
  @HttpCode(200)
  preview(@Param('loanId') loanId: string, @Body() body: RepaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.repayments.preview(loanId, body, user);
  }

  @Post()
  confirm(@Param('loanId') loanId: string, @Body() body: RepaymentDto, @Idempotency() idempotency: IdempotencyContext, @CurrentUser() user: AuthenticatedUser) {
    return this.repayments.confirm(loanId, body, idempotency, user);
  }
}
