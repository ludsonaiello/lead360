import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TwilioUsageTrackingService } from '../services/admin/twilio-usage-tracking.service';

/**
 * Twilio Usage Sync Scheduler
 *
 * CRITICAL CRON JOB - Fulfills AC-18: "Usage tracking syncs nightly"
 *
 * Responsibilities:
 * - Syncs usage data from Twilio API every night at 2:00 AM
 * - Processes all active tenants automatically
 * - Fetches yesterday's usage data (calls, SMS, recordings, transcriptions)
 * - Stores usage records in database for cost tracking and billing
 *
 * Schedule: Daily at 2:00 AM (server timezone)
 * Cron Expression: '0 2 * * *' (minute=0, hour=2, every day)
 *
 * Why 2:00 AM?
 * - Low traffic period (minimal API load)
 * - Allows full 24-hour data from Twilio API
 * - Completes before business hours start
 * - Gives buffer for retry if needed
 *
 * Error Handling:
 * - Logs all errors but continues processing
 * - One tenant failure doesn't stop others
 * - Failed tenants can be manually synced via admin endpoint
 *
 * Monitoring:
 * - Logs start and completion of sync
 * - Reports success/failure counts
 * - Can be monitored via system logs
 *
 * @class TwilioUsageSyncScheduler
 * @since Sprint 8
 */
@Injectable()
export class TwilioUsageSyncScheduler {
  private readonly logger = new Logger(TwilioUsageSyncScheduler.name);

  constructor(
    private readonly twilioUsageTrackingService: TwilioUsageTrackingService,
  ) {}

  /**
   * Nightly Usage Sync Job
   *
   * NOTE: This scheduler is now managed dynamically by DynamicCronManagerService.
   * The Cron decorator has been removed to allow runtime configuration.
   * Schedule is configured via system_settings table.
   * Setting key: twilio_usage_sync_cron
   *
   * This method is kept for manual triggering via admin endpoint.
   */
  async handleNightlyUsageSync() {
    this.logger.log(
      '🌙 Starting nightly Twilio usage sync for all active tenants...',
    );

    const startTime = Date.now();

    try {
      // Run usage sync for all active tenants
      await this.twilioUsageTrackingService.syncUsageForAllTenants();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.log(
        `✅ Nightly usage sync completed successfully in ${duration}s`,
      );
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.error(
        `❌ Failed to complete nightly usage sync after ${duration}s:`,
        error.message,
      );
      this.logger.error('Error stack:', error.stack);

      // Create admin alert for failed sync
      try {
        await this.twilioUsageTrackingService['prisma'].admin_alert.create({
          data: {
            id: require('uuid').v4(),
            type: 'USAGE_SYNC_FAILED',
            severity: 'HIGH',
            message: `Nightly usage sync failed after ${duration}s`,
            details: {
              error: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString(),
            },
            acknowledged: false,
            created_at: new Date(),
          },
        });
      } catch (alertError) {
        this.logger.error('Failed to create alert:', alertError.message);
      }
    }
  }

  /**
   * Manual trigger for testing
   *
   * This method can be called manually for testing purposes.
   * In production, use the admin endpoint: POST /admin/communication/usage/sync
   *
   * @example
   * // In your test:
   * await scheduler.triggerManualSync();
   */
  async triggerManualSync() {
    this.logger.log('Manual usage sync triggered');
    await this.handleNightlyUsageSync();
  }
}
