import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^[+0-9][0-9 ()-]{6,19}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  /** Admins may assign at creation. Officers are always assigned to themselves. */
  @IsOptional()
  @IsString()
  assignedOfficerId?: string;
}

export class AssignOfficerDto {
  /** null un-assigns the customer. */
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  officerId!: string | null;
}
