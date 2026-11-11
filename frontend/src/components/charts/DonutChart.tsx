import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type DonutColor = 'brand' | 'cyan' | 'amber' | 'green' | 'teal' | 'navy';

export interface DonutSegment {
  readonly label: string;
  readonly value: number;
  readonly color: DonutColor;
}

interface DonutChartProps {
  readonly segments: readonly DonutSegment[];
  /** Big text in the hole, e.g. the total. */
  readonly centerValue: ReactNode;
  readonly centerLabel: string;
  readonly formatValue: (value: number) => string;
  readonly caption: string;
}

const STROKE: Readonly<Record<DonutColor, string>> = {
  brand: 'stroke-brand',
  cyan: 'stroke-chart-cyan',
  amber: 'stroke-chart-amber',
  green: 'stroke-chart-green',
  teal: 'stroke-teal',
  navy: 'stroke-brand-strong',
};
const SWATCH: Readonly<Record<DonutColor, string>> = {
  brand: 'bg-brand',
  cyan: 'bg-chart-cyan',
  amber: 'bg-chart-amber',
  green: 'bg-chart-green',
  teal: 'bg-teal',
  navy: 'bg-brand-strong',
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Share of a whole, one decimal: display only. */
export function sharePercent(value: number, total: number): number {
  return total <= 0 ? 0 : Math.round((value * 1000) / total) / 10;
}

/** Thick ring with the total in the centre and a legend of label · amount · share. */
export function DonutChart({ segments, centerValue, centerLabel, formatValue, caption }: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;

  return (
    <figure className="m-0 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative size-52 shrink-0">
        <svg viewBox="0 0 100 100" role="img" aria-label={caption} className="size-full -rotate-90">
          <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="13" className="stroke-line" />
          {total > 0
            ? segments.map((segment) => {
                const length = (segment.value / total) * CIRCUMFERENCE;
                const dash = `${Math.max(0, length - 0.6)} ${CIRCUMFERENCE}`;
                const circle = <circle key={segment.label} cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="13" strokeDasharray={dash} strokeDashoffset={-offset} className={STROKE[segment.color]} />;
                offset += length;
                return circle;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold tracking-tight text-brand-strong tabular-nums">{centerValue}</span>
          <span className="text-xs text-ink-muted">{centerLabel}</span>
        </div>
      </div>
      <figcaption className="w-full">
        <ul className="flex flex-col gap-3">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', SWATCH[segment.color])} />
                <span className="truncate text-ink">{segment.label}</span>
              </span>
              <span className="text-right tabular-nums">
                <span className="text-ink-muted">{formatValue(segment.value)}</span>
                <span className="ml-2 font-medium text-ink">{sharePercent(segment.value, total)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
