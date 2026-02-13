import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookRetryService } from '../services/webhook-retry.service';

/**
 * Webhook Retry Scheduler
 *
 * Automatic Webhook Retry Processor
 *
 * Responsibilities:
 * - Runs every minute to process pending webhook retries
 * - Scans database for webhooks with next_retry_at in the past
 * - Queues eligible webhooks for retry processing
 * - Enforces max retry limits
 * - Provides comprehensive logging
 *
 * Schedule: Every minute
 * Cron Pattern: * * * * * (every minute)
 *
 * Why Every Minute:
 * - Ensures timely retry of failed webhooks
 * - First retry is 1 minute after failure (meets SLA)
 * - Low overhead - only queries database for eligible retries
 * - Webhooks are processed asynchronously via BullMQ
 * - Database query is optimized with indexes on (processed, next_retry_at)
 *
 * Retry Strategy:
 * - Retry 1: 1 minute after failure
 * - Retry 2: 5 minutes after retry 1
 * - Retry 3: 15 minutes after retry 2
 * - Retry 4: 1 hour after retry 3
 * - Retry 5: 24 hours after retry 4
 * - After 5 retries: Give up
 *
 * Performance:
 * - Processes up to 100 webhooks per run
 * - Each webhook queued asynchronously (non-blocking)
 * - Total execution time: <1 second for typical load
 * - Database query optimized with composite index
 *
 * Database Query:
 * ```sql
 * SELECT * FROM webhook_event
 * WHERE processed = false
 *   AND next_retry_at <= NOW()
 *   AND retry_count < 5
 * ORDER BY next_retry_at ASC
 * LIMIT 100
 * ```
 *
 * Integration:
 * - Works with WebhookRetryService for retry logic
 * - Works with WebhookRetryProcessor for actual processing
 * - Uses BullMQ for async job queue
 *
 * @class WebhookRetryScheduler
 * @since Sprint 7
 */
@Injectable()
export class WebhookRetryScheduler {
  private readonly logger = new Logger(WebhookRetryScheduler.name);

  constructor(private readonly webhookRetry: WebhookRetryService) {}

  /**
   * Periodic Webhook Retry Job
   *
   * Runs every minute to process pending webhook retries.
   *
   * This scheduler can be managed dynamically by DynamicCronManagerService
   * if needed in the future, but for now uses standard @Cron decorator
   * for simplicity and reliability.
   *
   * @Cron(CronExpression.EVERY_MINUTE)
   *
   * @returns Promise<void>
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleWebhookRetries(): Promise<void> {
    this.logger.debug('🔄 Running webhook retry scheduler...');

    const startTime = Date.now();

    try {
      // Process pending retries (scans DB, queues eligible webhooks)
      await this.webhookRetry.processPendingRetries();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.debug(
        `✅ Webhook retry scheduler completed in ${duration}s`,
      );
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.error(
        `❌ Webhook retry scheduler failed after ${duration}s: ${error.message}`,
      );
      this.logger.error('Error stack:', error.stack);

      // Don't throw - scheduler should continue running
      // Next run in 1 minute will retry
    }
  }

  /**
   * Manual trigger for testing
   *
   * This method can be called manually for testing or admin operations.
   * In production, the cron job handles automatic execution.
   *
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * // In your test or admin endpoint:
   * await webhookRetryScheduler.triggerManualRetry();
   * ```
   */
  async triggerManualRetry(): Promise<void> {
    this.logger.log('🔧 Manual webhook retry triggered');
    await this.handleWebhookRetries();
  }
}
