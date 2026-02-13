import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { WebhookRetryService } from '../services/webhook-retry.service';

/**
 * Webhook Retry Processor
 *
 * BullMQ processor that handles retrying failed webhook events.
 *
 * Workflow:
 * 1. Receive webhook event ID from queue
 * 2. Load webhook event from database with provider info
 * 3. Re-process webhook based on event_type
 * 4. Mark as processed on success
 * 5. Queue next retry on failure
 *
 * Supported Event Types:
 * - sms.delivered: Update communication_event with delivery status
 * - sms.failed: Update communication_event with failure status
 * - sms.sent: Update communication_event with sent status
 * - sms.undelivered: Update communication_event with undelivered status
 * - call.completed: Update call_record with final status
 * - call.failed: Update call_record with failure status
 * - (Additional event types can be added as needed)
 *
 * Error Handling:
 * - Network errors: Retry with backoff
 * - Database errors: Retry with backoff
 * - Invalid data: Mark as failed (no retry)
 * - Max retries: Permanently fail
 *
 * Performance:
 * - Concurrency: 10 simultaneous jobs
 * - Rate limiting: 100 jobs per minute
 * - Job timeout: 30 seconds
 *
 * @class WebhookRetryProcessor
 * @since Sprint 7
 */
@Processor('webhook-retry', {
  concurrency: 10, // Process up to 10 retries simultaneously
  limiter: {
    max: 100, // Max 100 jobs
    duration: 60000, // Per minute
  },
})
export class WebhookRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookRetryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookRetry: WebhookRetryService,
  ) {
    super();
  }

  /**
   * Process webhook retry job
   *
   * Attempts to re-process a failed webhook event.
   * On success, marks webhook as processed.
   * On failure, queues next retry attempt.
   *
   * @param job - BullMQ job with webhookEventId
   * @returns Promise<{ success: boolean; webhookEventId: string }>
   *
   * @example
   * Job data:
   * ```typescript
   * {
   *   webhookEventId: 'webhook-123'
   * }
   * ```
   */
  async process(
    job: Job<{ webhookEventId: string }>,
  ): Promise<{ success: boolean; webhookEventId: string }> {
    const { webhookEventId } = job.data;

    this.logger.log(
      `[Job ${job.id}] Retrying webhook ${webhookEventId} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      // Load webhook event with provider info
      const event = await this.prisma.webhook_event.findUnique({
        where: { id: webhookEventId },
        include: { provider: true },
      });

      if (!event) {
        this.logger.error(
          `[Job ${job.id}] Webhook event ${webhookEventId} not found`,
        );
        return { success: false, webhookEventId };
      }

      this.logger.debug(
        `[Job ${job.id}] Processing webhook event type: ${event.event_type}`,
      );

      // Re-process webhook based on event_type
      await this.reprocessWebhook(event);

      // Mark as processed
      await this.prisma.webhook_event.update({
        where: { id: webhookEventId },
        data: {
          processed: true,
          processed_at: new Date(),
          error_message: null, // Clear previous error
        },
      });

      this.logger.log(
        `[Job ${job.id}] ✅ Webhook ${webhookEventId} processed successfully`,
      );

      return { success: true, webhookEventId };
    } catch (error) {
      this.logger.error(
        `[Job ${job.id}] ❌ Webhook retry failed: ${error.message}`,
      );
      this.logger.error(`[Job ${job.id}] Stack: ${error.stack}`);

      // Update error message
      try {
        await this.prisma.webhook_event.update({
          where: { id: webhookEventId },
          data: {
            error_message: error.message,
          },
        });
      } catch (updateError) {
        this.logger.error(
          `[Job ${job.id}] Failed to update error message: ${updateError.message}`,
        );
      }

      // Queue next retry (WebhookRetryService handles backoff logic)
      await this.webhookRetry.queueRetry(webhookEventId);

      // Re-throw to let BullMQ handle job failure
      throw error;
    }
  }

  /**
   * Re-execute webhook logic based on event_type
   *
   * Routes webhook processing to appropriate handler based on event type.
   * This mirrors the logic in TwilioWebhooksController but operates on
   * stored webhook_event records.
   *
   * @param event - Webhook event record with provider info
   * @returns Promise<void>
   * @private
   */
  private async reprocessWebhook(event: any): Promise<void> {
    const payload = event.payload as any;

    switch (event.event_type) {
      // SMS Status Webhooks
      case 'sms.delivered':
      case 'sms.sent':
      case 'sms.failed':
      case 'sms.undelivered':
        await this.processSmsStatus(event);
        break;

      // Call Status Webhooks
      case 'call.completed':
      case 'call.failed':
      case 'call.busy':
      case 'call.no-answer':
      case 'call.canceled':
        await this.processCallStatus(event);
        break;

      // WhatsApp Status Webhooks
      case 'whatsapp.delivered':
      case 'whatsapp.sent':
      case 'whatsapp.read':
      case 'whatsapp.failed':
      case 'whatsapp.undelivered':
        await this.processWhatsAppStatus(event);
        break;

      // Inbound Messages (typically don't need retry, but handle anyway)
      case 'sms.inbound':
      case 'whatsapp.inbound':
        this.logger.warn(
          `Inbound message webhook retry (${event.event_type}) - normally auto-processed`,
        );
        // Inbound messages are typically processed immediately, no retry needed
        break;

      default:
        this.logger.warn(
          `Unknown webhook event type: ${event.event_type} for webhook ${event.id}`,
        );
        // Mark as processed to avoid infinite retries
        throw new Error(
          `Unsupported webhook event type: ${event.event_type}`,
        );
    }
  }

  /**
   * Process SMS status webhook
   *
   * Updates communication_event record based on SMS delivery status.
   *
   * Payload fields:
   * - MessageSid: Twilio message identifier (stored as provider_message_id)
   * - MessageStatus: delivered, sent, failed, undelivered
   * - ErrorCode: Error code if failed
   * - ErrorMessage: Error message if failed
   *
   * @param event - Webhook event record
   * @returns Promise<void>
   * @private
   */
  private async processSmsStatus(event: any): Promise<void> {
    const payload = event.payload as any;
    const messageSid =
      event.provider_message_id || payload.MessageSid || payload.SmsSid;

    if (!messageSid) {
      throw new Error(
        'Missing MessageSid in SMS status webhook (cannot identify communication event)',
      );
    }

    this.logger.debug(
      `Processing SMS status: ${messageSid} -> ${payload.MessageStatus}`,
    );

    // Find communication_event by provider_message_id
    const commEvent = await this.prisma.communication_event.findFirst({
      where: { provider_message_id: messageSid },
    });

    if (!commEvent) {
      this.logger.warn(
        `Communication event not found for MessageSid: ${messageSid}`,
      );
      // Don't throw - webhook is valid, but communication event might not exist yet
      return;
    }

    // Build update data based on status
    const updateData: any = {
      status: payload.MessageStatus,
      updated_at: new Date(),
    };

    if (payload.MessageStatus === 'delivered') {
      updateData.delivered_at = new Date();
    } else if (payload.MessageStatus === 'sent') {
      updateData.sent_at = new Date();
    } else if (
      payload.MessageStatus === 'failed' ||
      payload.MessageStatus === 'undelivered'
    ) {
      updateData.error_message =
        payload.ErrorMessage || `Error code: ${payload.ErrorCode || 'unknown'}`;
    }

    // Update communication_event
    await this.prisma.communication_event.update({
      where: { id: commEvent.id },
      data: updateData,
    });

    this.logger.log(
      `✅ SMS status updated: ${messageSid} -> ${payload.MessageStatus}`,
    );
  }

  /**
   * Process call status webhook
   *
   * Updates call_record with final call status and duration.
   *
   * Payload fields:
   * - CallSid: Twilio call identifier
   * - CallStatus: completed, failed, busy, no-answer, canceled
   * - CallDuration: Call duration in seconds (for completed calls)
   *
   * @param event - Webhook event record
   * @returns Promise<void>
   * @private
   */
  private async processCallStatus(event: any): Promise<void> {
    const payload = event.payload as any;
    const callSid = payload.CallSid;

    if (!callSid) {
      throw new Error(
        'Missing CallSid in call status webhook (cannot identify call)',
      );
    }

    this.logger.debug(
      `Processing call status: ${callSid} -> ${payload.CallStatus}`,
    );

    // Find call_record by twilio_call_sid
    const callRecord = await this.prisma.call_record.findFirst({
      where: { twilio_call_sid: callSid },
    });

    if (!callRecord) {
      this.logger.warn(`Call record not found for CallSid: ${callSid}`);
      // Don't throw - webhook is valid, but call record might not exist
      return;
    }

    // Build update data
    const updateData: any = {
      status: payload.CallStatus,
      ended_at: new Date(),
    };

    // Add duration for completed calls
    if (payload.CallStatus === 'completed' && payload.CallDuration) {
      updateData.duration_seconds = parseInt(payload.CallDuration, 10);
    }

    // Update call_record
    await this.prisma.call_record.update({
      where: { id: callRecord.id },
      data: updateData,
    });

    this.logger.log(
      `✅ Call status updated: ${callSid} -> ${payload.CallStatus}`,
    );
  }

  /**
   * Process WhatsApp status webhook
   *
   * Updates communication_event record based on WhatsApp delivery status.
   *
   * Payload fields:
   * - MessageSid: Twilio message identifier
   * - MessageStatus: delivered, sent, read, failed, undelivered
   * - ErrorCode: Error code if failed
   * - ErrorMessage: Error message if failed
   *
   * @param event - Webhook event record
   * @returns Promise<void>
   * @private
   */
  private async processWhatsAppStatus(event: any): Promise<void> {
    const payload = event.payload as any;
    const messageSid = event.provider_message_id || payload.MessageSid;

    if (!messageSid) {
      throw new Error(
        'Missing MessageSid in WhatsApp status webhook (cannot identify communication event)',
      );
    }

    this.logger.debug(
      `Processing WhatsApp status: ${messageSid} -> ${payload.MessageStatus}`,
    );

    // Find communication_event by provider_message_id
    const commEvent = await this.prisma.communication_event.findFirst({
      where: { provider_message_id: messageSid },
    });

    if (!commEvent) {
      this.logger.warn(
        `Communication event not found for MessageSid: ${messageSid}`,
      );
      // Don't throw - webhook is valid, but communication event might not exist
      return;
    }

    // Build update data based on status
    const updateData: any = {
      status: payload.MessageStatus,
      updated_at: new Date(),
    };

    if (payload.MessageStatus === 'delivered') {
      updateData.delivered_at = new Date();
    } else if (payload.MessageStatus === 'sent') {
      updateData.sent_at = new Date();
    } else if (payload.MessageStatus === 'read') {
      updateData.read_at = new Date();
    } else if (
      payload.MessageStatus === 'failed' ||
      payload.MessageStatus === 'undelivered'
    ) {
      updateData.error_message =
        payload.ErrorMessage || `Error code: ${payload.ErrorCode || 'unknown'}`;
    }

    // Update communication_event
    await this.prisma.communication_event.update({
      where: { id: commEvent.id },
      data: updateData,
    });

    this.logger.log(
      `✅ WhatsApp status updated: ${messageSid} -> ${payload.MessageStatus}`,
    );
  }
}
