import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { WebhooksService } from '../services/webhooks.service';
import type { Request } from 'express';

/**
 * Webhooks Controller
 *
 * PUBLIC endpoints for receiving webhook callbacks from providers.
 * No JWT authentication required (verified by signature instead).
 *
 * Handles webhooks from:
 * - SendGrid (email events: delivered, bounced, opened, clicked)
 * - Amazon SES/SNS (email events via SNS notifications)
 * - Brevo (email events: delivered, bounced, opened, clicked)
 * - Twilio SMS (status callbacks: sent, delivered, failed)
 * - Twilio WhatsApp (status callbacks: sent, delivered, read, failed)
 *
 * Security: All webhooks verify signatures before processing
 */
@ApiTags('Communication - Webhooks')
@Controller('webhooks/communication')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('sendgrid')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'SendGrid webhook receiver (PUBLIC)',
    description:
      'Receives email event notifications from SendGrid (delivered, bounced, opened, clicked, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid webhook signature',
  })
  @ApiExcludeEndpoint() // Exclude from Swagger (internal webhook)
  async handleSendGrid(
    @Body() events: any[],
    @Headers('x-twilio-email-event-webhook-signature') signature: string,
    @Headers('x-twilio-email-event-webhook-timestamp') timestamp: string,
    @Req() req: Request,
  ) {
    this.logger.log(`Received SendGrid webhook with ${events?.length || 0} events`);

    // Log all headers for debugging
    this.logger.debug(`[SENDGRID WEBHOOK] All headers: ${JSON.stringify(req.headers)}`);
    this.logger.debug(`[SENDGRID WEBHOOK] Signature header (x-twilio-email-event-webhook-signature): ${signature || 'missing'}`);
    this.logger.debug(`[SENDGRID WEBHOOK] Timestamp header (x-twilio-email-event-webhook-timestamp): ${timestamp || 'missing'}`);
    this.logger.debug(`[SENDGRID WEBHOOK] Body type: ${Array.isArray(events) ? 'array' : typeof events}`);
    this.logger.debug(`[SENDGRID WEBHOOK] Events count: ${events?.length || 0}`);

    try {
      // Get raw body Buffer from request (required for SendGrid signature verification)
      // SendGrid's verifySignature() expects a Buffer, not a string
      const rawBody = (req as any).rawBody;

      if (!rawBody) {
        this.logger.error(`[SENDGRID WEBHOOK] Raw body not available - signature verification will fail`);
        throw new Error('Raw body not captured for webhook verification');
      }

      const isBuffer = Buffer.isBuffer(rawBody);
      this.logger.debug(`[SENDGRID WEBHOOK] Raw body type: ${isBuffer ? 'Buffer' : typeof rawBody}`);
      this.logger.debug(`[SENDGRID WEBHOOK] Raw body available: ${!!rawBody}`);
      this.logger.debug(`[SENDGRID WEBHOOK] Raw body first 150 chars: ${rawBody.toString('utf8').substring(0, 150)}`);
      this.logger.debug(`[SENDGRID WEBHOOK] Raw body length: ${rawBody.length} bytes`);

      await this.webhooksService.processSendGridWebhook(
        events,
        signature,
        timestamp,
        rawBody, // Pass Buffer, not string
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`SendGrid webhook processing failed: ${error.message}`);
      throw error;
    }
  }

  @Post('amazon-ses')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Amazon SES/SNS webhook receiver (PUBLIC)',
    description:
      'Receives email event notifications from Amazon SES via SNS (bounce, complaint, delivery)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid SNS signature',
  })
  @ApiExcludeEndpoint() // Exclude from Swagger (internal webhook)
  async handleAmazonSES(@Body() payload: any, @Req() req: Request, @Headers() headers: any) {
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('🔔 AMAZON SES WEBHOOK RECEIVED');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log(`📍 URL: ${req.method} ${req.url}`);
    this.logger.log(`📦 Payload Type: ${payload.Type || payload['detail-type'] || 'unknown type'}`);
    this.logger.log(`📋 Headers: ${JSON.stringify(headers, null, 2)}`);
    this.logger.log(`📄 Full Payload: ${JSON.stringify(payload, null, 2)}`);
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Handle EventBridge events (new format from AWS SES)
      if (payload['detail-type']) {
        this.logger.log(`📬 EventBridge event detected: ${payload['detail-type']}`);

        // Extract messageId from EventBridge payload
        const messageId = payload.detail?.mail?.messageId;
        const eventType = payload.detail?.eventType;

        this.logger.log(`📧 Message ID: ${messageId}`);
        this.logger.log(`📊 Event Type: ${eventType}`);

        if (messageId) {
          // Process the event (update communication_event status)
          await this.webhooksService.processAmazonSESEventBridge(payload);
          return { success: true, messageId, eventType };
        } else {
          this.logger.warn('EventBridge payload missing messageId');
          return { success: false, message: 'Missing messageId in EventBridge payload' };
        }
      }

      // Handle SNS subscription confirmation (legacy format)
      if (payload.Type === 'SubscriptionConfirmation') {
        this.logger.log('📨 SNS Subscription Confirmation detected');
        await this.webhooksService.confirmSnsSubscription(payload);
        return { success: true };
      }

      // Handle SNS notification (legacy format)
      if (payload.Type === 'Notification') {
        this.logger.log('📬 SNS Notification detected');
        await this.webhooksService.processAmazonSESWebhook(payload);
        return { success: true };
      }

      this.logger.warn(`Unknown message format - Type: ${payload.Type}, detail-type: ${payload['detail-type']}`);
      return { success: false, message: 'Unknown message format' };
    } catch (error) {
      this.logger.error(`Amazon SES webhook processing failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('amazon_ses')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Exclude from Swagger (internal webhook)
  async handleAmazonSESUnderscore(@Body() payload: any, @Req() req: Request, @Headers() headers: any) {
    // Alias for amazon-ses (AWS sometimes uses underscore)
    return this.handleAmazonSES(payload, req, headers);
  }

  @Post('brevo')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Brevo webhook receiver (PUBLIC)',
    description:
      'Receives email event notifications from Brevo (delivered, bounced, opened, clicked, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid webhook token',
  })
  @ApiExcludeEndpoint() // Exclude from Swagger (internal webhook)
  async handleBrevo(
    @Body() payload: any,
    @Headers('x-sib-signature') token: string,
    @Req() req: Request,
  ) {
    this.logger.log(`Received Brevo webhook: ${payload.event || 'unknown event'}`);

    try {
      await this.webhooksService.processBrevoWebhook(payload, token);
      return { success: true };
    } catch (error) {
      this.logger.error(`Brevo webhook processing failed: ${error.message}`);
      throw error;
    }
  }

  @Post('twilio-sms')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Twilio SMS webhook receiver (PUBLIC)',
    description:
      'Receives SMS status callbacks from Twilio (sent, delivered, failed, undelivered)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid Twilio signature',
  })
  @ApiExcludeEndpoint() // Exclude from Swagger (internal webhook)
  async handleTwilioSMS(
    @Body() payload: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
  ) {
    this.logger.log(`Received Twilio SMS webhook: ${payload.MessageStatus || 'unknown status'}`);

    try {
      await this.webhooksService.processTwilioSmsWebhook(
        payload,
        signature,
        req.protocol + '://' + req.get('host') + req.originalUrl,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Twilio SMS webhook processing failed: ${error.message}`);
      throw error;
    }
  }

  @Post('twilio-whatsapp')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Twilio WhatsApp webhook receiver (PUBLIC)',
    description:
      'Receives WhatsApp status callbacks from Twilio (sent, delivered, read, failed)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid Twilio signature',
  })
  @ApiExcludeEndpoint() // Exclude from Swagger (internal webhook)
  async handleTwilioWhatsApp(
    @Body() payload: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
  ) {
    this.logger.log(`Received Twilio WhatsApp webhook: ${payload.MessageStatus || 'unknown status'}`);

    try {
      await this.webhooksService.processTwilioWhatsAppWebhook(
        payload,
        signature,
        req.protocol + '://' + req.get('host') + req.originalUrl,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Twilio WhatsApp webhook processing failed: ${error.message}`);
      throw error;
    }
  }
}
