import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';

@Module({ imports: [UsersModule, NotificationsModule], providers: [CustomersRepository, CustomersService], exports: [CustomersRepository, CustomersService] })
export class CustomersModule {}
