import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';

@Injectable()
export class JobRetentionHandler {
  private readonly logger = new Logger(JobRetentionHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
  ) {
    this.logger.log('JobRetentionHandler initialized');
  }

  async execute(jobId: string, payload: any): Promise<any> {
    this.logger.log(`🔄 PROCESSING: Starting job retention cleanup ${jobId}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

      // Delete old jobs (except last 100 per scheduled job)
      const scheduledJobs = await this.prisma.scheduled_job.findMany({
        select: { job_type: true },
      });

      let totalDeleted = 0;

      for (const schedule of scheduledJobs) {
        // Keep last 100 runs of each scheduled job
        const jobsToKeep = await this.prisma.job.findMany({
          where: { job_type: schedule.job_type },
          orderBy: { created_at: 'desc' },
          take: 100,
          select: { id: true },
        });

        const keepIds = jobsToKeep.map((j) => j.id);

        const deleted = await this.prisma.job.deleteMany({
          where: {
            job_type: schedule.job_type,
            created_at: { lt: cutoffDate },
            id: { notIn: keepIds },
          },
        });

        totalDeleted += deleted.count;
      }

      // Delete old non-scheduled jobs (all older than 30 days)
      const scheduledJobTypes = scheduledJobs.map((s) => s.job_type);

      const deletedOthers = await this.prisma.job.deleteMany({
        where: {
          job_type: { notIn: scheduledJobTypes },
          created_at: { lt: cutoffDate },
        },
      });

      totalDeleted += deletedOthers.count;

      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { jobsDeleted: totalDeleted },
      });

      await this.jobQueue.logJobExecution(
        jobId,
        'info',
        `Job retention cleanup completed: ${totalDeleted} jobs deleted`,
        { jobsDeleted: totalDeleted },
      );

      this.logger.log(`Job retention cleanup completed: ${totalDeleted} jobs deleted`);

      return { success: true, jobsDeleted: totalDeleted };
    } catch (error) {
      this.logger.error(
        `Job retention cleanup ${jobId} failed: ${error.message}`,
        error.stack,
      );

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      throw error;
    }
  }
}
