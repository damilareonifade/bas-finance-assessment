import { KOBO_PER_NAIRA, type Kobo } from './kobo';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "₦1,200,000.50". Integer arithmetic only — no toFixed, no float division. */
export function formatKobo(amountKobo: Kobo): string {
  const isNegative = amountKobo < 0;
  const absoluteKobo = Math.abs(amountKobo);
  const koboPart = absoluteKobo % KOBO_PER_NAIRA;
  const wholeNaira = (absoluteKobo - koboPart) / KOBO_PER_NAIRA;
  const sign = isNegative ? '-' : '';
  return `${sign}₦${groupThousands(String(wholeNaira))}.${String(koboPart).padStart(2, '0')}`;
}

/** Plain grouped kobo, e.g. "21,063,026" — for tables that show raw kobo next to naira. */
export function formatKoboRaw(amountKobo: Kobo): string {
  return groupThousands(String(amountKobo));
}

const COMPACT_UNITS = [
  { suffix: 'B', size: 1_000_000_000 },
  { suffix: 'M', size: 1_000_000 },
  { suffix: 'K', size: 1_000 },
] as const;

/**
 * Short axis label such as "₦120M" or "₦2.5K". Display only (chart ticks) — never used for amounts a person reads as exact.
 * Integer arithmetic only: whole naira, then tenths of a unit.
 */
export function formatKoboCompact(amountKobo: Kobo): string {
  const isNegative = amountKobo < 0;
  const wholeNaira = (Math.abs(amountKobo) - (Math.abs(amountKobo) % KOBO_PER_NAIRA)) / KOBO_PER_NAIRA;
  const sign = isNegative ? '-' : '';
  const unit = COMPACT_UNITS.find(({ size }) => wholeNaira >= size);
  if (!unit) return `${sign}₦${groupThousands(String(wholeNaira))}`;
  const tenths = Math.floor((wholeNaira * 10) / unit.size);
  const wholePart = Math.floor(tenths / 10);
  const tenthPart = tenths % 10;
  return `${sign}₦${wholePart}${tenthPart === 0 ? '' : `.${tenthPart}`}${unit.suffix}`;
}
