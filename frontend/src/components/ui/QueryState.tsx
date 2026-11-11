import type { ReactNode } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';

interface QueryErrorProps {
  readonly error: Error;
  readonly onRetry?: () => void;
}

export function QueryError({ error, onRetry }: QueryErrorProps) {
  return (
    <Alert tone="danger" title="Could not load this data">
      <p>{error.message}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Alert>
  );
}

interface FieldErrorSummaryProps {
  readonly messages: readonly string[];
  readonly children?: ReactNode;
}

export function FieldErrorSummary({ messages, children }: FieldErrorSummaryProps) {
  if (messages.length === 0 && !children) return null;
  return (
    <Alert tone="danger" title="Please fix the following">
      <ul className="list-disc pl-5">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      {children}
    </Alert>
  );
}
