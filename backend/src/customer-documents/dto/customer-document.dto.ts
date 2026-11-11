import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DOCUMENT_TYPES, DocumentType } from '../document-rules';

export class RequestDocumentDto {
  @IsIn(DOCUMENT_TYPES)
  type!: DocumentType;

  /** What exactly you need from the applicant. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Multipart fields that come with the optional `file`. */
export class SubmitDocumentDto {
  @IsIn(DOCUMENT_TYPES)
  type!: DocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  identifier?: string;
}

export class ReviewDocumentDto {
  @IsIn(['VERIFIED', 'REJECTED'])
  decision!: 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note?: string;
}
