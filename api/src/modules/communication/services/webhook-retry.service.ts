import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Webhook Retry Service
 *
 * Automatically retries failed webhook processing with exponential backoff.
 *
 * Retry Strategy:
 * - Retry 1: 1 minute
 * - Retry 2: 5 minutes
 * - Retry 3: 15 minutes
 * - Retry 4: 1 hour
 * - Retry 5: 24 hours
 * - After 5 retries: Give up and mark as failed
 *
 * Responsibilities:
 * - Queue webhook events for retry with exponential backoff
 * - Process pending retries via cron job (every minute)
 * - Enforce max retry limit (5 attempts)
 * - Mark failed webhooks after exhausting retries
 * - Track retry count and next retry time
 *
 * Features:
 * - Automatic exponential backoff
 * - Idempotent retry operations
 * - Comprehensive logging
 * - Database-backed retry state
 * - Integration with BullMQ for async processing
 *
 * Usage:
 * ```typescript
 * // Queue a webhook for retry after failure
 * await webhookRetryService.queueRetry(webhookEventId);
 *
 * // Process pending retries (cron job)
 * await webhookRetryService.processPendingRetries();
 * ```
 *
 * @class WebhookRetryService
 * @since Sprint 7
 */
@Injectable()
export class WebhookRetryService {
  private readonly logger = new Logger(WebhookRetryService.name);
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAYS = [
    60 * 1000, // 1 minute
    5 * 60 * 1000, // 5 minutes
    15 * 60 * 1000, // 15 minutes
    60 * 60 * 1000, // 1 hour
    24 * 60 * 60 * 1000, // 24 hours
  ];

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhook-retry') private readonly retryQueue: Queue,
  ) {}

  /**
   * Queue webhook for retry
   *
   * Calculates next retry time based on exponential backoff schedule
   * and queues the webhook event for processing.
   *
   * If webhook has exceeded max retries, marks it as permanently failed.
   *
   * @param webhookEventId - Webhook event ID to retry
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * // After webhook processing fails
   * try {
   *   await processWebhook(event);
   * } catch (error) {
   *   await webhookRetryService.queueRetry(event.id);
   * }
   * ```
   */
  async queueRetry(webhookEventId: string): Promise<void> {
    this.logger.debug(`Checking retry eligibility for webhook ${webhookEventId}`);

    // Get current webhook event state
    const event = await this.prisma.webhook_event.findUnique({
      where: { id: webhookEventId },
    });

    if (!event) {
      this.logger.warn(`Webhook event ${webhookEventId} not found`);
      return;
    }

    // Check if max retries exceeded
    if (event.retry_count >= this.MAX_RETRIES) {
      this.logger.warn(
        `Webhook ${webhookEventId} exceeded max retries (${this.MAX_RETRIES})`,
      );
      await this.markAsFailed(webhookEventId);
      return;
    }

    // Calculate delay for next retry (exponential backoff)
    const delayMs =
      this.RETRY_DELAYS[event.retry_count] ||
      this.RETRY_DELAYS[this.MAX_RETRIES - 1];
    const nextRetryAt = new Date(Date.now() + delayMs);

    // Update webhook_event with retry metadata
    await this.prisma.webhook_event.update({
      where: { id: webhookEventId },
      data: {
        retry_count: event.retry_count + 1,
        next_retry_at: nextRetryAt,
      },
    });

    // Queue retry job with calculated delay
    await this.retryQueue.add(
      'retry-webhook',
      { webhookEventId },
      {
        delay: delayMs,
        jobId: `webhook-retry-${webhookEventId}-${event.retry_count + 1}`,
        removeOnComplete: true, // Clean up completed jobs
        removeOnFail: false, // Keep failed jobs for debugging
      },
    );

    this.logger.log(
      `✅ Queued webhook ${webhookEventId} for retry ${event.retry_count + 1}/${this.MAX_RETRIES} in ${this.formatDelay(delayMs)}`,
    );
  }

  /**
   * Process pending retries (cron job)
   *
   * Scans database for webhook events that:
   * - Are not processed (processed = false)
   * - Have next_retry_at in the past
   * - Have not exceeded max retries
   *
   * Queues each eligible webhook for retry processing.
   *
   * This method is called by WebhookRetryScheduler every minute.
   *
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * // Called by cron scheduler
   * @Cron(CronExpression.EVERY_MINUTE)
   * async processPendingRetries() {
   *   await webhookRetryService.processPendingRetries();
   * }
   * ```
   */
  async processPendingRetries(): Promise<void> {
    const now = new Date();

    this.logger.debug('🔍 Scanning for pending webhook retries...');

    // Find all webhooks eligible for retry
    const pendingRetries = await this.prisma.webhook_event.findMany({
      where: {
        processed: false,
        next_retry_at: { lte: now },
        retry_count: { lt: this.MAX_RETRIES },
      },
      take: 100, // Process up to 100 at a time
      orderBy: { next_retry_at: 'asc' }, // Oldest first
    });

    if (pendingRetries.length === 0) {
      this.logger.debug('No pending webhook retries found');
      return;
    }

    this.logger.log(
      `📋 Found ${pendingRetries.length} pending webhook retries, queuing...`,
    );

    // Queue each webhook for retry
    for (const event of pendingRetries) {
      try {
        await this.queueRetry(event.id);
      } catch (error) {
        this.logger.error(
          `Failed to queue retry for webhook ${event.id}: ${error.message}`,
        );
        // Continue processing other webhooks
      }
    }

    this.logger.log(
      `✅ Completed processing ${pendingRetries.length} pending webhook retries`,
    );
  }

  /**
   * Mark webhook as permanently failed
   *
   * Called when webhook has exceeded max retry attempts.
   * Sets error message and ensures processed remains false
   * so it appears in failed webhook reports.
   *
   * @param webhookEventId - Webhook event ID
   * @returns Promise<void>
   * @private
   */
  private async markAsFailed(webhookEventId: string): Promise<void> {
    await this.prisma.webhook_event.update({
      where: { id: webhookEventId },
      data: {
        error_message: `Max retries exceeded (${this.MAX_RETRIES} attempts)`,
        processed: false, // Keep as unprocessed so it shows in failed reports
      },
    });

    this.logger.error(
      `❌ Webhook ${webhookEventId} permanently failed after ${this.MAX_RETRIES} retry attempts`,
    );
  }

  /**
   * Format delay in human-readable format
   *
   * @param delayMs - Delay in milliseconds
   * @returns Formatted string (e.g., "1 minute", "5 minutes", "1 hour")
   * @private
   */
  private formatDelay(delayMs: number): string {
    const seconds = delayMs / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;

    if (hours >= 1) {
      return `${Math.floor(hours)} hour${hours >= 2 ? 's' : ''}`;
    } else if (minutes >= 1) {
      return `${Math.floor(minutes)} minute${minutes >= 2 ? 's' : ''}`;
    } else {
      return `${Math.floor(seconds)} second${seconds >= 2 ? 's' : ''}`;
    }
  }
}
