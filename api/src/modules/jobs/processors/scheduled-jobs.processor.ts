import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ExpiryCheckHandler } from '../handlers/expiry-check.handler';
import { DataCleanupHandler } from '../handlers/data-cleanup.handler';
import { JobRetentionHandler } from '../handlers/job-retention.handler';
import { PartitionMaintenanceHandler } from '../handlers/partition-maintenance.handler';

@Processor('scheduled')
export class ScheduledJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledJobsProcessor.name);

  constructor(
    private readonly expiryCheckHandler: ExpiryCheckHandler,
    private readonly dataCleanupHandler: DataCleanupHandler,
    private readonly jobRetentionHandler: JobRetentionHandler,
    private readonly partitionMaintenanceHandler: PartitionMaintenanceHandler,
  ) {
    super();
    this.logger.log('🚀 ScheduledJobsProcessor worker initialized and ready');
  }

  async process(job: Job): Promise<any> {
    const jobId = job.data.jobId || (job.id as string);
    this.logger.log(`📥 Received job: ${job.name} (${jobId})`);

    try {
      switch (job.name) {
        case 'expiry-check':
          return await this.expiryCheckHandler.execute(jobId, job.data);

        case 'data-cleanup':
          return await this.dataCleanupHandler.execute(jobId, job.data);

        case 'job-retention':
          return await this.jobRetentionHandler.execute(jobId, job.data);

        case 'partition-maintenance':
          return await this.partitionMaintenanceHandler.execute(jobId, job.data);

        default:
          this.logger.warn(`❌ Unknown job type: ${job.name} - skipping`);
          return { success: false, error: 'Unknown job type' };
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to process job ${job.name} (${jobId}): ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
