import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { Clock } from '../common/clock/clock';
import { ConflictError, fieldError, NotFoundError } from '../common/errors/app-errors';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { CustomerNotificationsService } from '../customer-notifications/customer-notifications.service';
import { StoredCustomer } from '../customers/customers.repository';
import { CustomersService } from '../customers/customers.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PersonLookup, PersonRef, UsersService } from '../users/users.service';
import { CustomerDocumentsRepository, StoredDocument, SubmissionFields } from './customer-documents.repository';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  assertSubmissionComplete,
  DOCUMENT_LABELS,
  DocumentStatus,
  DocumentType,
  maskIdentifier,
  MAX_DOCUMENT_BYTES,
} from './document-rules';

/** The parts of an uploaded file we use (Multer's shape, without depending on its types). */
export interface UploadedDocumentFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

export interface DocumentView {
  documentId: string;
  customerId: string;
  type: DocumentType;
  typeLabel: string;
  status: DocumentStatus;
  /** Masked, e.g. "222••••••78". The full number only comes from GET …/documents/:id. */
  identifierMasked: string | null;
  hasFile: boolean;
  fileName: string | null;
  fileSize: number | null;
  requestNote: string | null;
  requestedBy: PersonRef | null;
  requestedAt: string | null;
  submittedBy: PersonRef | null;
  /** The customer uploaded it themselves through the portal. */
  submittedByCustomer: boolean;
  submittedAt: string | null;
  reviewedBy: PersonRef | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

/** What the customer sees in the portal: no staff names, never the full number. */
export interface PortalDocumentView {
  documentId: string;
  type: DocumentType;
  typeLabel: string;
  status: DocumentStatus;
  identifierMasked: string | null;
  hasFile: boolean;
  fileName: string | null;
  requestNote: string | null;
  requestedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** Shown when rejected, so the customer knows what to fix. */
  reviewNote: string | null;
}

/** Who handed the document in. */
type Submitter = { readonly kind: 'STAFF'; readonly actor: AuthenticatedUser } | { readonly kind: 'CUSTOMER' };

export interface VerificationSummary {
  requested: number;
  awaitingReview: number;
  verified: number;
  rejected: number;
}

@Injectable()
export class CustomerDocumentsService {
  private readonly uploadRoot: string;

  constructor(
    private readonly repository: CustomerDocumentsRepository,
    private readonly customers: CustomersService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly customerNotifications: CustomerNotificationsService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.uploadRoot = resolve(config.UPLOAD_DIR);
  }

  async list(actor: AuthenticatedUser, customerId: string): Promise<DocumentView[]> {
    await this.assertCustomerVisible(actor, customerId);
    return this.toViews(await this.repository.listForCustomer(customerId));
  }

  /** Single document including the full identifier — for the person verifying it. */
  async get(actor: AuthenticatedUser, customerId: string, documentId: string): Promise<DocumentView & { identifier: string | null }> {
    const document = await this.requireDocument(actor, customerId, documentId);
    return { ...(await this.toView(document)), identifier: document.identifier };
  }

  async summaryFor(customerId: string): Promise<VerificationSummary> {
    const documents = await this.repository.listForCustomer(customerId);
    const count = (status: DocumentStatus) => documents.filter((document) => document.status === status).length;
    return { requested: count('REQUESTED'), awaitingReview: count('SUBMITTED'), verified: count('VERIFIED'), rejected: count('REJECTED') };
  }

  /** Ask the applicant for a document. One open request per type (checked here; a trigger is the backstop for races). */
  async request(actor: AuthenticatedUser, customerId: string, type: DocumentType, note?: string): Promise<DocumentView> {
    const documentId = await this.prisma.transaction(async () => {
      await this.assertCustomerVisible(actor, customerId);
      if ((await this.repository.findOpen(customerId, type, 'REQUESTED')) || (await this.repository.findOpen(customerId, type, 'SUBMITTED'))) {
        throw new ConflictError('DOCUMENT_ALREADY_OPEN', `A ${DOCUMENT_LABELS[type]} is already requested or waiting for review`);
      }
      const requestedId = await this.repository.insertRequest({ customerId, type, note: note?.trim() || null, requestedBy: actor.userId, at: this.clock.nowIso() });
      await this.customerNotifications.notify(customerId, {
        kind: 'DOCUMENT_REQUESTED',
        title: `Please provide your ${DOCUMENT_LABELS[type]}`,
        body: note?.trim() || `BAS Finance needs your ${DOCUMENT_LABELS[type]} to continue.`,
        link: '/portal/documents',
      });
      return requestedId;
    });
    return this.toView(await this.mustFind(documentId));
  }

