import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.decorator';

export class CustomerListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  officerId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  unassigned?: 'true' | 'false';
}

export class ProductListQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ARCHIVED';
}

export class CollectionsQueryDto {
  @IsOptional()
  @IsString()
  officerId?: string;
}

export class LedgerQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  loanProductId?: string;

  /** Inclusive, YYYY-MM-DD. */
  @IsOptional()
  @IsCalendarDate()
  from?: string;

  @IsOptional()
  @IsCalendarDate()
  to?: string;
}

export class LedgerSearchQueryDto {
  @IsString()
  @MaxLength(100)
  q!: string;
}
