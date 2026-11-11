import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError, FieldError } from './app-errors';

export interface ApiErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  errors?: readonly FieldError[];
}

const HTTP_STATUS_CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
};

/** Every error leaves the API in the same shape: { statusCode, code, message, errors? }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const envelope = this.toEnvelope(exception);
    if (envelope.statusCode >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    response.status(envelope.statusCode).json(envelope);
  }

  private toEnvelope(exception: unknown): ApiErrorEnvelope {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        ...(exception.fieldErrors ? { errors: exception.fieldErrors } : {}),
      };
    }
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return { statusCode, code: HTTP_STATUS_CODES[statusCode] ?? 'HTTP_ERROR', message: exception.message };
    }
    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong on our side' };
  }
}
