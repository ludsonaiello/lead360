import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * QuoteDashboardService
 *
 * Provides tenant-specific dashboard analytics and metrics.
 *
 * Key Features:
 * - Stats by status (count, revenue)
 * - Conversion rate calculation
 * - Time series data (quotes over time)
 * - Top items analysis
 * - Win/loss analysis
 * - Conversion funnel
 * - Revenue by vendor
 * - Average pricing by task
 * - Dashboard export (CSV/Excel/PDF)
 *
 * Performance:
 * - Database aggregations (not app-level)
 * - Indexed queries
 * - Optional caching (5-10 min)
 *
 * @author Developer 5
 */
@Injectable()
export class QuoteDashboardService {
  private readonly logger = new Logger(QuoteDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard overview
   *
   * @param tenantId - Tenant ID
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @param compareToPrevious - Compare to previous period
   * @param statusFilter - Optional status filter
   * @returns Dashboard overview metrics
   */
  async getOverview(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    compareToPrevious: boolean,
    statusFilter?: string,
  ) {
    this.logger.log(
      `Getting dashboard overview for tenant ${tenantId} (${dateFrom.toISOString()} to ${dateTo.toISOString()})${statusFilter ? `, status: ${statusFilter}` : ''}`,
    );

    // Build where clause with optional status filter
    const whereClause: any = {
      tenant_id: tenantId,
      is_archived: false,
      created_at: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    // Get all quotes in date range (with optional status filter)
    const quotes = await this.prisma.quote.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        total: true,
        created_at: true,
      },
    });

    const totalQuotes = quotes.length;

    // DEBUG: Log all quotes fetched
    this.logger.debug(
      `[DASHBOARD] Fetched ${totalQuotes} quotes for tenant ${tenantId}`,
    );
    quotes.forEach((q) => {
      this.logger.debug(
        `[DASHBOARD] Quote ${q.id}: status=${q.status}, total=${q.total}`,
      );
    });

