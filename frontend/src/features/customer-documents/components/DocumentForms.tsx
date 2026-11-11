import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { mapServerFieldErrors } from '@/lib/api';
import { cn } from '@/lib/utils/cn';
import { checkSubmission, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, type DocumentType } from '../schemas/document';

const TYPE_OPTIONS = DOCUMENT_TYPES.map((type) => ({ value: type, label: DOCUMENT_TYPE_LABELS[type] }));
const NEEDS_NUMBER: readonly DocumentType[] = ['BVN', 'NIN', 'PASSPORT', 'DRIVERS_LICENCE', 'OTHER'];

interface RequestDocumentFormProps {
  readonly isSubmitting: boolean;
  readonly serverError: Error | null;
  readonly onSubmit: (input: { type: DocumentType; note?: string }) => void;
  readonly onCancel: () => void;
}

export function RequestDocumentForm({ isSubmitting, serverError, onSubmit, onCancel }: RequestDocumentFormProps) {
  const [type, setType] = useState<DocumentType>('BVN');
  const [note, setNote] = useState('');
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ type, note: note.trim() || undefined });
  };
  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-4 rounded-xl border border-line bg-canvas p-5 sm:grid-cols-[14rem_1fr]">
      <SelectField label="Document" options={TYPE_OPTIONS} value={type} onChange={(event) => setType(event.target.value as DocumentType)} />
      <TextField label="Note to the applicant" hint="Optional — e.g. 'Statement for the last 6 months'" value={note} onChange={(event) => setNote(event.target.value)} />
      {serverError ? <div className="sm:col-span-2"><Alert tone="danger">{serverError.message}</Alert></div> : null}
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" isLoading={isSubmitting}>Request document</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

interface SubmitDocumentFormProps {
  readonly defaultType?: DocumentType;
  /** Defaults to the staff wording; the customer portal says "Send document". */
  readonly submitLabel?: string;
  readonly isSubmitting: boolean;
  readonly serverError: Error | null;
  readonly onSubmit: (input: { type: DocumentType; identifier: string; file: File | null }) => void;
  readonly onCancel: () => void;
}

/** Record what the applicant handed over: the number (BVN, NIN, passport…) and/or a scan. */
export function SubmitDocumentForm({ defaultType = 'BVN', submitLabel = 'Save submission', isSubmitting, serverError, onSubmit, onCancel }: SubmitDocumentFormProps) {
  const [type, setType] = useState<DocumentType>(defaultType);
  const [identifier, setIdentifier] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localErrors, setLocalErrors] = useState<Partial<Record<'identifier' | 'file', string>>>({});
  const serverErrors = serverError ? Object.fromEntries(mapServerFieldErrors(serverError, { identifier: 'identifier', file: 'file', type: 'type' }).mapped.map(({ field, message }) => [field, message])) : {};
  const errorFor = (field: 'identifier' | 'file') => localErrors[field] ?? (serverErrors as Record<string, string | undefined>)[field];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const problems = checkSubmission(type, identifier, file);
    setLocalErrors(problems);
    if (Object.keys(problems).length === 0) onSubmit({ type, identifier, file });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-4 rounded-xl border border-line bg-canvas p-5 sm:grid-cols-3">
      <SelectField label="Document" options={TYPE_OPTIONS} value={type} onChange={(event) => { setType(event.target.value as DocumentType); setLocalErrors({}); }} />
      {NEEDS_NUMBER.includes(type) ? (
        <TextField
          label={type === 'BVN' || type === 'NIN' ? `${type} (11 digits)` : 'Document number'}
          inputMode={type === 'BVN' || type === 'NIN' ? 'numeric' : 'text'}
          autoComplete="off"
          isRequired={type === 'BVN' || type === 'NIN'}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          errorMessage={errorFor('identifier')}
        />
      ) : (
        <div />
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="document-file" className={cn('text-sm font-medium text-ink', (type === 'BANK_STATEMENT' || type === 'UTILITY_BILL') && "after:ml-0.5 after:text-danger after:content-['*']")}>
          File
        </label>
        <input
          id="document-file"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          aria-invalid={errorFor('file') ? true : undefined}
          aria-describedby="document-file-help"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand"
        />
        <p id="document-file-help" className={cn('text-xs', errorFor('file') ? 'text-danger' : 'text-ink-muted')} role={errorFor('file') ? 'alert' : undefined}>
          {errorFor('file') ?? 'PDF, PNG or JPEG, up to 5 MB'}
        </p>
      </div>
      {serverError && Object.keys(serverErrors).length === 0 ? <div className="sm:col-span-3"><Alert tone="danger">{serverError.message}</Alert></div> : null}
      <div className="flex gap-3 sm:col-span-3">
        <Button type="submit" isLoading={isSubmitting}>{submitLabel}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
