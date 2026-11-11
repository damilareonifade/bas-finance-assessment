import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { LedgerModule } from '../ledger/ledger.module';
import { TermLoansModule } from '../term-loans/term-loans.module';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsRepository } from './repayments.repository';
import { RepaymentsService } from './repayments.service';

@Module({
  imports: [LedgerModule, TermLoansModule, CustomersModule],
  controllers: [RepaymentsController],
  providers: [RepaymentsRepository, RepaymentsService],
  exports: [RepaymentsService],
})
export class RepaymentsModule {}
