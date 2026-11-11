import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface DashboardLikeCardProps {
  readonly title: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Same card shape as the dashboard widgets: rounded-xl, hairline border, compact title row. */
export function DashboardLikeCard({ title, action, children, className }: DashboardLikeCardProps) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface p-5 shadow-sm', className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
