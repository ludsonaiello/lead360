import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertService } from '../services/alert.service';

/**
 * Daily Stats Email Job
 *
 * Sends daily statistics email to all Platform Admins at 8:00 AM every day.
 * Includes dashboard metrics, growth trends, and recent activity.
 */
@Injectable()
export class DailyStatsEmailJob {
  private readonly logger = new Logger(DailyStatsEmailJob.name);

  constructor(private readonly alertService: AlertService) {}

  @Cron('0 8 * * *', {
    name: 'daily-stats-email',
    timeZone: 'America/New_York',
  })
  async handleCron() {
    this.logger.log('Running daily stats email job...');

    try {
      const result = await this.alertService.sendDailyStatsEmail();
      this.logger.log(`Daily stats email sent to ${result?.sent_to || 0} Platform Admins`);
    } catch (error) {
      this.logger.error(`Daily stats email job failed: ${error.message}`, error.stack);
    }
  }
}
