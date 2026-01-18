import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { EmailSenderService } from '../services/email-sender.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';

/**
 * Send Communication Email Processor
 *
 * Processes queued communication emails (transactional, marketing, notifications).
 * Handles multi-provider sending (SMTP, SendGrid, Amazon SES, Brevo).
 *
 * Queue: communication-email
 * Job: send-email
 *
 * Job Data:
 * - communicationEventId: UUID of communication_event record
 *
 * Process:
 * 1. Load communication_event with provider details
 * 2. Load tenant or platform email config
 * 3. Send via configured provider
 * 4. Update communication_event with provider response
 * 5. Handle errors and retry logic
 */
@Processor('communication-email')
export class SendCommunicationEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(SendCommunicationEmailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSender: EmailSenderService,
    private readonly encryption: EncryptionService,
  ) {
    super();
    this.logger.log(
      '🚀 SendCommunicationEmailProcessor worker initialized and ready',
    );
  }

  async process(job: Job): Promise<any> {
    const { communicationEventId } = job.data;
    const jobId = job.id as string;

    this.logger.log(
      `🔄 PROCESSING: Communication email job ${jobId} for event ${communicationEventId}`,
    );

    try {
      // 1. Load communication_event with relations
      const event = await this.prisma.communication_event.findUnique({
        where: { id: communicationEventId },
        include: {
          provider: true,
          tenant: true,
          created_by_user: true,
        },
      });

      if (!event) {
        throw new Error(
          `Communication event ${communicationEventId} not found`,
        );
      }

      if (event.status !== 'pending') {
        this.logger.warn(
          `Event ${communicationEventId} already processed (status: ${event.status})`,
        );
        return { success: false, reason: 'Already processed' };
      }

      // 2. Load email configuration (tenant or platform)
      let config: any;
      let encryptedCredentials: any;
      let providerConfig: any;

      if (event.tenant_id) {
        // Tenant email
        const tenantConfig = await this.prisma.tenant_email_config.findUnique({
          where: { tenant_id: event.tenant_id },
        });

        if (!tenantConfig || !tenantConfig.is_active) {
          throw new Error(
            `Tenant email config not found or inactive for tenant ${event.tenant_id}`,
          );
        }

        config = tenantConfig;
        encryptedCredentials = tenantConfig.credentials;
        providerConfig = tenantConfig.provider_config;
      } else {
        // Platform email
        const platformConfig =
          await this.prisma.platform_email_config.findFirst();

        if (!platformConfig) {
          throw new Error('Platform email config not found');
        }

        config = platformConfig;
        encryptedCredentials = platformConfig.credentials;
        providerConfig = platformConfig.provider_config;
      }

      // 3. Send via provider
      const startTime = Date.now();

      const result = await this.emailSender.send(
        event.provider,
        encryptedCredentials,
        providerConfig,
        {
          to: event.to_email!,
          cc: event.cc_emails as string[] | undefined,
          bcc: event.bcc_emails as string[] | undefined,
          from_email: config.from_email,
          from_name: config.from_name,
          reply_to: config.reply_to_email || undefined,
          subject: event.subject!,
          html_body: event.html_body!,
          text_body: event.text_body || undefined,
          attachments: event.attachments
            ? (event.attachments as any[]).map((att) => ({
                filename: att.filename,
                content: att.content,
                mime_type: att.mime_type,
              }))
            : undefined,
        },
      );

      const duration = Date.now() - startTime;

      // 4. Update communication_event
      await this.prisma.communication_event.update({
        where: { id: communicationEventId },
        data: {
          status: 'sent',
          provider_message_id: result.messageId,
          provider_metadata: result.metadata || {},
          sent_at: new Date(),
        },
      });

      this.logger.log(
        `✅ Email job ${jobId} completed - Provider Message ID: ${result.messageId} (${duration}ms)`,
      );

      return {
        success: true,
        messageId: result.messageId,
        duration_ms: duration,
      };
    } catch (error) {
      this.logger.error(
        `❌ Email job ${jobId} failed: ${error.message}`,
        error.stack,
      );

      // Update communication_event status to failed
      try {
        await this.prisma.communication_event.update({
          where: { id: communicationEventId },
          data: {
            status: 'failed',
            error_message: error.message,
          },
        });
      } catch (updateError) {
        this.logger.error(
          `Failed to update communication_event: ${updateError.message}`,
        );
      }

      throw error; // BullMQ will retry based on job options
    }
  }
}
