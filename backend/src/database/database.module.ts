import { Global, Module } from '@nestjs/common';
import { Clock } from '../common/clock/clock';
import { APP_CONFIG, loadAppConfig } from '../config/app-config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadAppConfig() }, PrismaService, Clock],
  exports: [APP_CONFIG, PrismaService, Clock],
})
export class DatabaseModule {}
