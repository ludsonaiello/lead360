import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { SmsSenderService } from '../services/sms-sender.service';
import { SmsKeywordDetectionService } from '../services/sms-keyword-detection.service';
import { SmsMetricsService } from '../services/sms-metrics.service';

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
    private readonly smsKeywordDetection: SmsKeywordDetectionService,
    private readonly metrics: SmsMetricsService,
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

      // Allow both 'pending' and 'scheduled' statuses
      if (event.status !== 'pending' && event.status !== 'scheduled') {
        this.logger.warn(
          `Event ${communicationEventId} already processed (status: ${event.status})`,
        );
        return { success: false, reason: 'Already processed' };
      }

      // If scheduled, verify the scheduled time has arrived
      if (event.scheduled_at) {
        const now = new Date();
        if (event.scheduled_at > now) {
          const remainingMs = event.scheduled_at.getTime() - now.getTime();
          this.logger.warn(
            `SMS ${communicationEventId} not ready - scheduled for ${event.scheduled_at.toISOString()} (${remainingMs}ms remaining)`,
          );
          // This shouldn't normally happen since BullMQ handles delay,
          // but if it does, we'll let the job fail and retry
          throw new Error(
            `SMS not ready - scheduled for ${event.scheduled_at.toISOString()}`,
          );
        }

        this.logger.log(
          `Processing scheduled SMS ${communicationEventId} (scheduled for ${event.scheduled_at.toISOString()})`,
        );
      }

      // 2. Load tenant SMS config from database
      if (!event.tenant_id) {
        this.logger.error(
          `❌ No tenant_id found in communication event ${communicationEventId}`,
        );
        await this.prisma.communication_event.update({
          where: { id: communicationEventId },
          data: {
            status: 'failed',
            error_message: 'No tenant_id found in communication event',
          },
        });
        return {
          success: false,
          reason: 'No tenant_id in event',
        };
      }

      const config = await this.prisma.tenant_sms_config.findFirst({
        where: {
          tenant_id: event.tenant_id,
          is_active: true,
        },
      });

      if (!config) {
        this.logger.error(
          `❌ No active SMS configuration found for tenant ${event.tenant_id}`,
        );
        await this.prisma.communication_event.update({
          where: { id: communicationEventId },
          data: {
            status: 'failed',
            error_message: 'No active SMS configuration found for tenant',
          },
        });
        return {
          success: false,
          reason: 'No active SMS configuration',
        };
      }

      const encryptedCredentials = config.credentials;

      // 3. Check if Lead has opted out of SMS (TCPA Compliance)
      if (
        event.related_entity_type === 'lead' &&
        event.related_entity_id &&
        event.tenant_id
      ) {
        const isOptedOut = await this.smsKeywordDetection.isOptedOut(
          event.tenant_id,
          event.related_entity_id,
        );

        if (isOptedOut) {
          this.logger.warn(
            `🚫 Blocked SMS to Lead ${event.related_entity_id} - user has opted out (TCPA compliance)`,
          );

          // Update communication_event status to blocked
          await this.prisma.communication_event.update({
            where: { id: communicationEventId },
            data: {
              status: 'failed',
              error_message:
                'Cannot send SMS: recipient has opted out (replied STOP)',
            },
          });

          return {
            success: false,
            reason: 'Lead has opted out of SMS',
          };
        }

        this.logger.debug(
          `✅ Opt-out check passed for Lead ${event.related_entity_id}`,
        );
      }

      // 4. Send SMS via provider
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

      // 5. Update communication_event
      await this.prisma.communication_event.update({
        where: { id: communicationEventId },
        data: {
          status: 'sent',
          provider_message_id: result.messageSid,
          provider_metadata: result.metadata || {},
          sent_at: new Date(),
        },
      });

      // 6. Record Prometheus metrics
      const durationSeconds = duration / 1000;
      this.metrics.incrementSmsSent(event.tenant_id);
      this.metrics.recordTwilioApiDuration(event.tenant_id, durationSeconds);

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
        // Load event to get tenant_id for metrics
        const event = await this.prisma.communication_event.findUnique({
          where: { id: communicationEventId },
          select: { tenant_id: true },
        });

        await this.prisma.communication_event.update({
          where: { id: communicationEventId },
          data: {
            status: 'failed',
            error_message: error.message,
          },
        });

        // Record failure metric
        if (event?.tenant_id) {
          this.metrics.incrementSmsFailed(
            event.tenant_id,
            error.code || 'unknown',
          );
        }
      } catch (updateError) {
        this.logger.error(
          `Failed to update communication_event: ${updateError.message}`,
        );
      }

      throw error; // BullMQ will retry
    }
  }
}
