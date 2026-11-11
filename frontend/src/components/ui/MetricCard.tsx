import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { TrendDownIcon, TrendUpIcon } from './icons';
import { Sparkline } from './Sparkline';

export interface MetricTrend {
  /** Percent change; null when there was nothing to compare with. */
  readonly changePercent: number | null;
  /** What it was compared with, e.g. "vs same days last month". */
  readonly comparedWith: string;
  /** Is an increase good news? (More customers: yes. More overdue: no.) */
  readonly increaseIsGood: boolean;
  /** Shown instead of a percentage when there is nothing to compare with. */
  readonly emptyText?: string;
}

type CaptionTone = 'neutral' | 'danger' | 'success' | 'brand';

interface MetricCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly trend?: MetricTrend;
  readonly caption?: ReactNode;
  readonly captionTone?: CaptionTone;
  readonly captionIcon?: ReactNode;
  /** Optional; the default card format has none. */
  readonly sparkline?: readonly number[];
  readonly valueTone?: 'neutral' | 'danger' | 'success';
}

const CAPTION_CLASSES: Readonly<Record<CaptionTone, string>> = {
  neutral: 'text-ink-muted',
  danger: 'text-danger',
  success: 'text-success',
  brand: 'text-brand',
};

const VALUE_CLASSES = { neutral: 'text-brand-strong', danger: 'text-danger', success: 'text-success' } as const;
const PILL_CLASSES = { positive: 'bg-success-soft text-success', negative: 'bg-danger-soft text-danger', neutral: 'bg-canvas text-ink-muted' } as const;

export function trendTone(trend: MetricTrend): 'positive' | 'negative' | 'neutral' {
  if (trend.changePercent === null || trend.changePercent === 0) return 'neutral';
  return trend.changePercent > 0 === trend.increaseIsGood ? 'positive' : 'negative';
}

/** "↑ 12.5%" pill. The full sentence ("+12.5% vs same days last month") is the tooltip and the screen-reader text. */
function TrendPill({ trend }: { readonly trend: MetricTrend }) {
  if (trend.changePercent === null) return null;
  const isUp = trend.changePercent > 0;
  const signed = `${isUp ? '+' : trend.changePercent < 0 ? '−' : ''}${Math.abs(trend.changePercent)}%`;
  const sentence = `${signed} ${trend.comparedWith}`;
  return (
    <span title={sentence} className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums', PILL_CLASSES[trendTone(trend)])}>
      {trend.changePercent === 0 ? null : isUp ? <TrendUpIcon size={12} /> : <TrendDownIcon size={12} />}
      <span aria-hidden="true">{Math.abs(trend.changePercent)}%</span>
      <span className="sr-only">{sentence}</span>
    </span>
  );
}

/** KPI card: small uppercase label with a change pill on the right, the figure underneath, one optional line of context. */
export function MetricCard({ label, value, trend, caption, captionTone = 'neutral', captionIcon, sparkline, valueTone = 'neutral' }: MetricCardProps) {
  const emptyComparison = trend && trend.changePercent === null ? (trend.emptyText ?? 'Nothing to compare with yet') : null;
  return (
    <div className="@container flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</dt>
          {trend ? <TrendPill trend={trend} /> : null}
        </div>
        <dd className={cn('text-2xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] @min-[16rem]:text-3xl', VALUE_CLASSES[valueTone])}>{value}</dd>
        {emptyComparison ? <p className="text-xs text-ink-muted">{emptyComparison}</p> : null}
        {caption ? (
          <p className={cn('flex items-center gap-1.5 text-xs', CAPTION_CLASSES[captionTone])}>
            {captionIcon}
            <span>{caption}</span>
          </p>
        ) : null}
      </div>
      {sparkline && trend ? <Sparkline values={sparkline} tone={trendTone(trend)} /> : null}
    </div>
  );
}
