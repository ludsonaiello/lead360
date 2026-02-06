import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);
  private readonly CACHE_TTL_DASHBOARD = 300; // 5 minutes
  private readonly CACHE_TTL_HEALTH = 60; // 1 minute

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get platform-wide dashboard overview with global stats, tenant breakdown, and trends
   * @param dateFrom - Start date (optional, defaults to 30 days ago)
   * @param dateTo - End date (optional, defaults to now)
   * @returns Dashboard overview data
   */
  async getDashboardOverview(dateFrom?: Date, dateTo?: Date): Promise<any> {
    const { dateFrom: from, dateTo: to } = this.getDefaultDateRange(
      dateFrom,
      dateTo,
    );

    // Validate date range
    this.validateDateRange(from, to);

    const cacheKey = `admin:dashboard:overview:${from.toISOString()}:${to.toISOString()}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Query all quotes in the current period (cross-tenant)
    const quotes = await this.prisma.quote.findMany({
      where: {
        created_at: { gte: from, lte: to },
        is_archived: false,
      },
      select: {
        id: true,
        tenant_id: true,
        status: true,
        total: true,
        created_at: true,
        tenant: {
          select: {
            id: true,
            company_name: true,
            is_active: true,
          },
        },
      },
    });

    // Calculate global stats
    const uniqueTenants = new Set(quotes.map((q) => q.tenant_id));
    const totalTenants = uniqueTenants.size;

    const activeTenants = new Set(
      quotes.filter((q) => q.tenant.is_active).map((q) => q.tenant_id),
    ).size;

    const totalQuotes = quotes.length;

    // Accepted statuses for revenue calculation
    const acceptedStatuses = ['approved', 'started', 'concluded'];
    const acceptedQuotes = quotes.filter((q) =>
      acceptedStatuses.includes(q.status),
    );
    const totalRevenue = acceptedQuotes.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );

    // Sent statuses (for conversion calculation)
    const sentStatuses = [
      'sent',
      'delivered',
      'read',
      'opened',
      'downloaded',
      'approved',
      'started',
      'concluded',
    ];
    const sentQuotes = quotes.filter((q) => sentStatuses.includes(q.status));

    const avgQuoteValue =
      sentQuotes.length > 0
        ? sentQuotes.reduce(
            (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
            0,
          ) / sentQuotes.length
        : 0;

    const conversionRate = this.calculateConversionRate(
      acceptedQuotes.length,
      sentQuotes.length,
    );

    // Top tenants by revenue
    const tenantRevenue = new Map<
      string,
      { revenue: number; count: number; name: string }
    >();
    acceptedQuotes.forEach((q) => {
      const existing = tenantRevenue.get(q.tenant_id) || {
        revenue: 0,
        count: 0,
        name: q.tenant.company_name,
      };
      existing.revenue += parseFloat(q.total?.toString() || '0');
      existing.count += 1;
      tenantRevenue.set(q.tenant_id, existing);
    });

    const topTenantsByRevenue = Array.from(tenantRevenue.entries())
      .map(([tenant_id, data]) => ({
        tenant_id,
        company_name: data.name,
        revenue: data.revenue,
        quote_count: data.count,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top tenants by quote count
    const tenantCounts = new Map<
      string,
      { count: number; revenue: number; name: string }
    >();
    quotes.forEach((q) => {
      const existing = tenantCounts.get(q.tenant_id) || {
        count: 0,
        revenue: 0,
        name: q.tenant.company_name,
      };
      existing.count += 1;
      if (acceptedStatuses.includes(q.status)) {
        existing.revenue += parseFloat(q.total?.toString() || '0');
      }
      tenantCounts.set(q.tenant_id, existing);
    });

    const topTenantsByQuoteCount = Array.from(tenantCounts.entries())
      .map(([tenant_id, data]) => ({
        tenant_id,
        company_name: data.name,
        quote_count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.quote_count - a.quote_count)
      .slice(0, 10);

    // New tenants (tenants with their first quote in this period)
    const tenantFirstQuote = new Map<string, Date>();
    const allQuotes = await this.prisma.quote.findMany({
      select: { tenant_id: true, created_at: true },
      orderBy: { created_at: 'asc' },
    });
    allQuotes.forEach((q) => {
      if (!tenantFirstQuote.has(q.tenant_id)) {
        tenantFirstQuote.set(q.tenant_id, q.created_at);
      }
    });
    const newTenantsThisPeriod = Array.from(tenantFirstQuote.values()).filter(
      (date) => date >= from && date <= to,
    ).length;

    // Calculate trends (compare to previous period)
    const periodLength = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - periodLength);
    const previousTo = from;

    const previousQuotes = await this.prisma.quote.findMany({
      where: {
        created_at: { gte: previousFrom, lt: previousTo },
        is_archived: false,
      },
      select: { status: true, total: true },
    });

    const previousTotal = previousQuotes.length;
    const previousAccepted = previousQuotes.filter((q) =>
      acceptedStatuses.includes(q.status),
    );
    const previousSent = previousQuotes.filter((q) =>
      sentStatuses.includes(q.status),
    );

    const previousAvgValue =
      previousSent.length > 0
        ? previousSent.reduce(
            (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
            0,
          ) / previousSent.length
        : 0;

    const previousConversionRate = this.calculateConversionRate(
      previousAccepted.length,
      previousSent.length,
    );

    const quoteVelocityChange = this.calculatePercentageChange(
      totalQuotes,
      previousTotal,
    );
    const avgValueChange = this.calculatePercentageChange(
      avgQuoteValue,
      previousAvgValue,
    );
    const conversionRateChange = this.calculatePercentageChange(
      conversionRate,
      previousConversionRate,
    );

    const result = {
      global_stats: {
        total_tenants: totalTenants,
        active_tenants: activeTenants,
        total_quotes: totalQuotes,
        total_revenue: totalRevenue,
        avg_quote_value: avgQuoteValue,
        conversion_rate: conversionRate,
      },
      tenant_breakdown: {
        top_tenants_by_revenue: topTenantsByRevenue,
        top_tenants_by_quote_count: topTenantsByQuoteCount,
        new_tenants_this_period: newTenantsThisPeriod,
      },
      trends: {
        quote_velocity: `${quoteVelocityChange > 0 ? '+' : ''}${quoteVelocityChange.toFixed(1)}%`,
        avg_value_change: `${avgValueChange > 0 ? '+' : ''}${avgValueChange.toFixed(1)}%`,
        conversion_rate_change: `${conversionRateChange > 0 ? '+' : ''}${conversionRateChange.toFixed(1)}%`,
      },
      date_from: from.toISOString(),
      date_to: to.toISOString(),
    };

    // Store in cache
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_DASHBOARD);

    return result;
  }

  /**
   * Get quote volume trends over time with specified interval
   * @param dateFrom - Start date (required)
   * @param dateTo - End date (required)
   * @param interval - Grouping interval (day, week, month)
   * @returns Quote trends data with time series
   */
  async getQuoteTrends(
    dateFrom: Date,
    dateTo: Date,
    interval: 'day' | 'week' | 'month',
  ): Promise<any> {
    // Validate date range
    this.validateDateRange(dateFrom, dateTo);

    const cacheKey = `admin:dashboard:trends:${interval}:${dateFrom.toISOString()}:${dateTo.toISOString()}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // MySQL date format strings for grouping
    const dateFormat = {
      day: '%Y-%m-%d',
      week: '%Y-%u', // Year-Week
      month: '%Y-%m',
    }[interval];

    // Accepted statuses for revenue calculation
    const acceptedStatuses = ['approved', 'started', 'concluded'];

    // Use raw SQL for DATE_FORMAT grouping (MySQL)
    const rawData = await this.prisma.$queryRaw<
      Array<{
        date_key: string;
        quote_count: bigint;
        total_revenue: number | null;
      }>
    >`
      SELECT
        DATE_FORMAT(created_at, ${dateFormat}) as date_key,
        COUNT(*) as quote_count,
        SUM(CASE
          WHEN status IN ('approved', 'started', 'concluded')
          THEN total
          ELSE 0
        END) as total_revenue
      FROM quote
      WHERE created_at >= ${dateFrom}
        AND created_at <= ${dateTo}
        AND is_archived = false
      GROUP BY date_key
      ORDER BY date_key ASC
    `;

    const dataPoints = rawData.map((row) => ({
      date: row.date_key,
      count: Number(row.quote_count),
      revenue: Number(row.total_revenue || 0),
    }));

    const totalQuotes = dataPoints.reduce((sum, p) => sum + p.count, 0);
    const totalRevenue = dataPoints.reduce((sum, p) => sum + p.revenue, 0);
    const avgPerInterval =
      dataPoints.length > 0 ? totalQuotes / dataPoints.length : 0;

    const result = {
      data_points: dataPoints,
      interval,
      summary: {
        total_quotes: totalQuotes,
        total_revenue: totalRevenue,
        avg_per_interval: avgPerInterval,
      },
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    };

    // Store in cache
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_DASHBOARD);

    return result;
  }

  /**
   * Get conversion funnel analysis with stage counts and conversion rates
   * @param dateFrom - Start date (optional, defaults to 30 days ago)
   * @param dateTo - End date (optional, defaults to now)
   * @returns Conversion funnel data
   */
  async getConversionFunnel(dateFrom?: Date, dateTo?: Date): Promise<any> {
    const { dateFrom: from, dateTo: to } = this.getDefaultDateRange(
      dateFrom,
      dateTo,
    );

    // Validate date range
    this.validateDateRange(from, to);

    const cacheKey = `admin:dashboard:funnel:${from.toISOString()}:${to.toISOString()}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Query all quotes in period
    const quotes = await this.prisma.quote.findMany({
      where: {
        created_at: { gte: from, lte: to },
        is_archived: false,
      },
      select: { status: true },
    });

    const totalCreated = quotes.length;

    // Define funnel stages by status
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
    const totalSent = quotes.filter((q) =>
      sentStatuses.includes(q.status),
    ).length;

    const viewedStatuses = [
      'read',
      'opened',
      'downloaded',
      'approved',
      'started',
      'concluded',
      'denied',
      'lost',
    ];
    const totalViewed = quotes.filter((q) =>
      viewedStatuses.includes(q.status),
    ).length;

    const acceptedStatuses = ['approved', 'started', 'concluded'];
    const totalAccepted = quotes.filter((q) =>
      acceptedStatuses.includes(q.status),
    ).length;

    const funnelStages = [
      {
        stage: 'created',
        count: totalCreated,
        percentage: 100.0,
      },
      {
        stage: 'sent',
        count: totalSent,
        percentage: totalCreated > 0 ? (totalSent / totalCreated) * 100 : 0,
      },
      {
        stage: 'viewed',
        count: totalViewed,
        percentage: totalCreated > 0 ? (totalViewed / totalCreated) * 100 : 0,
      },
      {
        stage: 'accepted',
        count: totalAccepted,
        percentage: totalCreated > 0 ? (totalAccepted / totalCreated) * 100 : 0,
      },
    ];

    const conversionRates = {
      sent_to_viewed: this.calculateConversionRate(totalViewed, totalSent),
      viewed_to_accepted: this.calculateConversionRate(
        totalAccepted,
        totalViewed,
      ),
      overall: this.calculateConversionRate(totalAccepted, totalSent),
    };

    const result = {
      funnel_stages: funnelStages,
      conversion_rates: conversionRates,
      date_from: from.toISOString(),
      date_to: to.toISOString(),
    };

    // Store in cache
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_DASHBOARD);

    return result;
  }

  /**
   * Get system health metrics including API, PDF, email, and database stats
   * @returns System health metrics
   */
  async getSystemHealth(): Promise<any> {
    const cacheKey = 'admin:system:health';

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // API Health (from audit logs as proxy)
    const apiLogs = await this.prisma.audit_log.findMany({
      where: {
        created_at: { gte: oneHourAgo },
        entity_type: 'quote',
      },
      select: { status: true },
    });

    const totalRequests = apiLogs.length;
    const errorRequests = apiLogs.filter(
      (log) => log.status === 'failure',
    ).length;
    const errorRate = totalRequests > 0 ? errorRequests / totalRequests : 0;

    // Estimate avg response time (placeholder - would need APM tool for real data)
    const avgResponseTimeMs = totalRequests > 0 ? 150 : 0;

    // PDF Generation (from job table)
    const pdfJobs = await this.prisma.job.findMany({
      where: {
        job_type: { contains: 'pdf' },
        created_at: { gte: oneDayAgo },
      },
      select: {
        status: true,
        duration_ms: true,
      },
    });

    const pendingPdfJobs = pdfJobs.filter((j) => j.status === 'pending').length;
    const completedPdfJobs = pdfJobs.filter((j) => j.status === 'completed');
    const avgPdfTime =
      completedPdfJobs.length > 0
        ? completedPdfJobs.reduce((sum, j) => sum + (j.duration_ms || 0), 0) /
          completedPdfJobs.length
        : 0;
    const pdfSuccessRate =
      pdfJobs.length > 0 ? (completedPdfJobs.length / pdfJobs.length) * 100 : 0;

    // Email Delivery (from email_queue table)
    const emailQueue = await this.prisma.email_queue.findMany({
      where: {
        created_at: { gte: oneDayAgo },
      },
      select: {
        status: true,
        created_at: true,
      },
    });

    const pendingEmails = emailQueue.filter(
      (e) => e.status === 'pending',
    ).length;
    const failedEmails24h = emailQueue.filter(
      (e) => e.status === 'failed' && e.created_at >= oneDayAgo,
    ).length;
    const sentEmails = emailQueue.filter((e) => e.status === 'sent').length;
    const emailSuccessRate =
      emailQueue.length > 0 ? (sentEmails / emailQueue.length) * 100 : 0;

    // Database Health (simple ping test)
    let queryPerformance = 'unknown';
    let connectionPoolUsage = 0;

    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const pingTime = Date.now() - startTime;

      if (pingTime < 100) {
        queryPerformance = 'excellent';
      } else if (pingTime < 200) {
        queryPerformance = 'good';
      } else if (pingTime < 500) {
        queryPerformance = 'fair';
      } else {
        queryPerformance = 'degraded';
      }

      // Connection pool usage (placeholder - would need Prisma metrics)
      connectionPoolUsage = 0;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      queryPerformance = 'error';
    }

    const result = {
      api_health: {
        avg_response_time_ms: avgResponseTimeMs,
        error_rate: errorRate,
        requests_last_hour: totalRequests,
      },
      pdf_generation: {
        queue_size: pendingPdfJobs,
        avg_generation_time_ms: avgPdfTime,
        success_rate: pdfSuccessRate,
      },
      email_delivery: {
        queue_size: pendingEmails,
        success_rate: emailSuccessRate,
        failed_last_24h: failedEmails24h,
      },
      database: {
        query_performance: queryPerformance,
        connection_pool_usage: connectionPoolUsage,
      },
      timestamp: now.toISOString(),
    };

    // Store in cache (shorter TTL for health)
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_HEALTH);

    return result;
  }

  /**
   * Get revenue analytics with optional grouping by vendor or tenant
   * @param dateFrom - Start date (required)
   * @param dateTo - End date (required)
   * @param groupBy - Group by vendor or tenant (optional)
   * @returns Revenue analytics data
   */
  async getRevenueAnalytics(
    dateFrom: Date,
    dateTo: Date,
    groupBy?: 'vendor' | 'tenant',
  ): Promise<any> {
    // Validate date range
    this.validateDateRange(dateFrom, dateTo);

    const cacheKey = `admin:dashboard:revenue:${groupBy || 'none'}:${dateFrom.toISOString()}:${dateTo.toISOString()}`;

    // Check cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    const acceptedStatuses: ('approved' | 'started' | 'concluded')[] = [
      'approved',
      'started',
      'concluded',
    ];

    // Query accepted quotes in period with related data
    const quotes = await this.prisma.quote.findMany({
      where: {
        created_at: { gte: dateFrom, lte: dateTo },
        status: { in: acceptedStatuses },
        is_archived: false,
      },
      select: {
        total: true,
        created_at: true,
        vendor_id: true,
        tenant_id: true,
        vendor:
          groupBy === 'vendor'
            ? {
                select: {
                  id: true,
                  name: true,
                },
              }
            : false,
        tenant:
          groupBy === 'tenant'
            ? {
                select: {
                  id: true,
                  company_name: true,
                },
              }
            : false,
      },
    });

    const totalRevenue = quotes.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );

    let revenueByGroup: Array<{
      group_id: string;
      group_name: string;
      revenue: number;
      quote_count: number;
    }> = [];

    if (groupBy === 'vendor') {
      const vendorRevenue = new Map<
        string,
        { name: string; revenue: number; count: number }
      >();
      quotes.forEach((q) => {
        if (!q.vendor_id) return;
        const existing = vendorRevenue.get(q.vendor_id) || {
          name: q.vendor && 'name' in q.vendor ? q.vendor.name : 'Unknown',
          revenue: 0,
          count: 0,
        };
        existing.revenue += parseFloat(q.total?.toString() || '0');
        existing.count += 1;
        vendorRevenue.set(q.vendor_id, existing);
      });

      revenueByGroup = Array.from(vendorRevenue.entries()).map(
        ([id, data]) => ({
          group_id: id,
          group_name: data.name,
          revenue: data.revenue,
          quote_count: data.count,
        }),
      );
    } else if (groupBy === 'tenant') {
      const tenantRevenue = new Map<
        string,
        { name: string; revenue: number; count: number }
      >();
      quotes.forEach((q) => {
        const existing = tenantRevenue.get(q.tenant_id) || {
          name:
            q.tenant && 'company_name' in q.tenant
              ? q.tenant.company_name
              : 'Unknown',
          revenue: 0,
          count: 0,
        };
        existing.revenue += parseFloat(q.total?.toString() || '0');
        existing.count += 1;
        tenantRevenue.set(q.tenant_id, existing);
      });

      revenueByGroup = Array.from(tenantRevenue.entries()).map(
        ([id, data]) => ({
          group_id: id,
          group_name: data.name,
          revenue: data.revenue,
          quote_count: data.count,
        }),
      );
    }

    const topRevenueSources = [...revenueByGroup]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Revenue trend (daily)
    const dailyRevenue = new Map<string, number>();
    quotes.forEach((q) => {
      const dateKey = q.created_at.toISOString().split('T')[0];
      const existing = dailyRevenue.get(dateKey) || 0;
      dailyRevenue.set(
        dateKey,
        existing + parseFloat(q.total?.toString() || '0'),
      );
    });

    const revenueTrend = Array.from(dailyRevenue.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const result = {
      total_revenue: totalRevenue,
      revenue_by_group: revenueByGroup,
      top_revenue_sources: topRevenueSources,
      revenue_trend: revenueTrend,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    };

    // Store in cache
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL_DASHBOARD);

    return result;
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

  /**
   * Calculate percentage change between two values
   * @param current - Current value
   * @param previous - Previous value
   * @returns Percentage change
   */
  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }
}
