import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { ScheduledJobService } from '../../jobs/services/scheduled-job.service';

/**
 * InsuranceExpiryCheckScheduler — Sprint 33
 *
 * Encapsulates the scheduling registration for the subcontractor insurance
 * expiry check job. Called from ProjectsModule.onModuleInit().
 *
 * Two responsibilities:
 *  1. Register the job in the scheduled_job table (idempotent — skip if exists)
 *     so it appears in the Platform Admin UI at /admin/jobs/schedules.
 *  2. Add a BullMQ repeatable job to the project-management queue.
 */
@Injectable()
export class InsuranceExpiryCheckScheduler {
  private readonly logger = new Logger(InsuranceExpiryCheckScheduler.name);

  private static readonly JOB_TYPE = 'subcontractor-insurance-check';
  private static readonly CRON = '0 7 * * *'; // Daily at 7:00 AM UTC

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduledJobService: ScheduledJobService,
  ) {}

  /**
   * Register the scheduled job in the DB and add the repeatable BullMQ job.
   * Safe to call on every module init (idempotent).
   */
  async setup(queue: Queue): Promise<void> {
    await this.registerScheduledJob();
    await this.addRepeatableJob(queue);
  }

  // ---------------------------------------------------------------------------
  // DB registration — makes the job visible in the admin UI
  // ---------------------------------------------------------------------------

  private async registerScheduledJob(): Promise<void> {
    try {
      const existing = await this.prisma.scheduled_job.findUnique({
        where: { job_type: InsuranceExpiryCheckScheduler.JOB_TYPE },
      });

      if (existing) {
        this.logger.log(
          `Scheduled job "${InsuranceExpiryCheckScheduler.JOB_TYPE}" already registered — skipping`,
        );
        return;
      }

      await this.scheduledJobService.registerScheduledJob({
        job_type: InsuranceExpiryCheckScheduler.JOB_TYPE,
        name: 'Subcontractor Insurance Expiry Check',
        description:
          'Daily scan for subcontractor insurance expiry. Notifies tenant owners and admins of expired or expiring insurance.',
        schedule: InsuranceExpiryCheckScheduler.CRON,
        timezone: 'UTC',
        max_retries: 3,
        timeout_seconds: 300,
      });

      this.logger.log(
        `Scheduled job "${InsuranceExpiryCheckScheduler.JOB_TYPE}" registered successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to register insurance expiry check scheduled job: ${error.message}`,
        error.stack,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // BullMQ repeatable job — actual cron scheduling
  // ---------------------------------------------------------------------------

  private async addRepeatableJob(queue: Queue): Promise<void> {
    try {
      await queue.add(
        InsuranceExpiryCheckScheduler.JOB_TYPE,
        {},
        {
          repeat: {
            pattern: InsuranceExpiryCheckScheduler.CRON,
            tz: 'UTC',
          },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      this.logger.log(
        `Repeatable insurance check job added to project-management queue (${InsuranceExpiryCheckScheduler.CRON} UTC)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to set up repeatable insurance check job: ${error.message}`,
        error.stack,
      );
    }
  }
}
