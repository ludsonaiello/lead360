import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MaintenanceModeService } from '../services/maintenance-mode.service';

/**
 * Maintenance Mode Check Job
 *
 * Checks every minute if scheduled maintenance mode should be auto-disabled.
 * If maintenance mode is enabled, scheduled, and past end_time, disables it automatically.
 */
@Injectable()
export class MaintenanceModeCheckJob {
  private readonly logger = new Logger(MaintenanceModeCheckJob.name);

  constructor(
    private readonly maintenanceModeService: MaintenanceModeService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'maintenance-mode-check',
  })
  async handleCron() {
    try {
      await this.maintenanceModeService.disableMaintenanceMode();
    } catch (error) {
      // Don't log every minute - only log when there's an actual error (not "already disabled")
      if (error.message && !error.message.includes('already')) {
        this.logger.error(
          `Maintenance mode check failed: ${error.message}`,
          error.stack,
        );
      }
    }
  }
}
