import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, Max, MinLength, IsInt } from 'class-validator';
import { IsKobo } from '../../common/validation/is-kobo.decorator';
import { MAX_AMOUNT_KOBO, MAX_ANNUAL_RATE_PERCENT, MAX_TERM_MONTHS, MIN_ANNUAL_RATE_PERCENT, MIN_TERM_MONTHS } from '../../common/money/limits';

export const PRODUCT_TYPES = ['TERM_LOAN', 'INVOICE_FINANCING'] as const;
export const PRODUCT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

class ProductLimitsFields {
  @IsOptional()
  @IsKobo({ min: 100, max: MAX_AMOUNT_KOBO })
  minPrincipalKobo?: number;

  @IsOptional()
  @IsKobo({ min: 100, max: MAX_AMOUNT_KOBO })
  maxPrincipalKobo?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(MIN_ANNUAL_RATE_PERCENT)
  @Max(MAX_ANNUAL_RATE_PERCENT)
  minAnnualRatePercent?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(MIN_ANNUAL_RATE_PERCENT)
  @Max(MAX_ANNUAL_RATE_PERCENT)
  maxAnnualRatePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_TERM_MONTHS)
  @Max(MAX_TERM_MONTHS)
  minTermMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_TERM_MONTHS)
  @Max(MAX_TERM_MONTHS)
  maxTermMonths?: number;
}

export class CreateLoanProductDto extends ProductLimitsFields {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsIn(PRODUCT_TYPES)
  type!: (typeof PRODUCT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateLoanProductDto extends ProductLimitsFields {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];
}
