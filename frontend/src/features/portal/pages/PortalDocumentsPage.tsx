import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { SubmitDocumentForm } from '@/features/customer-documents/components/DocumentForms';
import type { DocumentStatus, DocumentType } from '@/features/customer-documents/schemas/document';
import { usePortalDocumentsQuery, usePortalSubmitDocumentMutation } from '../api/portalApi';
import { formatPortalDate } from '../components/dates';
import type { PortalDocument } from '../schemas/portal';

const STATUS: Readonly<Record<DocumentStatus, { label: string; tone: StatusTone }>> = {
  REQUESTED: { label: 'We need this', tone: 'waiting' },
  SUBMITTED: { label: 'Being checked', tone: 'progress' },
  VERIFIED: { label: 'Verified', tone: 'good' },
  REJECTED: { label: 'Please send again', tone: 'alert' },
};

export default function PortalDocumentsPage() {
  const toast = useToast();
  const documentsQuery = usePortalDocumentsQuery();
  const submitMutation = usePortalSubmitDocumentMutation();
  const [uploadingType, setUploadingType] = useState<DocumentType | 'NEW' | null>(null);

  const documents = documentsQuery.data ?? [];
  // A rejected document only needs action if nothing newer of the same type is open or verified.
  const toDo = documents.filter(
    (document) =>
      document.status === 'REQUESTED' ||
      (document.status === 'REJECTED' && !documents.some((other) => other.type === document.type && other.documentId !== document.documentId && other.status !== 'REJECTED')),
  );

  const handleSubmit = (input: { type: DocumentType; identifier: string; file: File | null }) =>
    submitMutation.mutate(input, {
      onSuccess: (saved: PortalDocument) => {
        toast.success(`${saved.typeLabel} sent — we will check it shortly`);
        setUploadingType(null);
        submitMutation.reset();
      },
    });

  const form = (defaultType: DocumentType) => (
    <SubmitDocumentForm
      key={defaultType}
      defaultType={defaultType}
      submitLabel="Send document"
      isSubmitting={submitMutation.isPending}
      serverError={submitMutation.error}
      onSubmit={handleSubmit}
      onCancel={() => {
        setUploadingType(null);
        submitMutation.reset();
      }}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Documents"
        breadcrumbs={[{ label: 'My loans', to: '/portal' }, { label: 'Documents' }]}
        description="Send us what we ask for to verify your identity and your application. Numbers are shown partly hidden."
        actions={uploadingType === null ? <Button onClick={() => setUploadingType('NEW')}>Send a document</Button> : null}
      />
      {uploadingType === 'NEW' ? form('BVN') : null}
      {documentsQuery.isPending ? <Skeleton className="h-40 w-full rounded-2xl" /> : null}
      {documentsQuery.isError ? <QueryError error={documentsQuery.error} onRetry={() => void documentsQuery.refetch()} /> : null}

      {documentsQuery.isSuccess ? (
        <>
          <Card>
            <CardHeader title="What we need from you" />
            {toDo.length === 0 ? <p className="text-sm text-ink-muted">Nothing right now — thank you.</p> : null}
            <ul className="flex flex-col gap-4">
              {toDo.map((document) => (
                <li key={document.documentId} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{document.typeLabel}</p>
                      <p className="text-sm text-ink-muted">{document.status === 'REJECTED' ? `Why: ${document.reviewNote ?? 'it could not be verified'}` : (document.requestNote ?? 'Requested by BAS Finance')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusChip tone={STATUS[document.status].tone}>{STATUS[document.status].label}</StatusChip>
                      {uploadingType !== document.type ? (
                        <Button variant="secondary" onClick={() => setUploadingType(document.type)}>
                          Upload
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {uploadingType === document.type ? form(document.type) : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Everything you have sent" />
            {documents.filter((document) => document.status !== 'REQUESTED').length === 0 ? (
              <EmptyState title="Nothing sent yet" description="Documents you send appear here with where they are in checking." />
            ) : (
              <ul className="divide-y divide-line">
                {documents
                  .filter((document) => document.status !== 'REQUESTED')
                  .map((document) => (
                    <li key={document.documentId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {document.typeLabel}
                          {document.identifierMasked ? <span className="ml-2 font-normal text-ink-muted tabular-nums">{document.identifierMasked}</span> : null}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {document.submittedAt ? `Sent ${formatPortalDate(document.submittedAt)}` : ''}
                          {document.fileName ? ` · ${document.fileName}` : ''}
                        </p>
                      </div>
                      <StatusChip tone={STATUS[document.status].tone}>{STATUS[document.status].label}</StatusChip>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