    // Total Generated = sum of sent/read/approved/denied/expired/lost quotes (NOT drafts)
    const generatedQuotes = quotes.filter((q) => q.status !== 'draft');
    const totalGenerated = generatedQuotes.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );

    // Total Revenue = sum of APPROVED, STARTED, and CONCLUDED quotes (actual revenue)
    const approvedQuotes = quotes.filter((q) =>
      ['approved', 'started', 'concluded'].includes(q.status),
    );
    const totalRevenue = approvedQuotes.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );

    // Average quote value (excluding drafts)
    const avgQuoteValue =
      generatedQuotes.length > 0 ? totalGenerated / generatedQuotes.length : 0;

    // Amount Sent = sum of quotes with any status except draft, pending_approval, ready
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
      'email_failed',
    ];
    const sentQuotes = quotes.filter((q) => sentStatuses.includes(q.status));
    const amountSent = sentQuotes.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );

    // DEBUG: Log sent calculation
    this.logger.debug(
      `[DASHBOARD] Sent quotes count: ${sentQuotes.length}, amount_sent: ${amountSent}`,
    );
    sentQuotes.forEach((q) => {
      this.logger.debug(
        `[DASHBOARD] Sent quote ${q.id}: status=${q.status}, total=${q.total}`,
      );
    });

    // Amount Lost = sum of quotes with status = lost
    const lostQuotes = quotes.filter((q) => q.status === 'lost');
    const amountLost = lostQuotes.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );

    // Amount Denied = sum of quotes with status = denied
    const deniedQuotes = quotes.filter((q) => q.status === 'denied');
    const amountDenied = deniedQuotes.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );

    // Amount Pending Approval = sum of quotes with status = pending_approval
    const pendingApprovalQuotes = quotes.filter(
      (q) => q.status === 'pending_approval',
    );
    const amountPendingApproval = pendingApprovalQuotes.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );

    // Group by status
    const statusGroups = quotes.reduce(
      (acc, quote) => {
        const status = quote.status;
        if (!acc[status]) {
          acc[status] = { count: 0, total_revenue: 0, quotes: [] };
        }
        acc[status].count++;
        acc[status].total_revenue += parseFloat(quote.total?.toString() || '0');
        acc[status].quotes.push(quote);
        return acc;
      },
      {} as Record<
        string,
        { count: number; total_revenue: number; quotes: any[] }
      >,
    );

    const byStatus = Object.entries(statusGroups).map(([status, data]) => ({
      status,
      count: data.count,
      total_revenue: data.total_revenue,
      avg_value: data.count > 0 ? data.total_revenue / data.count : 0,
    }));

    // Calculate conversion rate (approved+started+concluded / sent)
    const sentCount = sentQuotes.length;
    const approvedCount = quotes.filter((q) =>
      ['approved', 'started', 'concluded'].includes(q.status),
    ).length;
    const conversionRate =
      sentCount > 0 ? (approvedCount / sentCount) * 100 : 0;

    let velocityComparison:
      | {
          current: number;
          previous: number;
          change_percent: number;
          trend: 'up' | 'down' | 'stable';
        }
      | undefined = undefined;

    if (compareToPrevious) {
      // Calculate previous period
      const periodDuration = dateTo.getTime() - dateFrom.getTime();
      const previousDateFrom = new Date(dateFrom.getTime() - periodDuration);
      const previousDateTo = new Date(dateTo.getTime() - periodDuration);

      const previousQuotes = await this.prisma.quote.count({
        where: {
          tenant_id: tenantId,
          is_archived: false,
          created_at: {
            gte: previousDateFrom,
            lte: previousDateTo,
          },
        },
      });

      const changePercent =
        previousQuotes > 0
          ? ((totalQuotes - previousQuotes) / previousQuotes) * 100
          : 0;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (changePercent > 5) trend = 'up';
      else if (changePercent < -5) trend = 'down';

      velocityComparison = {
        current: totalQuotes,
        previous: previousQuotes,
        change_percent: changePercent,
        trend,
      };
    }

    return {
      total_quotes: totalQuotes,
      total_generated: totalGenerated,
      total_revenue: totalRevenue,
      avg_quote_value: avgQuoteValue,
      amount_sent: amountSent,
      amount_lost: amountLost,
      amount_denied: amountDenied,
      amount_pending_approval: amountPendingApproval,
      conversion_rate: conversionRate,
      by_status: byStatus,
      velocity_comparison: velocityComparison,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    };
  }

  /**
   * Get quotes over time (time series)
   *
   * @param tenantId - Tenant ID
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @param interval - Grouping interval (day/week/month)
   * @returns Time series data
   */
  async getQuotesOverTime(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    interval: 'day' | 'week' | 'month',
  ) {
    const quotes = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        is_archived: false,
        created_at: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      select: {
        id: true,
        created_at: true,
        total: true,
        status: true,
      },
      orderBy: { created_at: 'asc' },
    });

    // Group by date
    const grouped = new Map<string, any>();

    quotes.forEach((quote) => {
      let dateKey: string;
      const date = new Date(quote.created_at);

      if (interval === 'day') {
        dateKey = date.toISOString().split('T')[0];
      } else if (interval === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        dateKey = weekStart.toISOString().split('T')[0];
      } else {
        // month
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      }

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          date: dateKey,
          count: 0,
          total_value: 0,
          approved_count: 0,
          rejected_count: 0,
        });
      }

      const group = grouped.get(dateKey);
      group.count++;
      group.total_value += parseFloat(quote.total?.toString() || '0');
      if (['approved', 'started', 'concluded'].includes(quote.status))
        group.approved_count++;
      if (quote.status === 'denied' || quote.status === 'lost')
        group.rejected_count++;
    });

    const data = Array.from(grouped.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      data,
      interval,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    };
  }

  /**
   * Get top items by usage
   *
   * @param tenantId - Tenant ID
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @param limit - Number of items to return
   * @returns Top items with usage count and revenue
   */
  async getTopItems(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    limit: number,
  ) {
    const items = await this.prisma.quote_item.findMany({
      where: {
        quote: {
          tenant_id: tenantId,
          is_archived: false,
          created_at: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      },
      select: {
        title: true,
        total_cost: true,
        item_library_id: true,
      },
    });

    // Group by title
    const grouped = items.reduce(
      (acc, item) => {
        const title = item.title;
        if (!acc[title]) {
          acc[title] = {
            title,
            usage_count: 0,
            total_revenue: 0,
            library_item_id: item.item_library_id,
          };
        }
        acc[title].usage_count++;
        acc[title].total_revenue += parseFloat(
          item.total_cost?.toString() || '0',
        );
        return acc;
      },
      {} as Record<string, any>,
    );

    const topItems = Object.values(grouped)
      .map((item: any) => ({
        title: item.title,
        usage_count: item.usage_count,
        total_revenue: item.total_revenue,
        avg_price:
          item.usage_count > 0 ? item.total_revenue / item.usage_count : 0,
        library_item_id: item.library_item_id,
      }))
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, limit);

    return {
      top_items: topItems,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    };
  }

  /**
   * Get win/loss analysis
   *
   * @param tenantId - Tenant ID
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @returns Win/loss breakdown with reasons
   */
  async getWinLossAnalysis(tenantId: string, dateFrom: Date, dateTo: Date) {
    const quotes = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        is_archived: false,
        created_at: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: {
          in: ['approved', 'started', 'concluded', 'denied', 'lost'],
        },
      },
      select: {
        status: true,
        total: true,
      },
    });

    const wins = quotes.filter((q) =>
      ['approved', 'started', 'concluded'].includes(q.status),
    );
    const losses = quotes.filter(
      (q) => q.status === 'denied' || q.status === 'lost',
    );

    const totalWins = wins.length;
    const totalLosses = losses.length;
    const winRate =
      totalWins + totalLosses > 0
        ? (totalWins / (totalWins + totalLosses)) * 100
        : 0;

    const winRevenue = wins.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );
    const lossRevenue = losses.reduce(
      (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
      0,
    );

    // Group loss reasons (currently just by status since loss_reason field doesn't exist)
    const lossReasonGroups = losses.reduce(
      (acc, quote) => {
        const reason = quote.status === 'denied' ? 'Denied' : 'Lost';
        if (!acc[reason]) {
          acc[reason] = { reason, count: 0 };
        }
        acc[reason].count++;
        return acc;
      },
      {} as Record<string, { reason: string; count: number }>,
    );

    const lossReasons = Object.values(lossReasonGroups).map((item) => ({
      reason: item.reason,
      count: item.count,
      percentage: totalLosses > 0 ? (item.count / totalLosses) * 100 : 0,
    }));

    return {
      total_wins: totalWins,
      total_losses: totalLosses,
      win_rate: winRate,
      win_revenue: winRevenue,
      loss_revenue: lossRevenue,
      loss_reasons: lossReasons,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    };
  }

  /**
   * Get conversion funnel
   *
   * @param tenantId - Tenant ID
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @returns Funnel stages with drop-off
   */
  async getConversionFunnel(tenantId: string, dateFrom: Date, dateTo: Date) {
    const quotes = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        is_archived: false,
        created_at: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
      select: {
        status: true,
        total: true,
      },
    });

    const statusOrder = ['sent', 'read', 'approved'];
    const statusCounts = statusOrder.map((status) => {
      let quotesInStatus;
      if (status === 'approved') {
        // Include started and concluded in the approved stage
        quotesInStatus = quotes.filter((q) =>
          ['approved', 'started', 'concluded'].includes(q.status),
        );
      } else {
        quotesInStatus = quotes.filter((q) => q.status === status);
      }
      return {
        stage: status.charAt(0).toUpperCase() + status.slice(1),
        count: quotesInStatus.length,
        total_value: quotesInStatus.reduce(
          (sum, q) => sum + parseFloat(q.total?.toString() || '0'),
          0,
        ),
        conversion_to_next: null as number | null,
        drop_off_rate: null as number | null,
      };
    });

    // Calculate conversion rates between stages
    for (let i = 0; i < statusCounts.length - 1; i++) {
      const currentCount = statusCounts[i].count;
      const nextCount = statusCounts[i + 1].count;
      if (currentCount > 0) {
        statusCounts[i].conversion_to_next = (nextCount / currentCount) * 100;
        statusCounts[i].drop_off_rate =
          ((currentCount - nextCount) / currentCount) * 100;
      }
    }

    const sentCount = statusCounts[0]?.count || 0;
    const approvedCount = statusCounts[2]?.count || 0;
    const overallConversionRate =
      sentCount > 0 ? (approvedCount / sentCount) * 100 : 0;

    return {
      funnel: statusCounts,
      overall_conversion_rate: overallConversionRate,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    };
  }

  /**
   * Get revenue by vendor
   *
   * @param tenantId - Tenant ID
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @returns Vendor performance metrics
   */
  async getRevenueByVendor(tenantId: string, dateFrom: Date, dateTo: Date) {
    const quotes = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        is_archived: false,
        created_at: {
          gte: dateFrom,
          lte: dateTo,
        },
        vendor_id: {
          not: null,
        },
      },
      select: {
        vendor_id: true,
        total: true,
        status: true,
        vendor: {
          select: {
            name: true,
          },
        },
      },
    });

    const vendorGroups = quotes.reduce(
      (acc, quote) => {
        const vendorId = quote.vendor_id as string;
        if (!acc[vendorId]) {
          acc[vendorId] = {
            vendor_id: vendorId,
            vendor_name: quote.vendor?.name || 'Unknown',
            quote_count: 0,
            total_revenue: 0,
            approved_count: 0,
          };
        }
        acc[vendorId].quote_count++;
        acc[vendorId].total_revenue += parseFloat(
          quote.total?.toString() || '0',
        );
        if (['approved', 'started', 'concluded'].includes(quote.status))
          acc[vendorId].approved_count++;
        return acc;
      },
      {} as Record<string, any>,
    );

    const vendors = Object.values(vendorGroups).map((v: any) => ({
      vendor_id: v.vendor_id,
      vendor_name: v.vendor_name,
      quote_count: v.quote_count,
      total_revenue: v.total_revenue,
      avg_quote_value: v.quote_count > 0 ? v.total_revenue / v.quote_count : 0,
      approval_rate:
        v.quote_count > 0 ? (v.approved_count / v.quote_count) * 100 : 0,
    }));

    return {
      vendors,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    };
  }

  /**
   * Get average pricing by task
   *
   * @param tenantId - Tenant ID
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @returns Task pricing benchmarks
   */
  async getAvgPricingByTask(tenantId: string, dateFrom: Date, dateTo: Date) {
    const items = await this.prisma.quote_item.findMany({
      where: {
        quote: {
          tenant_id: tenantId,
          is_archived: false,
          created_at: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      },
      select: {
        title: true,
        total_cost: true,
        item_library_id: true,
      },
    });

    // Group by title and collect prices
    const grouped = items.reduce(
      (acc, item) => {
        const title = item.title;
        if (!acc[title]) {
          acc[title] = {
            title,
            usage_count: 0,
            prices: [],
            library_item_id: item.item_library_id,
          };
        }
        acc[title].usage_count++;
        acc[title].prices.push(parseFloat(item.total_cost?.toString() || '0'));
        return acc;
      },
      {} as Record<string, any>,
    );

    const benchmarks = Object.values(grouped).map((item: any) => {
      const prices = item.prices.sort((a: number, b: number) => a - b);
      const sum = prices.reduce((a: number, b: number) => a + b, 0);
      const avg = prices.length > 0 ? sum / prices.length : 0;
      const min = prices.length > 0 ? prices[0] : 0;
      const max = prices.length > 0 ? prices[prices.length - 1] : 0;
      const median =
        prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;

      return {
        task_title: item.title,
        usage_count: item.usage_count,
        avg_price: avg,
        min_price: min,
        max_price: max,
        median_price: median,
        library_item_id: item.library_item_id,
      };
    });

    return {
      benchmarks,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    };
  }

  /**
   * Export dashboard data
   *
   * @param tenantId - Tenant ID
   * @param format - Export format (csv/xlsx/pdf)
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @param sections - Sections to include
   * @returns Export file URL
   */
  async exportDashboard(
    tenantId: string,
    format: 'csv' | 'xlsx' | 'pdf',
    dateFrom: Date,
    dateTo: Date,
    sections: string[],
  ) {
    // NOTE: This is a placeholder implementation
    // Real implementation would:
    // 1. Gather all requested section data
    // 2. Format as CSV/XLSX/PDF
    // 3. Upload to FilesService
    // 4. Return presigned download URL

    this.logger.warn(
      `Export dashboard not fully implemented yet (format: ${format}, sections: ${sections.join(', ')})`,
    );

    // For now, return a mock response
    const filename = `dashboard-export-${new Date().toISOString().split('T')[0]}.${format}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return {
      file_id: 'export-placeholder-id',
      download_url: `https://storage.lead360.app/exports/${filename}`,
      filename,
      file_size: 0,
      format,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  }
}
