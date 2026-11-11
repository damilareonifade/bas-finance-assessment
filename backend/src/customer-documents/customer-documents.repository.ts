import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CustomerDocument as DocumentRow } from '../generated/prisma/client';
import { DocumentStatus, DocumentType } from './document-rules';

export interface StoredDocument {
  readonly documentId: string;
  readonly customerId: string;
  readonly type: DocumentType;
  readonly status: DocumentStatus;
  readonly identifier: string | null;
  readonly fileName: string | null;
  readonly filePath: string | null;
  readonly fileMime: string | null;
  readonly fileSize: number | null;
  readonly requestNote: string | null;
  readonly requestedBy: string | null;
  readonly requestedAt: string | null;
  readonly submittedBy: string | null;
  /** Uploaded by the customer through the portal (submittedBy is then null). */
  readonly submittedByCustomer: boolean;
  readonly submittedAt: string | null;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly createdAt: string;
}

const toDocument = (row: DocumentRow): StoredDocument => ({
  documentId: row.id,
  customerId: row.customerId,
  type: row.type as DocumentType,
  status: row.status as DocumentStatus,
  identifier: row.identifier,
  fileName: row.fileName,
  filePath: row.filePath,
  fileMime: row.fileMime,
  fileSize: row.fileSize,
  requestNote: row.requestNote,
  requestedBy: row.requestedBy,
  requestedAt: row.requestedAt,
  submittedBy: row.submittedBy,
  submittedByCustomer: row.submittedByCustomer,
  submittedAt: row.submittedAt,
  reviewedBy: row.reviewedBy,
  reviewedAt: row.reviewedAt,
  reviewNote: row.reviewNote,
  createdAt: row.createdAt,
});

export interface SubmissionFields {
  readonly identifier: string | null;
  readonly fileName: string | null;
  readonly filePath: string | null;
  readonly fileMime: string | null;
  readonly fileSize: number | null;
  readonly submittedBy: string | null;
  readonly submittedByCustomer: boolean;
  readonly submittedAt: string;
}

@Injectable()
export class CustomerDocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(customerId: string): Promise<StoredDocument[]> {
    return (await this.prisma.db.customerDocument.findMany({ where: { customerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })).map(toDocument);
  }

  async findById(documentId: string): Promise<StoredDocument | undefined> {
    const row = await this.prisma.db.customerDocument.findUnique({ where: { id: documentId } });
    return row ? toDocument(row) : undefined;
  }

  /** The open (requested / submitted-not-yet-reviewed) document of a type, if any. */
  async findOpen(customerId: string, type: DocumentType, status: DocumentStatus): Promise<StoredDocument | undefined> {
    const row = await this.prisma.db.customerDocument.findFirst({ where: { customerId, type, status }, orderBy: { createdAt: 'desc' } });
    return row ? toDocument(row) : undefined;
  }

  async insertRequest(input: { customerId: string; type: DocumentType; note: string | null; requestedBy: string; at: string }): Promise<string> {
    const id = await this.prisma.nextId('DOC');
    await this.prisma.db.customerDocument.create({
      data: { id, customerId: input.customerId, type: input.type, status: 'REQUESTED', requestNote: input.note, requestedBy: input.requestedBy, requestedAt: input.at, createdAt: input.at },
    });
    return id;
  }

  async insertSubmission(customerId: string, type: DocumentType, fields: SubmissionFields): Promise<string> {
    const id = await this.prisma.nextId('DOC');
    await this.prisma.db.customerDocument.create({ data: { id, customerId, type, status: 'SUBMITTED', ...fields, createdAt: fields.submittedAt } });
    return id;
  }

  /** Fulfils a request with what the applicant provided — only while it is still REQUESTED (compare-and-set). */
  async fulfilRequest(documentId: string, fields: SubmissionFields): Promise<boolean> {
    const { count } = await this.prisma.db.customerDocument.updateMany({ where: { id: documentId, status: 'REQUESTED' }, data: { status: 'SUBMITTED', ...fields } });
    return count === 1;
  }

  /** Verifies or rejects — only while it is still SUBMITTED (compare-and-set). False when someone else reviewed it first. */
  async recordReview(documentId: string, decision: 'VERIFIED' | 'REJECTED', reviewedBy: string, at: string, note: string | null): Promise<boolean> {
    const { count } = await this.prisma.db.customerDocument.updateMany({
      where: { id: documentId, status: 'SUBMITTED' },
      data: { status: decision, reviewedBy, reviewedAt: at, reviewNote: note },
    });
    return count === 1;
  }
}
