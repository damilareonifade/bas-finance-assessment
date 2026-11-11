import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CustomerDocumentsModule } from './customer-documents/customer-documents.module';
import { LoanApplicationsModule } from './loan-applications/loan-applications.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PortalModule } from './portal/portal.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/database.module';
import { InvoiceFinancingModule } from './invoice-financing/invoice-financing.module';
import { LedgerModule } from './ledger/ledger.module';
import { LoanProductsModule } from './loan-products/loan-products.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { StatementsModule } from './statements/statements.module';
import { TermLoansModule } from './term-loans/term-loans.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    IdempotencyModule,
    UsersModule,
    AuthModule,
    CustomersModule,
    LoanProductsModule,
    LedgerModule,
    TermLoansModule,
    RepaymentsModule,
    InvoiceFinancingModule,
    StatementsModule,
    AdminModule,
    NotificationsModule,
    CustomerDocumentsModule,
    LoanApplicationsModule,
    PortalModule,
  ],
})
export class AppModule {}
