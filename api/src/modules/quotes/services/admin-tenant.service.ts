import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

/**
 * AdminTenantService
 *
 * Cross-tenant analytics and management for platform administrators
 * Provides tenant-level statistics, comparisons, and configuration views
 *
 * @author Backend Developer 2
 */
@Injectable()
export class AdminTenantService {
  private readonly logger = new Logger(AdminTenantService.name);
  private readonly CACHE_TTL_TENANT = 900; // 15 minutes (as specified)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * List tenants with quote activity (paginated)
   * @param filters - Status filter, search query, sort options
   * @param pagination - Page and limit
   * @returns Paginated list of tenants with quote statistics
   */
  async listTenantsWithQuoteActivity(
    filters: {
      status?: 'active' | 'trial' | 'suspended' | 'all';
      search?: string;
      sortBy?: 'quote_count' | 'revenue' | 'name';
    },
    pagination: {
      page?: number;
      limit?: number;
    },
  ): Promise<any> {
    const { status = 'active', search, sortBy = 'quote_count' } = filters;
    const { page = 1, limit = 50 } = pagination;

    // Build cache key
    const cacheKey = `admin:tenant:list:${status}:${search || 'all'}:${sortBy}:${page}:${limit}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Build where clause
    const where: any = {};

    // Filter by subscription status
    if (status !== 'all') {
      where.subscription_status = status;
    }

    // Search filter
    if (search) {
      where.OR = [
        { company_name: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Calculate date for "last 30 days" metric
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count total matching tenants
    const total = await this.prisma.tenant.count({ where });

    // Fetch tenants with quotes
    const tenants = await this.prisma.tenant.findMany({
      where,
      select: {
        id: true,
        company_name: true,
        subdomain: true,
        subscription_status: true,
        created_at: true,
        quotes: {
          where: {
            is_archived: false,
          },
          select: {
            id: true,
            status: true,
            total: true,
            created_at: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Calculate metrics per tenant
    const tenantsWithStats = tenants.map((tenant) => {
      const allQuotes = tenant.quotes;
      const quotesLast30Days = allQuotes.filter(
        (q) => q.created_at >= thirtyDaysAgo,
      );

      // Revenue: sum of accepted quotes
      const acceptedStatuses = ['approved', 'started', 'concluded'];
      const acceptedQuotes = allQuotes.filter((q) =>
        acceptedStatuses.includes(q.status),
      );
      const totalRevenue = acceptedQuotes.reduce(
        (sum, q) => sum + parseFloat(q.total.toString()),
        0,
      );

      // Conversion rate
      const sentStatuses = [
        'sent',
        'delivered',
        'read',
        'opened',
        'downloaded',
        'approved',
        'started',
        'concluded',
        'denied',
        'lost',
      ];
      const sentQuotes = allQuotes.filter((q) => sentStatuses.includes(q.status));
      const conversionRate = this.calculateConversionRate(
        acceptedQuotes.length,
        sentQuotes.length,
      );

      return {
        tenant_id: tenant.id,
        company_name: tenant.company_name,
        subdomain: tenant.subdomain,
        subscription_status: tenant.subscription_status,
        quote_stats: {
          total_quotes: allQuotes.length,
          quotes_last_30_days: quotesLast30Days.length,
          total_revenue: totalRevenue,
          conversion_rate: conversionRate,
        },
        created_at: tenant.created_at.toISOString(),
      };
    });

    // Sort based on sortBy parameter
    if (sortBy === 'quote_count') {
      tenantsWithStats.sort(
        (a, b) => b.quote_stats.total_quotes - a.quote_stats.total_quotes,
      );
    } else if (sortBy === 'revenue') {
      tenantsWithStats.sort(
        (a, b) => b.quote_stats.total_revenue - a.quote_stats.total_revenue,
      );
    } else if (sortBy === 'name') {
      tenantsWithStats.sort((a, b) =>
        a.company_name.localeCompare(b.company_name),
      );
    }

    // Count active tenants for summary
    const activeTenants = await this.prisma.tenant.count({
      where: { subscription_status: 'active' },
    });

    const result = {
      tenants: tenantsWithStats,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
      summary: {
        total_tenants: total,
        active_tenants: activeTenants,
      },
    };

    // Cache result
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_TENANT);

    return result;
  }

  /**
   * Get detailed statistics for a specific tenant
   * @param tenantId - Tenant UUID
   * @param dateFrom - Start date (optional)
   * @param dateTo - End date (optional)
   * @returns Detailed tenant statistics with trends
   */
  async getTenantQuoteStatistics(
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<any> {
    const { dateFrom: from, dateTo: to } = this.getDefaultDateRange(
      dateFrom,
      dateTo,
    );
    this.validateDateRange(from, to);

    // Build cache key
    const cacheKey = `admin:tenant:stats:${tenantId}:${from.toISOString()}:${to.toISOString()}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, company_name: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Get quotes for current period
    const quotes = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: from, lte: to },
        is_archived: false,
      },
      select: {
        id: true,
        status: true,
        total: true,
        created_at: true,
      },
    });

    // Calculate previous period for trends
    const periodDuration = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - periodDuration);
    const previousTo = new Date(from.getTime());

    const previousQuotes = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: previousFrom, lt: previousTo },
        is_archived: false,
      },
      select: {
        status: true,
        total: true,
      },
    });

    // Calculate statistics
    const acceptedStatuses = ['approved', 'started', 'concluded'];
    const sentStatuses = [
      'sent',
      'delivered',
      'read',
      'opened',
      'downloaded',
      'approved',
      'started',
      'concluded',
      'denied',
      'lost',
    ];

    const acceptedQuotes = quotes.filter((q) =>
      acceptedStatuses.includes(q.status),
    );
    const sentQuotes = quotes.filter((q) => sentStatuses.includes(q.status));

    const totalRevenue = acceptedQuotes.reduce(
      (sum, q) => sum + parseFloat(q.total.toString()),
      0,
    );

    const avgQuoteValue =
      sentQuotes.length > 0
        ? sentQuotes.reduce((sum, q) => sum + parseFloat(q.total.toString()), 0) /
          sentQuotes.length
        : 0;

    // Quotes by status
    const quotesByStatus = {
      draft: quotes.filter((q) => q.status === 'draft').length,
      sent: quotes.filter((q) =>
        [
          'sent',
          'delivered',
          'read',
          'opened',
          'downloaded',
          'approved',
          'started',
          'concluded',
          'denied',
          'lost',
        ].includes(q.status),
      ).length,
      accepted: acceptedQuotes.length,
      rejected: quotes.filter((q) => ['denied', 'lost'].includes(q.status))
        .length,
    };

    // Get top items
    const topItems = await this.getTopItemsForTenant(tenantId, from, to, 10);

    // Calculate trends
    const previousAcceptedQuotes = previousQuotes.filter((q) =>
      acceptedStatuses.includes(q.status),
    );
    const previousRevenue = previousAcceptedQuotes.reduce(
      (sum, q) => sum + parseFloat(q.total.toString()),
      0,
    );

    const quoteVolumeChange = this.calculatePercentageChange(
      quotes.length,
      previousQuotes.length,
    );
    const revenueChange = this.calculatePercentageChange(
      totalRevenue,
      previousRevenue,
    );

    const result = {
      tenant_id: tenantId,
      tenant_name: tenant.company_name,
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      statistics: {
        total_quotes: quotes.length,
        quotes_by_status: quotesByStatus,
        revenue: {
          total: totalRevenue,
          average_per_quote: quotes.length > 0 ? totalRevenue / quotes.length : 0,
        },
        conversion_rate: this.calculateConversionRate(
          acceptedQuotes.length,
          sentQuotes.length,
        ),
        avg_quote_value: avgQuoteValue,
        top_items: topItems,
      },
      trends: {
        quote_volume_change: quoteVolumeChange,
        revenue_change: revenueChange,
      },
    };

    // Cache result
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_TENANT);

    return result;
  }

  /**
   * Compare tenants by specified metric
   * @param metric - Metric to rank by
   * @param limit - Number of top tenants to return
   * @param dateRange - Optional date range
   * @returns Ranked tenants with supplementary metrics
   */
  async compareTenantsByMetric(
    metric: 'quote_count' | 'revenue' | 'conversion_rate' | 'avg_quote_value',
    limit: number = 10,
    dateRange?: { dateFrom?: Date; dateTo?: Date },
  ): Promise<any> {
    const { dateFrom: from, dateTo: to } = this.getDefaultDateRange(
      dateRange?.dateFrom,
      dateRange?.dateTo,
    );
    this.validateDateRange(from, to);

    // Build cache key
    const cacheKey = `admin:tenant:compare:${metric}:${limit}:${from.toISOString()}:${to.toISOString()}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Get all active tenants with quotes
    const tenants = await this.prisma.tenant.findMany({
      where: { is_active: true },
      select: {
        id: true,
        company_name: true,
        quotes: {
          where: {
            created_at: { gte: from, lte: to },
            is_archived: false,
          },
          select: {
            status: true,
            total: true,
          },
        },
      },
    });

    // Calculate metrics for each tenant
    const acceptedStatuses = ['approved', 'started', 'concluded'];
    const sentStatuses = [
      'sent',
      'delivered',
      'read',
      'opened',
      'downloaded',
      'approved',
      'started',
      'concluded',
      'denied',
      'lost',
    ];

    const tenantsWithMetrics = tenants.map((tenant) => {
      const allQuotes = tenant.quotes;
      const sentQuotes = allQuotes.filter((q) => sentStatuses.includes(q.status));
      const acceptedQuotes = allQuotes.filter((q) =>
        acceptedStatuses.includes(q.status),
      );

      const revenue = acceptedQuotes.reduce(
        (sum, q) => sum + parseFloat(q.total.toString()),
        0,
      );

      const avgQuoteValue =
        sentQuotes.length > 0
          ? sentQuotes.reduce(
              (sum, q) => sum + parseFloat(q.total.toString()),
              0,
            ) / sentQuotes.length
          : 0;

      return {
        tenant_id: tenant.id,
        tenant_name: tenant.company_name,
        quote_count: allQuotes.length,
        revenue,
        conversion_rate: this.calculateConversionRate(
          acceptedQuotes.length,
          sentQuotes.length,
        ),
        avg_quote_value: avgQuoteValue,
      };
    });

    // Sort by specified metric
    const sortedTenants = [...tenantsWithMetrics].sort(
      (a, b) => b[metric] - a[metric],
    );

    // Take top N and add ranks
    const topTenants = sortedTenants.slice(0, limit).map((tenant, index) => ({
      rank: index + 1,
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.tenant_name,
      value: tenant[metric],
      supplementary: {
        quote_count: tenant.quote_count,
        conversion_rate: tenant.conversion_rate,
        avg_quote_value: tenant.avg_quote_value,
      },
    }));

    // Calculate summary statistics
    const metricValues = tenantsWithMetrics.map((t) => t[metric]);
    const metricAverage =
      metricValues.length > 0
        ? metricValues.reduce((sum, v) => sum + v, 0) / metricValues.length
        : 0;
    const metricMedian = this.calculateMedian(metricValues);

    const result = {
      metric,
      date_range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      rankings: topTenants,
      summary: {
        total_tenants: tenantsWithMetrics.length,
        metric_average: metricAverage,
        metric_median: metricMedian,
      },
    };

    // Cache result
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_TENANT);

    return result;
  }

  /**
   * Get activity timeline for a tenant from audit logs
   * @param tenantId - Tenant UUID
   * @param dateFrom - Start date (optional)
   * @param dateTo - End date (optional)
   * @param limit - Max number of events to return
   * @returns Activity timeline with summary
   */
  async getTenantActivityTimeline(
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date,
    limit: number = 50,
  ): Promise<any> {
    const { dateFrom: from, dateTo: to } = this.getDefaultDateRange(
      dateFrom,
      dateTo,
    );
    this.validateDateRange(from, to);

    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, company_name: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Query audit logs (NO CACHE - real-time data)
    const activities = await this.prisma.audit_log.findMany({
      where: {
        tenant_id: tenantId,
        entity_type: 'quote',
        created_at: { gte: from, lte: to },
      },
      select: {
        created_at: true,
        action_type: true,
        description: true,
        metadata_json: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    // Transform to response format
    const events = activities.map((log) => ({
      timestamp: log.created_at.toISOString(),
      event_type: log.action_type,
      description: log.description,
      user: {
        name: log.user
          ? `${log.user.first_name} ${log.user.last_name}`
          : 'System',
      },
      metadata: log.metadata_json ? JSON.parse(log.metadata_json) : {},
    }));

    // Calculate summary
    const userActivity = new Map<string, number>();
    const dayActivity = new Map<string, number>();

    activities.forEach((log) => {
      const userName = log.user
        ? `${log.user.first_name} ${log.user.last_name}`
        : 'System';
      userActivity.set(userName, (userActivity.get(userName) || 0) + 1);

      const day = log.created_at.toISOString().split('T')[0];
      dayActivity.set(day, (dayActivity.get(day) || 0) + 1);
    });

    const mostActiveUser =
      Array.from(userActivity.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'N/A';

    const busiestDay =
      Array.from(dayActivity.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'N/A';

    return {
      tenant_id: tenantId,
      tenant_name: tenant.company_name,
      activities: events,
      summary: {
        total_events: activities.length,
        most_active_user: mostActiveUser,
        busiest_day: busiestDay,
      },
    };
  }

  /**
   * Get tenant configuration overview
   * @param tenantId - Tenant UUID
   * @returns Tenant configuration details
   */
  async getTenantConfiguration(tenantId: string): Promise<any> {
    // Build cache key
    const cacheKey = `admin:tenant:config:${tenantId}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Query tenant with relations
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        company_name: true,
        active_quote_template_id: true,
        default_profit_margin: true,
        default_overhead_rate: true,
        default_quote_validity_days: true,
        approval_thresholds: true,
        active_quote_template: {
          select: {
            name: true,
          },
        },
        unit_measurements: {
          where: { tenant_id: tenantId }, // Custom units only
          select: { id: true },
        },
        quote_templates: {
          where: { tenant_id: tenantId }, // Custom templates only
          select: { id: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Transform to response format
    const result = {
      tenant_id: tenant.id,
      tenant_name: tenant.company_name,
      quote_configuration: {
        active_template_id: tenant.active_quote_template_id,
        active_template_name: tenant.active_quote_template?.name || null,
        default_profit_margin: tenant.default_profit_margin
          ? parseFloat(tenant.default_profit_margin.toString())
          : null,
        default_overhead: tenant.default_overhead_rate
          ? parseFloat(tenant.default_overhead_rate.toString())
          : null,
        quote_expiration_days: tenant.default_quote_validity_days,
        approval_thresholds: tenant.approval_thresholds || [],
      },
      custom_resources: {
        custom_units: tenant.unit_measurements.length,
        custom_templates: tenant.quote_templates.length,
      },
      feature_flags: {
        quotes_enabled: true, // Always enabled for now
        approval_workflow_enabled: !!tenant.approval_thresholds,
      },
    };

    // Cache result
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_TENANT);

    return result;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Get top quoted items for a tenant
   * @param tenantId - Tenant UUID
   * @param from - Start date
   * @param to - End date
   * @param limit - Number of items to return
   * @returns Top items with usage count and average price
   */
  private async getTopItemsForTenant(
    tenantId: string,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<Array<{ title: string; usage_count: number; avg_price: number }>> {
    // Query quote items grouped by title
    const topItems = await this.prisma.quote_item.groupBy({
      by: ['title'],
      where: {
        quote: {
          tenant_id: tenantId,
          created_at: { gte: from, lte: to },
          is_archived: false,
        },
      },
      _count: { id: true },
      _avg: { total_cost: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    return topItems.map((item) => ({
      title: item.title,
      usage_count: item._count.id,
      avg_price: item._avg.total_cost
        ? parseFloat(item._avg.total_cost.toString())
        : 0,
    }));
  }

  /**
   * Calculate percentage change between two values
   * @param current - Current value
   * @param previous - Previous value
   * @returns Percentage change string with +/- prefix
   */
  private calculatePercentageChange(
    current: number,
    previous: number,
  ): string {
    if (previous === 0) {
      return current > 0 ? '+100.0%' : '0.0%';
    }

    const change = ((current - previous) / previous) * 100;
    const prefix = change >= 0 ? '+' : '';
    return `${prefix}${change.toFixed(1)}%`;
  }

  /**
   * Calculate median value from array of numbers
   * @param values - Array of numbers
   * @returns Median value
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Get default date range (last 30 days) if not provided
   * @param from - Start date (optional)
   * @param to - End date (optional)
   * @returns Object with dateFrom and dateTo
   */
  private getDefaultDateRange(
    from?: Date,
    to?: Date,
  ): { dateFrom: Date; dateTo: Date } {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      dateFrom: from || thirtyDaysAgo,
      dateTo: to || now,
    };
  }

  /**
   * Validate date range
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @throws BadRequestException if validation fails
   */
  private validateDateRange(dateFrom: Date, dateTo: Date): void {
    const now = new Date();
    // Add 1 hour tolerance to handle timezone differences and minor clock skew
    const futureThreshold = new Date(now.getTime() + 60 * 60 * 1000);

    // Check if dateFrom is after dateTo
    if (dateFrom > dateTo) {
      throw new BadRequestException('date_from must be before date_to');
    }

    // Check if dateTo is in the future (with 1 hour tolerance)
    if (dateTo > futureThreshold) {
      throw new BadRequestException('date_to cannot be in the future');
    }

    // Check if date range exceeds 365 days
    const rangeDays =
      (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > 365) {
      throw new BadRequestException('Date range cannot exceed 365 days');
    }
  }

  /**
   * Calculate conversion rate as percentage
   * @param numerator - Number of conversions
   * @param denominator - Total number
   * @returns Conversion rate percentage
   */
  private calculateConversionRate(
    numerator: number,
    denominator: number,
  ): number {
    return denominator > 0 ? (numerator / denominator) * 100 : 0;
  }
}
