import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { randomBytes } from 'crypto';
import * as parser from 'cron-parser';

@Injectable()
export class ScheduledJobService {
  private readonly logger = new Logger(ScheduledJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a new scheduled job
   * @param data Scheduled job configuration
   * @returns Created scheduled job record
   */
  async registerScheduledJob(data: {
    job_type: string;
    name: string;
    description?: string;
    schedule: string; // cron expression
    timezone?: string;
    max_retries?: number;
    timeout_seconds?: number;
  }) {
    // Validate cron expression
    try {
      parser.parseExpression(data.schedule, {
        tz: data.timezone || 'America/New_York',
      });
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error.message}`);
    }

    const nextRun = this.calculateNextRun(data.schedule, data.timezone);

    const scheduledJob = await this.prisma.scheduled_job.create({
      data: {
        id: randomBytes(16).toString('hex'),
        ...data,
        timezone: data.timezone || 'America/New_York',
        next_run_at: nextRun,
      },
    });

    this.logger.log(
      `Scheduled job registered: ${data.name} (${data.job_type}) - Next run: ${nextRun.toISOString()}`,
    );

    return scheduledJob;
  }

  /**
   * Update scheduled job configuration
   * @param scheduleId Scheduled job ID
   * @param updates Partial updates
   * @returns Updated scheduled job
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<{
      name: string;
      description: string;
      schedule: string;
      timezone: string;
      is_enabled: boolean;
      max_retries: number;
      timeout_seconds: number;
    }>,
  ) {
    if (updates.schedule) {
      const existing = await this.prisma.scheduled_job.findUnique({
        where: { id: scheduleId },
      });

      if (!existing) {
        throw new Error(`Scheduled job with ID ${scheduleId} not found`);
      }

      const timezone = updates.timezone || existing.timezone;

      try {
        parser.parseExpression(updates.schedule, { tz: timezone });
      } catch (error) {
        throw new Error(`Invalid cron expression: ${error.message}`);
      }

      // Recalculate next run time if schedule or timezone changed
      updates['next_run_at'] = this.calculateNextRun(updates.schedule, timezone);
    }

    const updated = await this.prisma.scheduled_job.update({
      where: { id: scheduleId },
      data: updates,
    });

    this.logger.log(`Scheduled job updated: ${updated.name} (${scheduleId})`);

    return updated;
  }

  /**
   * Get execution history for a scheduled job
   * @param scheduleId Scheduled job ID
   * @param limit Max number of records to return
   * @returns Array of job executions
   */
  async getScheduleHistory(scheduleId: string, limit: number = 100) {
    // First, get the scheduled job to find its job_type
    const scheduledJob = await this.prisma.scheduled_job.findUnique({
      where: { id: scheduleId },
      select: { job_type: true },
    });

    if (!scheduledJob) {
      throw new Error('Scheduled job not found');
    }

    // Find all job executions for this job_type
    return this.prisma.job.findMany({
      where: {
        job_type: scheduledJob.job_type,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Calculate next run time based on cron expression and timezone
   * @param cronExpression Cron expression (e.g., '0 6 * * *')
   * @param timezone IANA timezone (e.g., 'America/New_York')
   * @returns Next run date
   */
  calculateNextRun(
    cronExpression: string,
    timezone: string = 'America/New_York',
  ): Date {
    const interval = parser.parseExpression(cronExpression, { tz: timezone });
    return interval.next().toDate();
  }

  /**
   * Update last run time and calculate next run time
   * @param scheduleId Scheduled job ID
   * @param schedule Cron expression
   * @param timezone Timezone
   */
  async updateLastRun(
    scheduleId: string,
    schedule: string,
    timezone: string,
  ): Promise<void> {
    const nextRun = this.calculateNextRun(schedule, timezone);

    await this.prisma.scheduled_job.update({
      where: { id: scheduleId },
      data: {
        last_run_at: new Date(),
        next_run_at: nextRun,
      },
    });

    this.logger.debug(
      `Scheduled job ${scheduleId} updated - Next run: ${nextRun.toISOString()}`,
    );
  }

  /**
   * Get all jobs due for execution
   * @returns Array of scheduled jobs that should run now
   */
  async getJobsDueForExecution() {
    const now = new Date();

    return this.prisma.scheduled_job.findMany({
      where: {
        is_enabled: true,
        next_run_at: {
          lte: now,
        },
      },
    });
  }
}
