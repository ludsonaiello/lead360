import { TimeWindowValidator, timeToMinutes } from './time-window.validator';
import { ValidationArguments } from 'class-validator';

describe('TimeWindowValidator', () => {
  let validator: TimeWindowValidator;

  beforeEach(() => {
    validator = new TimeWindowValidator();
  });

  describe('timeToMinutes', () => {
    it('should convert time string to minutes', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('09:00')).toBe(540);
      expect(timeToMinutes('12:30')).toBe(750);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('should return null for null or undefined', () => {
      expect(timeToMinutes(null)).toBeNull();
      expect(timeToMinutes(undefined)).toBeNull();
    });
  });

  describe('validate', () => {
    it('should return true when is_available is false (skip validation)', () => {
      const object = {
        is_available: false,
        window1_start: null,
        window1_end: null,
        window2_start: null,
        window2_end: null,
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(true);
    });

    it('should return false when is_available is true but window1 times are missing', () => {
      const object = {
        is_available: true,
        window1_start: null,
        window1_end: null,
        window2_start: null,
        window2_end: null,
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(false);
    });

    it('should return true when is_available is true and window1 times are valid', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: null,
        window2_end: null,
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(true);
    });

    it('should return false when window1_start >= window1_end', () => {
      const object = {
        is_available: true,
        window1_start: '12:00',
        window1_end: '09:00',
        window2_start: null,
        window2_end: null,
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(false);
    });

    it('should return false when window1_start === window1_end', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '09:00',
        window2_start: null,
        window2_end: null,
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(false);
    });

    it('should return false when window2 is partially set (only start)', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: '13:00',
        window2_end: null,
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(false);
    });

    it('should return false when window2 is partially set (only end)', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: null,
        window2_end: '17:00',
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(false);
    });

    it('should return true when window2 is fully set and valid', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: '13:00',
        window2_end: '17:00',
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(true);
    });

    it('should return false when window1_end >= window2_start (no lunch break)', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '13:00',
        window2_start: '13:00',
        window2_end: '17:00',
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(false);
    });

    it('should return false when window1_end > window2_start', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '14:00',
        window2_start: '13:00',
        window2_end: '17:00',
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(false);
    });

    it('should return false when window2_start >= window2_end', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: '17:00',
        window2_end: '13:00',
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(false);
    });

    it('should return false when window2_start === window2_end', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: '13:00',
        window2_end: '13:00',
      };

      const args = { object } as ValidationArguments;
      expect(validator.validate(null, args)).toBe(false);
    });
  });

  describe('defaultMessage', () => {
    it('should return appropriate message when windows are missing', () => {
      const object = {
        is_available: true,
        window1_start: null,
        window1_end: null,
      };

      const args = { object } as ValidationArguments;
      const message = validator.defaultMessage(args);
      expect(message).toContain('window1_start and window1_end are required');
    });

    it('should return appropriate message when window1_start >= window1_end', () => {
      const object = {
        is_available: true,
        window1_start: '12:00',
        window1_end: '09:00',
      };

      const args = { object } as ValidationArguments;
      const message = validator.defaultMessage(args);
      expect(message).toContain('window1_start must be before window1_end');
    });

    it('should return appropriate message when window2 is partially set', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: '13:00',
        window2_end: null,
      };

      const args = { object } as ValidationArguments;
      const message = validator.defaultMessage(args);
      expect(message).toContain(
        'Both window2_start and window2_end are required',
      );
    });

    it('should return appropriate message when window1_end >= window2_start', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '13:00',
        window2_start: '13:00',
        window2_end: '17:00',
      };

      const args = { object } as ValidationArguments;
      const message = validator.defaultMessage(args);
      expect(message).toContain('window1_end must be before window2_start');
    });

    it('should return appropriate message when window2_start >= window2_end', () => {
      const object = {
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: '17:00',
        window2_end: '13:00',
      };

      const args = { object } as ValidationArguments;
      const message = validator.defaultMessage(args);
      expect(message).toContain('window2_start must be before window2_end');
    });
  });
});
