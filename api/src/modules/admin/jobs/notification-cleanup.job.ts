import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertService } from '../services/alert.service';

/**
 * Notification Cleanup Job
 *
 * Cleans up expired and old notifications at 2:00 AM every day.
 * - Deletes notifications older than 30 days
 * - Deletes explicitly expired notifications (expires_at < now)
 * - Enforces max 1000 notifications limit
 */
@Injectable()
export class NotificationCleanupJob {
  private readonly logger = new Logger(NotificationCleanupJob.name);

  constructor(private readonly alertService: AlertService) {}

  @Cron('0 2 * * *', {
    name: 'notification-cleanup',
    timeZone: 'America/New_York',
  })
  async handleCron() {
    this.logger.log('Running notification cleanup job...');

    try {
      const result = await this.alertService.cleanupExpiredNotifications();
      this.logger.log(
        `Notification cleanup complete: ${result.total_cleaned} notifications deleted (${result.old_deleted} old, ${result.expired_deleted} expired)`,
      );
    } catch (error) {
      this.logger.error(`Notification cleanup job failed: ${error.message}`, error.stack);
    }
  }
}
