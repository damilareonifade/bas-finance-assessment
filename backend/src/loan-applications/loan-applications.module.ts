import { Module } from '@nestjs/common';
import { CustomerDocumentsModule } from '../customer-documents/customer-documents.module';
import { CustomerNotificationsModule } from '../customer-notifications/customer-notifications.module';
import { CustomersModule } from '../customers/customers.module';
import { LoanProductsModule } from '../loan-products/loan-products.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TermLoansModule } from '../term-loans/term-loans.module';
import { UsersModule } from '../users/users.module';
import { LoanApplicationsController } from './loan-applications.controller';
import { LoanApplicationsRepository } from './loan-applications.repository';
import { LoanApplicationsService } from './loan-applications.service';

@Module({
  imports: [CustomersModule, LoanProductsModule, TermLoansModule, CustomerDocumentsModule, NotificationsModule, UsersModule, CustomerNotificationsModule],
  controllers: [LoanApplicationsController],
  providers: [LoanApplicationsRepository, LoanApplicationsService],
  exports: [LoanApplicationsService],
})
export class LoanApplicationsModule {}
