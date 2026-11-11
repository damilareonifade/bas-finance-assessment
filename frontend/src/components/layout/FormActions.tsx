import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface FormActionsProps {
  /** The primary submit button (and any secondary ones) — rendered left to right. */
  readonly children: ReactNode;
  /** Where Cancel goes; usually the list page. */
  readonly cancelTo?: string;
}

/** Footer row under a create / edit form: primary action first, then secondary, then Cancel. */
export function FormActions({ children, cancelTo }: FormActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      {cancelTo ? (
        <Link to={cancelTo} className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-line/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
          Cancel
        </Link>
      ) : null}
    </div>
  );
}
