import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.decorator';
import { IsKobo } from '../../common/validation/is-kobo.decorator';
import { MAX_AMOUNT_KOBO } from '../../common/money/limits';

export class QuoteInvoiceDto {
  @IsKobo({ min: 100, max: MAX_AMOUNT_KOBO })
  faceValueKobo!: number;

  /** The day the advance is paid. */
  @IsCalendarDate()
  issueDate!: string;

  @IsCalendarDate()
  dueDate!: string;

  /** When given, the quote is checked like the advance will be: the caller may finance this customer. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  /** When given, the face value is checked against this product's limits. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  loanProductId?: string;
}

export class FinanceInvoiceDto extends QuoteInvoiceDto {}

export class SettleInvoiceDto {
  /** The date the debtor paid the lender. */
  @IsCalendarDate()
  settlementDate!: string;
}
