import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface SmsAnalyticsSummary {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  delivery_rate: number;
  total_cost: number;
  unique_recipients: number;
  opt_out_count: number;
}

export interface SmsAnalyticsTrend {
  date: string;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
}

export interface SmsFailureBreakdown {
  error_code: string;
  count: number;
}

export interface SmsTopRecipient {
  to_phone: string;
  sms_count: number;
  lead: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

/**
 * SMS Analytics Service
 *
 * Provides comprehensive SMS analytics and reporting capabilities:
 * - Summary metrics (sent, delivered, failed, delivery rate, cost)
 * - Daily trends analysis
 * - Failure breakdown by error code
 * - Top recipients with lead enrichment
 *
 * Features:
 * - Multi-tenant isolation (CRITICAL)
 * - Date range filtering
 * - Efficient queries with proper indexes
 * - Cost tracking from provider metadata
 * - Opt-out count monitoring
 */
@Injectable()
export class SmsAnalyticsService {
  private readonly logger = new Logger(SmsAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get SMS summary for tenant
   * CRITICAL: Filter by tenant_id
   *
   * @param tenantId - The tenant ID (from JWT)
   * @param startDate - Start date for analysis
   * @param endDate - End date for analysis
   * @returns Summary metrics including counts, delivery rate, cost, unique recipients, opt-outs
   */
  async getSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SmsAnalyticsSummary> {
    this.logger.log(
      `Getting SMS summary for tenant ${tenantId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Validate date range
    if (startDate > endDate) {
      throw new BadRequestException(
        'start_date must be before or equal to end_date',
      );
    }

    const where = {
      tenant_id: tenantId,
      channel: 'sms' as const,
      created_at: {
        gte: startDate,
        lte: endDate,
      },
    };

    try {
      const [events, optOutCount, uniqueRecipients] = await Promise.all([
        // Get all SMS events with status and cost
        this.prisma.communication_event.findMany({
          where,
          select: {
            status: true,
            provider_metadata: true, // Contains cost
          },
        }),
        // Count leads who have opted out
        this.prisma.lead.count({
          where: {
            tenant_id: tenantId,
            sms_opt_out: true,
          },
        }),
        // Count unique recipients
        this.prisma.communication_event.groupBy({
          by: ['to_phone'],
          where,
          _count: true,
        }),
      ]);

      // Calculate metrics
      const total_sent = events.filter((e) =>
        ['sent', 'delivered'].includes(e.status),
      ).length;

      const total_delivered = events.filter(
        (e) => e.status === 'delivered',
      ).length;

      const total_failed = events.filter((e) => e.status === 'failed').length;

      const delivery_rate =
        total_sent > 0 ? (total_delivered / total_sent) * 100 : 0;

      // Calculate cost from provider_metadata
      const total_cost = events.reduce((sum, event) => {
        const metadata = event.provider_metadata as any;
        return sum + (parseFloat(metadata?.price || '0') || 0);
      }, 0);

      const result = {
        total_sent,
        total_delivered,
        total_failed,
        delivery_rate: Math.round(delivery_rate * 100) / 100,
        total_cost: Math.round(total_cost * 100) / 100,
        unique_recipients: uniqueRecipients.length,
        opt_out_count: optOutCount,
      };

      this.logger.log(
        `SMS summary for tenant ${tenantId}: ${total_sent} sent, ${total_delivered} delivered, ${total_failed} failed, ${delivery_rate.toFixed(2)}% delivery rate`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get SMS summary for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get daily SMS trends
   *
   * @param tenantId - The tenant ID (from JWT)
   * @param startDate - Start date for analysis
   * @param endDate - End date for analysis
   * @returns Array of daily trends with sent/delivered/failed counts
   */
  async getTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SmsAnalyticsTrend[]> {
    this.logger.log(
      `Getting SMS trends for tenant ${tenantId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Validate date range
    if (startDate > endDate) {
      throw new BadRequestException(
        'start_date must be before or equal to end_date',
      );
    }

    try {
      // Use raw SQL for date grouping (more efficient with large datasets)
      const trends = await this.prisma.$queryRaw<any[]>`
        SELECT
          DATE(created_at) as date,
          SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as sent_count,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
        FROM communication_event
        WHERE tenant_id = ${tenantId}
          AND channel = 'sms'
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const result = trends.map((t) => ({
        date: t.date.toISOString().split('T')[0],
        sent_count: Number(t.sent_count),
        delivered_count: Number(t.delivered_count),
        failed_count: Number(t.failed_count),
      }));

      this.logger.log(
        `SMS trends for tenant ${tenantId}: ${result.length} days of data`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get SMS trends for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get failure breakdown by error code
   *
   * @param tenantId - The tenant ID (from JWT)
   * @param startDate - Start date for analysis
   * @param endDate - End date for analysis
   * @returns Array of error codes with counts, sorted by count descending
   */
  async getFailureBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SmsFailureBreakdown[]> {
    this.logger.log(
      `Getting SMS failure breakdown for tenant ${tenantId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Validate date range
    if (startDate > endDate) {
      throw new BadRequestException(
        'start_date must be before or equal to end_date',
      );
    }

    try {
      const failures = await this.prisma.communication_event.findMany({
        where: {
          tenant_id: tenantId,
          channel: 'sms',
          status: 'failed',
          created_at: { gte: startDate, lte: endDate },
        },
        select: {
          error_message: true,
          provider_metadata: true,
        },
      });

      // Group by error code from provider metadata
      const breakdown: Record<string, number> = {};
      failures.forEach((f) => {
        const metadata = f.provider_metadata as any;
        const errorCode =
          metadata?.errorCode || metadata?.error_code || 'unknown';
        breakdown[errorCode] = (breakdown[errorCode] || 0) + 1;
      });

      const result = Object.entries(breakdown)
        .map(([error_code, count]) => ({ error_code, count }))
        .sort((a, b) => b.count - a.count);

      this.logger.log(
        `SMS failure breakdown for tenant ${tenantId}: ${result.length} unique error codes, ${failures.length} total failures`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get SMS failure breakdown for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get top recipients (most SMS'd leads)
   *
   * @param tenantId - The tenant ID (from JWT)
   * @param startDate - Start date for analysis
   * @param endDate - End date for analysis
   * @param limit - Maximum number of recipients to return (default: 10)
   * @returns Array of top recipients with lead information
   */
  async getTopRecipients(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ): Promise<SmsTopRecipient[]> {
    this.logger.log(
      `Getting top ${limit} SMS recipients for tenant ${tenantId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Validate date range
    if (startDate > endDate) {
      throw new BadRequestException(
        'start_date must be before or equal to end_date',
      );
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }

    try {
      const topRecipients = await this.prisma.communication_event.groupBy({
        by: ['to_phone'],
        where: {
          tenant_id: tenantId,
          channel: 'sms',
          created_at: { gte: startDate, lte: endDate },
          to_phone: { not: null }, // Exclude null phone numbers
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      });

      // Enrich with lead data
      const recipientsWithLeads = await Promise.all(
        topRecipients.map(async (r) => {
          if (!r.to_phone) {
            return {
              to_phone: '',
              sms_count: r._count.id,
              lead: null,
            };
          }

          // Find lead by phone number
          const leadPhone = await this.prisma.lead_phone.findFirst({
            where: {
              phone: r.to_phone,
              lead: {
                tenant_id: tenantId,
              },
            },
            include: {
              lead: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          });

          return {
            to_phone: r.to_phone,
            sms_count: r._count.id,
            lead: leadPhone?.lead || null,
          };
        }),
      );

      this.logger.log(
        `Top SMS recipients for tenant ${tenantId}: ${recipientsWithLeads.length} recipients found`,
      );

      return recipientsWithLeads;
    } catch (error) {
      this.logger.error(
        `Failed to get top SMS recipients for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get SMS analytics summary for all tenants (ADMIN ONLY)
   *
   * @param startDate - Start date for analysis
   * @param endDate - End date for analysis
   * @param tenantId - Optional tenant ID filter
   * @returns Summary metrics across all tenants or specific tenant
   */
  async getAdminSummary(
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<SmsAnalyticsSummary & { tenant_id?: string }> {
    this.logger.log(
      `Getting admin SMS summary ${tenantId ? `for tenant ${tenantId}` : 'for all tenants'} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Validate date range
    if (startDate > endDate) {
      throw new BadRequestException(
        'start_date must be before or equal to end_date',
      );
    }

    const where: any = {
      channel: 'sms' as const,
      created_at: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Optional tenant filter for admin
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    try {
      const [events, optOutCount, uniqueRecipients] = await Promise.all([
        this.prisma.communication_event.findMany({
          where,
          select: {
            status: true,
            provider_metadata: true,
          },
        }),
        tenantId
          ? this.prisma.lead.count({
              where: {
                tenant_id: tenantId,
                sms_opt_out: true,
              },
            })
          : this.prisma.lead.count({
              where: {
                sms_opt_out: true,
              },
            }),
        this.prisma.communication_event.groupBy({
          by: ['to_phone'],
          where,
          _count: true,
        }),
      ]);

      const total_sent = events.filter((e) =>
        ['sent', 'delivered'].includes(e.status),
      ).length;

      const total_delivered = events.filter(
        (e) => e.status === 'delivered',
      ).length;

      const total_failed = events.filter((e) => e.status === 'failed').length;

      const delivery_rate =
        total_sent > 0 ? (total_delivered / total_sent) * 100 : 0;

      const total_cost = events.reduce((sum, event) => {
        const metadata = event.provider_metadata as any;
        return sum + (parseFloat(metadata?.price || '0') || 0);
      }, 0);

      const result = {
        total_sent,
        total_delivered,
        total_failed,
        delivery_rate: Math.round(delivery_rate * 100) / 100,
        total_cost: Math.round(total_cost * 100) / 100,
        unique_recipients: uniqueRecipients.length,
        opt_out_count: optOutCount,
        ...(tenantId && { tenant_id: tenantId }),
      };

      this.logger.log(
        `Admin SMS summary: ${total_sent} sent, ${total_delivered} delivered, ${total_failed} failed`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get admin SMS summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
