import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Voice AI Jobs Scheduler
 *
 * Enqueues periodic background jobs for the Voice AI module:
 *
 * 1. Monthly Quota Reset — 1st of every month at 00:00
 *    Aggregates previous month's usage and logs billing summary.
 *    New-month records auto-create on first call (no explicit reset needed).
 *
 * 2. Daily Usage Sync — Every day at 02:00
 *    Audits consistency between completed call logs and usage records.
 *    Warns ops if billing data appears to be missing.
 *
 * 3. Stuck Call Cleanup — Every hour at :15 minutes past the hour
 *    Auto-fails calls stuck in 'in_progress' status for >2 hours.
 *    Prevents stuck calls from polluting active call metrics.
 *
 * NOTE: ScheduleModule.forRoot() is registered in AppModule — do NOT add it
 * here to avoid double-firing of cron jobs.
 *
 * @class VoiceAiJobsScheduler
 * @since Sprint B10
 */
@Injectable()
export class VoiceAiJobsScheduler {
  private readonly logger = new Logger(VoiceAiJobsScheduler.name);

  constructor(
    @InjectQueue('voice-ai-quota-reset')
    private readonly quotaResetQueue: Queue,
    @InjectQueue('voice-ai-usage-sync') private readonly usageSyncQueue: Queue,
    @InjectQueue('voice-ai-stuck-call-cleanup')
    private readonly stuckCallCleanupQueue: Queue,
  ) {}

  /**
   * Monthly Quota Reset
   *
   * Fires at midnight on the 1st of every month.
   * Uses a fixed jobId so BullMQ deduplicates if the cron fires more than once
   * within the same execution window.
   */
  @Cron('0 0 1 * *')
  async scheduleMonthlyReset(): Promise<void> {
    try {
      this.logger.log('Enqueueing monthly Voice AI quota reset job');
      await this.quotaResetQueue.add(
        'monthly-reset',
        {},
        { jobId: 'monthly-reset' },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue monthly quota reset job: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Daily Usage Sync
   *
   * Fires every day at 02:00 AM.
   * Uses a timestamp-based jobId so each daily run is a distinct job.
   */
  @Cron('0 2 * * *')
  async scheduleDailySync(): Promise<void> {
    try {
      this.logger.log('Enqueueing daily Voice AI usage sync job');
      await this.usageSyncQueue.add(
        'daily-sync',
        {},
        { jobId: `daily-sync-${Date.now()}` },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue daily usage sync job: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Stuck Call Cleanup
   *
   * Fires every hour at :15 minutes past the hour (00:15, 01:15, 02:15, etc.)
   * Cleans up calls stuck in 'in_progress' status for more than 2 hours.
   * Uses a timestamp-based jobId so each run is a distinct job.
   *
   * Why hourly?
   * - Frequent enough to keep metrics accurate
   * - Not so frequent that it impacts performance
   * - 2-hour threshold prevents false positives from long calls
   */
  @Cron('15 * * * *')
  async scheduleStuckCallCleanup(): Promise<void> {
    try {
      this.logger.log('Enqueueing stuck call cleanup job');
      await this.stuckCallCleanupQueue.add(
        'cleanup-stuck-calls',
        {},
        { jobId: `stuck-call-cleanup-${Date.now()}` },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue stuck call cleanup job: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
