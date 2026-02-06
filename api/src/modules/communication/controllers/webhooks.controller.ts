import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  Header,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { WebhooksService } from '../services/webhooks.service';
import { CallManagementService } from '../services/call-management.service';
import { LeadMatchingService } from '../services/lead-matching.service';
import { IvrConfigurationService } from '../services/ivr-configuration.service';
import { OfficeBypassService } from '../services/office-bypass.service';
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
 * - Twilio Voice (call status, recording ready, call bridging)
 *
 * Security: All webhooks verify signatures before processing
 */
@ApiTags('Communication - Webhooks')
@Controller('webhooks/communication')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly callManagementService: CallManagementService,
    private readonly leadMatchingService: LeadMatchingService,
    @Optional()
    @Inject(forwardRef(() => IvrConfigurationService))
    private readonly ivrConfigurationService?: IvrConfigurationService,
    @Optional()
    @Inject(forwardRef(() => OfficeBypassService))
    private readonly officeBypassService?: OfficeBypassService,
  ) {}

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
    this.logger.log(
      `Received SendGrid webhook with ${events?.length || 0} events`,
    );

    // Log all headers for debugging
    this.logger.debug(
      `[SENDGRID WEBHOOK] All headers: ${JSON.stringify(req.headers)}`,
    );
    this.logger.debug(
      `[SENDGRID WEBHOOK] Signature header (x-twilio-email-event-webhook-signature): ${signature || 'missing'}`,
    );
    this.logger.debug(
      `[SENDGRID WEBHOOK] Timestamp header (x-twilio-email-event-webhook-timestamp): ${timestamp || 'missing'}`,
    );
    this.logger.debug(
      `[SENDGRID WEBHOOK] Body type: ${Array.isArray(events) ? 'array' : typeof events}`,
    );
    this.logger.debug(
      `[SENDGRID WEBHOOK] Events count: ${events?.length || 0}`,
    );

    try {
      // Get raw body Buffer from request (required for SendGrid signature verification)
      // SendGrid's verifySignature() expects a Buffer, not a string
      const rawBody = (req as any).rawBody;

      if (!rawBody) {
        this.logger.error(
          `[SENDGRID WEBHOOK] Raw body not available - signature verification will fail`,
        );
        throw new Error('Raw body not captured for webhook verification');
      }

      const isBuffer = Buffer.isBuffer(rawBody);
      this.logger.debug(
        `[SENDGRID WEBHOOK] Raw body type: ${isBuffer ? 'Buffer' : typeof rawBody}`,
      );
      this.logger.debug(`[SENDGRID WEBHOOK] Raw body available: ${!!rawBody}`);
      this.logger.debug(
        `[SENDGRID WEBHOOK] Raw body first 150 chars: ${rawBody.toString('utf8').substring(0, 150)}`,
      );
      this.logger.debug(
        `[SENDGRID WEBHOOK] Raw body length: ${rawBody.length} bytes`,
      );

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
  async handleAmazonSES(
    @Body() payload: any,
    @Req() req: Request,
    @Headers() headers: any,
  ) {
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('🔔 AMAZON SES WEBHOOK RECEIVED');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log(`📍 URL: ${req.method} ${req.url}`);
    this.logger.log(
      `📦 Payload Type: ${payload.Type || payload['detail-type'] || 'unknown type'}`,
    );
    this.logger.log(`📋 Headers: ${JSON.stringify(headers, null, 2)}`);
    this.logger.log(`📄 Full Payload: ${JSON.stringify(payload, null, 2)}`);
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Handle EventBridge events (new format from AWS SES)
      if (payload['detail-type']) {
        this.logger.log(
          `📬 EventBridge event detected: ${payload['detail-type']}`,
        );

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
          return {
            success: false,
            message: 'Missing messageId in EventBridge payload',
          };
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

      this.logger.warn(
        `Unknown message format - Type: ${payload.Type}, detail-type: ${payload['detail-type']}`,
      );
      return { success: false, message: 'Unknown message format' };
    } catch (error) {
      this.logger.error(
        `Amazon SES webhook processing failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('amazon_ses')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Exclude from Swagger (internal webhook)
  async handleAmazonSESUnderscore(
    @Body() payload: any,
    @Req() req: Request,
    @Headers() headers: any,
  ) {
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
    this.logger.log(
      `Received Brevo webhook: ${payload.event || 'unknown event'}`,
    );

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
    this.logger.log(
      `Received Twilio SMS webhook: ${payload.MessageStatus || 'unknown status'}`,
    );

    try {
      await this.webhooksService.processTwilioSmsWebhook(
        payload,
        signature,
        req.protocol + '://' + req.get('host') + req.originalUrl,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Twilio SMS webhook processing failed: ${error.message}`,
      );
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
    this.logger.log(
      `Received Twilio WhatsApp webhook: ${payload.MessageStatus || 'unknown status'}`,
    );

    try {
      await this.webhooksService.processTwilioWhatsAppWebhook(
        payload,
        signature,
        req.protocol + '://' + req.get('host') + req.originalUrl,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Twilio WhatsApp webhook processing failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Twilio Voice Call Status Webhook
   * Receives call status updates from Twilio
   */
  @Post('twilio-call-status')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Twilio Voice call status webhook (PUBLIC)',
    description:
      'Receives call status notifications from Twilio (initiated, ringing, answered, completed)',
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
  async handleTwilioCallStatus(
    @Body() payload: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
  ) {
    const { CallSid, CallStatus, CallDuration } = payload;

    this.logger.log(
      `Received Twilio Call Status webhook: ${CallSid} - ${CallStatus}`,
    );

    try {
      // Handle different call statuses
      switch (CallStatus) {
        case 'answered':
          await this.callManagementService.handleCallAnswered(CallSid);
          break;

        case 'completed':
          const duration = parseInt(CallDuration, 10) || 0;
          await this.callManagementService.handleCallEnded(CallSid, duration);
          break;

        case 'failed':
        case 'busy':
        case 'no-answer':
          await this.callManagementService.handleCallEnded(CallSid, 0);
          break;

        default:
          this.logger.debug(`Unhandled call status: ${CallStatus}`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Twilio Call Status webhook processing failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Twilio Recording Ready Webhook
   * Receives notification when call recording is ready for download
   */
  @Post('twilio-recording-ready')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Twilio recording ready webhook (PUBLIC)',
    description:
      'Receives notification when a call recording is ready for download',
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
  async handleTwilioRecordingReady(
    @Body() payload: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
  ) {
    const { CallSid, RecordingUrl, RecordingDuration } = payload;

    this.logger.log(
      `Received Twilio Recording Ready webhook: ${CallSid} - Duration: ${RecordingDuration}s`,
    );

    try {
      // Construct full recording URL (Twilio sends relative URL)
      const fullRecordingUrl = RecordingUrl.startsWith('http')
        ? RecordingUrl
        : `https://api.twilio.com${RecordingUrl}`;

      const duration = parseInt(RecordingDuration, 10) || 0;

      await this.callManagementService.handleRecordingReady(
        CallSid,
        fullRecordingUrl,
        duration,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Twilio Recording Ready webhook processing failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Twilio Inbound Call Webhook
   * Receives inbound call notifications and creates call records
   */
  @Post('twilio-inbound-call')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio inbound call webhook (PUBLIC)',
    description:
      'Receives inbound call notifications from Twilio and returns TwiML for call routing',
  })
  @ApiResponse({
    status: 200,
    description: 'TwiML response returned',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid Twilio signature',
  })
  @ApiExcludeEndpoint() // Exclude from Swagger (internal webhook)
  async handleTwilioInboundCall(
    @Body() payload: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
  ) {
    const { CallSid, From, To } = payload;

    this.logger.log(
      `Received Twilio Inbound Call webhook: ${CallSid} from ${From}`,
    );

    try {
      // Extract tenant from subdomain (host: tenant.lead360.app)
      const host = req.get('host') || '';
      const subdomain = host.split('.')[0];

      // Get tenant by subdomain
      const tenant =
        await this.callManagementService['prisma'].tenant.findUnique({
          where: { subdomain },
          select: { id: true },
        });

      if (!tenant) {
        this.logger.error(`Tenant not found for subdomain: ${subdomain}`);
        // Return TwiML to reject call
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, this number is not configured.</Say><Hangup/></Response>`;
      }

      // Handle inbound call and return TwiML
      const twiml = await this.callManagementService.handleInboundCall(
        tenant.id,
        payload,
      );

      return twiml;
    } catch (error) {
      this.logger.error(
        `Twilio Inbound Call webhook processing failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Twilio Call Bridge Webhook
   * Returns TwiML to bridge user call to Lead
   */
  @Post('twilio-call-connect/:callRecordId')
  @Public() // No JWT required
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio call bridge webhook (PUBLIC)',
    description:
      'Returns TwiML to bridge the user to the Lead when user answers the call',
  })
  @ApiResponse({
    status: 200,
    description: 'TwiML response returned',
  })
  @ApiExcludeEndpoint() // Exclude from Swagger (internal webhook)
  async handleTwilioCallConnect(
    @Param('callRecordId') callRecordId: string,
    @Body() payload: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
  ) {
    this.logger.log(
      `Received Twilio Call Connect webhook for CallRecord: ${callRecordId}`,
    );

    try {
      // Generate TwiML to bridge call to Lead
      const twiml =
        await this.callManagementService.bridgeCallToLead(callRecordId);

      return twiml;
    } catch (error) {
      this.logger.error(
        `Twilio Call Connect webhook processing failed: ${error.message}`,
      );

      // Return TwiML error response
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, we couldn't connect your call. Please try again later.</Say><Hangup/></Response>`;
    }
  }

  /**
   * Twilio IVR Menu Webhook
   * Returns IVR menu TwiML
   */
  @Post('twilio-ivr-menu')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio IVR menu webhook (PUBLIC)',
    description: 'Returns IVR menu TwiML for tenant',
  })
  @ApiExcludeEndpoint()
  async handleTwilioIvrMenu(@Body() payload: any, @Req() req: Request) {
    const { CallSid } = payload;

    this.logger.log(`Received Twilio IVR Menu request: ${CallSid}`);

    try {
      // Extract tenant from call record
      const callRecord = await this.callManagementService['prisma'].call_record.findUnique({
        where: { twilio_call_sid: CallSid },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found for CallSid: ${CallSid}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
      }

      if (!this.ivrConfigurationService) {
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service not available.</Say><Hangup/></Response>`;
      }

      const twiml = await this.ivrConfigurationService.generateIvrMenuTwiML(
        callRecord.tenant_id,
      );

      return twiml;
    } catch (error) {
      this.logger.error(`IVR menu generation failed: ${error.message}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
    }
  }

  /**
   * Twilio IVR Input Webhook
   * Handles IVR digit input
   */
  @Post('twilio-ivr-input')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio IVR input webhook (PUBLIC)',
    description: 'Handles IVR digit input and executes action',
  })
  @ApiExcludeEndpoint()
  async handleTwilioIvrInput(@Body() payload: any, @Req() req: Request) {
    const { CallSid, Digits } = payload;

    this.logger.log(`Received Twilio IVR Input: ${CallSid} - Digit: ${Digits}`);

    try {
      // Extract tenant from call record
      const callRecord = await this.callManagementService['prisma'].call_record.findUnique({
        where: { twilio_call_sid: CallSid },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found for CallSid: ${CallSid}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
      }

      if (!this.ivrConfigurationService) {
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service not available.</Say><Hangup/></Response>`;
      }

      // Update call record with IVR action
      await this.callManagementService['prisma'].call_record.update({
        where: { twilio_call_sid: CallSid },
        data: { ivr_action_taken: { digit: Digits } },
      });

      const twiml = await this.ivrConfigurationService.executeIvrAction(
        callRecord.tenant_id,
        Digits,
      );

      return twiml;
    } catch (error) {
      this.logger.error(`IVR input processing failed: ${error.message}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
    }
  }

  /**
   * Twilio IVR Default Action Webhook
   * Handles IVR timeout/no input
   */
  @Post('twilio-ivr-default')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio IVR default action webhook (PUBLIC)',
    description: 'Handles IVR timeout/no input',
  })
  @ApiExcludeEndpoint()
  async handleTwilioIvrDefault(@Body() payload: any, @Req() req: Request) {
    const { CallSid } = payload;

    this.logger.log(`Received Twilio IVR Default Action: ${CallSid}`);

    try {
      // Extract tenant from call record
      const callRecord = await this.callManagementService['prisma'].call_record.findUnique({
        where: { twilio_call_sid: CallSid },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found for CallSid: ${CallSid}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
      }

      if (!this.ivrConfigurationService) {
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service not available.</Say><Hangup/></Response>`;
      }

      const twiml = await this.ivrConfigurationService.executeDefaultAction(
        callRecord.tenant_id,
      );

      return twiml;
    } catch (error) {
      this.logger.error(`IVR default action failed: ${error.message}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
    }
  }

  /**
   * Twilio Office Bypass Prompt Webhook
   * Returns prompt TwiML for target number input
   */
  @Post('twilio-bypass-prompt')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio office bypass prompt webhook (PUBLIC)',
    description: 'Returns prompt for target phone number',
  })
  @ApiExcludeEndpoint()
  async handleTwilioBypassPrompt(@Body() payload: any, @Req() req: Request) {
    const { CallSid, From } = payload;

    this.logger.log(`Received Twilio Bypass Prompt: ${CallSid}`);

    try {
      // Extract tenant from call record
      const callRecord = await this.callManagementService['prisma'].call_record.findUnique({
        where: { twilio_call_sid: CallSid },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found for CallSid: ${CallSid}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
      }

      if (!this.officeBypassService) {
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service not available.</Say><Hangup/></Response>`;
      }

      const twiml = await this.officeBypassService.handleBypassCall(
        callRecord.tenant_id,
        From,
      );

      return twiml;
    } catch (error) {
      this.logger.error(`Bypass prompt generation failed: ${error.message}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
    }
  }

  /**
   * Twilio Office Bypass Dial Webhook
   * Initiates outbound call to target number
   */
  @Post('twilio-bypass-dial')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio office bypass dial webhook (PUBLIC)',
    description: 'Dials target number entered by whitelisted caller',
  })
  @ApiExcludeEndpoint()
  async handleTwilioBypassDial(@Body() payload: any, @Req() req: Request) {
    const { CallSid, Digits } = payload;

    this.logger.log(`Received Twilio Bypass Dial: ${CallSid} - Target: ${Digits}`);

    try {
      // Extract tenant from call record
      const callRecord = await this.callManagementService['prisma'].call_record.findUnique({
        where: { twilio_call_sid: CallSid },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found for CallSid: ${CallSid}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
      }

      if (!this.officeBypassService) {
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Service not available.</Say><Hangup/></Response>`;
      }

      const twiml = await this.officeBypassService.initiateBypassOutboundCall(
        callRecord.tenant_id,
        CallSid,
        Digits,
      );

      return twiml;
    } catch (error) {
      this.logger.error(`Bypass dial failed: ${error.message}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, the call could not be completed.</Say><Hangup/></Response>`;
    }
  }
}
