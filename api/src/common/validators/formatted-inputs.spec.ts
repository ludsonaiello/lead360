import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsString, Matches } from 'class-validator';
import {
  SanitizePhone,
  SanitizeEIN,
  SanitizeZipCode,
  SanitizeRoutingNumber,
  SanitizeAccountNumber,
  ToUpperCase,
  ToLowerCase,
} from './formatted-inputs';

describe('Input Sanitization Utilities', () => {
  describe('SanitizePhone', () => {
    class TestPhoneDto {
      @SanitizePhone()
      @IsString()
      @Matches(/^\d{10}$/, { message: 'Phone must be 10 digits' })
      phone: string;
    }

    it('should remove all non-digits and strip US country code (+1)', async () => {
      const testCases = [
        { input: '+1 (555) 123-4567', expected: '5551234567' },
        { input: '+1 555 123 4567', expected: '5551234567' },
        { input: '+15551234567', expected: '5551234567' },
        { input: '(555) 123-4567', expected: '5551234567' },
        { input: '555-123-4567', expected: '5551234567' },
        { input: '555.123.4567', expected: '5551234567' },
        { input: '5551234567', expected: '5551234567' },
        { input: '1 555 123 4567', expected: '5551234567' }, // No + sign, but 11 digits starting with 1
      ];

      for (const { input, expected } of testCases) {
        const dto = plainToInstance(TestPhoneDto, { phone: input });
        expect(dto.phone).toBe(expected);
      }
    });

    it('should pass validation after sanitization', async () => {
      const dto = plainToInstance(TestPhoneDto, { phone: '(555) 123-4567' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.phone).toBe('5551234567');
    });

    it('should handle +1 prefix from frontend and pass validation', async () => {
      const dto = plainToInstance(TestPhoneDto, { phone: '+1 (555) 123-4567' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.phone).toBe('5551234567');
    });

    it('should handle null and undefined values', () => {
      const dto1 = plainToInstance(TestPhoneDto, { phone: null });
      expect(dto1.phone).toBeNull();

      const dto2 = plainToInstance(TestPhoneDto, { phone: undefined });
      expect(dto2.phone).toBeUndefined();
    });
  });

  describe('SanitizeEIN', () => {
    class TestEINDto {
      @SanitizeEIN()
      @IsString()
      @Matches(/^\d{2}-\d{7}$/, { message: 'Invalid EIN format' })
      ein: string;
    }

    it('should format 9 digits to XX-XXXXXXX', async () => {
      const testCases = [
        { input: '123456789', expected: '12-3456789' },
        { input: '12-3456789', expected: '12-3456789' },
        { input: '12 3456789', expected: '12-3456789' },
        { input: '12.3456789', expected: '12-3456789' },
        { input: '12/3456789', expected: '12-3456789' },
      ];

      for (const { input, expected } of testCases) {
        const dto = plainToInstance(TestEINDto, { ein: input });
        expect(dto.ein).toBe(expected);
      }
    });

    it('should pass validation after sanitization', async () => {
      const dto = plainToInstance(TestEINDto, { ein: '12 3456789' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.ein).toBe('12-3456789');
    });

    it('should return as-is if not exactly 9 digits', () => {
      const dto1 = plainToInstance(TestEINDto, { ein: '12345' });
      expect(dto1.ein).toBe('12345');

      const dto2 = plainToInstance(TestEINDto, { ein: '1234567890' });
      expect(dto2.ein).toBe('1234567890');
    });

    it('should handle null and undefined values', () => {
      const dto1 = plainToInstance(TestEINDto, { ein: null });
      expect(dto1.ein).toBeNull();

      const dto2 = plainToInstance(TestEINDto, { ein: undefined });
      expect(dto2.ein).toBeUndefined();
    });
  });

  describe('SanitizeZipCode', () => {
    class TestZipDto {
      @SanitizeZipCode()
      @IsString()
      @Matches(/^\d{5}(-\d{4})?$/, { message: 'Invalid ZIP code' })
      zip_code: string;
    }

    it('should format 5-digit ZIP codes', async () => {
      const testCases = [
        { input: '12345', expected: '12345' },
        { input: '12-345', expected: '12-345' }, // Keeps hyphen as-is (not 9 digits)
        { input: '1-2345', expected: '1-2345' }, // Keeps hyphen as-is (not 9 digits)
      ];

      for (const { input, expected } of testCases) {
        const dto = plainToInstance(TestZipDto, { zip_code: input });
        expect(dto.zip_code).toBe(expected);
      }
    });

    it('should format 9-digit ZIP codes to ZIP+4', async () => {
      const testCases = [
        { input: '123456789', expected: '12345-6789' },
        { input: '12345-6789', expected: '12345-6789' },
        { input: '12345 6789', expected: '12345-6789' }, // spaces removed, then formatted
      ];

      for (const { input, expected } of testCases) {
        const dto = plainToInstance(TestZipDto, { zip_code: input });
        expect(dto.zip_code).toBe(expected);
      }
    });

    it('should pass validation after sanitization', async () => {
      const dto1 = plainToInstance(TestZipDto, { zip_code: '12345' });
      const errors1 = await validate(dto1);
      expect(errors1).toHaveLength(0);

      const dto2 = plainToInstance(TestZipDto, { zip_code: '123456789' });
      const errors2 = await validate(dto2);
      expect(errors2).toHaveLength(0);
      expect(dto2.zip_code).toBe('12345-6789');
    });

    it('should handle null and undefined values', () => {
      const dto1 = plainToInstance(TestZipDto, { zip_code: null });
      expect(dto1.zip_code).toBeNull();

      const dto2 = plainToInstance(TestZipDto, { zip_code: undefined });
      expect(dto2.zip_code).toBeUndefined();
    });
  });

  describe('SanitizeRoutingNumber', () => {
    class TestRoutingDto {
      @SanitizeRoutingNumber()
      @IsString()
      @Matches(/^\d{9}$/, { message: 'Routing number must be 9 digits' })
      routing_number: string;
    }

    it('should remove all non-digits from routing numbers', async () => {
      const testCases = [
        { input: '123456789', expected: '123456789' },
        { input: '123-456-789', expected: '123456789' },
        { input: '123 456 789', expected: '123456789' },
        { input: '123.456.789', expected: '123456789' },
      ];

      for (const { input, expected } of testCases) {
        const dto = plainToInstance(TestRoutingDto, { routing_number: input });
        expect(dto.routing_number).toBe(expected);
      }
    });

    it('should pass validation after sanitization', async () => {
      const dto = plainToInstance(TestRoutingDto, {
        routing_number: '123-456-789',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.routing_number).toBe('123456789');
    });

    it('should handle null and undefined values', () => {
      const dto1 = plainToInstance(TestRoutingDto, { routing_number: null });
      expect(dto1.routing_number).toBeNull();

      const dto2 = plainToInstance(TestRoutingDto, {
        routing_number: undefined,
      });
      expect(dto2.routing_number).toBeUndefined();
    });
  });

  describe('SanitizeAccountNumber', () => {
    class TestAccountDto {
      @SanitizeAccountNumber()
      @IsString()
      account_number: string;
    }

    it('should remove spaces from account numbers', async () => {
      const testCases = [
        { input: '123456789012', expected: '123456789012' },
        { input: '1234 5678 9012', expected: '123456789012' },
        { input: '1234  5678  9012', expected: '123456789012' },
      ];

      for (const { input, expected } of testCases) {
        const dto = plainToInstance(TestAccountDto, { account_number: input });
        expect(dto.account_number).toBe(expected);
      }
    });

    it('should preserve other characters (not spaces)', () => {
      const dto = plainToInstance(TestAccountDto, {
        account_number: '1234-5678-9012',
      });
      expect(dto.account_number).toBe('1234-5678-9012');
    });

    it('should handle null and undefined values', () => {
      const dto1 = plainToInstance(TestAccountDto, { account_number: null });
      expect(dto1.account_number).toBeNull();

      const dto2 = plainToInstance(TestAccountDto, {
        account_number: undefined,
      });
      expect(dto2.account_number).toBeUndefined();
    });
  });

  describe('ToUpperCase', () => {
    class TestUpperCaseDto {
      @ToUpperCase()
      @IsString()
      @Matches(/^[A-Z]{2}$/, { message: 'Must be 2 uppercase letters' })
      state: string;
    }

    it('should convert strings to uppercase', async () => {
      const testCases = [
        { input: 'ca', expected: 'CA' },
        { input: 'Ca', expected: 'CA' },
        { input: 'CA', expected: 'CA' },
        { input: 'ny', expected: 'NY' },
      ];

      for (const { input, expected } of testCases) {
        const dto = plainToInstance(TestUpperCaseDto, { state: input });
        expect(dto.state).toBe(expected);
      }
    });

    it('should pass validation after transformation', async () => {
      const dto = plainToInstance(TestUpperCaseDto, { state: 'ca' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.state).toBe('CA');
    });

    it('should handle null and undefined values', () => {
      const dto1 = plainToInstance(TestUpperCaseDto, { state: null });
      expect(dto1.state).toBeNull();

      const dto2 = plainToInstance(TestUpperCaseDto, { state: undefined });
      expect(dto2.state).toBeUndefined();
    });
  });

  describe('ToLowerCase', () => {
    class TestLowerCaseDto {
      @ToLowerCase()
      @IsString()
      @Matches(/^[a-z0-9-]+$/, { message: 'Must be lowercase alphanumeric' })
      subdomain: string;
    }

    it('should convert strings to lowercase', async () => {
      const testCases = [
        { input: 'ACME', expected: 'acme' },
        { input: 'Acme', expected: 'acme' },
        { input: 'acme', expected: 'acme' },
        { input: 'ACME-Roofing', expected: 'acme-roofing' },
      ];

      for (const { input, expected } of testCases) {
        const dto = plainToInstance(TestLowerCaseDto, { subdomain: input });
        expect(dto.subdomain).toBe(expected);
      }
    });

    it('should pass validation after transformation', async () => {
      const dto = plainToInstance(TestLowerCaseDto, {
        subdomain: 'ACME-Roofing',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.subdomain).toBe('acme-roofing');
    });

    it('should handle null and undefined values', () => {
      const dto1 = plainToInstance(TestLowerCaseDto, { subdomain: null });
      expect(dto1.subdomain).toBeNull();

      const dto2 = plainToInstance(TestLowerCaseDto, { subdomain: undefined });
      expect(dto2.subdomain).toBeUndefined();
    });
  });
});
