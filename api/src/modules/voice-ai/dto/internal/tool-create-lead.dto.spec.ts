import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateLeadToolDto } from './tool-create-lead.dto';

describe('CreateLeadToolDto', () => {
  describe('phone_number sanitization', () => {
    const validData = {
      first_name: 'John',
      last_name: 'Doe',
      address: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip_code: '02101',
    };

    it('should accept E.164 format (+19788968047)', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        ...validData,
        phone_number: '+19788968047',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.phone_number).toBe('9788968047'); // Should be sanitized to 10 digits
    });

    it('should accept 11-digit format with country code (19788968047)', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        ...validData,
        phone_number: '19788968047',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.phone_number).toBe('9788968047');
    });

    it('should accept 10-digit format (9788968047)', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        ...validData,
        phone_number: '9788968047',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.phone_number).toBe('9788968047');
    });

    it('should accept formatted phone with parentheses (978) 896-8047', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        ...validData,
        phone_number: '(978) 896-8047',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.phone_number).toBe('9788968047');
    });

    it('should accept formatted phone with dashes 978-896-8047', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        ...validData,
        phone_number: '978-896-8047',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.phone_number).toBe('9788968047');
    });

    it('should accept E.164 with formatting +1 (978) 896-8047', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        ...validData,
        phone_number: '+1 (978) 896-8047',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.phone_number).toBe('9788968047');
    });

    it('should reject invalid phone with too few digits', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        ...validData,
        phone_number: '123456789', // Only 9 digits
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.matches).toContain('10 digits');
    });

    it('should reject invalid phone with too many digits (12 digits)', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        ...validData,
        phone_number: '119788968047', // 12 digits
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.matches).toContain('10 digits');
    });

    it('should reject empty phone number', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        ...validData,
        phone_number: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('other field validation', () => {
    it('should validate email format when provided', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '9788968047',
        email: 'invalid-email',
        address: '123 Main St',
        city: 'Boston',
        state: 'MA',
        zip_code: '02101',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should accept valid email when provided', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '9788968047',
        email: 'john@example.com',
        address: '123 Main St',
        city: 'Boston',
        state: 'MA',
        zip_code: '02101',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should require all mandatory fields', async () => {
      const dto = plainToClass(CreateLeadToolDto, {
        first_name: 'John',
        // Missing last_name, phone_number, address, city, state, zip_code
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
