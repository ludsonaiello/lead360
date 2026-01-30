import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { EmailSenderService } from '../services/email-sender.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { FilesService } from '../../files/files.service';

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
 * - communication_event_id: UUID of communication_event record
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
    private readonly filesService: FilesService,
  ) {
    super();
    this.logger.log(
      '🚀 SendCommunicationEmailProcessor worker initialized and ready',
    );
  }

  async process(job: Job): Promise<any> {
    const { communication_event_id } = job.data;
    const jobId = job.id as string;

    this.logger.log(
      `🔄 PROCESSING: Communication email job ${jobId} for event ${communication_event_id}`,
    );

    try {
      // 1. Load communication_event with relations
      const event = await this.prisma.communication_event.findUnique({
        where: { id: communication_event_id },
        include: {
          provider: true,
          tenant: true,
          created_by_user: true,
        },
      });

      if (!event) {
        throw new Error(
          `Communication event ${communication_event_id} not found`,
        );
      }

      if (event.status !== 'pending') {
        this.logger.warn(
          `Event ${communication_event_id} already processed (status: ${event.status})`,
        );
        return { success: false, reason: 'Already processed' };
      }

      // 2. Load email configuration (tenant or platform)
      let config: any;
      let encryptedCredentials: any;
      let providerConfig: any;

      if (event.tenant_id) {
        // Tenant email - get ACTIVE provider configuration
        const tenantConfig = await this.prisma.tenant_email_config.findFirst({
          where: {
            tenant_id: event.tenant_id,
            is_active: true, // ✅ CRITICAL: Only use active provider
          },
          include: {
            provider: true,
          },
        });

        if (!tenantConfig) {
          throw new Error(
            `No active email provider configured for tenant ${event.tenant_id}. Please add and activate a provider in Communication Settings.`,
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

      // 3. Process attachments (fetch file content if file_id is provided)
      let processedAttachments: Array<{
        filename: string;
        content: string;
        mime_type: string;
      }> | undefined;

      if (event.attachments && Array.isArray(event.attachments)) {
        const attachmentsWithNulls = await Promise.all(
          (event.attachments as any[]).map(async (att) => {
            // If attachment has file_id, fetch the file content from storage
            if (att.file_id) {
              // Query file directly to get storage_path
              const file = await this.prisma.file.findFirst({
                where: {
                  file_id: att.file_id,
                  tenant_id: event.tenant_id || undefined,
                  is_trashed: false,
                },
              });

              if (!file) {
                this.logger.warn(
                  `Attachment file ${att.file_id} not found, skipping`,
                );
                return null; // Skip this attachment
              }

              // Get storage provider and download file content
              const storageProvider = await (this.filesService as any).storageFactory.getProvider(
                event.tenant_id,
              );
              const fileBuffer = await storageProvider.download(
                file.id,
                file.storage_path,
              );

              return {
                filename: file.original_filename,
                content: fileBuffer.toString('base64'),
                mime_type: file.mime_type,
              };
            }

            // If attachment already has content, use it as-is
            return {
              filename: att.filename,
              content: att.content,
              mime_type: att.mime_type,
            };
          }),
        );

        // Filter out null entries (skipped attachments)
        processedAttachments = attachmentsWithNulls.filter(
          (att) => att !== null,
        ) as Array<{
          filename: string;
          content: string;
          mime_type: string;
        }>;
      }

      // 4. Send via provider
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
          attachments: processedAttachments,
        },
      );

      const duration = Date.now() - startTime;

      // 4. Update communication_event
      await this.prisma.communication_event.update({
        where: { id: communication_event_id },
        data: {
          status: 'sent',
          provider_message_id: result.messageId,
          provider_metadata: result.metadata || {},
          sent_at: new Date(),
        },
      });

      // 5. If this email is related to a quote, update quote status to 'sent'
      if (
        event.related_entity_type === 'quote' &&
        event.related_entity_id &&
        event.tenant_id
      ) {
        const quote = await this.prisma.quote.findFirst({
          where: {
            id: event.related_entity_id,
            tenant_id: event.tenant_id,
          },
        });

        // Only update if quote is currently 'ready' (first time sending)
        if (quote && quote.status === 'ready') {
          await this.prisma.quote.update({
            where: { id: quote.id },
            data: { status: 'sent' },
          });

          this.logger.log(
            `Quote ${quote.id} status changed from 'ready' to 'sent' (email successfully sent)`,
          );
        }
      }

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
          where: { id: communication_event_id },
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
