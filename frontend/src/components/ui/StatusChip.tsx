import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Fixed meanings across the app: waiting = orange · good/done = green · in progress = blue ·
 * disbursed/settled = teal · needs action = red · neutral = grey.
 */
export type StatusTone = 'waiting' | 'good' | 'progress' | 'complete' | 'alert' | 'neutral';

const TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  waiting: 'border-orange/25 bg-orange-soft text-orange',
  good: 'border-success/25 bg-success-soft text-success',
  progress: 'border-info/25 bg-info-soft text-info',
  complete: 'border-teal/25 bg-teal-soft text-teal',
  alert: 'border-danger/25 bg-danger-soft text-danger',
  neutral: 'border-line bg-canvas text-ink-muted',
};

interface StatusChipProps {
  readonly tone: StatusTone;
  readonly children: ReactNode;
}

export function StatusChip({ tone, children }: StatusChipProps) {
  return <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONE_CLASSES[tone])}>{children}</span>;
}
