import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  // Valid 64-char hex key (32 bytes) for testing
  const TEST_ENCRYPTION_KEY =
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ENCRYPTION_KEY') return TEST_ENCRYPTION_KEY;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt', () => {
    it('should encrypt a value and return a JSON string', () => {
      const encrypted = service.encrypt('test-ssn');

      expect(typeof encrypted).toBe('string');

      const parsed = JSON.parse(encrypted);
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('encrypted');
      expect(parsed).toHaveProperty('authTag');
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const encrypted1 = service.encrypt('test-ssn');
      const encrypted2 = service.encrypt('test-ssn');

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted value back to the original', () => {
      const original = 'test-ssn';
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it('should correctly round-trip a SSN value', () => {
      const ssn = '123-45-6789';
      const encrypted = service.encrypt(ssn);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(ssn);
    });

    it('should correctly round-trip an ITIN value', () => {
      const itin = '900-70-0000';
      const encrypted = service.encrypt(itin);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(itin);
    });

    it('should correctly round-trip a drivers license number', () => {
      const dl = 'D12345678';
      const encrypted = service.encrypt(dl);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(dl);
    });

    it('should correctly round-trip a bank routing number', () => {
      const routing = '021000021';
      const encrypted = service.encrypt(routing);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(routing);
    });

    it('should correctly round-trip a bank account number', () => {
      const account = '1234567890';
      const encrypted = service.encrypt(account);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(account);
    });
  });

  describe('error handling', () => {
    it('should throw if decrypting tampered data', () => {
      const encrypted = service.encrypt('test-ssn');
      const parsed = JSON.parse(encrypted);
      parsed.encrypted = 'tampered' + parsed.encrypted;
      const tampered = JSON.stringify(parsed);

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw if decrypting invalid JSON', () => {
      expect(() => service.decrypt('not-json')).toThrow();
    });
  });

  describe('constructor validation', () => {
    it('should throw if ENCRYPTION_KEY is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            EncryptionService,
            {
              provide: ConfigService,
              useValue: { get: () => undefined },
            },
          ],
        }).compile(),
      ).rejects.toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    });

    it('should throw if ENCRYPTION_KEY is wrong length', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            EncryptionService,
            {
              provide: ConfigService,
              useValue: { get: () => 'tooshort' },
            },
          ],
        }).compile(),
      ).rejects.toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    });
  });
});
