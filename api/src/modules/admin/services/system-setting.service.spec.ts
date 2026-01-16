import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SystemSettingService } from './system-setting.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('SystemSettingService', () => {
  let service: SystemSettingService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockSetting = {
    id: 'setting-123',
    setting_key: 'max_file_upload_size_mb',
    setting_value: '10',
    data_type: 'integer',
    description: 'Max file upload size',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemSettingService,
        {
          provide: PrismaService,
          useValue: {
            system_setting: {
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

    service = module.get<SystemSettingService>(SystemSettingService);
    prismaService = module.get(PrismaService);
  });

  describe('getSetting', () => {
    it('should return integer setting', async () => {
      prismaService.system_setting.findUnique.mockResolvedValue(mockSetting);
      const result = await service.getSetting('max_file_upload_size_mb');
      expect(result).toBe(10);
      expect(typeof result).toBe('number');
    });

    it('should return boolean setting', async () => {
      prismaService.system_setting.findUnique.mockResolvedValue({
        ...mockSetting,
        setting_value: 'true',
        data_type: 'boolean',
      });
      const result = await service.getSetting('test_key');
      expect(result).toBe(true);
    });

    it('should throw error for non-existent setting', async () => {
      prismaService.system_setting.findUnique.mockResolvedValue(null);
      await expect(service.getSetting('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setSetting', () => {
    it('should update setting value', async () => {
      prismaService.system_setting.findUnique.mockResolvedValue(mockSetting);
      prismaService.system_setting.update.mockResolvedValue({
        ...mockSetting,
        setting_value: '15',
      });

      const result = await service.setSetting('max_file_upload_size_mb', 15, 'admin-123');
      expect(result.setting_value).toBe(15);
    });
  });

  describe('updateSettings', () => {
    it('should bulk update settings', async () => {
      prismaService.system_setting.findUnique.mockResolvedValue(mockSetting);
      prismaService.system_setting.update.mockResolvedValue(mockSetting);

      const result = await service.updateSettings(
        [{ key: 'max_file_upload_size_mb', value: 15 }],
        'admin-123',
      );

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });
  });
});
