import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/auth.decorators';
import { Idempotency } from '../common/idempotency/idempotency-key.decorator';
import type { IdempotencyContext } from '../common/idempotency/idempotency.service';
import { FinanceInvoiceDto, QuoteInvoiceDto, SettleInvoiceDto } from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post('quote')
  @HttpCode(200)
  quote(@Body() body: QuoteInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.quoteFor(body, user);
  }

  @Post()
  finance(@Body() body: FinanceInvoiceDto, @Idempotency() idempotency: IdempotencyContext, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.finance(body, idempotency, user);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.invoices.listVisibleTo(user);
  }

  @Get(':invoiceId')
  get(@Param('invoiceId') invoiceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.getVisibleTo(user, invoiceId);
  }

  @Post(':invoiceId/settlement/preview')
  @HttpCode(200)
  previewSettlement(@Param('invoiceId') invoiceId: string, @Body() body: SettleInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.previewSettlement(invoiceId, body, user);
  }

  @Post(':invoiceId/settlement')
  settle(@Param('invoiceId') invoiceId: string, @Body() body: SettleInvoiceDto, @Idempotency() idempotency: IdempotencyContext, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.settle(invoiceId, body, idempotency, user);
  }
}
