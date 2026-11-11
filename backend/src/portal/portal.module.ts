import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { CustomerDocumentsModule } from '../customer-documents/customer-documents.module';
import { CustomerNotificationsModule } from '../customer-notifications/customer-notifications.module';
import { CustomersModule } from '../customers/customers.module';
import { InvoiceFinancingModule } from '../invoice-financing/invoice-financing.module';
import { LedgerModule } from '../ledger/ledger.module';
import { LoanApplicationsModule } from '../loan-applications/loan-applications.module';
import { LoanProductsModule } from '../loan-products/loan-products.module';
import { TermLoansModule } from '../term-loans/term-loans.module';
import { UsersModule } from '../users/users.module';
import { CustomerAccountsRepository } from './customer-accounts.repository';
import { PortalAuthGuard } from './portal-auth.guard';
import { PortalAuthService } from './portal-auth.service';
import { CustomerPortalAccessController, PortalAuthController, PortalController } from './portal.controllers';
import { PortalService } from './portal.service';

/** The customer self-service portal (/portal/*) and the staff controls for it (/customers/:id/portal-access). */
@Module({
  imports: [
    UsersModule,
    CustomersModule,
    LoanProductsModule,
    TermLoansModule,
    InvoiceFinancingModule,
    LedgerModule,
    LoanApplicationsModule,
    CustomerDocumentsModule,
    CustomerNotificationsModule,
    JwtModule.registerAsync({ inject: [APP_CONFIG], useFactory: (config: AppConfig) => ({ secret: config.JWT_SECRET }) }),
  ],
  controllers: [PortalAuthController, PortalController, CustomerPortalAccessController],
  providers: [CustomerAccountsRepository, PortalAuthService, PortalService, { provide: APP_GUARD, useClass: PortalAuthGuard }],
})
export class PortalModule {}
