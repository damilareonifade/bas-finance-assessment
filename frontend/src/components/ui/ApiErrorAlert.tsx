import { describeApiError } from '@/lib/api';
import { Alert } from './Alert';

interface ApiErrorAlertProps {
  readonly title: string;
  readonly error: unknown;
  /** Server field name → the label on screen, so "principalKobo must …" reads "Principal must …". */
  readonly fieldLabels?: Readonly<Record<string, string>>;
}

/** A failed request in plain words: the server's actual reasons, never just "Validation failed". */
export function ApiErrorAlert({ title, error, fieldLabels }: ApiErrorAlertProps) {
  const lines = describeApiError(error, fieldLabels);
  return (
    <Alert tone="danger" title={title}>
      {lines.length === 1 ? (
        <p>{lines[0]}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
