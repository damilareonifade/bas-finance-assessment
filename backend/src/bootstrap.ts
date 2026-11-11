import { INestApplication } from '@nestjs/common';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { createValidationPipe } from './common/validation/validation-pipe.factory';

/** Shared between main.ts and the e2e tests so both run with identical pipes and filters. */
export function configureApp(app: INestApplication, frontendOrigin: string): void {
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: frontendOrigin, credentials: true, allowedHeaders: ['Content-Type', 'Idempotency-Key'] });
}
