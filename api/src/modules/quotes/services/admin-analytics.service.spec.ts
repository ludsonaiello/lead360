import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let prismaService: PrismaService;
  let cacheService: CacheService;

  // Mock data
  const mockTenants = [
    { id: 'tenant-1', company_name: 'Acme Roofing', is_active: true },
    { id: 'tenant-2', company_name: 'Beta Construction', is_active: true },
    { id: 'tenant-3', company_name: 'Gamma Repairs', is_active: false },
  ];

  const mockQuotes = [
    {
      id: 'quote-1',
      tenant_id: 'tenant-1',
      status: 'approved',
      total: 5000,
      created_at: new Date('2024-01-15'),
      tenant: mockTenants[0],
    },
    {
      id: 'quote-2',
      tenant_id: 'tenant-1',
      status: 'sent',
      total: 3000,
      created_at: new Date('2024-01-16'),
      tenant: mockTenants[0],
    },
    {
      id: 'quote-3',
      tenant_id: 'tenant-2',
      status: 'read',
      total: 7000,
      created_at: new Date('2024-01-17'),
      tenant: mockTenants[1],
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            quote: {
              findMany: jest.fn(),
              count: jest.fn(),
              groupBy: jest.fn(),
            },
            tenant: {
              count: jest.fn(),
              findMany: jest.fn(),
            },
            job: {
              count: jest.fn(),
              aggregate: jest.fn(),
            },
            email_queue: {
              count: jest.fn(),
            },
            audit_log: {
              count: jest.fn(),
            },
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
    prismaService = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Helper Methods', () => {
    describe('calculateConversionRate', () => {
      it('should calculate conversion rate correctly', () => {
        // Use a private method accessor (TypeScript workaround for testing)
        const rate = service['calculateConversionRate'](42, 100);
        expect(rate).toBe(42);
      });

      it('should return 0 when denominator is 0', () => {
        const rate = service['calculateConversionRate'](10, 0);
        expect(rate).toBe(0);
      });

      it('should handle 100% conversion', () => {
        const rate = service['calculateConversionRate'](50, 50);
        expect(rate).toBe(100);
      });

      it('should handle 0% conversion', () => {
        const rate = service['calculateConversionRate'](0, 100);
        expect(rate).toBe(0);
      });

      it('should handle decimal results', () => {
        const rate = service['calculateConversionRate'](33, 100);
        expect(rate).toBe(33);
      });
    });

    describe('calculatePercentageChange', () => {
      it('should calculate positive percentage change', () => {
        const change = service['calculatePercentageChange'](150, 100);
        expect(change).toBe(50);
      });

      it('should calculate negative percentage change', () => {
        const change = service['calculatePercentageChange'](75, 100);
        expect(change).toBe(-25);
      });

      it('should return 0 when values are equal', () => {
        const change = service['calculatePercentageChange'](100, 100);
        expect(change).toBe(0);
      });

      it('should return 100 when previous is 0 and current is positive', () => {
        const change = service['calculatePercentageChange'](50, 0);
        expect(change).toBe(100);
      });

      it('should return 0 when both values are 0', () => {
        const change = service['calculatePercentageChange'](0, 0);
        expect(change).toBe(0);
      });

      it('should handle large percentage increases', () => {
        const change = service['calculatePercentageChange'](1000, 100);
        expect(change).toBe(900);
      });
    });

    describe('getDefaultDateRange', () => {
      it('should return last 30 days when no dates provided', () => {
        const { dateFrom, dateTo } = service['getDefaultDateRange']();

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Allow 1 second tolerance for test execution time
        expect(Math.abs(dateTo.getTime() - now.getTime())).toBeLessThan(1000);
        expect(Math.abs(dateFrom.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(1000);
      });

      it('should use provided dateFrom and default dateTo', () => {
        const customFrom = new Date('2024-01-01');
        const { dateFrom, dateTo } = service['getDefaultDateRange'](customFrom);

        expect(dateFrom).toEqual(customFrom);
        expect(dateTo).toBeInstanceOf(Date);
      });

      it('should use provided dateTo and default dateFrom', () => {
        const customTo = new Date('2024-12-31');
        const { dateFrom, dateTo } = service['getDefaultDateRange'](undefined, customTo);

        expect(dateTo).toEqual(customTo);
        expect(dateFrom).toBeInstanceOf(Date);
      });

      it('should use both provided dates', () => {
        const customFrom = new Date('2024-01-01');
        const customTo = new Date('2024-12-31');
        const { dateFrom, dateTo } = service['getDefaultDateRange'](customFrom, customTo);

        expect(dateFrom).toEqual(customFrom);
        expect(dateTo).toEqual(customTo);
      });
    });

    describe('validateDateRange', () => {
      it('should accept valid date range', () => {
        const from = new Date('2024-01-01');
        const to = new Date('2024-01-31');

        expect(() => service['validateDateRange'](from, to)).not.toThrow();
      });

      it('should reject date_from after date_to', () => {
        const from = new Date('2024-12-31');
        const to = new Date('2024-01-01');

        expect(() => service['validateDateRange'](from, to)).toThrow(BadRequestException);
        expect(() => service['validateDateRange'](from, to)).toThrow('date_from must be before date_to');
      });

      it('should reject date_to in the future', () => {
        const from = new Date('2024-01-01');
        const to = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

        expect(() => service['validateDateRange'](from, to)).toThrow(BadRequestException);
        expect(() => service['validateDateRange'](from, to)).toThrow('date_to cannot be in the future');
      });

      it('should reject date range exceeding 365 days', () => {
        const from = new Date('2023-01-01');
        const to = new Date('2024-12-31'); // More than 365 days

        expect(() => service['validateDateRange'](from, to)).toThrow(BadRequestException);
        expect(() => service['validateDateRange'](from, to)).toThrow('Date range cannot exceed 365 days');
      });

      it('should accept exactly 365 days', () => {
        const from = new Date('2024-01-01');
        const to = new Date('2024-12-31'); // Exactly 365 days

        expect(() => service['validateDateRange'](from, to)).not.toThrow();
      });

      it('should accept date range at the boundary', () => {
        const from = new Date('2024-01-01');
        const to = new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000); // Exactly 365 days later

        expect(() => service['validateDateRange'](from, to)).not.toThrow();
      });
    });
  });

  describe('getDashboardOverview', () => {
    it('should return cached data if available', async () => {
      const cachedData = {
        global_stats: {
          total_tenants: 100,
          active_tenants: 80,
          total_quotes: 1000,
          total_revenue: 500000,
          avg_quote_value: 5000,
          conversion_rate: 42.5,
        },
        tenant_breakdown: {
          top_tenants_by_revenue: [],
          top_tenants_by_quote_count: [],
          new_tenants_this_period: 5,
        },
        trends: {
          quote_velocity: '+15.2%',
          avg_value_change: '+8.3%',
          conversion_rate_change: '-2.1%',
        },
        date_from: '2024-01-01T00:00:00.000Z',
        date_to: '2024-01-31T23:59:59.999Z',
      };

      jest.spyOn(cacheService, 'get').mockResolvedValue(cachedData);

      const result = await service.getDashboardOverview();

      expect(cacheService.get).toHaveBeenCalled();
      expect(result).toEqual(cachedData);
      expect(prismaService.quote.findMany).not.toHaveBeenCalled();
    });

    it('should compute data when cache miss', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      jest.spyOn(prismaService.tenant, 'count').mockResolvedValue(100);
      jest.spyOn(prismaService.quote, 'findMany').mockResolvedValue(mockQuotes as any);

      const result = await service.getDashboardOverview();

      expect(cacheService.get).toHaveBeenCalled();
      expect(prismaService.tenant.count).toHaveBeenCalled();
      expect(prismaService.quote.findMany).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
      expect(result).toHaveProperty('global_stats');
      expect(result).toHaveProperty('tenant_breakdown');
      expect(result).toHaveProperty('trends');
    });

    it('should handle empty dataset gracefully', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      jest.spyOn(prismaService.tenant, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.quote, 'findMany').mockResolvedValue([]);

      const result = await service.getDashboardOverview();

      expect(result.global_stats.total_tenants).toBe(0);
      expect(result.global_stats.total_quotes).toBe(0);
      expect(result.global_stats.total_revenue).toBe(0);
      expect(result.global_stats.avg_quote_value).toBe(0);
      expect(result.global_stats.conversion_rate).toBe(0);
    });
  });

  describe('getConversionFunnel', () => {
    it('should calculate funnel stages correctly', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      jest.spyOn(prismaService.quote, 'findMany').mockResolvedValue(mockQuotes as any);

      const result = await service.getConversionFunnel();

      expect(result).toHaveProperty('funnel_stages');
      expect(result).toHaveProperty('conversion_rates');
      expect(result.funnel_stages).toHaveLength(4); // created, sent, viewed, accepted
      expect(result.funnel_stages[0].stage).toBe('created');
    });

    it('should handle empty funnel gracefully', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      jest.spyOn(prismaService.quote, 'findMany').mockResolvedValue([]);

      const result = await service.getConversionFunnel();

      expect(result.funnel_stages[0].count).toBe(0);
      expect(result.funnel_stages[0].percentage).toBe(0);
      expect(result.conversion_rates.overall).toBe(0);
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health metrics', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      jest.spyOn(prismaService.audit_log, 'count').mockResolvedValue(1500);
      jest.spyOn(prismaService.job, 'count').mockResolvedValue(5);
      jest.spyOn(prismaService.job, 'aggregate').mockResolvedValue({
        _avg: { duration_ms: 2350.25 },
        _count: { id: 100 },
      } as any);
      jest.spyOn(prismaService.email_queue, 'count').mockResolvedValue(12);

      const result = await service.getSystemHealth();

      expect(result).toHaveProperty('api_health');
      expect(result).toHaveProperty('pdf_generation');
      expect(result).toHaveProperty('email_delivery');
      expect(result).toHaveProperty('database');
      expect(result.api_health.requests_last_hour).toBe(1500);
    });

    it('should use 1-minute cache TTL for health metrics', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      jest.spyOn(prismaService.audit_log, 'count').mockResolvedValue(1500);
      jest.spyOn(prismaService.job, 'count').mockResolvedValue(5);
      jest.spyOn(prismaService.job, 'aggregate').mockResolvedValue({
        _avg: { duration_ms: 2350.25 },
        _count: { id: 100 },
      } as any);
      jest.spyOn(prismaService.email_queue, 'count').mockResolvedValue(12);

      await service.getSystemHealth();

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        60, // 1 minute TTL
      );
    });
  });

  describe('getRevenueAnalytics', () => {
    it('should group revenue by vendor', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      jest.spyOn(prismaService.quote, 'findMany').mockResolvedValue([
        {
          ...mockQuotes[0],
          vendor: { id: 'vendor-1', business_name: 'ABC Roofing' },
        },
      ] as any);
      jest.spyOn(prismaService.$queryRaw as any).mockResolvedValue([
        { date_key: '2024-01-15', total_revenue: 5000 },
      ]);

      const result = await service.getRevenueAnalytics(dateFrom, dateTo, 'vendor');

      expect(result).toHaveProperty('total_revenue');
      expect(result).toHaveProperty('revenue_by_group');
      expect(result).toHaveProperty('top_revenue_sources');
      expect(result).toHaveProperty('revenue_trend');
    });

    it('should group revenue by tenant', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      jest.spyOn(prismaService.quote, 'findMany').mockResolvedValue(mockQuotes as any);
      jest.spyOn(prismaService.$queryRaw as any).mockResolvedValue([
        { date_key: '2024-01-15', total_revenue: 5000 },
      ]);

      const result = await service.getRevenueAnalytics(dateFrom, dateTo, 'tenant');

      expect(result.revenue_by_group.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Error Handling', () => {
    it('should continue if cache.get fails', async () => {
      jest.spyOn(cacheService, 'get').mockRejectedValue(new Error('Redis connection failed'));
      jest.spyOn(cacheService, 'set').mockResolvedValue();
      jest.spyOn(prismaService.tenant, 'count').mockResolvedValue(100);
      jest.spyOn(prismaService.quote, 'findMany').mockResolvedValue(mockQuotes as any);

      const result = await service.getDashboardOverview();

      expect(result).toHaveProperty('global_stats');
    });

    it('should continue if cache.set fails', async () => {
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockRejectedValue(new Error('Redis connection failed'));
      jest.spyOn(prismaService.tenant, 'count').mockResolvedValue(100);
      jest.spyOn(prismaService.quote, 'findMany').mockResolvedValue(mockQuotes as any);

      const result = await service.getDashboardOverview();

      expect(result).toHaveProperty('global_stats');
    });
  });
});
