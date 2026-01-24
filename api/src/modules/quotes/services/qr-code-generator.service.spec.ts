import { Test, TestingModule } from '@nestjs/testing';
import { QrCodeGeneratorService } from './qr-code-generator.service';

describe('QrCodeGeneratorService', () => {
  let service: QrCodeGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QrCodeGeneratorService],
    }).compile();

    service = module.get<QrCodeGeneratorService>(QrCodeGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should generate QR code as buffer', async () => {
      const url = 'https://example.com/quote/123';

      const buffer = await service.generate(url);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should generate QR code with custom width', async () => {
      const url = 'https://example.com/quote/123';
      const options = { width: 300 };

      const buffer = await service.generate(url, options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should generate QR code with custom margin', async () => {
      const url = 'https://example.com/quote/123';
      const options = { margin: 4 };

      const buffer = await service.generate(url, options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should use default width (200) when not specified', async () => {
      const url = 'https://example.com/quote/123';

      const buffer = await service.generate(url);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should use default margin (2) when not specified', async () => {
      const url = 'https://example.com/quote/123';

      const buffer = await service.generate(url);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle long URLs', async () => {
      const longUrl = 'https://example.com/quote/123456789012345678901234567890?param1=value1&param2=value2&param3=value3';

      const buffer = await service.generate(longUrl);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle special characters in URL', async () => {
      const url = 'https://example.com/quote/123?name=John%20Doe&email=test@example.com';

      const buffer = await service.generate(url);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should throw error for invalid URL', async () => {
      const invalidUrl = '';

      await expect(service.generate(invalidUrl)).rejects.toThrow();
    });
  });

  describe('generateAndSave', () => {
    it('should generate QR code and return placeholder ID', async () => {
      const tenantId = 'tenant-123';
      const url = 'https://example.com/quote/123';
      const userId = 'user-123';

      const result = await service.generateAndSave(tenantId, url, userId);

      expect(result).toBe('qr-code-placeholder-id');
    });

    it('should log warning about incomplete implementation', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      await service.generateAndSave('tenant-123', 'https://example.com', 'user-123');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('generateAndSave not fully implemented'),
      );
    });
  });
});
