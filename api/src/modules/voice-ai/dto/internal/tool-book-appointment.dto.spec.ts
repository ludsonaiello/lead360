import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { BookAppointmentToolDto } from './tool-book-appointment.dto';

describe('BookAppointmentToolDto', () => {
  describe('date format validation', () => {
    const validData = {
      lead_id: '550e8400-e29b-41d4-a716-446655440000',
    };

    it('should accept valid preferred_date in YYYY-MM-DD format', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        ...validData,
        preferred_date: '2026-03-15',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.preferred_date).toBe('2026-03-15');
    });

    it('should accept valid confirmed_date and confirmed_start_time', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        ...validData,
        confirmed_date: '2026-03-15',
        confirmed_start_time: '09:00',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.confirmed_date).toBe('2026-03-15');
      expect(dto.confirmed_start_time).toBe('09:00');
    });

    it('should reject invalid date format (MM/DD/YYYY)', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        ...validData,
        preferred_date: '03/15/2026',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('preferred_date');
      expect(errors[0].constraints?.matches).toContain('YYYY-MM-DD');
    });

    it('should reject invalid date format (YYYY/MM/DD)', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        ...validData,
        confirmed_date: '2026/03/15',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('confirmed_date');
    });

    it('should reject invalid time format (12-hour with AM/PM)', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        ...validData,
        confirmed_date: '2026-03-15',
        confirmed_start_time: '9:00 AM',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('confirmed_start_time');
      expect(errors[0].constraints?.matches).toContain('HH:MM');
    });

    it('should accept valid time in 24-hour format', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        ...validData,
        confirmed_date: '2026-03-15',
        confirmed_start_time: '14:30',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid time format (single digit hour)', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        ...validData,
        confirmed_date: '2026-03-15',
        confirmed_start_time: '9:00',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('confirmed_start_time');
    });
  });

  describe('required field validation', () => {
    it('should require lead_id', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        // Missing lead_id
        preferred_date: '2026-03-15',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'lead_id')).toBe(true);
    });

    it('should allow optional fields to be omitted', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        lead_id: '550e8400-e29b-41d4-a716-446655440000',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept all optional fields when provided', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        lead_id: '550e8400-e29b-41d4-a716-446655440000',
        preferred_date: '2026-03-15',
        confirmed_date: '2026-03-15',
        confirmed_start_time: '09:00',
        notes: 'Customer prefers morning appointments',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should accept midnight as valid time (00:00)', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        lead_id: '550e8400-e29b-41d4-a716-446655440000',
        confirmed_date: '2026-03-15',
        confirmed_start_time: '00:00',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept end of day as valid time (23:59)', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        lead_id: '550e8400-e29b-41d4-a716-446655440000',
        confirmed_date: '2026-03-15',
        confirmed_start_time: '23:59',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should allow empty notes string', async () => {
      const dto = plainToClass(BookAppointmentToolDto, {
        lead_id: '550e8400-e29b-41d4-a716-446655440000',
        notes: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
