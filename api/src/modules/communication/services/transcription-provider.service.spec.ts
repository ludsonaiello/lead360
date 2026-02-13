import { Test, TestingModule } from '@nestjs/testing';
import { TranscriptionProviderService } from './transcription-provider.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TranscriptionProviderService', () => {
  let service: TranscriptionProviderService;
  let prisma: PrismaService;
  let encryption: EncryptionService;

  const mockPrismaService = {
    transcription_provider_configuration: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn((data) => `encrypted:${data}`),
    decrypt: jest.fn((data) => data.replace('encrypted:', '')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptionProviderService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<TranscriptionProviderService>(
      TranscriptionProviderService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    encryption = module.get<EncryptionService>(EncryptionService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('registerProvider', () => {
    it('should register OpenAI Whisper provider successfully', async () => {
      const config = {
        api_key: 'sk-test123',
        model: 'whisper-1',
        language: 'en',
      };

      const expectedProvider = {
        id: 'provider-123',
        provider_name: 'openai_whisper',
        is_system_default: true,
        status: 'active',
        configuration_json: 'encrypted:' + JSON.stringify(config),
        usage_current: 0,
      };

      mockPrismaService.transcription_provider_configuration.updateMany.mockResolvedValue(
        { count: 0 },
      );
      mockPrismaService.transcription_provider_configuration.create.mockResolvedValue(
        expectedProvider,
      );

      // Mock OpenAI API validation
      jest
        .spyOn(service as any, 'validateOpenAIWhisperConfig')
        .mockResolvedValue(undefined);

      const result = await service.registerProvider(
        'openai_whisper',
        config,
        null,
        true,
      );

      expect(result).toEqual(expectedProvider);
      expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify(config));
      expect(
        mockPrismaService.transcription_provider_configuration.create,
      ).toHaveBeenCalledWith({
        data: {
          tenant_id: null,
          provider_name: 'openai_whisper',
          is_system_default: true,
          status: 'active',
          configuration_json: 'encrypted:' + JSON.stringify(config),
          usage_current: 0,
        },
      });
    });

    it('should disable previous system default when registering new system default', async () => {
      const config = { api_key: 'sk-test123' };

      mockPrismaService.transcription_provider_configuration.updateMany.mockResolvedValue(
        { count: 1 },
      );
      mockPrismaService.transcription_provider_configuration.create.mockResolvedValue(
        { id: 'new-provider' },
      );

      jest
        .spyOn(service as any, 'validateOpenAIWhisperConfig')
        .mockResolvedValue(undefined);

      await service.registerProvider('openai_whisper', config, null, true);

      expect(
        mockPrismaService.transcription_provider_configuration.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          is_system_default: true,
          tenant_id: null,
        },
        data: {
          is_system_default: false,
        },
      });
    });

    it('should throw BadRequestException for invalid provider', async () => {
      await expect(
        service.registerProvider('invalid_provider', {}, null, false),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getActiveProvider', () => {
    it('should return tenant-specific provider if available', async () => {
      const tenantProvider = {
        id: 'tenant-provider-123',
        provider_name: 'openai_whisper',
        tenant_id: 'tenant-123',
      };

      mockPrismaService.transcription_provider_configuration.findFirst.mockResolvedValueOnce(
        tenantProvider,
      );

      const result = await service.getActiveProvider('tenant-123');

      expect(result).toEqual(tenantProvider);
      expect(
        mockPrismaService.transcription_provider_configuration.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-123',
          status: 'active',
        },
      });
    });

    it('should fallback to system default if no tenant provider', async () => {
      const systemProvider = {
        id: 'system-provider-123',
        provider_name: 'openai_whisper',
        is_system_default: true,
      };

      mockPrismaService.transcription_provider_configuration.findFirst
        .mockResolvedValueOnce(null) // No tenant provider
        .mockResolvedValueOnce(systemProvider); // System default

      const result = await service.getActiveProvider('tenant-123');

      expect(result).toEqual(systemProvider);
    });

    it('should throw NotFoundException if no provider available', async () => {
      mockPrismaService.transcription_provider_configuration.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(service.getActiveProvider('tenant-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDecryptedConfig', () => {
    it('should return provider with decrypted configuration', async () => {
      const config = { api_key: 'sk-test123' };
      const provider = {
        id: 'provider-123',
        provider_name: 'openai_whisper',
        configuration_json: 'encrypted:' + JSON.stringify(config),
      };

      mockPrismaService.transcription_provider_configuration.findUnique.mockResolvedValue(
        provider,
      );

      const result = await service.getDecryptedConfig('provider-123');

      expect(result.provider).toEqual(provider);
      expect(result.config).toEqual(config);
      expect(encryption.decrypt).toHaveBeenCalledWith(
        provider.configuration_json,
      );
    });

    it('should throw NotFoundException if provider not found', async () => {
      mockPrismaService.transcription_provider_configuration.findUnique.mockResolvedValue(
        null,
      );

      await expect(service.getDecryptedConfig('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage counter', async () => {
      mockPrismaService.transcription_provider_configuration.update.mockResolvedValue(
        { id: 'provider-123', usage_current: 1 },
      );

      await service.incrementUsage('provider-123');

      expect(
        mockPrismaService.transcription_provider_configuration.update,
      ).toHaveBeenCalledWith({
        where: { id: 'provider-123' },
        data: {
          usage_current: {
            increment: 1,
          },
        },
      });
    });
  });

  describe('hasExceededUsageLimit', () => {
    it('should return false if no limit set', async () => {
      mockPrismaService.transcription_provider_configuration.findUnique.mockResolvedValue(
        {
          usage_limit: null,
          usage_current: 100,
        },
      );

      const result = await service.hasExceededUsageLimit('provider-123');

      expect(result).toBe(false);
    });

    it('should return true if usage exceeds limit', async () => {
      mockPrismaService.transcription_provider_configuration.findUnique.mockResolvedValue(
        {
          usage_limit: 100,
          usage_current: 150,
        },
      );

      const result = await service.hasExceededUsageLimit('provider-123');

      expect(result).toBe(true);
    });

    it('should return false if usage below limit', async () => {
      mockPrismaService.transcription_provider_configuration.findUnique.mockResolvedValue(
        {
          usage_limit: 100,
          usage_current: 50,
        },
      );

      const result = await service.hasExceededUsageLimit('provider-123');

      expect(result).toBe(false);
    });

    it('should throw NotFoundException if provider not found', async () => {
      mockPrismaService.transcription_provider_configuration.findUnique.mockResolvedValue(
        null,
      );

      await expect(service.hasExceededUsageLimit('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resetMonthlyUsage', () => {
    it('should reset usage counters for all providers', async () => {
      mockPrismaService.transcription_provider_configuration.updateMany.mockResolvedValue(
        { count: 5 },
      );

      const result = await service.resetMonthlyUsage();

      expect(result.count).toBe(5);
      expect(
        mockPrismaService.transcription_provider_configuration.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          usage_current: {
            gt: 0,
          },
        },
        data: {
          usage_current: 0,
        },
      });
    });
  });

  describe('updateProviderStatus', () => {
    it('should update provider status', async () => {
      const updatedProvider = {
        id: 'provider-123',
        status: 'inactive',
      };

      mockPrismaService.transcription_provider_configuration.update.mockResolvedValue(
        updatedProvider,
      );

      const result = await service.updateProviderStatus(
        'provider-123',
        'inactive',
      );

      expect(result).toEqual(updatedProvider);
      expect(
        mockPrismaService.transcription_provider_configuration.update,
      ).toHaveBeenCalledWith({
        where: { id: 'provider-123' },
        data: { status: 'inactive' },
      });
    });
  });

  describe('listProviders', () => {
    it('should list providers for tenant including system defaults', async () => {
      const providers = [
        { id: 'system-1', is_system_default: true },
        { id: 'tenant-1', tenant_id: 'tenant-123' },
      ];

      mockPrismaService.transcription_provider_configuration.findMany.mockResolvedValue(
        providers,
      );

      const result = await service.listProviders('tenant-123');

      expect(result).toEqual(providers);
      expect(
        mockPrismaService.transcription_provider_configuration.findMany,
      ).toHaveBeenCalledWith({
        where: {
          OR: [{ is_system_default: true }, { tenant_id: 'tenant-123' }],
        },
        select: expect.any(Object),
        orderBy: [{ is_system_default: 'desc' }, { created_at: 'desc' }],
      });
    });
  });
});
