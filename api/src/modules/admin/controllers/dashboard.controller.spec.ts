import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from '../services/dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';

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
        activeTenants: { count: 150, growth: { count: 12, percentage: 8.7, trend: 'up' } },
        totalUsers: { count: 2450, growth: { count: 87, percentage: 3.7, trend: 'up' } },
        jobSuccessRate: { total: 500, successful: 475, failed: 25, percentage: 95 },
        storageUsed: { bytes: 250000000000, gb: 232.8, formatted: '232.8 GB' },
        systemHealth: { database: 'healthy', redis: 'healthy', overall: 'healthy' },
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
      const mockChartData = {
        labels: ['Jan', 'Feb', 'Mar'],
        data: [10, 15, 20],
      };

      dashboardService.getChartData.mockResolvedValue(mockChartData);

      const result = await controller.getChartData('tenant-growth', { days: 30 });

      expect(result).toEqual(mockChartData);
      expect(dashboardService.getChartData).toHaveBeenCalledWith('tenant-growth', { days: 30 });
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activity', async () => {
      const mockActivity = [
        {
          id: 'log-1',
          description: 'Tenant created',
          created_at: new Date(),
          actor_user: { email: 'admin@test.com' },
        },
      ];

      dashboardService.getRecentActivity.mockResolvedValue(mockActivity);

      const result = await controller.getRecentActivity({ limit: 10 });

      expect(result).toEqual(mockActivity);
      expect(dashboardService.getRecentActivity).toHaveBeenCalledWith(10);
    });
  });
});
