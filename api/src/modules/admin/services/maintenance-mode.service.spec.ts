import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceModeService } from './maintenance-mode.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('MaintenanceModeService', () => {
  let service: MaintenanceModeService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockConfig = {
    id: 'config-123',
    is_enabled: false,
    mode: 'immediate',
    message: 'System maintenance',
    allowed_ips: '192.168.1.1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceModeService,
        {
          provide: PrismaService,
          useValue: {
            maintenance_mode: {
              findFirst: jest.fn(),
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

    service = module.get<MaintenanceModeService>(MaintenanceModeService);
    prismaService = module.get(PrismaService);
  });

  describe('isInMaintenanceMode', () => {
    it('should return false when maintenance disabled', async () => {
      prismaService.maintenance_mode.findFirst.mockResolvedValue(mockConfig);
      const result = await service.isInMaintenanceMode();
      expect(result).toBe(false);
    });

    it('should return true when maintenance enabled', async () => {
      prismaService.maintenance_mode.findFirst.mockResolvedValue({
        ...mockConfig,
        is_enabled: true,
      });
      const result = await service.isInMaintenanceMode();
      expect(result).toBe(true);
    });

    it('should use cache on subsequent calls', async () => {
      prismaService.maintenance_mode.findFirst.mockResolvedValue(mockConfig);
      await service.isInMaintenanceMode();
      await service.isInMaintenanceMode();
      expect(prismaService.maintenance_mode.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateMaintenanceMode', () => {
    it('should update maintenance mode and invalidate cache', async () => {
      prismaService.maintenance_mode.findFirst.mockResolvedValue(mockConfig);
      prismaService.maintenance_mode.update.mockResolvedValue({
        ...mockConfig,
        is_enabled: true,
      });

      const result = await service.updateMaintenanceMode(
        { is_enabled: true },
        'admin-123',
      );

      expect(result.is_enabled).toBe(true);
    });
  });
});
