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

    try {
      await this.webhooksService.processSendGridWebhook(
        events,
        signature,
        timestamp,
        JSON.stringify(req.body),
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
  async handleAmazonSES(@Body() payload: any, @Req() req: Request) {
    this.logger.log(`Received Amazon SES webhook: ${payload.Type || 'unknown type'}`);

    try {
      // Handle SNS subscription confirmation
      if (payload.Type === 'SubscriptionConfirmation') {
        await this.webhooksService.confirmSnsSubscription(payload);
        return { success: true };
      }

      // Handle SNS notification
      if (payload.Type === 'Notification') {
        await this.webhooksService.processAmazonSESWebhook(payload);
        return { success: true };
      }

      this.logger.warn(`Unknown SNS message type: ${payload.Type}`);
      return { success: false, message: 'Unknown message type' };
    } catch (error) {
      this.logger.error(`Amazon SES webhook processing failed: ${error.message}`);
      throw error;
    }
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
