import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  readonly label: string;
  readonly hint?: string;
  readonly errorMessage?: string;
  readonly isRequired?: boolean;
  /** Rendered on the label row, right-aligned (e.g. "Forgot password?"). */
  readonly labelAction?: ReactNode;
}

function EyeIcon({ isCrossedOut }: { readonly isCrossedOut: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {isCrossedOut ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

/** Password input with a show/hide toggle. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, hint, errorMessage, isRequired, labelAction, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);
  const describedBy = [hint ? `${inputId}-hint` : null, errorMessage ? `${inputId}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className={cn('text-sm font-medium text-ink', isRequired && "after:ml-0.5 after:text-danger after:content-['*']")}>
          {label}
        </label>
        {labelAction}
      </div>
      <div className={cn('flex overflow-hidden rounded-lg border bg-surface shadow-xs focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand', errorMessage ? 'border-danger' : 'border-line')}>
        <input
          ref={ref}
          id={inputId}
          type={isVisible ? 'text' : 'password'}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={describedBy}
          className={cn('min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm outline-none', className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
          className="border-l border-line px-3 text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
        >
          <EyeIcon isCrossedOut={isVisible} />
        </button>
      </div>
      {hint && !errorMessage ? (
        <p id={`${inputId}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {errorMessage ? (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
});
