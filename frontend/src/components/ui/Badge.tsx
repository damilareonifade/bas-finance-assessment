import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning';

interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly children: ReactNode;
}

const toneClasses: Readonly<Record<BadgeTone, string>> = {
  neutral: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
};

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', toneClasses[tone])}>{children}</span>;
}
