import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { EmailService } from '../services/email.service';
import { JobQueueService } from '../services/job-queue.service';
import { randomBytes } from 'crypto';

@Processor('email')
export class SendEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(SendEmailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly jobQueue: JobQueueService,
  ) {
    super();
    this.logger.log('🚀 SendEmailProcessor worker initialized and ready');
  }

  async process(job: Job): Promise<any> {
    const { to, cc, bcc, templateKey, variables } = job.data;
    const jobId = job.id as string;

    this.logger.log(`🔄 PROCESSING: Email job ${jobId} to ${to}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      const startTime = Date.now();

      // Send email using EmailService (Developer 1's implementation)
      const result = await this.emailService.sendTemplatedEmail({
        to,
        cc,
        bcc,
        templateKey,
        variables,
      });

      const duration = Date.now() - startTime;

      // Get template details for email_queue record
      const template = await this.prisma.email_template.findFirst({
        where: { template_key: templateKey },
      });

      // Create email queue record
      await this.prisma.email_queue.create({
        data: {
          id: randomBytes(16).toString('hex'),
          job_id: jobId,
          template_key: templateKey,
          to_email: to,
          cc_emails: cc ?? undefined,
          bcc_emails: bcc ?? undefined,
          subject: template?.subject || '',
          html_body: template?.html_body || '',
          text_body: template?.text_body ?? undefined,
          status: 'sent',
          smtp_message_id: result.messageId,
          sent_at: new Date(),
        },
      });

      // Update job status
      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { messageId: result.messageId },
        duration_ms: duration,
      });

      await this.jobQueue.logJobExecution(
        jobId,
        'info',
        `Email sent successfully to ${to}`,
        { messageId: result.messageId },
      );

      this.logger.log(
        `Email job ${jobId} completed - Message ID: ${result.messageId}`,
      );

      return { success: true, messageId: result.messageId };
    } catch (error) {
      this.logger.error(
        `Email job ${jobId} failed: ${error.message}`,
        error.stack,
      );

      // Update email queue status
      try {
        await this.prisma.email_queue.upsert({
          where: { job_id: jobId },
          create: {
            id: randomBytes(16).toString('hex'),
            job_id: jobId,
            template_key: templateKey || '',
            to_email: to,
            cc_emails: cc ?? undefined,
            bcc_emails: bcc ?? undefined,
            subject: '',
            html_body: '',
            status: 'failed',
            error_message: error.message,
          },
          update: {
            status: 'failed',
            error_message: error.message,
          },
        });
      } catch (e) {
        this.logger.error(`Failed to update email queue: ${e.message}`);
      }

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      await this.jobQueue.logJobExecution(
        jobId,
        'error',
        `Email sending failed: ${error.message}`,
      );

      throw error; // BullMQ will retry
    }
  }
}
