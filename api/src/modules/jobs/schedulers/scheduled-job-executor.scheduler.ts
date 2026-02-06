import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';
import { ScheduledJobService } from '../services/scheduled-job.service';

@Injectable()
export class ScheduledJobExecutor {
  private readonly logger = new Logger(ScheduledJobExecutor.name);
  private isRunning = false;
  private lastStartTime: Date | null = null;
  private consecutiveSkips = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
    private readonly scheduledJobService: ScheduledJobService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndExecuteScheduledJobs() {
    if (this.isRunning) {
      this.consecutiveSkips++;

      // Only warn if execution is taking abnormally long (>2 minutes)
      if (this.consecutiveSkips >= 2) {
        const runningDuration = this.lastStartTime
          ? Math.floor((Date.now() - this.lastStartTime.getTime()) / 1000)
          : 'unknown';
        this.logger.warn(
          `Scheduled job executor still running after ${runningDuration}s (${this.consecutiveSkips} consecutive skips). ` +
            `This may indicate slow database queries or long-running jobs.`,
        );
      }
      return;
    }

    this.isRunning = true;
    this.lastStartTime = new Date();
    this.consecutiveSkips = 0;

    try {
      const now = new Date();

      // Find all enabled jobs that are due
      const dueJobs = await this.prisma.scheduled_job.findMany({
        where: {
          is_enabled: true,
          next_run_at: { lte: now },
        },
      });

      this.logger.log(
        `Found ${dueJobs.length} scheduled jobs due for execution`,
      );

      for (const schedule of dueJobs) {
        try {
          // Queue the job
          await this.jobQueue.queueScheduledJob(schedule.job_type, {
            scheduleId: schedule.id,
            scheduleName: schedule.name,
          });

          // Update last_run_at and next_run_at
          await this.scheduledJobService.updateLastRun(
            schedule.id,
            schedule.schedule,
            schedule.timezone,
          );

          this.logger.log(
            `Queued scheduled job: ${schedule.name} (${schedule.job_type})`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to queue scheduled job ${schedule.name}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Scheduled job executor failed: ${error.message}`,
        error.stack,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
