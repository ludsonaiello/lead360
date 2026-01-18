import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { WhatsAppSenderService } from '../services/whatsapp-sender.service';

/**
 * Send WhatsApp Processor
 *
 * Processes queued WhatsApp messages via Twilio.
 *
 * Queue: communication-whatsapp
 * Job: send-whatsapp
 *
 * Job Data:
 * - communicationEventId: UUID of communication_event record
 */
@Processor('communication-whatsapp')
export class SendWhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(SendWhatsAppProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappSender: WhatsAppSenderService,
  ) {
    super();
    this.logger.log('🚀 SendWhatsAppProcessor worker initialized and ready');
  }

  async process(job: Job): Promise<any> {
    const { communicationEventId } = job.data;
    const jobId = job.id as string;

    this.logger.log(
      `🔄 PROCESSING: WhatsApp job ${jobId} for event ${communicationEventId}`,
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

      // 2. Load tenant WhatsApp config (TODO: Create tenant_whatsapp_config table in future)
      // For now, assuming credentials are stored in tenant settings or similar
      // This is a placeholder - actual implementation depends on how WhatsApp config is stored

      const encryptedCredentials = {}; // TODO: Load from tenant_whatsapp_config

      // 3. Send WhatsApp message via provider
      const startTime = Date.now();

      const result = await this.whatsappSender.send(
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
        `✅ WhatsApp job ${jobId} completed - Message SID: ${result.messageSid} (${duration}ms)`,
      );

      return {
        success: true,
        messageSid: result.messageSid,
        duration_ms: duration,
      };
    } catch (error) {
      this.logger.error(
        `❌ WhatsApp job ${jobId} failed: ${error.message}`,
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