  /** Staff record what the applicant handed over. */
  async submit(
    actor: AuthenticatedUser,
    customerId: string,
    type: DocumentType,
    identifierInput: string | undefined,
    file: UploadedDocumentFile | undefined,
  ): Promise<DocumentView> {
    const customer = await this.assertCustomerVisible(actor, customerId);
    return this.toView(await this.recordSubmission(customer, type, identifierInput, file, { kind: 'STAFF', actor }));
  }

  /** The customer uploads it themselves (portal). Scoped to their own customer record by the caller. */
  async submitFromPortal(customerId: string, type: DocumentType, identifierInput: string | undefined, file: UploadedDocumentFile | undefined): Promise<PortalDocumentView> {
    const customer = await this.customers.getStored(customerId);
    return this.toPortalView(await this.recordSubmission(customer, type, identifierInput, file, { kind: 'CUSTOMER' }));
  }

  async listForPortal(customerId: string): Promise<PortalDocumentView[]> {
    return (await this.repository.listForCustomer(customerId)).map((document) => this.toPortalView(document));
  }

  /**
   * Fulfils an open request of the same type, otherwise starts a new record; staff are notified in the same transaction.
   * The file is written before the transaction (no disk I/O while holding the write lock) and removed again if the
   * transaction does not commit, so a rolled-back submission never leaves an orphaned upload behind.
   */
  private async recordSubmission(
    customer: StoredCustomer,
    type: DocumentType,
    identifierInput: string | undefined,
    file: UploadedDocumentFile | undefined,
    submitter: Submitter,
  ): Promise<StoredDocument> {
    const customerId = customer.customerId;
    const identifier = identifierInput?.replace(/\s+/g, '') || undefined;
    if (file) this.assertFileAllowed(file);
    assertSubmissionComplete(type, identifier, file !== undefined);
    if (await this.repository.findOpen(customerId, type, 'SUBMITTED')) throw this.awaitingReview(type);

    const storedPath = file ? this.storeFile(customerId, file) : null;
    try {
      const documentId = await this.prisma.transaction(async () => {
        if (await this.repository.findOpen(customerId, type, 'SUBMITTED')) throw this.awaitingReview(type);
        const fields: SubmissionFields = {
          identifier: identifier ?? null,
          fileName: file ? file.originalname.slice(0, 200) : null,
          filePath: storedPath,
          fileMime: file?.mimetype ?? null,
          fileSize: file?.size ?? null,
          submittedBy: submitter.kind === 'STAFF' ? submitter.actor.userId : null,
          submittedByCustomer: submitter.kind === 'CUSTOMER',
          submittedAt: this.clock.nowIso(),
        };
        const openRequest = await this.repository.findOpen(customerId, type, 'REQUESTED');
        const fulfilled = openRequest ? await this.repository.fulfilRequest(openRequest.documentId, fields) : false;
        const savedId = fulfilled && openRequest ? openRequest.documentId : await this.repository.insertSubmission(customerId, type, fields);

        const from = submitter.kind === 'CUSTOMER' ? `${customer.fullName} uploaded` : `${customer.fullName} submitted`;
        await this.notifications.notify(
          [customer.assignedOfficerId, ...(await this.notifications.activeAdminIds())],
          { kind: 'DOCUMENT_SUBMITTED', title: `${DOCUMENT_LABELS[type]} to verify`, body: `${from} a ${DOCUMENT_LABELS[type]}.`, link: `/customers/${customerId}?tab=documents` },
          submitter.kind === 'STAFF' ? submitter.actor.userId : undefined,
        );
        return savedId;
      });
      return await this.mustFind(documentId);
    } catch (error) {
      if (storedPath) rmSync(join(this.uploadRoot, storedPath), { force: true });
      throw error;
    }
  }

  /** Verify or reject. Compare-and-set on SUBMITTED, so two reviewers at once cannot both decide. */
  async review(actor: AuthenticatedUser, customerId: string, documentId: string, decision: 'VERIFIED' | 'REJECTED', note?: string): Promise<DocumentView> {
    if (decision === 'REJECTED' && !note?.trim()) throw fieldError('note', 'Say why it was rejected so the applicant can fix it');
    await this.prisma.transaction(async () => {
      const document = await this.requireDocument(actor, customerId, documentId);
      if (document.status !== 'SUBMITTED' || !(await this.repository.recordReview(documentId, decision, actor.userId, this.clock.nowIso(), note?.trim() || null))) {
        throw new ConflictError('DOCUMENT_NOT_AWAITING_REVIEW', 'Only a submitted document can be verified or rejected');
      }
      await this.customerNotifications.notify(customerId, {
        kind: 'DOCUMENT_REVIEWED',
        title: decision === 'VERIFIED' ? `Your ${DOCUMENT_LABELS[document.type]} was verified` : `Your ${DOCUMENT_LABELS[document.type]} needs another look`,
        body: decision === 'VERIFIED' ? 'Thank you — nothing more is needed for this document.' : `${note?.trim() ?? ''} Please upload it again.`.trim(),
        link: '/portal/documents',
      });
    });
    return this.toView(await this.mustFind(documentId));
  }

