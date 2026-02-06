import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockFlag = {
    id: 'flag-123',
    flag_key: 'user_registration',
    name: 'User Registration',
    description: 'Allow new tenant signups',
    is_enabled: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        {
          provide: PrismaService,
          useValue: {
            feature_flag: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: AuditLoggerService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<FeatureFlagService>(FeatureFlagService);
    prismaService = module.get(PrismaService);
  });

  describe('isEnabled', () => {
    it('should return flag status with caching', async () => {
      prismaService.feature_flag.findUnique.mockResolvedValue(mockFlag);

      const result = await service.isEnabled('user_registration');
      expect(result).toBe(true);

      // Second call should use cache
      const result2 = await service.isEnabled('user_registration');
      expect(result2).toBe(true);
      expect(prismaService.feature_flag.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return false for non-existent flag', async () => {
      prismaService.feature_flag.findUnique.mockResolvedValue(null);
      const result = await service.isEnabled('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('toggleFlag', () => {
    it('should toggle flag and invalidate cache', async () => {
      prismaService.feature_flag.findUnique.mockResolvedValue(mockFlag);
      prismaService.feature_flag.update.mockResolvedValue({
        ...mockFlag,
        is_enabled: false,
      });

      const result = await service.toggleFlag('user_registration', 'admin-123');
      expect(result.is_enabled).toBe(false);
    });

    it('should throw error if flag not found', async () => {
      prismaService.feature_flag.findUnique.mockResolvedValue(null);
      await expect(service.toggleFlag('invalid', 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
