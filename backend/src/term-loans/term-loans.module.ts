import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { LedgerModule } from '../ledger/ledger.module';
import { LoanProductsModule } from '../loan-products/loan-products.module';
import { UsersModule } from '../users/users.module';
import { TermLoansController } from './term-loans.controller';
import { TermLoansRepository } from './term-loans.repository';
import { TermLoansService } from './term-loans.service';

@Module({
  imports: [LedgerModule, CustomersModule, LoanProductsModule, UsersModule],
  controllers: [TermLoansController],
  providers: [TermLoansRepository, TermLoansService],
  exports: [TermLoansRepository, TermLoansService],
})
export class TermLoansModule {}
