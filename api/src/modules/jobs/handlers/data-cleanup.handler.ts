import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';

@Injectable()
export class DataCleanupHandler {
  private readonly logger = new Logger(DataCleanupHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
  ) {
    this.logger.log('DataCleanupHandler initialized');
  }

  async execute(jobId: string, payload: any): Promise<any> {
    this.logger.log(`🔄 PROCESSING: Starting data cleanup job ${jobId}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneDayAgo = new Date(now.getTime() - 86400000);

      let totalDeleted = 0;

      // Delete expired password reset tokens (1 hour expiry)
      const deletedResetTokens = await this.prisma.user.updateMany({
        where: {
          password_reset_token: { not: null },
          password_reset_expires: { lt: oneHourAgo },
        },
        data: {
          password_reset_token: null,
          password_reset_expires: null,
        },
      });

      totalDeleted += deletedResetTokens.count;

      await this.jobQueue.logJobExecution(
        jobId,
        'info',
        `Deleted ${deletedResetTokens.count} expired password reset tokens`,
      );

      // Delete expired activation tokens (24 hours expiry)
      const deletedActivationTokens = await this.prisma.user.updateMany({
        where: {
          activation_token: { not: null },
          activation_token_expires: { lt: oneDayAgo },
        },
        data: {
          activation_token: null,
          activation_token_expires: null,
        },
      });

      totalDeleted += deletedActivationTokens.count;

      await this.jobQueue.logJobExecution(
        jobId,
        'info',
        `Deleted ${deletedActivationTokens.count} expired activation tokens`,
      );

      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { tokensDeleted: totalDeleted },
      });

      await this.jobQueue.logJobExecution(
        jobId,
        'info',
        `Data cleanup completed: ${totalDeleted} tokens cleaned`,
        { tokensDeleted: totalDeleted },
      );

      this.logger.log(`Data cleanup completed: ${totalDeleted} tokens cleaned`);

      return { success: true, tokensDeleted: totalDeleted };
    } catch (error) {
      this.logger.error(
        `Data cleanup job ${jobId} failed: ${error.message}`,
        error.stack,
      );

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      throw error;
    }
  }
}
