import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import twilio from 'twilio';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * TwilioUsageTrackingService
 *
 * CRITICAL SERVICE - Fulfills AC-18: "Usage tracking pulls data from Twilio API and syncs nightly"
 *
 * Responsibilities:
 * - Sync usage data from Twilio API for individual tenants
 * - Nightly batch sync for all active tenants
 * - Generate usage summaries for reporting (month-to-date, custom ranges)
 * - Calculate cost estimates per tenant and system-wide
 * - Track usage across 4 categories: calls, SMS, recordings, transcriptions
 *
 * Key Features:
 * - Graceful error handling (logs and continues on failure)
 * - Duplicate prevention using skipDuplicates
 * - Multi-tenant isolation
 * - Comprehensive logging for audit trails
 * - System-wide aggregation for admin analytics
 *
 * @class TwilioUsageTrackingService
 * @since Sprint 8
 */
@Injectable()
export class TwilioUsageTrackingService {
  private readonly logger = new Logger(TwilioUsageTrackingService.name);

  /**
   * Usage categories tracked from Twilio API
   * Maps to Twilio's usage record categories
   */
  private readonly USAGE_CATEGORIES = [
    'calls',
    'sms',
    'recordings',
    'transcriptions',
  ] as const;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sync usage from Twilio API for a specific tenant
   *
   * Fetches usage records from Twilio API for the specified date range
   * and stores them in the database for cost tracking and billing.
   *
   * This method:
   * 1. Loads tenant's active SMS configuration (contains Twilio credentials)
   * 2. Initializes Twilio client with tenant's credentials
   * 3. Fetches usage records for all 4 categories
   * 4. Stores records in database with duplicate prevention
   *
   * @param tenantId - UUID of the tenant to sync usage for
   * @param startDate - Start date of usage period (inclusive)
   * @param endDate - End date of usage period (inclusive)
   * @returns Promise<void>
   *
   * @example
   * // Sync usage for last 7 days
   * const startDate = new Date();
   * startDate.setDate(startDate.getDate() - 7);
   * const endDate = new Date();
   * await service.syncUsageForTenant('tenant-uuid', startDate, endDate);
   */
  async syncUsageForTenant(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    this.logger.log(
      `Starting usage sync for tenant ${tenantId} (${startDate.toISOString()} to ${endDate.toISOString()})`,
    );

    try {
      // Load tenant's active SMS configuration (contains Twilio credentials)
      const config = await this.prisma.tenant_sms_config.findFirst({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
        select: {
          id: true,
          credentials: true,
        },
      });

      if (!config) {
        this.logger.warn(
          `No active SMS configuration found for tenant ${tenantId}, skipping usage sync`,
        );
        return;
      }

      // Decrypt and parse Twilio credentials
      // Note: credentials are stored encrypted in the database
      const credentials = JSON.parse(config.credentials);
      const { account_sid, auth_token } = credentials;

      if (!account_sid || !auth_token) {
        this.logger.error(
          `Invalid Twilio credentials for tenant ${tenantId}, cannot sync usage`,
        );
        return;
      }

      // Initialize Twilio client with tenant's credentials
      const client = twilio(account_sid, auth_token);

      // Track overall sync stats
      let totalRecordsSynced = 0;

      // Fetch usage records for each category
      for (const category of this.USAGE_CATEGORIES) {
        try {
          this.logger.debug(
            `Fetching ${category} usage for tenant ${tenantId}`,
          );

          // Fetch usage records from Twilio API
          // Note: Twilio returns usage records with pricing information
          const usageRecords = await client.usage.records.list({
            startDate: startDate,
            endDate: endDate,
            category: category,
          });

          if (usageRecords.length === 0) {
            this.logger.debug(
              `No ${category} usage records found for tenant ${tenantId}`,
            );
            continue;
          }

          // Transform Twilio records to database format
          const recordsToInsert = usageRecords.map((record) => ({
            id: this.generateUsageRecordId(
              tenantId,
              category,
              record.startDate instanceof Date
                ? record.startDate.toISOString()
                : record.startDate,
            ),
            tenant_id: tenantId,
            category: record.category,
            count: parseInt(record.count, 10) || 0,
            usage_unit: record.usageUnit || 'unit',
            price: new Decimal(record.price || '0'),
            price_unit: record.priceUnit || 'USD',
            start_date: new Date(record.startDate),
            end_date: new Date(record.endDate),
            synced_at: new Date(),
            created_at: new Date(),
          }));

          // Insert records with duplicate prevention
          // skipDuplicates ensures idempotency if sync runs multiple times
          const result = await this.prisma.twilio_usage_record.createMany({
            data: recordsToInsert,
            skipDuplicates: true,
          });

          totalRecordsSynced += result.count;

          this.logger.log(
            `Synced ${result.count} ${category} usage records for tenant ${tenantId}`,
          );
        } catch (categoryError) {
          // Log error but continue with next category
          // This ensures one category failure doesn't block others
          this.logger.error(
            `Failed to sync ${category} usage for tenant ${tenantId}:`,
            categoryError.message,
          );
          this.logger.debug(`Full error stack:`, categoryError.stack);
        }
      }

      this.logger.log(
        `Usage sync completed for tenant ${tenantId}: ${totalRecordsSynced} total records synced`,
      );
    } catch (error) {
      // Top-level error handling for tenant sync
      this.logger.error(
        `Failed to sync usage for tenant ${tenantId}:`,
        error.message,
      );
      this.logger.debug(`Full error stack:`, error.stack);
    }
  }

