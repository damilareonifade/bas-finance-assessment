import { cn } from '@/lib/utils/cn';

export type SparklineTone = 'positive' | 'negative' | 'neutral';

interface SparklineProps {
  readonly values: readonly number[];
  readonly tone?: SparklineTone;
  readonly className?: string;
}

const STROKE: Readonly<Record<SparklineTone, string>> = { positive: 'stroke-success', negative: 'stroke-danger', neutral: 'stroke-brand' };
const FILL: Readonly<Record<SparklineTone, string>> = { positive: 'fill-success-soft', negative: 'fill-danger-soft', neutral: 'fill-brand-soft' };

const WIDTH = 100;
const HEIGHT = 28;
const PADDING_Y = 3;

/** A quiet area line meant to sit flush along the bottom edge of a card. Purely decorative — the numbers above carry the meaning. */
export function Sparkline({ values, tone = 'neutral', className }: SparklineProps) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * WIDTH;
    const y = max === min ? HEIGHT / 2 : HEIGHT - PADDING_Y - ((value - min) / range) * (HEIGHT - PADDING_Y * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className={cn('block h-7 w-full', className)}>
      <path d={area} className={cn('stroke-0', FILL[tone])} />
      <path d={line} fill="none" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" className={STROKE[tone]} />
    </svg>
  );
}
