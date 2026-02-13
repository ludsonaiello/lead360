import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../../../core/database/prisma.service';
import { TwilioUsageTrackingService } from './twilio-usage-tracking.service';
import { TwilioHealthMonitorService } from './twilio-health-monitor.service';

/**
 * Dynamic Cron Manager Service
 *
 * Manages cron schedules dynamically from system settings.
 * Replaces hardcoded Cron decorators with runtime-configurable jobs.
 *
 * Features:
 * - Loads cron expressions from system_settings table
 * - Updates cron jobs at runtime when settings change
 * - Supports enable and disable flags
 * - Uses configurable timezone
 */
@Injectable()
export class DynamicCronManagerService implements OnModuleInit {
  private readonly logger = new Logger(DynamicCronManagerService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly twilioUsageTrackingService: TwilioUsageTrackingService,
    private readonly twilioHealthMonitorService: TwilioHealthMonitorService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing dynamic cron jobs from system settings...');
    await this.initializeCronJobs();
  }

  private async initializeCronJobs() {
    try {
      const settings = await this.loadCronSettings();

      if (settings.twilio_usage_sync_enabled) {
        await this.addUsageSyncJob(
          settings.twilio_usage_sync_cron,
          settings.cron_timezone,
        );
      } else {
        this.logger.warn('Usage sync job is disabled in system settings');
      }

      if (settings.twilio_health_check_enabled) {
        await this.addHealthCheckJob(
          settings.twilio_health_check_cron,
          settings.cron_timezone,
        );
      } else {
        this.logger.warn('Health check job is disabled in system settings');
      }

      this.logger.log('✅ All cron jobs initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize cron jobs:', error.message);
      this.logger.error(error.stack);
    }
  }

  private async loadCronSettings() {
    const [
      usageSyncCron,
      healthCheckCron,
      timezone,
      usageSyncEnabled,
      healthCheckEnabled,
    ] = await Promise.all([
      this.getSetting('twilio_usage_sync_cron', '0 2 * * *'),
      this.getSetting('twilio_health_check_cron', '*/15 * * * *'),
      this.getSetting('cron_timezone', 'America/New_York'),
      this.getSetting('twilio_usage_sync_enabled', 'true'),
      this.getSetting('twilio_health_check_enabled', 'true'),
    ]);

    return {
      twilio_usage_sync_cron: usageSyncCron,
      twilio_health_check_cron: healthCheckCron,
      cron_timezone: timezone,
      twilio_usage_sync_enabled: usageSyncEnabled === 'true',
      twilio_health_check_enabled: healthCheckEnabled === 'true',
    };
  }

  private async getSetting(key: string, defaultValue: string): Promise<string> {
    try {
      const setting = await this.prisma.system_setting.findUnique({
        where: { setting_key: key },
      });
      return setting?.setting_value || defaultValue;
    } catch (error) {
      this.logger.warn(
        `Failed to load setting ${key}, using default: ${defaultValue}`,
      );
      return defaultValue;
    }
  }

  async addUsageSyncJob(cronExpression: string, timezone: string) {
    const jobName = 'twilio-usage-nightly-sync';

    try {
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
        this.logger.log(`Removed existing job: ${jobName}`);
      }

      const job = new CronJob(
        cronExpression,
        async () => {
          this.logger.log(
            '🌙 Starting nightly Twilio usage sync for all active tenants...',
          );
          const startTime = Date.now();

          try {
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
          }
        },
        null,
        true,
        timezone,
      );

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();

      this.logger.log(
        `✓ Usage sync job scheduled: ${cronExpression} (${timezone})`,
      );
    } catch (error) {
      this.logger.error(`Failed to add usage sync job:`, error.message);
      throw error;
    }
  }

  async addHealthCheckJob(cronExpression: string, timezone: string) {
    const jobName = 'twilio-health-check-periodic';

    try {
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
        this.logger.log(`Removed existing job: ${jobName}`);
      }

      const job = new CronJob(
        cronExpression,
        async () => {
          this.logger.debug('🏥 Running Twilio system health check...');
          const startTime = Date.now();

          try {
            const healthStatus =
              await this.twilioHealthMonitorService.runSystemHealthCheck();
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            if (healthStatus.isHealthy) {
              this.logger.debug(
                `✅ System health check passed (${duration}s) - All systems HEALTHY`,
              );
            } else {
              this.logger.warn(
                `⚠️  System health check completed (${duration}s) - DEGRADED or DOWN detected`,
              );
              await this.twilioHealthMonitorService.alertOnFailures(
                healthStatus,
              );
            }
          } catch (error) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.error(
              `❌ Health check execution failed after ${duration}s:`,
              error.message,
            );
            this.logger.error('Error stack:', error.stack);
          }
        },
        null,
        true,
        timezone,
      );

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();

      this.logger.log(
        `✓ Health check job scheduled: ${cronExpression} (${timezone})`,
      );
    } catch (error) {
      this.logger.error(`Failed to add health check job:`, error.message);
      throw error;
    }
  }

  async updateCronSchedules() {
    this.logger.log('Reloading cron schedules from system settings...');
    await this.initializeCronJobs();
    this.logger.log('Cron schedules updated successfully');
  }

  async getCronJobStatus() {
    const settings = await this.loadCronSettings();

    return {
      usage_sync: {
        enabled: settings.twilio_usage_sync_enabled,
        schedule: settings.twilio_usage_sync_cron,
        timezone: settings.cron_timezone,
        status: this.schedulerRegistry.doesExist(
          'cron',
          'twilio-usage-nightly-sync',
        )
          ? 'running'
          : 'stopped',
      },
      health_check: {
        enabled: settings.twilio_health_check_enabled,
        schedule: settings.twilio_health_check_cron,
        timezone: settings.cron_timezone,
        status: this.schedulerRegistry.doesExist(
          'cron',
          'twilio-health-check-periodic',
        )
          ? 'running'
          : 'stopped',
      },
    };
  }
}
