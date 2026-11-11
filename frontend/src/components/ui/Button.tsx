import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly isLoading?: boolean;
}

const variantClasses: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-brand text-surface hover:bg-brand-strong',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
  danger: 'bg-danger text-surface hover:opacity-90',
};

const BASE_CLASSES = [
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
];

interface ButtonLinkProps extends LinkProps {
  readonly variant?: ButtonVariant;
  readonly children: ReactNode;
}

/** A navigation that looks like a button — page header actions such as "New customer". */
export function ButtonLink({ variant = 'primary', className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cn(BASE_CLASSES, variantClasses[variant], className)} {...rest}>
      {children}
    </Link>
  );
}

export function Button({ variant = 'primary', isLoading = false, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {isLoading ? 'Working…' : children}
    </button>
  );
}
