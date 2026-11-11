import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { cn } from '@/lib/utils/cn';

export type ChartColor = 'blue' | 'green' | 'amber';

export interface ChartSeries {
  readonly label: string;
  readonly values: readonly number[];
  readonly color: ChartColor;
}

interface AreaChartProps {
  /** One label per point, e.g. "2026-01-15". */
  readonly days: readonly string[];
  readonly series: readonly ChartSeries[];
  /** Compact text for axis ticks. */
  readonly formatAxis: (value: number) => string;
  /** Full text for the tooltip and the accessible table. */
  readonly formatValue: (value: number) => string;
  readonly caption: string;
}

const STROKE: Readonly<Record<ChartColor, string>> = { blue: 'stroke-chart-blue', green: 'stroke-chart-green', amber: 'stroke-chart-amber' };
const FILL: Readonly<Record<ChartColor, string>> = { blue: 'fill-chart-blue', green: 'fill-chart-green', amber: 'fill-chart-amber' };
const SWATCH: Readonly<Record<ChartColor, string>> = { blue: 'border-chart-blue bg-chart-blue/15', green: 'border-chart-green bg-chart-green/15', amber: 'border-chart-amber bg-chart-amber/15' };

/** Used until the container is measured (and in environments without ResizeObserver). */
const DEFAULT_WIDTH = 900;
const MIN_WIDTH = 320;
const HEIGHT = 280;
const MARGIN = { top: 16, right: 20, bottom: 34, left: 78 };
const TICK_COUNT = 5;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Rounds a maximum up to 1, 2, 2.5, 5 or 10 × a power of ten so axis ticks land on friendly numbers. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const step = [1, 2, 2.5, 5, 10].find((candidate) => fraction <= candidate) ?? 10;
  return step * magnitude;
}

/** "2026-01-05" → "Jan 05" */
export function formatDayLabel(isoDate: string): string {
  const month = MONTH_NAMES[Number(isoDate.slice(5, 7)) - 1] ?? '';
  return `${month} ${isoDate.slice(8, 10)}`;
}

/** Hand-drawn SVG area chart: gridlines, rounded axis ticks, hover guide with a tooltip, and a screen-reader table. */
export function AreaChart({ days, series, formatAxis, formatValue, caption }: AreaChartProps) {
  const titleId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // Draw at the container's real width so axis text stays 11px whether the chart is full-width or in a half-width card.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(MIN_WIDTH, Math.round(entry.contentRect.width)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const maxValue = Math.max(0, ...series.flatMap((entry) => entry.values));
    const top = niceCeiling(maxValue);
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const xAt = (index: number) => MARGIN.left + (days.length <= 1 ? 0 : (index / (days.length - 1)) * plotWidth);
    const yAt = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;
    const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, index) => (top / TICK_COUNT) * index);
    return { top, xAt, yAt, ticks, baseline: MARGIN.top + plotHeight, plotWidth };
  }, [days.length, series, width]);

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const xInViewBox = ((event.clientX - bounds.left) / bounds.width) * width;
    const ratio = (xInViewBox - MARGIN.left) / geometry.plotWidth;
    setHoverIndex(Math.min(days.length - 1, Math.max(0, Math.round(ratio * (days.length - 1)))));
  };

  const maxLabels = Math.max(3, Math.floor(width / 110));
  const labelEvery = Math.max(1, Math.ceil(days.length / maxLabels));
  const hovered = hoverIndex === null ? null : { index: hoverIndex, x: geometry.xAt(hoverIndex) };

  return (
    <figure className="m-0">
      <div ref={containerRef} className="relative">
        <svg
          role="img"
          aria-labelledby={titleId}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block h-auto w-full touch-pan-y"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <title id={titleId}>{caption}</title>
          {geometry.ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={geometry.yAt(tick)} y2={geometry.yAt(tick)} className="stroke-line" strokeWidth="1" />
              <text x={MARGIN.left - 10} y={geometry.yAt(tick)} textAnchor="end" dominantBaseline="middle" className="fill-ink-muted text-[11px] tabular-nums">
                {formatAxis(tick)}
              </text>
            </g>
          ))}
          {days.map((day, index) =>
            index % labelEvery === 0 ? (
              <text key={day} x={geometry.xAt(index)} y={HEIGHT - 10} textAnchor="middle" className="fill-ink-muted text-[11px]">
                {formatDayLabel(day)}
              </text>
            ) : null,
          )}
          {series.map((entry) => {
            const line = entry.values.map((value, index) => `${index === 0 ? 'M' : 'L'}${geometry.xAt(index).toFixed(1)},${geometry.yAt(value).toFixed(1)}`).join(' ');
            const lastIndex = entry.values.length - 1;
            return (
              <g key={entry.label}>
                <path d={`${line} L${geometry.xAt(lastIndex).toFixed(1)},${geometry.baseline} L${geometry.xAt(0).toFixed(1)},${geometry.baseline} Z`} className={cn(FILL[entry.color], 'stroke-0')} fillOpacity="0.12" />
                <path d={line} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className={STROKE[entry.color]} />
              </g>
            );
          })}
          {hovered ? (
            <g pointerEvents="none">
              <line x1={hovered.x} x2={hovered.x} y1={MARGIN.top} y2={geometry.baseline} className="stroke-ink-muted" strokeDasharray="3 3" />
              {series.map((entry) => (
                <circle key={entry.label} cx={hovered.x} cy={geometry.yAt(entry.values[hovered.index] ?? 0)} r="4" className={cn('fill-surface', STROKE[entry.color])} strokeWidth="2" />
              ))}
            </g>
          ) : null}
        </svg>
        {hovered ? (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 min-w-40 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md"
            style={{ left: `${Math.min(88, Math.max(12, (hovered.x / width) * 100))}%` }}
          >
            <p className="mb-1 font-medium text-ink">{formatDayLabel(days[hovered.index] ?? '')}</p>
            {series.map((entry) => (
              <p key={entry.label} className="flex items-center justify-between gap-4 text-ink-muted">
                <span>{entry.label}</span>
                <span className="font-medium text-ink tabular-nums">{formatValue(entry.values[hovered.index] ?? 0)}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <figcaption className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-ink-muted">
        {series.map((entry) => (
          <span key={entry.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-3 rounded-[3px] border-2', SWATCH[entry.color])} />
            {entry.label}
          </span>
        ))}
      </figcaption>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {series.map((entry) => (
              <th key={entry.label} scope="col">
                {entry.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, index) => (
            <tr key={day}>
              <th scope="row">{formatDayLabel(day)}</th>
              {series.map((entry) => (
                <td key={entry.label}>{formatValue(entry.values[index] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
