/** A calendar date with no time zone, formatted YYYY-MM-DD. */
export type CalendarDate = string & { readonly __calendarDate: true };

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

function toUtcMilliseconds(isoDate: string): number | null {
  const match = CALENDAR_DATE_PATTERN.exec(isoDate);
  if (!match) return null;
  const [, yearText = '', monthText = '', dayText = ''] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utcMilliseconds = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(utcMilliseconds);
  const isRealDate =
    roundTrip.getUTCFullYear() === year && roundTrip.getUTCMonth() === month - 1 && roundTrip.getUTCDate() === day;
  return isRealDate ? utcMilliseconds : null;
}

export function isCalendarDate(value: string): value is CalendarDate {
  return toUtcMilliseconds(value) !== null;
}

/** Days between two dates = later − earlier (negative when `later` precedes `earlier`). */
export function daysBetween(earlier: string, later: string): number {
  const earlierMs = toUtcMilliseconds(earlier);
  const laterMs = toUtcMilliseconds(later);
  if (earlierMs === null || laterMs === null) throw new RangeError('Invalid calendar date');
  return Math.round((laterMs - earlierMs) / MILLISECONDS_PER_DAY);
}

/** Today's date in the user's local calendar, as YYYY-MM-DD. */
export function todayCalendarDate(now: Date = new Date()): CalendarDate {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as CalendarDate;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago", then the date. For timestamps (ISO strings) shown in feeds. */
export function formatRelativeTime(isoTimestamp: string, now: Date = new Date()): string {
  const elapsedMinutes = Math.floor((now.getTime() - new Date(isoTimestamp).getTime()) / 60_000);
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
  return isoTimestamp.slice(0, 10);
}
