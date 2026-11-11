import { asCalendarDate, daysBetween, isCalendarDate } from './calendar-date';

describe('calendar dates', () => {
  it('rejects impossible dates', () => {
    expect(isCalendarDate('2025-02-30')).toBe(false);
    expect(isCalendarDate('2025-13-01')).toBe(false);
    expect(isCalendarDate('2025-1-1')).toBe(false);
    expect(isCalendarDate(20250101)).toBe(false);
    expect(isCalendarDate('2024-02-29')).toBe(true);
  });

  it('counts days as later minus earlier', () => {
    expect(daysBetween('2026-01-01', '2026-03-02')).toBe(60);
    expect(daysBetween('2026-03-02', '2026-01-01')).toBe(-60);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('asCalendarDate throws for invalid input', () => {
    expect(() => asCalendarDate('nope')).toThrow(RangeError);
  });
});
