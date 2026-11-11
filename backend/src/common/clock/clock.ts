import { Injectable } from '@nestjs/common';
import { CalendarDate, formatUtcDate } from '../dates/calendar-date';

/** Injectable so tests can pin "today". */
@Injectable()
export class Clock {
  today(): CalendarDate {
    return formatUtcDate(new Date());
  }

  nowIso(): string {
    return new Date().toISOString();
  }
}
