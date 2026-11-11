import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function Card({ children, className }: CardProps) {
  return <section className={cn('rounded-xl border border-line bg-surface p-6 shadow-sm', className)}>{children}</section>;
}

interface CardHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
