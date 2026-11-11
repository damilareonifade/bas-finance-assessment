/** A calendar date with no time zone, formatted YYYY-MM-DD. */
export type CalendarDate = string & { readonly __calendarDate: true };

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

function toUtcMilliseconds(isoDate: string): number | null {
  const match = CALENDAR_DATE_PATTERN.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMilliseconds = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(utcMilliseconds);
  const isRealDate =
    roundTrip.getUTCFullYear() === year && roundTrip.getUTCMonth() === month - 1 && roundTrip.getUTCDate() === day;
  return isRealDate ? utcMilliseconds : null;
}

export function isCalendarDate(value: unknown): value is CalendarDate {
  return typeof value === 'string' && toUtcMilliseconds(value) !== null;
}

export function asCalendarDate(value: string): CalendarDate {
  if (!isCalendarDate(value)) throw new RangeError(`Invalid calendar date: ${value}`);
  return value;
}

/** Days between two dates = later − earlier (negative when `later` precedes `earlier`). */
export function daysBetween(earlier: string, later: string): number {
  const earlierMs = toUtcMilliseconds(earlier);
  const laterMs = toUtcMilliseconds(later);
  if (earlierMs === null || laterMs === null) throw new RangeError('Invalid calendar date');
  return Math.round((laterMs - earlierMs) / MILLISECONDS_PER_DAY);
}

/** Adds whole months, clamping to the end of a shorter month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const startMs = toUtcMilliseconds(date);
  if (startMs === null) throw new RangeError('Invalid calendar date');
  const start = new Date(startMs);
  const targetMonthIndex = start.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(start.getUTCFullYear(), targetMonthIndex + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(start.getUTCFullYear(), targetMonthIndex, Math.min(start.getUTCDate(), lastDayOfTargetMonth)));
  return formatUtcDate(result);
}

export function formatUtcDate(date: Date): CalendarDate {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as CalendarDate;
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const startMs = toUtcMilliseconds(date);
  if (startMs === null) throw new RangeError('Invalid calendar date');
  return formatUtcDate(new Date(startMs + days * MILLISECONDS_PER_DAY));
}

export function startOfMonth(date: CalendarDate): CalendarDate {
  return `${date.slice(0, 7)}-01` as CalendarDate;
}
