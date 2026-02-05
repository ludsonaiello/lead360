import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaService: jest.Mocked<PrismaService>;
  let auditLogger: jest.Mocked<AuditLoggerService>;

  beforeEach(async () => {
    const mockPrismaService = {
      tenant: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        count: jest.fn(),
      },
      scheduled_job: {
        count: jest.fn(),
      },
      file: {
        aggregate: jest.fn(),
      },
      audit_log: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const mockAuditLogger = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prismaService = module.get(PrismaService);
    auditLogger = module.get(AuditLoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('should return all dashboard metrics', async () => {
      // Mock active tenants
      (prismaService.tenant.count as any).mockResolvedValueOnce(150); // current
      (prismaService.tenant.count as any).mockResolvedValueOnce(138); // last month

      // Mock users
      (prismaService.user.count as any).mockResolvedValueOnce(2450); // current
      (prismaService.user.count as any).mockResolvedValueOnce(2363); // last month

      // Mock jobs
      (prismaService.scheduled_job.count as any).mockResolvedValueOnce(500); // total 24h
      (prismaService.scheduled_job.count as any).mockResolvedValueOnce(475); // successful 24h

      // Mock storage
      (prismaService.file.aggregate as any).mockResolvedValueOnce({
        _sum: { file_size_bytes: 250000000000 }, // 250GB
      });

      // Mock sparklines
      prismaService.$queryRaw.mockResolvedValue([
        { day: '2024-01-01', count: 10 },
        { day: '2024-01-02', count: 12 },
      ]);

      const result = await service.getMetrics();

      expect(result).toHaveProperty('activeTenants');
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('jobSuccessRate');
      expect(result).toHaveProperty('storageUsed');
      expect(result).toHaveProperty('systemHealth');
      expect(result).toHaveProperty('alerts');

      expect(result.activeTenants.count).toBe(150);
      expect(result.activeTenants.growth.count).toBe(12);
      expect(result.activeTenants.growth.percentage).toBeCloseTo(8.7, 1);

      expect(result.totalUsers.count).toBe(2450);
      expect(result.jobSuccessRate.percentage).toBe(95);
    });

    it('should handle zero tenants gracefully', async () => {
      prismaService.tenant.count.mockResolvedValue(0);
      prismaService.user.count.mockResolvedValue(0);
      prismaService.scheduled_job.count.mockResolvedValue(0);
      prismaService.file.aggregate.mockResolvedValue({ _sum: { file_size_bytes: 0 } });
      prismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getMetrics();

      expect(result.activeTenants.count).toBe(0);
      expect(result.activeTenants.growth.percentage).toBe(0);
    });
  });

  describe('getActiveTenants', () => {
    it('should count active tenants', async () => {
      prismaService.tenant.count.mockResolvedValue(150);

      const result = await service.getActiveTenants();

      expect(result).toBe(150);
      expect(prismaService.tenant.count).toHaveBeenCalledWith({
        where: { is_active: true, deleted_at: null },
      });
    });
  });

  describe('getTenantsGrowth', () => {
    it('should calculate tenant growth', async () => {
      (prismaService.tenant.count as any).mockResolvedValueOnce(150); // current
      (prismaService.tenant.count as any).mockResolvedValueOnce(138); // last month

      const result = await service.getTenantsGrowth();

      expect(result.count).toBe(12);
      expect(result.percentage).toBeCloseTo(8.7, 1);
      expect(result.trend).toBe('up');
    });

    it('should handle negative growth', async () => {
      (prismaService.tenant.count as any).mockResolvedValueOnce(130); // current
      (prismaService.tenant.count as any).mockResolvedValueOnce(150); // last month

      const result = await service.getTenantsGrowth();

      expect(result.count).toBe(-20);
      expect(result.percentage).toBeCloseTo(-13.3, 1);
      expect(result.trend).toBe('down');
    });

    it('should handle zero previous month', async () => {
      (prismaService.tenant.count as any).mockResolvedValueOnce(10);
      (prismaService.tenant.count as any).mockResolvedValueOnce(0);

      const result = await service.getTenantsGrowth();

      expect(result.percentage).toBe(0);
    });
  });

  describe('getTotalUsers', () => {
    it('should count all users', async () => {
      prismaService.user.count.mockResolvedValue(2450);

      const result = await service.getTotalUsers();

      expect(result).toBe(2450);
      expect(prismaService.user.count).toHaveBeenCalledWith({
        where: { deleted_at: null },
      });
    });
  });

  describe('getJobSuccessRate', () => {
    it('should calculate 24h job success rate', async () => {
      (prismaService.scheduled_job.count as any).mockResolvedValueOnce(500); // total
      (prismaService.scheduled_job.count as any).mockResolvedValueOnce(475); // successful

      const result = await service.getJobSuccessRate();

      expect(result.total).toBe(500);
      expect(result.successful).toBe(475);
      expect(result.failed).toBe(25);
      expect(result.percentage).toBe(95);
    });

    it('should handle zero jobs', async () => {
      prismaService.scheduled_job.count.mockResolvedValue(0);

      const result = await service.getJobSuccessRate();

      expect(result.percentage).toBe(100);
    });
  });

  describe('getStorageUsed', () => {
    it('should calculate total storage', async () => {
      prismaService.file.aggregate.mockResolvedValue({
        _sum: { file_size_bytes: 250000000000 }, // 250GB
      });

      const result = await service.getStorageUsed();

      expect(result.bytes).toBe(250000000000);
      expect(result.gb).toBeCloseTo(232.8, 1);
      expect(result.formatted).toBe('232.8 GB');
    });

    it('should handle null storage', async () => {
      prismaService.file.aggregate.mockResolvedValue({
        _sum: { file_size_bytes: null },
      });

      const result = await service.getStorageUsed();

      expect(result.bytes).toBe(0);
      expect(result.gb).toBe(0);
    });
  });

  describe('getSystemHealth', () => {
    it('should return healthy system status', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const result = await service.getSystemHealth();

      expect(result.database).toBe('healthy');
      expect(result.overall).toBe('healthy');
    });

    it('should detect unhealthy database', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await service.getSystemHealth();

      expect(result.database).toBe('unhealthy');
      expect(result.overall).toBe('unhealthy');
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent audit logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          description: 'Tenant created',
          created_at: new Date(),
          actor_user: { email: 'admin@test.com' },
        },
      ];

      prismaService.audit_log.findMany.mockResolvedValue(mockLogs);

      const result = await service.getRecentActivity(10);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('description');
      expect(prismaService.audit_log.findMany).toHaveBeenCalledWith({
        where: { actor_type: 'platform_admin' },
        take: 10,
        orderBy: { created_at: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('getChartData', () => {
    it('should return tenant growth chart data', async () => {
      const mockData = [
        { day: '2024-01-01', count: 10 },
        { day: '2024-01-02', count: 12 },
      ];

      prismaService.$queryRaw.mockResolvedValue(mockData);

      const result = await service.getChartData('tenant-growth', { days: 30 });

      expect(result.labels).toHaveLength(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toBe(10);
    });
  });
});
