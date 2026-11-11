import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface DashboardCardProps {
  readonly title: string;
  /** Right side of the header: "View all", a period select, a legend. */
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** The one card shape on the dashboard: white, rounded-xl, hairline border, compact title row. */
export function DashboardCard({ title, action, children, className }: DashboardCardProps) {
  return (
    <section className={cn('flex flex-col rounded-xl border border-line bg-surface p-5 shadow-sm', className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {action}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}
