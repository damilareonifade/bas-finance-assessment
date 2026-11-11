import { ValidationOptions, ValidateBy, buildMessage } from 'class-validator';
import { isCalendarDate } from '../dates/calendar-date';

/** Validates a real calendar date formatted YYYY-MM-DD (rejects 2025-02-30). */
export function IsCalendarDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isCalendarDate',
      validator: {
        validate: (value: unknown): boolean => isCalendarDate(value),
        defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property must be a valid calendar date (YYYY-MM-DD)`, validationOptions),
      },
    },
    validationOptions,
  );
}
