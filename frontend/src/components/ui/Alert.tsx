import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type AlertTone = 'danger' | 'warning' | 'success' | 'info';

interface AlertProps {
  readonly tone?: AlertTone;
  readonly title?: string;
  readonly children: ReactNode;
}

const toneClasses: Readonly<Record<AlertTone, string>> = {
  danger: 'border-danger bg-danger-soft text-danger',
  warning: 'border-warning bg-warning-soft text-warning',
  success: 'border-success bg-success-soft text-success',
  info: 'border-brand bg-brand-soft text-brand',
};

export function Alert({ tone = 'info', title, children }: AlertProps) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-lg border px-4 py-3 text-sm', toneClasses[tone])}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}