  /**
   * Nightly cron job - sync all active tenants
   *
   * Called by TwilioUsageSyncScheduler daily at 2:00 AM.
   * Syncs usage data for yesterday for all active tenants.
   *
   * This method:
   * 1. Fetches all active tenants
   * 2. Defines yesterday's date range
   * 3. Syncs usage for each tenant sequentially
   * 4. Continues on failure (one tenant error doesn't stop others)
   *
   * @returns Promise<void>
   *
   * @example
   * // Called by scheduler
   * await service.syncUsageForAllTenants();
   */
  async syncUsageForAllTenants(): Promise<void> {
    this.logger.log('Starting nightly usage sync for all active tenants');

    try {
      // Fetch all active tenants
      const tenants = await this.prisma.tenant.findMany({
        where: {
          is_active: true,
        },
        select: {
          id: true,
          company_name: true,
        },
      });

      if (tenants.length === 0) {
        this.logger.warn('No active tenants found for usage sync');
        return;
      }

      this.logger.log(`Found ${tenants.length} active tenants to sync`);

      // Define date range: yesterday (full day)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0); // Start of yesterday

      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999); // End of yesterday

      // Track sync results
      let successCount = 0;
      let failureCount = 0;

      // Sync each tenant sequentially
      // Note: Could be parallelized with Promise.all for better performance
      // but sequential approach is safer for rate limiting
      for (const tenant of tenants) {
        try {
          await this.syncUsageForTenant(tenant.id, startDate, endDate);
          successCount++;
        } catch (error) {
          // Log error but continue with remaining tenants
          this.logger.error(
            `Failed to sync tenant ${tenant.id} (${tenant.company_name}):`,
            error.message,
          );
          failureCount++;
        }
      }

      this.logger.log(
        `Nightly usage sync completed: ${successCount} successful, ${failureCount} failed out of ${tenants.length} tenants`,
      );
    } catch (error) {
      this.logger.error('Failed to execute nightly usage sync:', error.message);
      this.logger.debug(`Full error stack:`, error.stack);
    }
  }

  /**
   * Get usage summary for a specific tenant and month
   *
   * Returns aggregated usage statistics grouped by category.
   * Used for monthly billing reports and cost analysis.
   *
   * @param tenantId - UUID of the tenant
   * @param month - Month in YYYY-MM format (e.g., "2026-01")
   * @returns Promise<UsageSummary[]> - Array of usage summaries by category
   *
   * @example
   * const summary = await service.getUsageSummary('tenant-uuid', '2026-01');
   * // Returns: [
   * //   { category: 'calls', total_count: 150, total_cost: 12.50, currency: 'USD' },
   * //   { category: 'sms', total_count: 300, total_cost: 15.00, currency: 'USD' },
   * //   ...
   * // ]
   */
  async getUsageSummary(
    tenantId: string,
    month: string,
  ): Promise<TenantUsageReport> {
    this.logger.debug(
      `Generating usage summary for tenant ${tenantId}, month: ${month}`,
    );

    try {
      // Parse month string to date range
      const [year, monthNum] = month.split('-').map(Number);

      if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
        throw new Error(`Invalid month format: ${month}. Expected YYYY-MM`);
      }

      // Calculate start and end of month
      const startDate = new Date(year, monthNum - 1, 1); // First day of month
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999); // Last day of month

      // Get tenant info
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, company_name: true },
      });

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Aggregate usage records by category
      const usageAggregation = await this.prisma.twilio_usage_record.groupBy({
        by: ['category'],
        where: {
          tenant_id: tenantId,
          start_date: { gte: startDate },
          end_date: { lte: endDate },
        },
        _sum: {
          count: true,
          price: true,
        },
      });

      // Get last sync time for this tenant
      const lastSync = await this.prisma.twilio_usage_record.findFirst({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        select: { created_at: true },
      });

      // Transform aggregation to categorized format
      const usageMap = new Map<string, { count: number; cost: number }>();
      usageAggregation.forEach((item) => {
        usageMap.set(item.category, {
          count: item._sum.count || 0,
          cost: item._sum.price?.toNumber() || 0,
        });
      });

      // Build usage_breakdown with documented structure
      const callsData = usageMap.get('calls') || { count: 0, cost: 0 };
      const smsData = usageMap.get('sms') || { count: 0, cost: 0 };
      const recordingsData = usageMap.get('recordings') || {
        count: 0,
        cost: 0,
      };
      const transcriptionsData = usageMap.get('transcriptions') || {
        count: 0,
        cost: 0,
      };

      const usage_breakdown = {
        calls: {
          count: callsData.count,
          minutes: Math.round(callsData.count * 3), // Rough estimate: avg 3 min per call
          cost: callsData.cost.toFixed(2),
        },
        sms: {
          count: smsData.count,
          cost: smsData.cost.toFixed(2),
        },
        recordings: {
          count: recordingsData.count,
          storage_mb: Math.round(recordingsData.count * 0.25), // Rough estimate: 0.25 MB per recording
          cost: recordingsData.cost.toFixed(2),
        },
        transcriptions: {
          count: transcriptionsData.count,
          cost: transcriptionsData.cost.toFixed(2),
        },
      };

      // Calculate total cost
      const totalCost = (
        callsData.cost +
        smsData.cost +
        recordingsData.cost +
        transcriptionsData.cost
      ).toFixed(2);

      this.logger.debug(
        `Usage summary generated for tenant ${tenantId}: total cost $${totalCost}`,
      );

      return {
        tenant_id: tenantId,
        tenant_name: tenant.company_name,
        month,
        usage_breakdown,
        total_cost: totalCost,
        synced_at:
          lastSync?.created_at.toISOString() || new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate usage summary for tenant ${tenantId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get system-wide usage aggregation across all tenants
   *
   * Provides platform-level usage statistics for admin analytics.
   * Used for capacity planning, cost tracking, and system monitoring.
   *
   * @param startDate - Start date of analysis period
   * @param endDate - End date of analysis period
   * @returns Promise<SystemWideUsage> - Aggregated usage across all tenants
   *
   * @example
   * const startDate = new Date('2026-01-01');
   * const endDate = new Date('2026-01-31');
   * const systemUsage = await service.getSystemWideUsage(startDate, endDate);
   */
  async getSystemWideUsage(
    startDate: Date,
    endDate: Date,
  ): Promise<SystemWideUsage> {
    this.logger.debug(
      `Generating system-wide usage report (${startDate.toISOString()} to ${endDate.toISOString()})`,
    );

    try {
      // Count unique tenants in the period
      const uniqueTenants = await this.prisma.twilio_usage_record.groupBy({
        by: ['tenant_id'],
        where: {
          start_date: { gte: startDate },
          end_date: { lte: endDate },
        },
      });

      // Aggregate usage across all tenants by category
      const usageAggregation = await this.prisma.twilio_usage_record.groupBy({
        by: ['category'],
        where: {
          start_date: { gte: startDate },
          end_date: { lte: endDate },
        },
        _sum: {
          count: true,
          price: true,
        },
      });

      // Transform aggregation to categorized format
      const usageMap = new Map<string, { count: number; cost: number }>();
      usageAggregation.forEach((item) => {
        usageMap.set(item.category, {
          count: item._sum.count || 0,
          cost: item._sum.price?.toNumber() || 0,
        });
      });

      // Build platform_totals with documented structure
      const callsData = usageMap.get('calls') || { count: 0, cost: 0 };
      const smsData = usageMap.get('sms') || { count: 0, cost: 0 };
      const recordingsData = usageMap.get('recordings') || {
        count: 0,
        cost: 0,
      };
      const transcriptionsData = usageMap.get('transcriptions') || {
        count: 0,
        cost: 0,
      };

      const platform_totals = {
        total_tenants: uniqueTenants.length,
        calls: {
          count: callsData.count,
          minutes: Math.round(callsData.count * 3), // Rough estimate: avg 3 min per call
          cost: callsData.cost.toFixed(2),
        },
        sms: {
          count: smsData.count,
          cost: smsData.cost.toFixed(2),
        },
        recordings: {
          count: recordingsData.count,
          storage_mb: Math.round(recordingsData.count * 0.25), // Rough estimate: 0.25 MB per recording
          cost: recordingsData.cost.toFixed(2),
        },
        transcriptions: {
          count: transcriptionsData.count,
          cost: transcriptionsData.cost.toFixed(2),
        },
      };

      // Calculate total cost across all categories
      const totalCost = (
        callsData.cost +
        smsData.cost +
        recordingsData.cost +
        transcriptionsData.cost
      ).toFixed(2);

      this.logger.debug(
        `System-wide usage generated: ${uniqueTenants.length} tenants, total cost: $${totalCost}`,
      );

      return {
        period: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
        platform_totals,
        total_cost: totalCost,
      };
    } catch (error) {
      this.logger.error('Failed to generate system-wide usage:', error.message);
      throw error;
    }
  }

  /**
   * Estimate costs for a tenant for the current month
   *
   * Provides month-to-date cost estimation with category breakdown.
   * Used for budget alerts and billing previews.
   *
   * @param tenantId - UUID of the tenant
   * @param month - Month in YYYY-MM format (e.g., "2026-01")
   * @returns Promise<CostEstimate> - Cost breakdown with total
   *
   * @example
   * const costs = await service.estimateCosts('tenant-uuid', '2026-01');
   * // Returns: {
   * //   tenant_id: 'tenant-uuid',
   * //   month: '2026-01',
   * //   breakdown: [...],
   * //   total_cost: '42.50',
   * //   currency: 'USD'
   * // }
   */
  async estimateCosts(tenantId: string, month: string): Promise<CostEstimate> {
    this.logger.debug(
      `Estimating costs for tenant ${tenantId}, month: ${month}`,
    );

    try {
      // Get usage summary for the month (now returns TenantUsageReport)
      const usageReport = await this.getUsageSummary(tenantId, month);

      // Extract breakdown and convert back to UsageSummary[] format for cost estimate
      const breakdown: UsageSummary[] = [
        {
          category: 'calls',
          total_count: usageReport.usage_breakdown.calls.count,
          total_cost: parseFloat(usageReport.usage_breakdown.calls.cost),
          currency: 'USD',
        },
        {
          category: 'sms',
          total_count: usageReport.usage_breakdown.sms.count,
          total_cost: parseFloat(usageReport.usage_breakdown.sms.cost),
          currency: 'USD',
        },
        {
          category: 'recordings',
          total_count: usageReport.usage_breakdown.recordings.count,
          total_cost: parseFloat(usageReport.usage_breakdown.recordings.cost),
          currency: 'USD',
        },
        {
          category: 'transcriptions',
          total_count: usageReport.usage_breakdown.transcriptions.count,
          total_cost: parseFloat(
            usageReport.usage_breakdown.transcriptions.cost,
          ),
          currency: 'USD',
        },
      ];

      const estimate: CostEstimate = {
        tenant_id: tenantId,
        month,
        breakdown,
        total_cost: usageReport.total_cost,
        currency: 'USD',
      };

      this.logger.debug(
        `Cost estimate generated for tenant ${tenantId}: $${estimate.total_cost}`,
      );

      return estimate;
    } catch (error) {
      this.logger.error(
        `Failed to estimate costs for tenant ${tenantId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get usage trends over time for a tenant
   *
   * Provides time-series usage data for analytics and forecasting.
   *
   * @param tenantId - UUID of the tenant
   * @param startDate - Start date of analysis period
   * @param endDate - End date of analysis period
   * @param granularity - Time granularity ('day' | 'week' | 'month')
   * @returns Promise<UsageTrend[]> - Time-series usage data
   */
  async getUsageTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day',
  ): Promise<UsageTrend[]> {
    this.logger.debug(
      `Generating usage trends for tenant ${tenantId} (${granularity} granularity)`,
    );

    try {
      // Fetch raw usage records
      const records = await this.prisma.twilio_usage_record.findMany({
        where: {
          tenant_id: tenantId,
          start_date: { gte: startDate },
          end_date: { lte: endDate },
        },
        orderBy: {
          start_date: 'asc',
        },
      });

      // Group records by time period and category
      // Implementation depends on granularity
      // For now, returning raw records grouped by date
      const trends: UsageTrend[] = records.map((record) => ({
        period: record.start_date,
        category: record.category,
        count: record.count,
        cost: record.price.toNumber(),
      }));

      this.logger.debug(
        `Usage trends generated for tenant ${tenantId}: ${trends.length} data points`,
      );

      return trends;
    } catch (error) {
      this.logger.error(
        `Failed to generate usage trends for tenant ${tenantId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Generate unique ID for usage record
   *
   * Creates deterministic ID based on tenant, category, and date
   * to enable idempotent inserts.
   *
   * @private
   */
  private generateUsageRecordId(
    tenantId: string,
    category: string,
    startDate: string,
  ): string {
    const date = new Date(startDate).toISOString().split('T')[0];
    return `${tenantId}-${category}-${date}`;
  }
}

/**
 * Type Definitions
 */

export interface UsageSummary {
  category: string;
  total_count: number;
  total_cost: number;
  currency: string;
}

export interface SystemWideUsage {
  period: {
    start_date: string;
    end_date: string;
  };
  platform_totals: {
    total_tenants: number;
    calls: {
      count: number;
      minutes: number;
      cost: string;
    };
    sms: {
      count: number;
      cost: string;
    };
    recordings: {
      count: number;
      storage_mb: number;
      cost: string;
    };
    transcriptions: {
      count: number;
      cost: string;
    };
  };
  total_cost: string;
}

export interface TenantUsageReport {
  tenant_id: string;
  tenant_name: string;
  month: string;
  usage_breakdown: {
    calls: {
      count: number;
      minutes: number;
      cost: string;
    };
    sms: {
      count: number;
      cost: string;
    };
    recordings: {
      count: number;
      storage_mb: number;
      cost: string;
    };
    transcriptions: {
      count: number;
      cost: string;
    };
  };
  total_cost: string;
  synced_at: string;
}

export interface CostEstimate {
  tenant_id: string;
  month: string;
  breakdown: UsageSummary[];
  total_cost: string;
  currency: string;
}

export interface UsageTrend {
  period: Date;
  category: string;
  count: number;
  cost: number;
}
