import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsKobo } from '../../common/validation/is-kobo.decorator';
import { MAX_PRINCIPAL_KOBO, MAX_TERM_MONTHS, MIN_PRINCIPAL_KOBO, MIN_TERM_MONTHS } from '../../common/money';
import { DOCUMENT_TYPES, DocumentType } from '../../customer-documents/document-rules';

export class PortalLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class PortalAcceptInvitationDto {
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

export class PortalChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}

/** The customer chooses a product, an amount and a term. The rate is the product's — customers never set it. */
export class PortalQuoteDto {
  @IsString()
  @MaxLength(64)
  loanProductId!: string;

  @IsKobo({ min: MIN_PRINCIPAL_KOBO, max: MAX_PRINCIPAL_KOBO })
  principalKobo!: number;

  @IsInt()
  @Min(MIN_TERM_MONTHS)
  @Max(MAX_TERM_MONTHS)
  termMonths!: number;
}

export class PortalApplicationDto extends PortalQuoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;
}

export class PortalSubmitDocumentDto {
  @IsIn(DOCUMENT_TYPES)
  type!: DocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  identifier?: string;
}

/** Staff: invite a customer to the portal (defaults to the email on their profile). */
export class InviteCustomerToPortalDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class SetPortalAccessDto {
  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';
}
