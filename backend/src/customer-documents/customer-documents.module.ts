import { Module } from '@nestjs/common';
import { CustomerNotificationsModule } from '../customer-notifications/customer-notifications.module';
import { CustomersModule } from '../customers/customers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { CustomerDocumentsController } from './customer-documents.controller';
import { CustomerDocumentsRepository } from './customer-documents.repository';
import { CustomerDocumentsService } from './customer-documents.service';

@Module({
  imports: [CustomersModule, UsersModule, NotificationsModule, CustomerNotificationsModule],
  controllers: [CustomerDocumentsController],
  providers: [CustomerDocumentsRepository, CustomerDocumentsService],
  exports: [CustomerDocumentsService],
})
export class CustomerDocumentsModule {}
