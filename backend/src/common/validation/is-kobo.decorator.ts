import { ValidationOptions, ValidateBy, buildMessage } from 'class-validator';

export interface KoboRange {
  readonly min: number;
  readonly max: number;
}

/** Validates a JSON integer number of kobo within [min, max]. Rejects floats, strings and unsafe integers. */
export function IsKobo(range: KoboRange, validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isKobo',
      constraints: [range.min, range.max],
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'number' && Number.isSafeInteger(value) && value >= range.min && value <= range.max,
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be an integer number of kobo between ${range.min} and ${range.max}`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