  /** Absolute path of a document's file, after the access check. Never leaves the upload folder. */
  async filePathFor(actor: AuthenticatedUser, customerId: string, documentId: string): Promise<{ absolutePath: string; fileName: string; mime: string }> {
    const document = await this.requireDocument(actor, customerId, documentId);
    if (!document.filePath || !document.fileMime) throw new NotFoundError('DOCUMENT_FILE_NOT_FOUND', 'This document has no file');
    const absolutePath = resolve(this.uploadRoot, document.filePath);
    const fromRoot = relative(this.uploadRoot, absolutePath);
    if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) throw new NotFoundError('DOCUMENT_FILE_NOT_FOUND', 'This document has no file');
    return { absolutePath, fileName: document.fileName ?? `${document.documentId}`, mime: document.fileMime };
  }

  private awaitingReview(type: DocumentType): ConflictError {
    return new ConflictError('DOCUMENT_AWAITING_REVIEW', `A ${DOCUMENT_LABELS[type]} is already waiting for review — verify or reject it first`);
  }

  private assertFileAllowed(file: UploadedDocumentFile): void {
    if (!(file.mimetype in ALLOWED_DOCUMENT_MIME_TYPES)) throw fieldError('file', 'Upload a PDF, PNG or JPEG file');
    if (file.size > MAX_DOCUMENT_BYTES) throw fieldError('file', 'Files must be 5 MB or smaller');
  }

  /** Random file name (never the user's), in a per-customer folder. Returns the path relative to the upload root. */
  private storeFile(customerId: string, file: UploadedDocumentFile): string {
    const folder = join(this.uploadRoot, customerId);
    mkdirSync(folder, { recursive: true });
    const relativePath = join(customerId, `${randomUUID()}${ALLOWED_DOCUMENT_MIME_TYPES[file.mimetype] ?? ''}`);
    writeFileSync(join(this.uploadRoot, relativePath), file.buffer);
    return relativePath;
  }

  private async assertCustomerVisible(actor: AuthenticatedUser, customerId: string) {
    const customer = await this.customers.getStored(customerId);
    await this.customers.assertCanView(actor, customerId);
    return customer;
  }

  private async requireDocument(actor: AuthenticatedUser, customerId: string, documentId: string): Promise<StoredDocument> {
    await this.assertCustomerVisible(actor, customerId);
    const document = await this.repository.findById(documentId);
    if (!document || document.customerId !== customerId) throw new NotFoundError('DOCUMENT_NOT_FOUND', `Document ${documentId} does not exist`);
    return document;
  }

  private async mustFind(documentId: string): Promise<StoredDocument> {
    const document = await this.repository.findById(documentId);
    if (!document) throw new NotFoundError('DOCUMENT_NOT_FOUND', `Document ${documentId} does not exist`);
    return document;
  }

  private toPortalView(document: StoredDocument): PortalDocumentView {
    return {
      documentId: document.documentId,
      type: document.type,
      typeLabel: DOCUMENT_LABELS[document.type],
      status: document.status,
      identifierMasked: maskIdentifier(document.identifier),
      hasFile: document.filePath !== null,
      fileName: document.fileName,
      requestNote: document.requestNote,
      requestedAt: document.requestedAt,
      submittedAt: document.submittedAt,
      reviewedAt: document.reviewedAt,
      reviewNote: document.status === 'REJECTED' ? document.reviewNote : null,
    };
  }

  private async toView(document: StoredDocument): Promise<DocumentView> {
    return (await this.toViews([document]))[0] as DocumentView;
  }

  private async toViews(documents: readonly StoredDocument[]): Promise<DocumentView[]> {
    const person: PersonLookup = await this.users.people(documents.flatMap((document) => [document.requestedBy, document.submittedBy, document.reviewedBy]));
    return documents.map((document) => ({
      documentId: document.documentId,
      customerId: document.customerId,
      type: document.type,
      typeLabel: DOCUMENT_LABELS[document.type],
      status: document.status,
      identifierMasked: maskIdentifier(document.identifier),
      hasFile: document.filePath !== null,
      fileName: document.fileName,
      fileSize: document.fileSize,
      requestNote: document.requestNote,
      requestedBy: person(document.requestedBy),
      requestedAt: document.requestedAt,
      submittedBy: person(document.submittedBy),
      submittedByCustomer: document.submittedByCustomer,
      submittedAt: document.submittedAt,
      reviewedBy: person(document.reviewedBy),
      reviewedAt: document.reviewedAt,
      reviewNote: document.reviewNote,
    }));
  }
}
