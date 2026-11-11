import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.decorator';
import { IsKobo } from '../../common/validation/is-kobo.decorator';
import {
  MAX_ANNUAL_RATE_PERCENT,
  MAX_PRINCIPAL_KOBO,
  MAX_TERM_MONTHS,
  MIN_ANNUAL_RATE_PERCENT,
  MIN_PRINCIPAL_KOBO,
  MIN_TERM_MONTHS,
} from '../../common/money/limits';

/** The three numbers every term loan is made of. */
export class TermLoanTermsDto {
  @IsKobo({ min: MIN_PRINCIPAL_KOBO, max: MAX_PRINCIPAL_KOBO })
  principalKobo!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 6 })
  @Min(MIN_ANNUAL_RATE_PERCENT)
  @Max(MAX_ANNUAL_RATE_PERCENT)
  annualRatePercent!: number;

  @IsInt()
  @Min(MIN_TERM_MONTHS)
  @Max(MAX_TERM_MONTHS)
  termMonths!: number;
}

export class QuoteTermLoanDto extends TermLoanTermsDto {
  /** When given, the quote is checked like the loan will be: the caller may lend to this customer. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  /** When given, the quote is checked against this product's limits — so a quote is never offered that approval would refuse. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  loanProductId?: string;
}

export class OriginateTermLoanDto extends QuoteTermLoanDto {
  /** Defaults to today. */
  @IsOptional()
  @IsCalendarDate()
  disbursedOn?: string;

  /** Loan officer following the loan up. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedOfficerId?: string;
}

export class LoanListQueryDto {
  /** A user id, or "me". */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  approvedBy?: string;

  /** A user id, or "me". */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  officerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;
}
