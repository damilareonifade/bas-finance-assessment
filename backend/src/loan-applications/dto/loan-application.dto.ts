import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.decorator';
import { TermLoanTermsDto } from '../../term-loans/dto/term-loan.dto';
import { APPLICATION_STATUSES, ApplicationStatus } from '../loan-applications.repository';

export class CreateLoanApplicationDto extends TermLoanTermsDto {
  /** The applicant's customer profile. */
  @IsString()
  @MaxLength(64)
  customerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  loanProductId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;
}

export class ApplicationListQueryDto {
  @IsOptional()
  @IsIn([...APPLICATION_STATUSES, 'OPEN'])
  status?: ApplicationStatus | 'OPEN';

  /** A user id, or "me". */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  officerId?: string;

  /** Who approved or rejected: a user id, or "me". */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  decidedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class AssignApplicationOfficerDto {
  /** null removes the officer. */
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  officerId!: string | null;
}

export class ApproveApplicationDto {
  /** Loan officer for the new loan. Admins may pick anyone active; officers are assigned themselves. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  officerId?: string;

  /** Defaults to today. */
  @IsOptional()
  @IsCalendarDate()
  disbursedOn?: string;
}

export class RejectApplicationDto {
  @IsString()
  @MinLength(3, { message: 'reason must explain the decision' })
  @MaxLength(500)
  reason!: string;
}
