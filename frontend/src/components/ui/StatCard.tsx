import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type StatTone = 'neutral' | 'danger' | 'success';

interface StatCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
  readonly tone?: StatTone;
}

const toneClasses: Readonly<Record<StatTone, string>> = { neutral: 'text-ink', danger: 'text-danger', success: 'text-success' };

export function StatCard({ label, value, hint, tone = 'neutral' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={cn('mt-1 text-xl font-semibold tabular-nums', toneClasses[tone])}>{value}</dd>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
