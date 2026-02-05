import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from '../services/dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { audit_log_status } from '@prisma/client';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: jest.Mocked<DashboardService>;

  const mockRequest = {
    user: { id: 'admin-123', is_platform_admin: true },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getMetrics: jest.fn(),
            getChartData: jest.fn(),
            getRecentActivity: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PlatformAdminGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    dashboardService = module.get(DashboardService);
  });

  describe('getMetrics', () => {
    it('should return dashboard metrics', async () => {
      const mockMetrics = {
        activeTenants: { count: 150, growth: { count: 12, percentage: 8.7, trend: 'up' }, sparkline: [140, 145, 148, 150] },
        totalUsers: { count: 2450, growth: { count: 87, percentage: 3.7, trend: 'up' }, sparkline: [2300, 2350, 2400, 2450] },
        jobSuccessRate: { percentage: 95, totalJobs: 500, failedJobs: 25, status: 'healthy' },
        storageUsed: { current: 250000000000, limit: 500000000000, percentage: 50 },
        systemHealth: { status: 'healthy', checks: { database: true, redis: true } },
        alerts: { unread: 3, critical: 1 },
      };

      dashboardService.getMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(result).toEqual(mockMetrics);
      expect(dashboardService.getMetrics).toHaveBeenCalled();
    });
  });

  describe('getChartData', () => {
    it('should return chart data', async () => {
      const mockChartData = [
        { date: '2025-01-01', count: 10, cumulative: 100 },
        { date: '2025-02-01', count: 15, cumulative: 115 },
        { date: '2025-03-01', count: 20, cumulative: 135 },
      ];

      dashboardService.getChartData.mockResolvedValue(mockChartData);

      const result = await controller.getChartData('tenant-growth');

      expect(result).toEqual(mockChartData);
      expect(dashboardService.getChartData).toHaveBeenCalledWith('tenant-growth', { days: 30 });
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activity', async () => {
      const mockActivity = [
        {
          id: 'log-1',
          action: 'create',
          entity: 'tenant',
          entityId: 'tenant-1',
          description: 'Tenant created',
          actor: { id: 'user-1', name: 'Admin User', email: 'admin@test.com' },
          timestamp: new Date(),
          status: audit_log_status.success,
        },
      ];

      dashboardService.getRecentActivity.mockResolvedValue(mockActivity);

      const result = await controller.getRecentActivity(10);

      expect(result).toEqual(mockActivity);
      expect(dashboardService.getRecentActivity).toHaveBeenCalledWith(10);
    });
  });
});
