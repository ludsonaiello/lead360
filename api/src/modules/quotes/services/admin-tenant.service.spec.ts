import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminTenantService } from './admin-tenant.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

describe('AdminTenantService', () => {
  let service: AdminTenantService;
  let prismaService: PrismaService;
  let cacheService: CacheService;

  const mockTenants = [
    {
      id: 'tenant-1',
      company_name: 'Acme Roofing',
      subdomain: 'acme-roofing',
      subscription_status: 'active',
      created_at: new Date('2024-01-01'),
      quotes: [
        {
          id: 'quote-1',
          status: 'approved',
          total: 10000,
          created_at: new Date('2024-01-15'),
        },
        {
          id: 'quote-2',
          status: 'sent',
          total: 5000,
          created_at: new Date('2024-01-20'),
        },
      ],
    },
    {
      id: 'tenant-2',
      company_name: 'Beta Construction',
      subdomain: 'beta-construction',
      subscription_status: 'trial',
      created_at: new Date('2024-01-05'),
      quotes: [
        {
          id: 'quote-3',
          status: 'draft',
          total: 3000,
          created_at: new Date('2024-01-10'),
        },
      ],
    },
  ];

  const mockAuditLogs = [
    {
      created_at: new Date('2024-01-15T10:30:00.000Z'),
      action_type: 'quote_created',
      description: 'Quote Q-001 created',
      metadata_json: '{"quote_id":"quote-1","quote_number":"Q-001"}',
      user: { first_name: 'John', last_name: 'Doe' },
    },
    {
      created_at: new Date('2024-01-15T14:20:00.000Z'),
      action_type: 'quote_sent',
      description: 'Quote Q-001 sent to customer',
      metadata_json: '{"quote_id":"quote-1"}',
      user: { first_name: 'John', last_name: 'Doe' },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTenantService,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            quote: {
              findMany: jest.fn(),
            },
            quote_item: {
              groupBy: jest.fn(),
            },
            audit_log: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminTenantService>(AdminTenantService);
    prismaService = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listTenantsWithQuoteActivity', () => {
    it('should return paginated list of tenants with stats', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'count').mockResolvedValue(2);
      jest
        .spyOn(prismaService.tenant, 'findMany')
        .mockResolvedValue(mockTenants);

      const result = await service.listTenantsWithQuoteActivity(
        { status: 'active' },
        { page: 1, limit: 50 },
      );

      expect(result.tenants).toBeDefined();
      expect(result.tenants.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(2);
      expect(result.summary).toBeDefined();
    });

    it('should filter by subscription status', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'count').mockResolvedValue(1);
      jest
        .spyOn(prismaService.tenant, 'findMany')
        .mockResolvedValue([mockTenants[0]]);

      await service.listTenantsWithQuoteActivity(
        { status: 'active' },
        { page: 1, limit: 50 },
      );

      expect(prismaService.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscription_status: 'active',
          }),
        }),
      );
    });

    it('should search by company name', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'count').mockResolvedValue(1);
      jest
        .spyOn(prismaService.tenant, 'findMany')
        .mockResolvedValue([mockTenants[0]]);

      await service.listTenantsWithQuoteActivity(
        { status: 'active', search: 'acme' },
        { page: 1, limit: 50 },
      );

      expect(prismaService.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ company_name: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });

    it('should calculate quote_stats correctly', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'count').mockResolvedValue(1);
      jest
        .spyOn(prismaService.tenant, 'findMany')
        .mockResolvedValue([mockTenants[0]]);

      const result = await service.listTenantsWithQuoteActivity(
        { status: 'active' },
        { page: 1, limit: 50 },
      );

      expect(result.tenants[0].quote_stats).toBeDefined();
      expect(result.tenants[0].quote_stats.total_quotes).toBe(2);
      expect(result.tenants[0].quote_stats.total_revenue).toBeGreaterThan(0);
    });

    it('should use cache when available', async () => {
      const cachedData = { tenants: [], pagination: {}, summary: {} };
      jest.spyOn(cacheService, 'get').mockResolvedValue(cachedData);

      const result = await service.listTenantsWithQuoteActivity(
        { status: 'active' },
        { page: 1, limit: 50 },
      );

      expect(result).toEqual(cachedData);
      expect(prismaService.tenant.findMany).not.toHaveBeenCalled();
    });

    it('should sort by revenue when specified', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'count').mockResolvedValue(2);
      jest
        .spyOn(prismaService.tenant, 'findMany')
        .mockResolvedValue(mockTenants);

      const result = await service.listTenantsWithQuoteActivity(
        { status: 'active', sortBy: 'revenue' },
        { page: 1, limit: 50 },
      );

      expect(result.tenants).toBeDefined();
      // First tenant should have higher revenue
      if (result.tenants.length > 1) {
        expect(
          result.tenants[0].quote_stats.total_revenue,
        ).toBeGreaterThanOrEqual(result.tenants[1].quote_stats.total_revenue);
      }
    });
  });

  describe('getTenantQuoteStatistics', () => {
    it('should return statistics for existing tenant', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
      });
      jest
        .spyOn(prismaService.quote, 'findMany')
        .mockResolvedValueOnce(mockTenants[0].quotes)
        .mockResolvedValueOnce([]);
      jest.spyOn(prismaService.quote_item, 'groupBy').mockResolvedValue([
        {
          title: 'Roof Installation',
          _count: { id: 10 },
          _avg: { total_cost: 5000 },
        },
      ]);

      const result = await service.getTenantQuoteStatistics('tenant-1');

      expect(result).toBeDefined();
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.statistics).toBeDefined();
      expect(result.statistics.total_quotes).toBe(2);
      expect(result.trends).toBeDefined();
    });

    it('should throw NotFoundException for invalid tenant', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getTenantQuoteStatistics('invalid-tenant-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate quotes_by_status correctly', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
      });
      jest
        .spyOn(prismaService.quote, 'findMany')
        .mockResolvedValueOnce(mockTenants[0].quotes)
        .mockResolvedValueOnce([]);
      jest.spyOn(prismaService.quote_item, 'groupBy').mockResolvedValue([]);

      const result = await service.getTenantQuoteStatistics('tenant-1');

      expect(result.statistics.quotes_by_status).toBeDefined();
      expect(result.statistics.quotes_by_status.draft).toBeDefined();
      expect(result.statistics.quotes_by_status.sent).toBeDefined();
      expect(result.statistics.quotes_by_status.accepted).toBeDefined();
    });

    it('should use cache when available', async () => {
      const cachedData = { tenant_id: 'tenant-1', statistics: {}, trends: {} };
      jest.spyOn(cacheService, 'get').mockResolvedValue(cachedData);

      const result = await service.getTenantQuoteStatistics('tenant-1');

      expect(result).toEqual(cachedData);
      expect(prismaService.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('compareTenantsByMetric', () => {
    it('should rank tenants by revenue', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest
        .spyOn(prismaService.tenant, 'findMany')
        .mockResolvedValue(mockTenants);

      const result = await service.compareTenantsByMetric('revenue', 10);

      expect(result).toBeDefined();
      expect(result.metric).toBe('revenue');
      expect(result.rankings).toBeDefined();
      expect(result.rankings.length).toBeGreaterThan(0);
      expect(result.rankings[0].rank).toBe(1);
    });

    it('should include supplementary metrics', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest
        .spyOn(prismaService.tenant, 'findMany')
        .mockResolvedValue(mockTenants);

      const result = await service.compareTenantsByMetric('revenue', 10);

      expect(result.rankings[0].supplementary).toBeDefined();
      expect(result.rankings[0].supplementary.quote_count).toBeDefined();
      expect(result.rankings[0].supplementary.conversion_rate).toBeDefined();
      expect(result.rankings[0].supplementary.avg_quote_value).toBeDefined();
    });

    it('should calculate platform average and median', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest
        .spyOn(prismaService.tenant, 'findMany')
        .mockResolvedValue(mockTenants);

      const result = await service.compareTenantsByMetric('revenue', 10);

      expect(result.summary).toBeDefined();
      expect(result.summary.total_tenants).toBe(2);
      expect(result.summary.metric_average).toBeDefined();
      expect(result.summary.metric_median).toBeDefined();
    });

    it('should limit results to specified limit', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest
        .spyOn(prismaService.tenant, 'findMany')
        .mockResolvedValue(mockTenants);

      const result = await service.compareTenantsByMetric('revenue', 1);

      expect(result.rankings.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getTenantActivityTimeline', () => {
    it('should return activity events for tenant', async () => {
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
      });
      jest
        .spyOn(prismaService.audit_log, 'findMany')
        .mockResolvedValue(mockAuditLogs);

      const result = await service.getTenantActivityTimeline('tenant-1');

      expect(result).toBeDefined();
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.activities).toBeDefined();
      expect(result.activities.length).toBe(2);
    });

    it('should throw NotFoundException for invalid tenant', async () => {
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getTenantActivityTimeline('invalid-tenant-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate most_active_user', async () => {
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
      });
      jest
        .spyOn(prismaService.audit_log, 'findMany')
        .mockResolvedValue(mockAuditLogs);

      const result = await service.getTenantActivityTimeline('tenant-1');

      expect(result.summary.most_active_user).toBe('John Doe');
    });

    it('should handle empty audit log', async () => {
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
      });
      jest.spyOn(prismaService.audit_log, 'findMany').mockResolvedValue([]);

      const result = await service.getTenantActivityTimeline('tenant-1');

      expect(result.activities).toEqual([]);
      expect(result.summary.most_active_user).toBe('N/A');
      expect(result.summary.busiest_day).toBe('N/A');
    });

    it('should NOT use cache (real-time data)', async () => {
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
      });
      jest
        .spyOn(prismaService.audit_log, 'findMany')
        .mockResolvedValue(mockAuditLogs);

      await service.getTenantActivityTimeline('tenant-1');

      // Cache should not be checked for activity timeline
      expect(cacheService.get).not.toHaveBeenCalled();
    });
  });

  describe('getTenantConfiguration', () => {
    it('should return configuration for existing tenant', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
        active_quote_template_id: 'template-1',
        default_profit_margin: 15.5,
        default_overhead_rate: 10.0,
        default_quote_validity_days: 30,
        approval_thresholds: [{ threshold: 10000 }],
        active_quote_template: { name: 'Professional Template' },
        unit_measurements: [{ id: 'unit-1' }, { id: 'unit-2' }],
        quote_templates: [{ id: 'template-1' }],
      });

      const result = await service.getTenantConfiguration('tenant-1');

      expect(result).toBeDefined();
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.quote_configuration).toBeDefined();
      expect(result.custom_resources).toBeDefined();
      expect(result.feature_flags).toBeDefined();
    });

    it('should throw NotFoundException for invalid tenant', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getTenantConfiguration('invalid-tenant-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle null template', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
        active_quote_template_id: null,
        default_profit_margin: null,
        default_overhead_rate: null,
        default_quote_validity_days: 30,
        approval_thresholds: null,
        active_quote_template: null,
        unit_measurements: [],
        quote_templates: [],
      });

      const result = await service.getTenantConfiguration('tenant-1');

      expect(result.quote_configuration.active_template_name).toBeNull();
    });

    it('should count custom units correctly', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
        active_quote_template_id: null,
        default_profit_margin: null,
        default_overhead_rate: null,
        default_quote_validity_days: 30,
        approval_thresholds: null,
        active_quote_template: null,
        unit_measurements: [
          { id: 'unit-1' },
          { id: 'unit-2' },
          { id: 'unit-3' },
        ],
        quote_templates: [{ id: 'template-1' }],
      });

      const result = await service.getTenantConfiguration('tenant-1');

      expect(result.custom_resources.custom_units).toBe(3);
      expect(result.custom_resources.custom_templates).toBe(1);
    });

    it('should map default_overhead_rate to default_overhead', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.tenant, 'findUnique').mockResolvedValue({
        id: 'tenant-1',
        company_name: 'Acme Roofing',
        active_quote_template_id: null,
        default_profit_margin: null,
        default_overhead_rate: 12.5,
        default_quote_validity_days: 30,
        approval_thresholds: null,
        active_quote_template: null,
        unit_measurements: [],
        quote_templates: [],
      });

      const result = await service.getTenantConfiguration('tenant-1');

      expect(result.quote_configuration.default_overhead).toBe(12.5);
    });
  });

  describe('Helper Methods', () => {
    describe('validateDateRange', () => {
      it('should throw error if dateFrom > dateTo', () => {
        const dateFrom = new Date('2024-02-01');
        const dateTo = new Date('2024-01-01');

        expect(() => {
          service['validateDateRange'](dateFrom, dateTo);
        }).toThrow(BadRequestException);
      });

      it('should throw error if dateTo in future', () => {
        const dateFrom = new Date('2024-01-01');
        const dateTo = new Date('2030-01-01');

        expect(() => {
          service['validateDateRange'](dateFrom, dateTo);
        }).toThrow(BadRequestException);
      });

      it('should throw error if range > 365 days', () => {
        const dateFrom = new Date('2023-01-01');
        const dateTo = new Date('2024-01-15');

        expect(() => {
          service['validateDateRange'](dateFrom, dateTo);
        }).toThrow(BadRequestException);
      });

      it('should pass for valid range', () => {
        const dateFrom = new Date('2024-01-01');
        const dateTo = new Date('2024-01-31');

        expect(() => {
          service['validateDateRange'](dateFrom, dateTo);
        }).not.toThrow();
      });
    });

    describe('calculateConversionRate', () => {
      it('should return 0 if denominator is 0', () => {
        const result = service['calculateConversionRate'](5, 0);
        expect(result).toBe(0);
      });

      it('should calculate percentage correctly', () => {
        const result = service['calculateConversionRate'](25, 100);
        expect(result).toBe(25);
      });

      it('should handle decimal results', () => {
        const result = service['calculateConversionRate'](1, 3);
        expect(result).toBeCloseTo(33.33, 1);
      });
    });

    describe('calculateMedian', () => {
      it('should return 0 for empty array', () => {
        const result = service['calculateMedian']([]);
        expect(result).toBe(0);
      });

      it('should calculate median for odd-length array', () => {
        const result = service['calculateMedian']([1, 2, 3, 4, 5]);
        expect(result).toBe(3);
      });

      it('should calculate median for even-length array', () => {
        const result = service['calculateMedian']([1, 2, 3, 4]);
        expect(result).toBe(2.5);
      });

      it('should handle unsorted arrays', () => {
        const result = service['calculateMedian']([5, 1, 3, 2, 4]);
        expect(result).toBe(3);
      });
    });
  });
});
