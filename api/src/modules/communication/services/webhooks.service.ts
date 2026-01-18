import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { WebhookVerificationService } from './webhook-verification.service';
import { randomUUID } from 'crypto';
import axios from 'axios';

/**
 * Webhooks Service
 *
 * Processes webhooks from various communication providers.
 * Updates communication_event status based on webhook data.
 *
 * Supported providers:
 * - SendGrid (email)
 * - Amazon SES/SNS (email)
 * - Brevo (email)
 * - Twilio SMS
 * - Twilio WhatsApp
 *
 * Features:
 * - Signature verification
 * - Idempotency (don't process same event twice)
 * - Webhook event logging
 * - Communication event status updates
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookVerification: WebhookVerificationService,
  ) {}

  /**
   * Process SendGrid webhook events
   */
  async processSendGridWebhook(
    events: any[],
    signature: string,
    timestamp: string,
    payload: string,
  ) {
    this.logger.log(
      `Processing SendGrid webhook: ${events.length} events, timestamp=${timestamp}`,
    );

    // Get webhook secret from configuration
    const config = await this.getWebhookSecret('sendgrid');

    // Verify signature
    const verified = this.webhookVerification.verifySendGrid(
      payload,
      signature,
      timestamp,
      config.webhook_secret || '',
    );

    if (!verified) {
      throw new UnauthorizedException('SendGrid webhook signature verification failed');
    }

    // Process each event
    const results: any[] = [];
    for (const event of events) {
      const result = await this.processSendGridEvent(event);
      results.push(result);
    }

    return {
      success: true,
      processed: results.length,
      results,
    };
  }

  /**
   * Confirm Amazon SNS subscription (one-time setup)
   */
  async confirmSnsSubscription(payload: any) {
    this.logger.log(`SNS Subscription confirmation request received`);

    if (payload.Type !== 'SubscriptionConfirmation') {
      throw new BadRequestException('Not a subscription confirmation');
    }

    // Verify signature
    const verified = this.webhookVerification.verifyAmazonSES(payload);
    if (!verified) {
      throw new UnauthorizedException('SNS signature verification failed');
    }

    // Confirm subscription by visiting SubscribeURL
    const subscribeUrl = payload.SubscribeURL;
    if (!subscribeUrl) {
      throw new BadRequestException('SubscribeURL missing from payload');
    }

    try {
      const response = await axios.get(subscribeUrl);
      this.logger.log(`SNS subscription confirmed: ${subscribeUrl}`);

      return {
        success: true,
        message: 'SNS subscription confirmed',
        subscription_arn: response.data,
      };
    } catch (error) {
      this.logger.error(`Failed to confirm SNS subscription: ${error.message}`);
      throw new BadRequestException('Failed to confirm SNS subscription');
    }
  }

  /**
   * Process Amazon SES webhook (via SNS)
   */
  async processAmazonSESWebhook(payload: any) {
    this.logger.log(`Processing Amazon SES webhook: type=${payload.Type}`);

    // Verify signature
    const verified = this.webhookVerification.verifyAmazonSES(payload);
    if (!verified) {
      throw new UnauthorizedException('Amazon SES signature verification failed');
    }

    // Handle notification
    if (payload.Type === 'Notification') {
      const message = JSON.parse(payload.Message);
      const result = await this.processAmazonSESEvent(message);

      return {
        success: true,
        processed: 1,
        result,
      };
    }

    return { success: true, message: 'No action required' };
  }

  /**
   * Process Brevo webhook events
   */
  async processBrevoWebhook(payload: any, token: string) {
    this.logger.log(`Processing Brevo webhook: event=${payload.event}`);

    // Get webhook secret
    const config = await this.getWebhookSecret('brevo');

    // Verify token
    const verified = this.webhookVerification.verifyBrevo(
      token,
      config.webhook_secret || '',
    );

    if (!verified) {
      throw new UnauthorizedException('Brevo webhook token verification failed');
    }

    // Process event
    const result = await this.processBrevoEvent(payload);

    return {
      success: true,
      processed: 1,
      result,
    };
  }

  /**
   * Process Twilio SMS webhook
   */
  async processTwilioSmsWebhook(payload: any, signature: string, url: string) {
    this.logger.log(
      `Processing Twilio SMS webhook: MessageSid=${payload.MessageSid}`,
    );

    // Get webhook secret (Twilio Auth Token)
    const config = await this.getWebhookSecret('twilio');

    // Verify signature
    const verified = this.webhookVerification.verifyTwilio(
      url,
      payload,
      signature,
      config.webhook_secret || '',
    );

    if (!verified) {
      throw new UnauthorizedException('Twilio SMS signature verification failed');
    }

    // Process event
    const result = await this.processTwilioSmsEvent(payload);

    return {
      success: true,
      processed: 1,
      result,
    };
  }

  /**
   * Process Twilio WhatsApp webhook
   */
  async processTwilioWhatsAppWebhook(
    payload: any,
    signature: string,
    url: string,
  ) {
    this.logger.log(
      `Processing Twilio WhatsApp webhook: MessageSid=${payload.MessageSid}`,
    );

    // Get webhook secret (Twilio Auth Token)
    const config = await this.getWebhookSecret('twilio');

    // Verify signature
    const verified = this.webhookVerification.verifyTwilio(
      url,
      payload,
      signature,
      config.webhook_secret || '',
    );

    if (!verified) {
      throw new UnauthorizedException('Twilio WhatsApp signature verification failed');
    }

    // Process event
    const result = await this.processTwilioWhatsAppEvent(payload);

    return {
      success: true,
      processed: 1,
      result,
    };
  }

  /**
   * Process single SendGrid event
   */
  private async processSendGridEvent(event: any) {
    const eventType = event.event; // delivered, bounce, open, click, etc.
    const messageId = event.sg_message_id?.split('.')[0]; // Remove domain suffix

    // Check for idempotency
    const existing = await this.prisma.webhook_event.findFirst({
      where: {
        provider_message_id: messageId,
        event_type: eventType,
      },
    });

    if (existing) {
      this.logger.debug(
        `Duplicate SendGrid event ignored: ${eventType} for ${messageId}`,
      );
      return { status: 'duplicate', message_id: messageId };
    }

    // Find communication event
    const commEvent = await this.prisma.communication_event.findFirst({
      where: { provider_message_id: messageId },
      include: { provider: true },
    });

    if (!commEvent) {
      this.logger.warn(
        `Communication event not found for SendGrid message: ${messageId}`,
      );
      return { status: 'not_found', message_id: messageId };
    }

    // Log webhook event
    const webhookEventId = randomUUID();
    await this.prisma.webhook_event.create({
      data: {
        id: webhookEventId,
        provider_id: commEvent.provider_id,
        communication_event_id: commEvent.id,
        event_type: eventType,
        provider_message_id: messageId,
        payload: event,
        signature_verified: true,
        processed: true,
        processed_at: new Date(),
      },
    });

    // Update communication event status
    const statusMap: Record<string, string> = {
      delivered: 'delivered',
      bounce: 'bounced',
      dropped: 'failed',
      deferred: 'pending',
      processed: 'sent',
    };

    const newStatus = statusMap[eventType];
    if (newStatus) {
      await this.prisma.communication_event.update({
        where: { id: commEvent.id },
        data: {
          status: newStatus as any,
          delivered_at: eventType === 'delivered' ? new Date() : undefined,
          bounced_at:
            eventType === 'bounce' || eventType === 'dropped'
              ? new Date()
              : undefined,
          error_message: event.reason || event.error,
        },
      });

      this.logger.log(
        `SendGrid event processed: ${eventType} -> ${newStatus} for ${messageId}`,
      );
    }

    return { status: 'processed', event_type: eventType, message_id: messageId };
  }

  /**
   * Process Amazon SES event
   */
  private async processAmazonSESEvent(message: any) {
    const eventType = message.eventType || message.notificationType;
    const mail = message.mail;
    const messageId = mail?.messageId;

    if (!messageId) {
      this.logger.warn('Amazon SES event missing messageId');
      return { status: 'invalid' };
    }

    // Check for idempotency
    const existing = await this.prisma.webhook_event.findFirst({
      where: {
        provider_message_id: messageId,
        event_type: eventType,
      },
    });

    if (existing) {
      return { status: 'duplicate', message_id: messageId };
    }

    // Find communication event
    const commEvent = await this.prisma.communication_event.findFirst({
      where: { provider_message_id: messageId },
      include: { provider: true },
    });

    if (!commEvent) {
      this.logger.warn(`Communication event not found for SES message: ${messageId}`);
      return { status: 'not_found', message_id: messageId };
    }

    // Log webhook event
    await this.prisma.webhook_event.create({
      data: {
        id: randomUUID(),
        provider_id: commEvent.provider_id,
        communication_event_id: commEvent.id,
        event_type: eventType,
        provider_message_id: messageId,
        payload: message,
        signature_verified: true,
        processed: true,
        processed_at: new Date(),
      },
    });

    // Update communication event status
    const statusMap: Record<string, string> = {
      Delivery: 'delivered',
      Bounce: 'bounced',
      Complaint: 'failed',
      Send: 'sent',
    };

    const newStatus = statusMap[eventType];
    if (newStatus) {
      await this.prisma.communication_event.update({
        where: { id: commEvent.id },
        data: {
          status: newStatus as any,
          delivered_at: eventType === 'Delivery' ? new Date() : undefined,
          bounced_at:
            eventType === 'Bounce' || eventType === 'Complaint'
              ? new Date()
              : undefined,
          error_message: message.bounce?.bouncedRecipients?.[0]?.diagnosticCode,
        },
      });
    }

    return { status: 'processed', event_type: eventType, message_id: messageId };
  }

  /**
   * Process Brevo event
   */
  private async processBrevoEvent(event: any) {
    const eventType = event.event;
    const messageId = event['message-id'];

    if (!messageId) {
      return { status: 'invalid' };
    }

    // Check for idempotency
    const existing = await this.prisma.webhook_event.findFirst({
      where: {
        provider_message_id: messageId,
        event_type: eventType,
      },
    });

    if (existing) {
      return { status: 'duplicate', message_id: messageId };
    }

    // Find communication event
    const commEvent = await this.prisma.communication_event.findFirst({
      where: { provider_message_id: messageId },
      include: { provider: true },
    });

    if (!commEvent) {
      this.logger.warn(`Communication event not found for Brevo message: ${messageId}`);
      return { status: 'not_found', message_id: messageId };
    }

    // Log webhook event
    await this.prisma.webhook_event.create({
      data: {
        id: randomUUID(),
        provider_id: commEvent.provider_id,
        communication_event_id: commEvent.id,
        event_type: eventType,
        provider_message_id: messageId,
        payload: event,
        signature_verified: true,
        processed: true,
        processed_at: new Date(),
      },
    });

    // Update status
    const statusMap: Record<string, string> = {
      delivered: 'delivered',
      hard_bounce: 'bounced',
      soft_bounce: 'bounced',
      blocked: 'failed',
    };

    const newStatus = statusMap[eventType];
    if (newStatus) {
      await this.prisma.communication_event.update({
        where: { id: commEvent.id },
        data: {
          status: newStatus as any,
          delivered_at: eventType === 'delivered' ? new Date() : undefined,
          bounced_at:
            eventType === 'hard_bounce' ||
            eventType === 'soft_bounce' ||
            eventType === 'blocked'
              ? new Date()
              : undefined,
          error_message: event.reason,
        },
      });
    }

    return { status: 'processed', event_type: eventType, message_id: messageId };
  }

  /**
   * Process Twilio SMS event
   */
  private async processTwilioSmsEvent(event: any) {
    const messageStatus = event.MessageStatus;
    const messageSid = event.MessageSid;

    if (!messageSid) {
      return { status: 'invalid' };
    }

    // Check for idempotency
    const existing = await this.prisma.webhook_event.findFirst({
      where: {
        provider_message_id: messageSid,
        event_type: messageStatus,
      },
    });

    if (existing) {
      return { status: 'duplicate', message_id: messageSid };
    }

    // Find communication event
    const commEvent = await this.prisma.communication_event.findFirst({
      where: { provider_message_id: messageSid },
      include: { provider: true },
    });

    if (!commEvent) {
      this.logger.warn(`Communication event not found for Twilio SMS: ${messageSid}`);
      return { status: 'not_found', message_id: messageSid };
    }

    // Log webhook event
    await this.prisma.webhook_event.create({
      data: {
        id: randomUUID(),
        provider_id: commEvent.provider_id,
        communication_event_id: commEvent.id,
        event_type: messageStatus,
        provider_message_id: messageSid,
        payload: event,
        signature_verified: true,
        processed: true,
        processed_at: new Date(),
      },
    });

    // Update status
    const statusMap: Record<string, string> = {
      sent: 'sent',
      delivered: 'delivered',
      failed: 'failed',
      undelivered: 'failed',
    };

    const newStatus = statusMap[messageStatus];
    if (newStatus) {
      await this.prisma.communication_event.update({
        where: { id: commEvent.id },
        data: {
          status: newStatus as any,
          delivered_at: messageStatus === 'delivered' ? new Date() : undefined,
          bounced_at:
            messageStatus === 'failed' || messageStatus === 'undelivered'
              ? new Date()
              : undefined,
          error_message: event.ErrorCode
            ? `${event.ErrorCode}: ${event.ErrorMessage}`
            : undefined,
        },
      });
    }

    return { status: 'processed', event_type: messageStatus, message_id: messageSid };
  }

  /**
   * Process Twilio WhatsApp event
   */
  private async processTwilioWhatsAppEvent(event: any) {
    // Same processing as SMS
    return this.processTwilioSmsEvent(event);
  }

  /**
   * Get webhook secret for provider
   */
  private async getWebhookSecret(providerKey: string) {
    // Try tenant config first (if available in context)
    // For now, use platform config
    const platformConfig = await this.prisma.platform_email_config.findFirst({
      include: { provider: true },
    });

    if (platformConfig?.provider?.provider_key === providerKey) {
      return {
        webhook_secret: platformConfig.webhook_secret,
      };
    }

    // Try tenant configs (for SMS/WhatsApp, they might have their own config)
    const tenantConfig = await this.prisma.tenant_email_config.findFirst({
      where: {
        provider: {
          provider_key: providerKey,
        },
      },
    });

    if (tenantConfig) {
      return {
        webhook_secret: tenantConfig.webhook_secret,
      };
    }

    throw new BadRequestException(
      `No webhook secret configured for provider: ${providerKey}`,
    );
  }
}
