import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { InvoiceFinancingModule } from '../invoice-financing/invoice-financing.module';
import { LedgerModule } from '../ledger/ledger.module';
import { LoanProductsModule } from '../loan-products/loan-products.module';
import { TermLoansModule } from '../term-loans/term-loans.module';
import { UsersModule } from '../users/users.module';
import { CollectionsController, CustomersController, DashboardController, LoanProductsController } from './admin.controllers';
import { DashboardTrendsRepository } from './dashboard-trends.repository';
import { LedgerBookController } from './ledger-book.controller';
import { LedgerBookService } from './ledger-book.service';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [CustomersModule, LoanProductsModule, TermLoansModule, InvoiceFinancingModule, LedgerModule, UsersModule],
  controllers: [CustomersController, LoanProductsController, CollectionsController, DashboardController, LedgerBookController],
  providers: [PortfolioService, DashboardTrendsRepository, LedgerBookService],
})
export class AdminModule {}
