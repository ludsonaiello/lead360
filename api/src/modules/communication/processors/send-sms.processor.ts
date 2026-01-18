import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { SmsSenderService } from '../services/sms-sender.service';

/**
 * Send SMS Processor
 *
 * Processes queued SMS messages via Twilio.
 *
 * Queue: communication-sms
 * Job: send-sms
 *
 * Job Data:
 * - communicationEventId: UUID of communication_event record
 */
@Processor('communication-sms')
export class SendSmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SendSmsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsSender: SmsSenderService,
  ) {
    super();
    this.logger.log('🚀 SendSmsProcessor worker initialized and ready');
  }

  async process(job: Job): Promise<any> {
    const { communicationEventId } = job.data;
    const jobId = job.id as string;

    this.logger.log(
      `🔄 PROCESSING: SMS job ${jobId} for event ${communicationEventId}`,
    );

    try {
      // 1. Load communication_event
      const event = await this.prisma.communication_event.findUnique({
        where: { id: communicationEventId },
        include: { provider: true },
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

      // 2. Load tenant SMS config (TODO: Create tenant_sms_config table in future)
      // For now, assuming credentials are stored in tenant settings or similar
      // This is a placeholder - actual implementation depends on how SMS config is stored

      const encryptedCredentials = {}; // TODO: Load from tenant_sms_config

      // 3. Send SMS via provider
      const startTime = Date.now();

      const result = await this.smsSender.send(
        event.provider as any,
        encryptedCredentials,
        {
          to_phone: event.to_phone!,
          text_body: event.text_body!,
          media_urls: event.attachments
            ? (event.attachments as any[]).map((att) => att.url)
            : undefined,
        },
      );

      const duration = Date.now() - startTime;

      // 4. Update communication_event
      await this.prisma.communication_event.update({
        where: { id: communicationEventId },
        data: {
          status: 'sent',
          provider_message_id: result.messageSid,
          provider_metadata: result.metadata || {},
          sent_at: new Date(),
        },
      });

      this.logger.log(
        `✅ SMS job ${jobId} completed - Message SID: ${result.messageSid} (${duration}ms)`,
      );

      return {
        success: true,
        messageSid: result.messageSid,
        duration_ms: duration,
      };
    } catch (error) {
      this.logger.error(
        `❌ SMS job ${jobId} failed: ${error.message}`,
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

      throw error; // BullMQ will retry
    }
  }
}
