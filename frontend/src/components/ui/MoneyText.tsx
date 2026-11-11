import { formatKobo, type Kobo } from '@/lib/money';

interface MoneyTextProps {
  readonly kobo: Kobo;
}

/** The only way money is rendered. */
export function MoneyText({ kobo }: MoneyTextProps) {
  return <span className="tabular-nums">{formatKobo(kobo)}</span>;
}
