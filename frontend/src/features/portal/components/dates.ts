const DATE_FORMAT = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "2026-02-15" (or an ISO timestamp) → "15 Feb 2026". Calendar dates are read as UTC so they never shift a day. */
export function formatPortalDate(value: string): string {
  return DATE_FORMAT.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
