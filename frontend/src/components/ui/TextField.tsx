import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly hint?: string;
  readonly errorMessage?: string;
  /** Shows the red required marker next to the label (visual only; use the native `required` for semantics). */
  readonly isRequired?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, errorMessage, isRequired, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, errorMessage ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className={cn('text-sm font-medium text-ink', isRequired && "after:ml-0.5 after:text-danger after:content-['*']")}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'rounded-lg border bg-surface px-3.5 py-2.5 text-sm tabular-nums shadow-xs',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
          errorMessage ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      />
      {hint && !errorMessage ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {errorMessage ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
});
