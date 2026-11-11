import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClipboardIcon, UploadIcon } from '@/components/ui/icons';
import { QueryError } from '@/components/ui/QueryState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import {
  documentFileUrl,
  useCustomerDocumentsQuery,
  useRequestDocumentMutation,
  useReviewDocumentMutation,
  useRevealDocumentMutation,
  useSubmitDocumentMutation,
} from '../api/documentsApi';
import type { CustomerDocument, DocumentStatus, DocumentType } from '../schemas/document';
import { RequestDocumentForm, SubmitDocumentForm } from './DocumentForms';

const STATUS: Readonly<Record<DocumentStatus, { label: string; tone: StatusTone }>> = {
  REQUESTED: { label: 'Requested', tone: 'progress' },
  SUBMITTED: { label: 'Waiting for review', tone: 'waiting' },
  VERIFIED: { label: 'Verified', tone: 'good' },
  REJECTED: { label: 'Rejected', tone: 'alert' },
};

interface DocumentsPanelProps {
  readonly customerId: string;
}

/** The applicant's KYC: what was requested, what they submitted, and who verified it. */
export function DocumentsPanel({ customerId }: DocumentsPanelProps) {
  const toast = useToast();
  const documentsQuery = useCustomerDocumentsQuery(customerId);
  const requestMutation = useRequestDocumentMutation(customerId);
  const submitMutation = useSubmitDocumentMutation(customerId);
  const reviewMutation = useReviewDocumentMutation(customerId);
  const revealMutation = useRevealDocumentMutation(customerId);
  const [openForm, setOpenForm] = useState<{ kind: 'request' } | { kind: 'submit'; type?: DocumentType } | null>(null);
  const [revealed, setRevealed] = useState<Readonly<Record<string, string>>>({});
  const [rejecting, setRejecting] = useState<{ documentId: string; note: string } | null>(null);

  const reveal = (documentId: string) =>
    revealMutation.mutate(documentId, { onSuccess: (document) => setRevealed((current) => ({ ...current, [documentId]: document.identifier ?? '' })) });

  const decide = (document: CustomerDocument, decision: 'VERIFIED' | 'REJECTED', note?: string) =>
    reviewMutation.mutate(
      { documentId: document.documentId, decision, note },
      {
        onSuccess: (updated) => {
          setRejecting(null);
          toast.success(decision === 'VERIFIED' ? `${updated.typeLabel} verified` : `${updated.typeLabel} rejected`);
        },
      },
    );

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Documents and verification</h2>
          <p className="text-xs text-ink-muted">BVN, NIN, ID and statements the applicant has been asked for or has provided.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setOpenForm({ kind: 'request' })}>
            <ClipboardIcon size={16} />
            Request a document
          </Button>
          <Button onClick={() => setOpenForm({ kind: 'submit' })}>
            <UploadIcon size={16} />
            Record a submission
          </Button>
        </div>
      </header>

      {openForm?.kind === 'request' ? (
        <div className="mb-5">
          <RequestDocumentForm
            isSubmitting={requestMutation.isPending}
            serverError={requestMutation.error}
            onCancel={() => setOpenForm(null)}
            onSubmit={(input) => requestMutation.mutate(input, { onSuccess: (document) => { setOpenForm(null); toast.success(`${document.typeLabel} requested`); } })}
          />
        </div>
      ) : null}
      {openForm?.kind === 'submit' ? (
        <div className="mb-5">
          <SubmitDocumentForm
            key={openForm.type ?? 'any'}
            defaultType={openForm.type}
            isSubmitting={submitMutation.isPending}
            serverError={submitMutation.error}
            onCancel={() => setOpenForm(null)}
            onSubmit={(input) => submitMutation.mutate(input, { onSuccess: (document) => { setOpenForm(null); toast.success(`${document.typeLabel} saved`, 'It is waiting for review.'); } })}
          />
        </div>
      ) : null}
      {reviewMutation.error && !rejecting ? <div className="mb-4"><Alert tone="danger">{reviewMutation.error.message}</Alert></div> : null}

      {documentsQuery.isPending ? <TableSkeleton columnCount={5} rowCount={3} /> : null}
      {documentsQuery.isError ? <QueryError error={documentsQuery.error} onRetry={() => void documentsQuery.refetch()} /> : null}
      {documentsQuery.isSuccess && documentsQuery.data.length === 0 ? (
        <EmptyState title="No documents yet" description="Request a BVN or NIN, or record what the applicant has already handed over." />
      ) : null}
      {documentsQuery.isSuccess && documentsQuery.data.length > 0 ? (
        <ul className="divide-y divide-line">
          {documentsQuery.data.map((document) => {
            const status = STATUS[document.status];
            const fullNumber = revealed[document.documentId];
            return (
              <li key={document.documentId} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    {document.typeLabel}
                    <StatusChip tone={status.tone}>{status.label}</StatusChip>
                  </p>
                  {document.identifierMasked ? (
                    <p className="mt-1 flex items-center gap-2 text-sm text-ink tabular-nums">
                      <span aria-label={fullNumber ? 'Number' : 'Number, masked'}>{fullNumber ?? document.identifierMasked}</span>
                      {fullNumber ? null : (
                        <button type="button" onClick={() => reveal(document.documentId)} className="text-xs font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                          Reveal
                        </button>
                      )}
                    </p>
                  ) : null}
                  {document.hasFile ? (
                    <a className="mt-1 inline-block text-sm font-medium text-brand hover:underline" href={documentFileUrl(customerId, document.documentId)} target="_blank" rel="noreferrer">
                      {document.fileName ?? 'View file'}
                    </a>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-muted">
                    {[
                      document.requestedAt ? `Requested ${document.requestedAt.slice(0, 10)}${document.requestedBy ? ` by ${document.requestedBy.fullName}` : ''}${document.requestNote ? ` — “${document.requestNote}”` : ''}` : null,
                      document.submittedAt ? `Submitted ${document.submittedAt.slice(0, 10)}${document.submittedByCustomer ? ' by the customer (portal)' : document.submittedBy ? ` by ${document.submittedBy.fullName}` : ''}` : null,
                      document.reviewedAt ? `${document.status === 'VERIFIED' ? 'Verified' : 'Rejected'} ${document.reviewedAt.slice(0, 10)}${document.reviewedBy ? ` by ${document.reviewedBy.fullName}` : ''}${document.reviewNote ? ` — “${document.reviewNote}”` : ''}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-start gap-2">
                  {document.status === 'REQUESTED' ? (
                    <Button variant="secondary" onClick={() => setOpenForm({ kind: 'submit', type: document.type })}>Record submission</Button>
                  ) : null}
                  {document.status === 'SUBMITTED' && rejecting?.documentId !== document.documentId ? (
                    <>
                      <Button isLoading={reviewMutation.isPending && reviewMutation.variables?.documentId === document.documentId} onClick={() => decide(document, 'VERIFIED')}>Verify</Button>
                      <Button variant="secondary" onClick={() => setRejecting({ documentId: document.documentId, note: '' })}>Reject</Button>
                    </>
                  ) : null}
                  {rejecting?.documentId === document.documentId ? (
                    <div className="flex w-full flex-col gap-2 sm:w-80">
                      <TextField
                        label="Why is it rejected?"
                        value={rejecting.note}
                        onChange={(event) => setRejecting({ documentId: document.documentId, note: event.target.value })}
                        errorMessage={reviewMutation.error?.message}
                      />
                      <div className="flex gap-2">
                        <Button variant="danger" isLoading={reviewMutation.isPending} onClick={() => decide(document, 'REJECTED', rejecting.note)}>Reject</Button>
                        <Button variant="secondary" onClick={() => { setRejecting(null); reviewMutation.reset(); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
