import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminReportingService } from './admin-reporting.service';

/**
 * ScheduledReportSchedulerService
 *
 * Executes scheduled reports based on their schedule (daily, weekly, monthly)
 * Runs every hour to check for reports that are due
 */
@Injectable()
export class ScheduledReportSchedulerService {
  private readonly logger = new Logger(ScheduledReportSchedulerService.name);

  constructor(private readonly adminReportingService: AdminReportingService) {}

  /**
   * Cron job to execute scheduled reports
   * Runs every hour at the start of the hour (0 minutes)
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'execute-scheduled-reports',
    timeZone: 'UTC',
  })
  async handleScheduledReports(): Promise<void> {
    this.logger.log('Starting scheduled reports execution check');

    try {
      await this.adminReportingService.executeScheduledReports();
      this.logger.log('Scheduled reports execution check completed');
    } catch (error) {
      this.logger.error(
        `Failed to execute scheduled reports: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manual trigger for testing
   * Can be called directly for testing purposes
   */
  async triggerManually(): Promise<void> {
    this.logger.log('Manual trigger for scheduled reports');
    await this.handleScheduledReports();
  }
}
