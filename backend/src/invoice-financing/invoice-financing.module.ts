import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { LedgerModule } from '../ledger/ledger.module';
import { LoanProductsModule } from '../loan-products/loan-products.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [LedgerModule, CustomersModule, LoanProductsModule],
  controllers: [InvoicesController],
  providers: [InvoicesRepository, InvoicesService],
  exports: [InvoicesRepository, InvoicesService],
})
export class InvoiceFinancingModule {}
