import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly label: string;
  readonly options: readonly SelectOption[];
  /** Text of the empty choice, e.g. "No customer". Omit to require a choice. */
  readonly placeholder?: string;
  readonly hint?: string;
  readonly errorMessage?: string;
  /** Keep the label for screen readers but don't show it (compact toolbar controls). */
  readonly hideLabel?: boolean;
  readonly isRequired?: boolean;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, options, placeholder, hint, errorMessage, hideLabel, isRequired, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const describedBy = [hint ? `${selectId}-hint` : null, errorMessage ? `${selectId}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className={hideLabel ? 'sr-only' : cn('text-sm font-medium text-ink', isRequired && "after:ml-0.5 after:text-danger after:content-['*']")}
      >
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'rounded-lg border bg-surface px-3.5 py-2.5 text-sm shadow-xs',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
          errorMessage ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !errorMessage ? (
        <p id={`${selectId}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {errorMessage ? (
        <p id={`${selectId}-error`} role="alert" className="text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
});
