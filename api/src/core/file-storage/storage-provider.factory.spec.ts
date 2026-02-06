import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageProviderFactory } from './storage-provider.factory';
import { PrismaService } from '../database/prisma.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

describe('StorageProviderFactory', () => {
  let factory: StorageProviderFactory;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    storage_config: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('../uploads/public'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageProviderFactory,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    factory = module.get<StorageProviderFactory>(StorageProviderFactory);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProvider', () => {
    it('should return LocalStorageProvider when no config exists', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue(null);

      const provider = await factory.getProvider('tenant-123');

      expect(provider).toBeInstanceOf(LocalStorageProvider);
      expect(provider.getProviderType()).toBe('local');
    });

    it('should return LocalStorageProvider when config has local provider', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue({
        storage_provider: 'local',
      });

      const provider = await factory.getProvider('tenant-123');

      expect(provider).toBeInstanceOf(LocalStorageProvider);
    });

    it('should return S3StorageProvider when config has s3 provider', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue({
        storage_provider: 's3',
        s3_bucket: 'test-bucket',
        s3_access_key_id: 'test-key',
        s3_secret_key: 'test-secret',
        s3_region: 'us-east-1',
      });

      const provider = await factory.getProvider('tenant-123');

      expect(provider).toBeInstanceOf(S3StorageProvider);
      expect(provider.getProviderType()).toBe('s3');
    });

    it('should cache provider instances', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue(null);

      const provider1 = await factory.getProvider('tenant-123');
      const provider2 = await factory.getProvider('tenant-123');

      expect(provider1).toBe(provider2);
      expect(mockPrismaService.storage_config.findUnique).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific tenant', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue(null);

      await factory.getProvider('tenant-123');
      factory.clearCache('tenant-123');
      await factory.getProvider('tenant-123');

      expect(mockPrismaService.storage_config.findUnique).toHaveBeenCalledTimes(
        2,
      );
    });

    it('should clear all caches', async () => {
      mockPrismaService.storage_config.findUnique.mockResolvedValue(null);

      await factory.getProvider('tenant-1');
      await factory.getProvider('tenant-2');
      factory.clearCache();
      await factory.getProvider('tenant-1');
      await factory.getProvider('tenant-2');

      expect(mockPrismaService.storage_config.findUnique).toHaveBeenCalledTimes(
        4,
      );
    });
  });
});
