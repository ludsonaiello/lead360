import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * Helper function to convert time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Validates time window logic for appointment schedules:
 * - If is_available is false, skip time validation
 * - If is_available is true:
 *   - window1_start must be < window1_end
 *   - If window2 is set: window1_end < window2_start < window2_end
 *
 * Used for validating single day schedule entries
 */
@ValidatorConstraint({ name: 'TimeWindowValidator', async: false })
export class TimeWindowValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;

    // If day is not available, skip time validation
    if (object.is_available === false) {
      return true;
    }

    // If day is available, validate time windows
    const window1Start = object.window1_start;
    const window1End = object.window1_end;
    const window2Start = object.window2_start;
    const window2End = object.window2_end;

    // If available, window1_start and window1_end are required
    if (object.is_available === true) {
      if (!window1Start || !window1End) {
        return false;
      }
    }

    // Validate window1_start < window1_end
    if (window1Start && window1End) {
      const start1Minutes = timeToMinutes(window1Start);
      const end1Minutes = timeToMinutes(window1End);

      if (
        start1Minutes === null ||
        end1Minutes === null ||
        start1Minutes >= end1Minutes
      ) {
        return false;
      }
    }

    // If window2 is partially set, both start and end are required
    if ((window2Start && !window2End) || (!window2Start && window2End)) {
      return false;
    }

    // If window2 is fully set, validate window1_end < window2_start < window2_end
    if (window2Start && window2End) {
      const end1Minutes = timeToMinutes(window1End);
      const start2Minutes = timeToMinutes(window2Start);
      const end2Minutes = timeToMinutes(window2End);

      if (
        end1Minutes === null ||
        start2Minutes === null ||
        end2Minutes === null
      ) {
        return false;
      }

      // window1_end must be < window2_start (lunch break required)
      if (end1Minutes >= start2Minutes) {
        return false;
      }

      // window2_start must be < window2_end
      if (start2Minutes >= end2Minutes) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;

    // Custom error messages based on validation failure
    if (
      object.is_available === true &&
      (!object.window1_start || !object.window1_end)
    ) {
      return 'When day is available, window1_start and window1_end are required';
    }

    const window1Start = object.window1_start;
    const window1End = object.window1_end;
    const window2Start = object.window2_start;
    const window2End = object.window2_end;

    if (window1Start && window1End) {
      const start1Minutes = timeToMinutes(window1Start);
      const end1Minutes = timeToMinutes(window1End);
      if (
        start1Minutes !== null &&
        end1Minutes !== null &&
        start1Minutes >= end1Minutes
      ) {
        return 'window1_start must be before window1_end';
      }
    }

    if ((window2Start && !window2End) || (!window2Start && window2End)) {
      return 'Both window2_start and window2_end are required for second shift';
    }

    if (window2Start && window2End && window1End) {
      const end1Minutes = timeToMinutes(window1End);
      const start2Minutes = timeToMinutes(window2Start);
      const end2Minutes = timeToMinutes(window2End);

      if (
        end1Minutes !== null &&
        start2Minutes !== null &&
        end1Minutes >= start2Minutes
      ) {
        return 'window1_end must be before window2_start (lunch break required)';
      }

      if (
        start2Minutes !== null &&
        end2Minutes !== null &&
        start2Minutes >= end2Minutes
      ) {
        return 'window2_start must be before window2_end';
      }
    }

    return 'Invalid time window configuration';
  }
}

/**
 * Decorator to validate time windows in DTOs
 * Apply this to the DTO class (not a specific property)
 */
export function ValidateTimeWindows(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: TimeWindowValidator,
    });
  };
}
