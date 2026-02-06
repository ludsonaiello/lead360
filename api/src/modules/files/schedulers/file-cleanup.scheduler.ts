import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Scheduler for automated file cleanup jobs
 * Triggers daily cleanup at midnight
 */
@Injectable()
export class FileCleanupScheduler {
  private readonly logger = new Logger(FileCleanupScheduler.name);

  constructor(@InjectQueue('file-cleanup') private fileCleanupQueue: Queue) {}

  /**
   * Daily cleanup job - runs at midnight (00:00)
   * Adds job to BullMQ queue for processing
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleDailyCleanup() {
    this.logger.log('Scheduling daily file cleanup job');

    try {
      await this.fileCleanupQueue.add(
        'daily-cleanup',
        {},
        {
          attempts: 3, // Retry up to 3 times on failure
          backoff: {
            type: 'exponential',
            delay: 60000, // Start with 1 minute delay
          },
          removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 1000,
          },
          removeOnFail: false, // Keep failed jobs for debugging
        },
      );

      this.logger.log('Daily cleanup job added to queue successfully');
    } catch (error) {
      this.logger.error(
        `Failed to schedule daily cleanup: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manually trigger cleanup for a specific tenant
   * Can be called from an admin endpoint
   */
  async triggerManualCleanup(tenantId: string, userId: string) {
    this.logger.log(`Triggering manual cleanup for tenant ${tenantId}`);

    try {
      const job = await this.fileCleanupQueue.add(
        'manual-cleanup',
        {
          tenantId,
          userId,
        },
        {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 30000, // 30 seconds
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 100,
          },
          removeOnFail: false,
        },
      );

      this.logger.log(`Manual cleanup job created with ID: ${job.id}`);
      return { jobId: job.id };
    } catch (error) {
      this.logger.error(
        `Failed to trigger manual cleanup for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
