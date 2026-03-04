import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: ConfigService;

  // Valid 64-character hex key (32 bytes = 256 bits)
  const validEncryptionKey =
    '1d238a1a9dd10e8b30c93b9631758e89e299c58c4c3e1279e0f4241b01b98c0e';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ENCRYPTION_KEY') {
                return validEncryptionKey;
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with valid 64-character hex key', () => {
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('ENCRYPTION_KEY');
    });

    it('should throw error if ENCRYPTION_KEY is missing', () => {
      const invalidConfigService = {
        get: jest.fn(() => undefined),
      };

      expect(() => {
        new EncryptionService(invalidConfigService as any);
      }).toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    });

    it('should throw error if ENCRYPTION_KEY is too short', () => {
      const invalidConfigService = {
        get: jest.fn(() => '1234567890abcdef'), // Only 16 characters
      };

      expect(() => {
        new EncryptionService(invalidConfigService as any);
      }).toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    });

    it('should throw error if ENCRYPTION_KEY is too long', () => {
      const invalidConfigService = {
        get: jest.fn(
          () =>
            '1d238a1a9dd10e8b30c93b9631758e89e299c58c4c3e1279e0f4241b01b98c0e1234',
        ), // 68 characters
      };

      expect(() => {
        new EncryptionService(invalidConfigService as any);
      }).toThrow('ENCRYPTION_KEY must be a 64-character hex string');
    });
  });

  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'Hello, World!';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt OAuth access token', () => {
      const accessToken =
        'ya29.a0AfB_byB8qZ3X4rP9vN5k2Uw1Qw8eRtYuI0pA7sDfGhJkL3zXcVbNmQ9wErTyU8iO7pQwErTyU8iO7p';
      const encrypted = service.encrypt(accessToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(accessToken);
    });

    it('should encrypt and decrypt OAuth refresh token', () => {
      const refreshToken =
        '1//0gXYZ1234567890-aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890aBcDeFgHiJkLmNoPqRsTuVwXyZ';
      const encrypted = service.encrypt(refreshToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(refreshToken);
    });

    it('should encrypt and decrypt empty string', () => {
      const plaintext = '';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt string with special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt string with unicode characters', () => {
      const plaintext = 'Hello 世界 🌍 café';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt multi-line string', () => {
      const plaintext = `Line 1
Line 2
Line 3
with special characters: !@#$%`;
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt very long string (10KB)', () => {
      const plaintext = 'A'.repeat(10240); // 10KB of 'A's
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(10240);
    });
  });

  describe('Encryption Properties', () => {
    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'Hello, World!';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      // Ciphertexts should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same plaintext
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should return encrypted data in JSON format with iv, encrypted, and authTag', () => {
      const plaintext = 'Test data';
      const encrypted = service.encrypt(plaintext);

      const parsed = JSON.parse(encrypted);

      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('encrypted');
      expect(parsed).toHaveProperty('authTag');
      expect(typeof parsed.iv).toBe('string');
      expect(typeof parsed.encrypted).toBe('string');
      expect(typeof parsed.authTag).toBe('string');
    });

    it('should use 16-byte (32 hex chars) IV', () => {
      const plaintext = 'Test data';
      const encrypted = service.encrypt(plaintext);
      const parsed = JSON.parse(encrypted);

      // IV should be 16 bytes = 32 hex characters
      expect(parsed.iv.length).toBe(32);
    });

    it('should use 16-byte (32 hex chars) authTag for AES-256-GCM', () => {
      const plaintext = 'Test data';
      const encrypted = service.encrypt(plaintext);
      const parsed = JSON.parse(encrypted);

      // GCM auth tag should be 16 bytes = 32 hex characters
      expect(parsed.authTag.length).toBe(32);
    });
  });

  describe('Decryption Error Handling', () => {
    it('should throw error when decrypting tampered ciphertext', () => {
      const plaintext = 'Hello, World!';
      const encrypted = service.encrypt(plaintext);

      // Tamper with the encrypted data
      const parsed = JSON.parse(encrypted);
      parsed.encrypted = parsed.encrypted.substring(0, parsed.encrypted.length - 2) + 'FF';
      const tampered = JSON.stringify(parsed);

      expect(() => {
        service.decrypt(tampered);
      }).toThrow();
    });

    it('should throw error when decrypting with tampered authTag', () => {
      const plaintext = 'Hello, World!';
      const encrypted = service.encrypt(plaintext);

      // Tamper with the auth tag
      const parsed = JSON.parse(encrypted);
      parsed.authTag = parsed.authTag.substring(0, parsed.authTag.length - 2) + 'FF';
      const tampered = JSON.stringify(parsed);

      expect(() => {
        service.decrypt(tampered);
      }).toThrow();
    });

    it('should throw error when decrypting with tampered IV', () => {
      const plaintext = 'Hello, World!';
      const encrypted = service.encrypt(plaintext);

      // Tamper with the IV
      const parsed = JSON.parse(encrypted);
      parsed.iv = parsed.iv.substring(0, parsed.iv.length - 2) + 'FF';
      const tampered = JSON.stringify(parsed);

      expect(() => {
        service.decrypt(tampered);
      }).toThrow();
    });

    it('should throw error when decrypting invalid JSON', () => {
      const invalidJson = 'not a json string';

      expect(() => {
        service.decrypt(invalidJson);
      }).toThrow();
    });

    it('should throw error when decrypting JSON missing required fields', () => {
      const missingFields = JSON.stringify({
        iv: '1234567890abcdef1234567890abcdef',
        // missing 'encrypted' and 'authTag'
      });

      expect(() => {
        service.decrypt(missingFields);
      }).toThrow();
    });
  });

  describe('Real-World OAuth Token Scenarios', () => {
    it('should handle Google OAuth access token encryption/decryption', () => {
      const googleAccessToken =
        'ya29.a0AfB_byB8qZ3X4rP9vN5k2Uw1Qw8eRtYuI0pA7sDfGhJkL3zXcVbNmQ9wErTyU8iO7pQwErTyU8iO7p';
      const encrypted = service.encrypt(googleAccessToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(googleAccessToken);
      expect(encrypted).not.toContain(googleAccessToken); // Ensure it's actually encrypted
    });

    it('should handle Google OAuth refresh token encryption/decryption', () => {
      const googleRefreshToken =
        '1//0gXYZ1234567890-aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890aBcDeFgHiJkLmNoPqRsTuVwXyZ';
      const encrypted = service.encrypt(googleRefreshToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(googleRefreshToken);
      expect(encrypted).not.toContain(googleRefreshToken);
    });

    it('should not leak plaintext in encrypted output', () => {
      const sensitiveData = 'SECRET_PASSWORD_12345';
      const encrypted = service.encrypt(sensitiveData);

      // Encrypted data should not contain the plaintext
      expect(encrypted).not.toContain(sensitiveData);
      expect(encrypted.toLowerCase()).not.toContain(sensitiveData.toLowerCase());
    });
  });

  describe('Data Integrity', () => {
    it('should verify data integrity with GCM auth tag', () => {
      const plaintext = 'Critical data that must not be tampered';
      const encrypted = service.encrypt(plaintext);

      // Valid decryption should succeed
      expect(() => {
        service.decrypt(encrypted);
      }).not.toThrow();

      // Tampered decryption should fail
      const parsed = JSON.parse(encrypted);
      parsed.encrypted = 'FFFFFFFFFFFFFFFF';
      const tampered = JSON.stringify(parsed);

      expect(() => {
        service.decrypt(tampered);
      }).toThrow();
    });

    it('should ensure encrypted output is always different due to random IV', () => {
      const plaintext = 'Same plaintext';
      const results = new Set<string>();

      // Encrypt same plaintext 10 times
      for (let i = 0; i < 10; i++) {
        results.add(service.encrypt(plaintext));
      }

      // All encrypted outputs should be unique
      expect(results.size).toBe(10);
    });
  });

  describe('Multi-Tenant Isolation Preparation', () => {
    it('should encrypt tenant A OAuth token', () => {
      const tenantAToken = 'tenant_a_access_token_12345';
      const encrypted = service.encrypt(tenantAToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(tenantAToken);
    });

    it('should encrypt tenant B OAuth token independently', () => {
      const tenantBToken = 'tenant_b_access_token_67890';
      const encrypted = service.encrypt(tenantBToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(tenantBToken);
    });

    it('should produce different ciphertexts for different tenant tokens', () => {
      const tenantAToken = 'tenant_a_token';
      const tenantBToken = 'tenant_b_token';

      const encryptedA = service.encrypt(tenantAToken);
      const encryptedB = service.encrypt(tenantBToken);

      // Ciphertexts should be different
      expect(encryptedA).not.toBe(encryptedB);

      // Each should decrypt to correct plaintext
      expect(service.decrypt(encryptedA)).toBe(tenantAToken);
      expect(service.decrypt(encryptedB)).toBe(tenantBToken);
    });
  });
});
