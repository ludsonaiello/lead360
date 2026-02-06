import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('scheduled') private scheduledQueue: Queue,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('JobQueueService initialized');
    this.setupQueueEventHandlers();
    this.logQueueStatus();
  }

  /**
   * Setup event handlers for queue connection monitoring
   */
  private setupQueueEventHandlers() {
    // Email queue connection events
    this.emailQueue.on('error', (error) => {
      this.logger.error(`Email queue error: ${error.message}`);
    });

    // Scheduled queue connection events
    this.scheduledQueue.on('error', (error) => {
      this.logger.error(`Scheduled queue error: ${error.message}`);
    });

    this.logger.debug('Queue event handlers registered');
  }

  private async logQueueStatus() {
    try {
      const emailClient = await this.emailQueue.client;
      const scheduledClient = await this.scheduledQueue.client;
      const emailHealth = await emailClient.ping();
      const scheduledHealth = await scheduledClient.ping();
      this.logger.log(`Email queue connected: ${emailHealth === 'PONG'}`);
      this.logger.log(
        `Scheduled queue connected: ${scheduledHealth === 'PONG'}`,
      );
    } catch (error) {
      this.logger.error(
        `Queue connection error: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Check if queue connection is healthy
   * @returns true if connection is alive, false otherwise
   */
  private async isQueueHealthy(queue: Queue): Promise<boolean> {
    try {
      const client = await queue.client;
      const result = await client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.warn(`Queue health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Queue email sending job
   * @param data Email job data including recipient, template, variables
   * @returns Job ID (UUID)
   */
  async queueEmail(data: {
    to: string;
    cc?: string[];
    bcc?: string[];
    templateKey: string;
    variables: Record<string, any>;
    tenantId?: string;
  }): Promise<{ jobId: string }> {
    const jobId = randomBytes(16).toString('hex');

    // Check queue health before attempting to queue
    const isHealthy = await this.isQueueHealthy(this.emailQueue);
    if (!isHealthy) {
      const error = new Error(
        'Email queue connection is not healthy. Retrying connection...',
      );
      this.logger.warn(error.message);

      // Try to reconnect by checking status again
      await this.logQueueStatus();

      // Throw error to trigger retry at caller level
      throw error;
    }

    try {
      // Create job record in database
      await this.prisma.job.create({
        data: {
          id: jobId,
          job_type: 'send-email',
          status: 'pending',
          tenant_id: data.tenantId,
          payload: data as any,
          max_retries: 3,
        },
      });

      // Queue to BullMQ
      await this.emailQueue.add('send-email', data, {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // 24 hours
          count: 1000,
        },
        removeOnFail: false, // Keep failed jobs for manual retry
      });

      this.logger.log(`Email job queued: ${jobId} to ${data.to}`);

      return { jobId };
    } catch (error) {
      this.logger.error(
        `Failed to queue email job: ${error.message}`,
        error.stack,
      );

      // Cleanup orphaned DB record if queueing failed
      await this.prisma.job
        .deleteMany({
          where: { id: jobId },
        })
        .catch((deleteError) => {
          this.logger.error(
            `Failed to cleanup orphaned job record ${jobId}: ${deleteError.message}`,
          );
        });

      throw error;
    }
  }

  /**
   * Queue scheduled job execution
   * @param jobType Type of scheduled job (e.g., 'expiry-check', 'data-cleanup')
   * @param payload Job payload data
   * @returns Job ID (UUID)
   */
  async queueScheduledJob(
    jobType: string,
    payload: any,
  ): Promise<{ jobId: string }> {
    const jobId = randomBytes(16).toString('hex');

    // Add jobId to payload for processor access
    const jobPayload = { ...payload, jobId };

    // Check queue health before attempting to queue
    const isHealthy = await this.isQueueHealthy(this.scheduledQueue);
    if (!isHealthy) {
      const error = new Error(
        'Scheduled queue connection is not healthy. Retrying connection...',
      );
      this.logger.warn(error.message);

      // Try to reconnect by checking status again
      await this.logQueueStatus();

      // Throw error to trigger retry at scheduler level
      throw error;
    }

    try {
      await this.prisma.job.create({
        data: {
          id: jobId,
          job_type: jobType,
          status: 'pending',
          payload: jobPayload,
          max_retries: 1, // Most scheduled jobs run once
        },
      });

      await this.scheduledQueue.add(jobType, jobPayload, {
        jobId,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Scheduled job queued: ${jobType} (${jobId})`);

      return { jobId };
    } catch (error) {
      this.logger.error(
        `Failed to queue scheduled job ${jobType}: ${error.message}`,
        error.stack,
      );

      // If BullMQ queueing failed but DB record was created, delete the orphaned record
      await this.prisma.job
        .deleteMany({
          where: { id: jobId },
        })
        .catch((deleteError) => {
          this.logger.error(
            `Failed to cleanup orphaned job record ${jobId}: ${deleteError.message}`,
          );
        });

      throw error;
    }
  }

  /**
   * Update job status in database
   * @param jobId Job UUID
   * @param status New status (processing, completed, failed)
   * @param updates Optional updates (result, error_message, duration_ms)
   */
  async updateJobStatus(
    jobId: string,
    status: 'processing' | 'completed' | 'failed',
    updates: {
      result?: any;
      error_message?: string;
      duration_ms?: number;
    } = {},
  ): Promise<void> {
    const updateData: any = {
      status,
      attempts: status === 'failed' ? { increment: 1 } : undefined,
    };

    if (status === 'processing') {
      updateData.started_at = new Date();
    } else if (status === 'completed') {
      updateData.completed_at = new Date();
      updateData.result = updates.result || null;
      updateData.duration_ms = updates.duration_ms;
    } else if (status === 'failed') {
      updateData.failed_at = new Date();
      updateData.error_message = updates.error_message;
    }

    await this.prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });

    this.logger.debug(`Job ${jobId} updated to status: ${status}`);
  }

  /**
   * Log job execution event
   * @param jobId Job UUID
   * @param level Log level (info, warn, error)
   * @param message Log message
   * @param metadata Optional metadata (errors, results, etc.)
   */
  async logJobExecution(
    jobId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.prisma.job_log.create({
      data: {
        id: randomBytes(16).toString('hex'),
        job_id: jobId,
        level,
        message,
        metadata: metadata as any,
      },
    });

    this.logger.debug(`Job ${jobId} log [${level}]: ${message}`);
  }
}
