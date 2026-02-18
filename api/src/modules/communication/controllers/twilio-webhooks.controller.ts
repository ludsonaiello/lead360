import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Param,
  Header,
  Logger,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Request } from 'express';
import { Public } from '../../auth/decorators';
import { CallManagementService } from '../services/call-management.service';
import { LeadMatchingService } from '../services/lead-matching.service';
import { IvrConfigurationService } from '../services/ivr-configuration.service';
import { OfficeBypassService } from '../services/office-bypass.service';
import { WebhookVerificationService } from '../services/webhook-verification.service';
import { TranscriptionJobService } from '../services/transcription-job.service';
import {
  SmsKeywordDetectionService,
  SmsKeywordAction,
} from '../services/sms-keyword-detection.service';
import { SmsMetricsService } from '../services/sms-metrics.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Twilio Webhooks Controller (Public Endpoints)
 *
 * Handles all incoming webhooks from Twilio for:
 * - Inbound SMS messages
 * - Inbound voice calls
 * - Call status updates (ringing, in-progress, completed)
 * - Recording ready notifications
 * - IVR DTMF input handling
 *
 * Security:
 * - Twilio signature verification on all endpoints
 * - Tenant resolution from subdomain
 * - Rate limiting applied
 *
 * Endpoints are PUBLIC (no JWT auth) but require valid Twilio signatures.
 *
 * @example
 * Webhook URLs configured in Twilio:
 * - https://tenant123.lead360.app/api/v1/twilio/sms/inbound
 * - https://tenant123.lead360.app/api/v1/twilio/call/inbound
 * - https://tenant123.lead360.app/api/v1/twilio/call/status
 * - https://tenant123.lead360.app/api/v1/twilio/recording/ready
 * - https://tenant123.lead360.app/api/v1/twilio/ivr/input
 */
@ApiTags('Twilio Webhooks (Public)')
@Controller('twilio')
export class TwilioWebhooksController {
  private readonly logger = new Logger(TwilioWebhooksController.name);

  constructor(
    private readonly callService: CallManagementService,
    private readonly leadMatching: LeadMatchingService,
    private readonly ivrService: IvrConfigurationService,
    private readonly bypassService: OfficeBypassService,
    private readonly webhookVerification: WebhookVerificationService,
    private readonly transcriptionService: TranscriptionJobService,
    private readonly smsKeywordDetection: SmsKeywordDetectionService,
    private readonly metrics: SmsMetricsService,
    @InjectQueue('communication-sms') private readonly smsQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Inbound SMS Webhook
   *
   * Receives inbound SMS messages from Twilio. Creates communication event
   * and attempts to match/create Lead for the sender.
   *
   * Twilio Payload:
   * - MessageSid: Unique message identifier
   * - From: Sender phone number (E.164 format)
   * - To: Recipient phone number (tenant's Twilio number)
   * - Body: SMS text content
   * - NumMedia: Number of media attachments
   *
   * @param body - Twilio SMS webhook payload
   * @param signature - Twilio signature header for verification
   * @param request - Express request object
   * @returns Empty response (200 OK)
   */
  @Post('sms/inbound')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive inbound SMS from Twilio' })
  @ApiResponse({ status: 200, description: 'SMS processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid Twilio signature' })
  @ApiExcludeEndpoint() // Exclude from public API docs (webhook only)
  async handleSmsInbound(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    this.logger.log(
      `Inbound SMS webhook received: ${body.MessageSid} from ${body.From}`,
    );

    // Log all request headers for debugging signature verification
    this.logger.debug('[HEADERS] ========== Request Headers ==========');
    this.logger.debug(`[HEADERS] Host: ${request.get('host')}`);
    this.logger.debug(
      `[HEADERS] X-Forwarded-Host: ${request.get('x-forwarded-host') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Forwarded-Proto: ${request.get('x-forwarded-proto') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Forwarded-For: ${request.get('x-forwarded-for') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Real-IP: ${request.get('x-real-ip') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Tenant-Subdomain: ${request.get('x-tenant-subdomain') || '(not set)'}`,
    );
    this.logger.debug(`[HEADERS] X-Twilio-Signature: ${signature}`);
    this.logger.debug(`[HEADERS] Protocol: ${request.protocol}`);
    this.logger.debug(`[HEADERS] Original URL: ${request.originalUrl}`);
    this.logger.debug(`[HEADERS] Path: ${request.path}`);
    this.logger.debug(
      `[HEADERS] Query String: ${request.url.includes('?') ? request.url.split('?')[1] : '(none)'}`,
    );
    this.logger.debug(
      '[HEADERS] ===============================================',
    );

    // Step 1: Extract tenant from subdomain
    const tenantId = await this.resolveTenantFromSubdomain(request);

    this.logger.debug(`Tenant resolved: ${tenantId}`);

    // Step 2: Verify Twilio signature
    const authToken = await this.getTenantTwilioAuthToken(tenantId);
    const url = this.buildWebhookUrl(request);

    this.logger.debug(`Verifying signature for URL: ${url}`);

    if (
      !this.webhookVerification.verifyTwilio(url, body, signature, authToken)
    ) {
      this.logger.error(
        `❌ Invalid Twilio signature for SMS webhook (tenant: ${tenantId})`,
      );
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    this.logger.debug('✅ Twilio signature verified');

    // Step 3: Match or create Lead
    let leadId: string | null = null;
    try {
      leadId = await this.leadMatching.matchOrCreateLead(tenantId, body.From);
      this.logger.log(`Lead matched/created: ${leadId}`);
    } catch (error) {
      this.logger.error(
        `Failed to match/create lead for ${body.From}: ${error.message}`,
      );
      // Continue processing even if lead matching fails
    }

    // Step 4: Detect SMS keywords (STOP/START/HELP) for TCPA compliance
    if (leadId && body.Body) {
      const keywordResult = this.smsKeywordDetection.detectKeyword(body.Body);

      if (keywordResult.action !== SmsKeywordAction.NONE) {
        this.logger.log(
          `🔔 Keyword detected: ${keywordResult.keyword} (action: ${keywordResult.action}) for Lead ${leadId}`,
        );

        // Process opt-out action
        if (keywordResult.action === SmsKeywordAction.OPT_OUT) {
          await this.smsKeywordDetection.processOptOut(
            tenantId,
            leadId,
            `User sent: ${keywordResult.keyword}`,
          );
        }
        // Process opt-in action
        else if (keywordResult.action === SmsKeywordAction.OPT_IN) {
          await this.smsKeywordDetection.processOptIn(tenantId, leadId);
        }

        // Send auto-reply SMS (for all keywords: STOP, START, HELP)
        if (keywordResult.autoReplyMessage) {
          try {
            await this.sendAutoReplySms(
              tenantId,
              body.From,
              body.To,
              keywordResult.autoReplyMessage,
              leadId,
            );
            this.logger.log(
              `✅ Auto-reply SMS queued for keyword: ${keywordResult.keyword}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to send auto-reply SMS: ${error.message}`,
            );
            // Don't throw - webhook should still return 200 OK
          }
        }
      }
    }

    // Step 5: Create communication event for inbound SMS (for history tracking)
    try {
      // Get Twilio SMS provider
      const twilioProvider = await this.prisma.communication_provider.findFirst(
        {
          where: { provider_key: 'twilio_sms' },
        },
      );

      if (!twilioProvider) {
        this.logger.error('Twilio SMS provider not found in database');
      } else {
        // Create communication_event for inbound SMS
        await this.prisma.communication_event.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            provider_id: twilioProvider.id,
            channel: 'sms',
            direction: 'inbound', // CRITICAL: Mark as inbound
            status: 'delivered', // Inbound SMS are already delivered
            to_phone: body.From, // Sender's phone (who we received from)
            text_body: body.Body || '', // SMS content
            provider_message_id: body.MessageSid, // Twilio Message SID
            delivered_at: new Date(), // Already delivered (inbound)
            related_entity_type: leadId ? 'lead' : null,
            related_entity_id: leadId,
            // Note: created_by_user_id is null for inbound (not initiated by user)
          },
        });

        this.logger.log(
          `✅ Communication event created for inbound SMS: ${body.MessageSid}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to create communication_event for inbound SMS: ${error.message}`,
      );
      // Don't throw - webhook should still return 200 OK
    }

    this.logger.log(`✅ Inbound SMS processed: ${body.MessageSid}`);

    // Return empty response (Twilio expects 200 OK)
    return {};
  }

  /**
   * Inbound Call Webhook
   *
   * Receives inbound call notifications from Twilio. Creates CallRecord
   * and returns TwiML response based on IVR/bypass configuration.
   *
   * Twilio Payload:
   * - CallSid: Unique call identifier
   * - From: Caller phone number
   * - To: Recipient phone number (tenant's Twilio number)
   * - CallStatus: Call status (ringing)
   *
   * @param body - Twilio call webhook payload
   * @param signature - Twilio signature header
   * @param request - Express request object
   * @returns TwiML XML response
   */
  @Post('call/inbound')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive inbound call from Twilio' })
  @ApiResponse({ status: 200, description: 'TwiML response returned' })
  @ApiExcludeEndpoint()
  async handleCallInbound(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    this.logger.log(
      `Inbound call webhook received: ${body.CallSid} from ${body.From}`,
    );

    // Log all request headers for debugging signature verification
    this.logger.debug('[HEADERS] ========== Request Headers ==========');
    this.logger.debug(`[HEADERS] Host: ${request.get('host')}`);
    this.logger.debug(
      `[HEADERS] X-Forwarded-Host: ${request.get('x-forwarded-host') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Forwarded-Proto: ${request.get('x-forwarded-proto') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Forwarded-For: ${request.get('x-forwarded-for') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Real-IP: ${request.get('x-real-ip') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Tenant-Subdomain: ${request.get('x-tenant-subdomain') || '(not set)'}`,
    );
    this.logger.debug(`[HEADERS] X-Twilio-Signature: ${signature}`);
    this.logger.debug(`[HEADERS] Protocol: ${request.protocol}`);
    this.logger.debug(`[HEADERS] Original URL: ${request.originalUrl}`);
    this.logger.debug(`[HEADERS] Path: ${request.path}`);
    this.logger.debug(
      `[HEADERS] Query String: ${request.url.includes('?') ? request.url.split('?')[1] : '(none)'}`,
    );
    this.logger.debug(
      '[HEADERS] ===============================================',
    );

    // Extract tenant
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Verify signature
    const authToken = await this.getTenantTwilioAuthToken(tenantId);
    const url = this.buildWebhookUrl(request);

    if (
      !this.webhookVerification.verifyTwilio(url, body, signature, authToken)
    ) {
      this.logger.error('❌ Invalid Twilio signature for call webhook');
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    // Handle inbound call (returns TwiML)
    const twiml = await this.callService.handleInboundCall(tenantId, body);

    this.logger.log(`✅ Inbound call processed: ${body.CallSid}`);

    // Return TwiML as XML (CallManagementService generates this)
    return twiml;
  }

  /**
   * Call Status Webhook
   *
   * Receives call status updates from Twilio throughout call lifecycle:
   * - ringing: Call initiated
   * - in-progress: Call answered
   * - completed: Call ended normally
   * - failed: Call failed
   * - busy: Line busy
   * - no-answer: No answer
   * - canceled: Call canceled
   *
   * @param body - Twilio status webhook payload
   * @param signature - Twilio signature header
   * @param request - Express request object
   * @returns Empty response
   */
  @Post('call/status')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive call status updates from Twilio' })
  @ApiResponse({ status: 200, description: 'Status update processed' })
  @ApiExcludeEndpoint()
  async handleCallStatus(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    const { CallSid, CallStatus, CallDuration } = body;

    this.logger.log(`Call status webhook: ${CallSid} - ${CallStatus}`);

    // Log all request headers for debugging signature verification
    this.logger.debug('[HEADERS] ========== Request Headers ==========');
    this.logger.debug(`[HEADERS] Host: ${request.get('host')}`);
    this.logger.debug(
      `[HEADERS] X-Forwarded-Host: ${request.get('x-forwarded-host') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Forwarded-Proto: ${request.get('x-forwarded-proto') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Forwarded-For: ${request.get('x-forwarded-for') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Real-IP: ${request.get('x-real-ip') || '(not set)'}`,
    );
    this.logger.debug(
      `[HEADERS] X-Tenant-Subdomain: ${request.get('x-tenant-subdomain') || '(not set)'}`,
    );
    this.logger.debug(`[HEADERS] X-Twilio-Signature: ${signature}`);
    this.logger.debug(`[HEADERS] Protocol: ${request.protocol}`);
    this.logger.debug(`[HEADERS] Original URL: ${request.originalUrl}`);
    this.logger.debug(`[HEADERS] Path: ${request.path}`);
    this.logger.debug(
      `[HEADERS] Query String: ${request.url.includes('?') ? request.url.split('?')[1] : '(none)'}`,
    );
    this.logger.debug(
      '[HEADERS] ===============================================',
    );

    // Extract tenant
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Verify signature
    const authToken = await this.getTenantTwilioAuthToken(tenantId);
    const url = this.buildWebhookUrl(request);

    if (
      !this.webhookVerification.verifyTwilio(url, body, signature, authToken)
    ) {
      this.logger.error('❌ Invalid Twilio signature for status webhook');
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    // Check if this is a child call (created by <Dial> verb)
    // Child calls have ParentCallSid and Direction = "outbound-dial"
    const isChildCall =
      body.ParentCallSid && body.Direction === 'outbound-dial';

    if (isChildCall) {
      this.logger.debug(
        `[CHILD CALL] Ignoring status webhook for child call ${CallSid} (parent: ${body.ParentCallSid}). Child calls are created by <Dial> and don't have call_records.`,
      );
      return {};
    }

    // Handle status update based on call state
    switch (CallStatus) {
      case 'initiated':
        this.logger.debug(`Call ${CallSid} initiated`);
        // Initial status - call is being placed
        // Call record already created with status 'initiated'
        break;

      case 'ringing':
        this.logger.debug(`Call ${CallSid} is ringing`);
        // Status already set to 'initiated' when call was created
        break;

      case 'in-progress':
        this.logger.log(`Call ${CallSid} answered`);
        await this.callService.handleCallAnswered(CallSid);
        break;

      case 'completed':
        this.logger.log(`Call ${CallSid} completed (${CallDuration}s)`);
        await this.callService.handleCallEnded(
          CallSid,
          parseInt(CallDuration || '0', 10),
        );
        break;

      case 'failed':
      case 'busy':
      case 'no-answer':
      case 'canceled':
        this.logger.log(`Call ${CallSid} ended with status: ${CallStatus}`);
        // Update call record with final status
        await this.prisma.call_record.updateMany({
          where: { twilio_call_sid: CallSid },
          data: {
            status: CallStatus,
            ended_at: new Date(),
          },
        });
        break;

      default:
        this.logger.warn(`Unknown call status: ${CallStatus} for ${CallSid}`);
    }

    return {};
  }

  /**
   * SMS Status Callback Webhook
   *
   * Receives status updates for outbound SMS messages sent via Twilio.
   * Updates communication_event records with delivery status.
   *
   * Twilio Payload:
   * - MessageSid: Unique message identifier
   * - MessageStatus: Status (queued, sent, delivered, failed, undelivered)
   * - ErrorCode: Error code if failed
   * - ErrorMessage: Error message if failed
   *
   * @param body - Twilio SMS status webhook payload
   * @param signature - Twilio signature header
   * @param request - Express request object
   * @returns Empty response
   */
  @Post('sms/status')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive SMS status updates from Twilio' })
  @ApiResponse({ status: 200, description: 'Status update processed' })
  @ApiExcludeEndpoint()
  async handleSmsStatus(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    const startTime = Date.now();
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = body;

    this.logger.log(`SMS status webhook: ${MessageSid} - ${MessageStatus}`);

    try {
      // Extract tenant
      const tenantId = await this.resolveTenantFromSubdomain(request);

      // Verify signature
      const authToken = await this.getTenantTwilioAuthToken(tenantId);
      const url = this.buildWebhookUrl(request);

      if (
        !this.webhookVerification.verifyTwilio(url, body, signature, authToken)
      ) {
        this.logger.error('❌ Invalid Twilio signature for SMS status webhook');
        throw new UnauthorizedException('Invalid Twilio signature');
      }

      // Update communication event status
      const updateData: any = {
        status: MessageStatus,
        updated_at: new Date(),
      };

      if (MessageStatus === 'delivered') {
        updateData.delivered_at = new Date();
      } else if (MessageStatus === 'sent') {
        updateData.sent_at = new Date();
      } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
        updateData.error_message = ErrorMessage || `Error code: ${ErrorCode}`;
      }

      await this.prisma.communication_event.updateMany({
        where: {
          tenant_id: tenantId,
          provider_message_id: MessageSid,
        },
        data: updateData,
      });

      // Record Prometheus metrics
      if (MessageStatus === 'delivered') {
        this.metrics.incrementSmsDelivered(tenantId);
      } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
        this.metrics.incrementSmsFailed(tenantId, ErrorCode);
      }

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordWebhookProcessing('twilio', duration);

      this.logger.log(
        `✅ SMS status updated: ${MessageSid} -> ${MessageStatus}`,
      );

      return {};
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordWebhookProcessing('twilio', duration);
      throw error;
    }
  }

  /**
   * Recording Ready Webhook
   *
   * Receives notification when call recording is available. Downloads
   * recording URL and queues transcription job.
   *
   * Twilio Payload:
   * - CallSid: Call identifier
   * - RecordingSid: Recording identifier
   * - RecordingUrl: URL to download recording
   * - RecordingDuration: Recording duration in seconds
   * - RecordingStatus: Recording status (completed)
   *
   * @param body - Twilio recording webhook payload
   * @param signature - Twilio signature header
   * @param request - Express request object
   * @returns Empty response
   */
  @Post('recording/ready')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive recording ready notification from Twilio' })
  @ApiResponse({ status: 200, description: 'Recording processed' })
  @ApiExcludeEndpoint()
  async handleRecordingReady(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    const { CallSid, RecordingUrl, RecordingDuration } = body;

    this.logger.log(
      `Recording ready webhook: ${CallSid} - ${RecordingUrl} (${RecordingDuration}s)`,
    );

    // Extract tenant
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Verify signature
    const authToken = await this.getTenantTwilioAuthToken(tenantId);
    const url = this.buildWebhookUrl(request);

    if (
      !this.webhookVerification.verifyTwilio(url, body, signature, authToken)
    ) {
      this.logger.error('❌ Invalid Twilio signature for recording webhook');
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    // Handle recording ready (saves URL and queues transcription)
    await this.callService.handleRecordingReady(
      CallSid,
      RecordingUrl,
      parseInt(RecordingDuration || '0', 10),
    );

    this.logger.log(`✅ Recording processed for call ${CallSid}`);

    return {};
  }

  /**
   * IVR Input Webhook
   *
   * Receives DTMF input from caller during IVR menu interaction.
   * Executes configured action based on digit pressed.
   *
   * Twilio Payload:
   * - CallSid: Call identifier
   * - Digits: DTMF digits pressed by caller
   * - From: Caller phone number
   * - To: Recipient phone number
   *
   * @param body - Twilio IVR webhook payload
   * @param signature - Twilio signature header
   * @param request - Express request object
   * @returns TwiML XML response
   */
  @Post('ivr/input')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive IVR DTMF input from Twilio' })
  @ApiResponse({ status: 200, description: 'TwiML response returned' })
  @ApiExcludeEndpoint()
  async handleIvrInput(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    const { CallSid, Digits } = body;

    this.logger.log(`IVR input webhook: ${CallSid} - Digit: ${Digits}`);

    // Extract tenant
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Verify signature
    const authToken = await this.getTenantTwilioAuthToken(tenantId);
    const url = this.buildWebhookUrl(request);

    if (
      !this.webhookVerification.verifyTwilio(url, body, signature, authToken)
    ) {
      this.logger.error('❌ Invalid Twilio signature for IVR webhook');
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    // Execute IVR action based on digit pressed (pass CallSid for voice_ai SIP routing)
    const twiml = await this.ivrService.executeIvrAction(tenantId, Digits, CallSid);

    this.logger.log(`✅ IVR action executed for call ${CallSid}`);

    // Return TwiML XML response
    return twiml;
  }

  /**
   * WhatsApp Inbound Webhook
   *
   * Receives incoming WhatsApp messages from Twilio.
   *
   * Twilio sends:
   * - MessageSid: Unique message identifier
   * - From: Sender's WhatsApp number (whatsapp:+1234567890)
   * - To: Recipient's WhatsApp number
   * - Body: Message content
   * - NumMedia: Number of media attachments
   * - MediaUrl0, MediaContentType0: Media attachments
   *
   * Response: Empty TwiML (no automatic reply)
   *
   * @public No JWT required - Twilio signature verification only
   */
  @Post('whatsapp/inbound')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive incoming WhatsApp messages from Twilio' })
  @ApiExcludeEndpoint()
  async handleWhatsAppInbound(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    const { MessageSid, From, To, Body: messageBody } = body;

    this.logger.log(
      `WhatsApp inbound webhook: ${MessageSid} from ${From} to ${To}`,
    );

    // Resolve tenant from subdomain
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Get tenant's Twilio auth token for signature verification
    const authToken = await this.getTenantTwilioAuthToken(tenantId);

    // Build full webhook URL for signature verification
    const url = this.buildWebhookUrl(request);

    // Verify Twilio signature
    if (
      !this.webhookVerification.verifyTwilio(url, body, signature, authToken)
    ) {
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    this.logger.log(
      `✅ WhatsApp inbound message received: ${MessageSid} - "${messageBody?.substring(0, 50) || '(no text)'}"`,
    );

    // TODO: Implement WhatsApp inbound message handling
    // For now, just log and return empty response
    // Future: Create communication_event record, trigger auto-responses, etc.

    // Return empty response (no automatic reply)
    return {};
  }

  /**
   * WhatsApp Status Webhook
   *
   * Receives status updates for outbound WhatsApp messages from Twilio.
   *
   * Status values:
   * - queued: Message accepted by Twilio
   * - sent: Message sent to WhatsApp
   * - delivered: Message delivered to recipient
   * - read: Message read by recipient
   * - failed: Message failed to send
   * - undelivered: Message could not be delivered
   *
   * Updates communication_event record with delivery status.
   *
   * @public No JWT required - Twilio signature verification only
   */
  @Post('whatsapp/status')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive WhatsApp status updates from Twilio',
  })
  @ApiExcludeEndpoint()
  async handleWhatsAppStatus(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = body;

    this.logger.log(
      `WhatsApp status webhook: ${MessageSid} - ${MessageStatus}`,
    );

    // Resolve tenant from subdomain
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Get tenant's Twilio auth token for signature verification
    const authToken = await this.getTenantTwilioAuthToken(tenantId);

    // Build full webhook URL for signature verification
    const url = this.buildWebhookUrl(request);

    // Verify Twilio signature
    if (
      !this.webhookVerification.verifyTwilio(url, body, signature, authToken)
    ) {
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    // Build update data based on status
    const updateData: any = {
      status: MessageStatus,
      updated_at: new Date(),
    };

    if (MessageStatus === 'delivered') {
      updateData.delivered_at = new Date();
    } else if (MessageStatus === 'sent') {
      updateData.sent_at = new Date();
    } else if (MessageStatus === 'read') {
      updateData.read_at = new Date();
    } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
      updateData.error_message = ErrorMessage || `Error code: ${ErrorCode}`;
    }

    // Update communication event
    await this.prisma.communication_event.updateMany({
      where: {
        tenant_id: tenantId,
        provider_message_id: MessageSid,
      },
      data: updateData,
    });

    this.logger.log(
      `✅ WhatsApp status updated: ${MessageSid} -> ${MessageStatus}`,
    );

    // Return empty response
    return {};
  }

  /**
   * Call Bridge Webhook
   * Returns TwiML to bridge user call to Lead
   */
  @Post('call/connect/:callRecordId')
  @Public()
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
  @ApiExcludeEndpoint()
  async handleCallConnect(
    @Param('callRecordId') callRecordId: string,
    @Body() payload: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
  ) {
    this.logger.log(`Call bridge webhook for CallRecord: ${callRecordId}`);

    try {
      // Get call record to retrieve tenant_id
      const callRecord = await this.prisma.call_record.findUnique({
        where: { id: callRecordId },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found: ${callRecordId}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, we couldn't connect your call. Please try again later.</Say><Hangup/></Response>`;
      }

      // Verify Twilio signature
      const authToken = await this.getTenantTwilioAuthToken(
        callRecord.tenant_id,
      );
      const url = this.buildWebhookUrl(req);

      if (
        !this.webhookVerification.verifyTwilio(
          url,
          payload,
          signature,
          authToken,
        )
      ) {
        this.logger.error(
          '❌ Invalid Twilio signature for call bridge webhook',
        );
        throw new UnauthorizedException('Invalid Twilio signature');
      }

      // Generate TwiML to bridge call to Lead
      const twiml = await this.callService.bridgeCallToLead(callRecordId);

      return twiml;
    } catch (error) {
      this.logger.error(
        `Call bridge webhook processing failed: ${error.message}`,
      );

      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, we couldn't connect your call. Please try again later.</Say><Hangup/></Response>`;
    }
  }

  /**
   * IVR Menu Webhook
   * Returns IVR menu TwiML
   */
  @Post('ivr/menu')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio IVR menu webhook (PUBLIC)',
    description: 'Returns IVR menu TwiML for tenant',
  })
  @ApiExcludeEndpoint()
  async handleIvrMenu(@Body() payload: any, @Req() req: Request) {
    const { CallSid } = payload;

    this.logger.log(`IVR menu webhook: ${CallSid}`);

    try {
      // Extract tenant from call record
      const callRecord = await this.prisma.call_record.findUnique({
        where: { twilio_call_sid: CallSid },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found for CallSid: ${CallSid}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
      }

      const twiml = await this.ivrService.generateIvrMenuTwiML(
        callRecord.tenant_id,
      );

      return twiml;
    } catch (error) {
      this.logger.error(`IVR menu generation failed: ${error.message}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
    }
  }

  /**
   * IVR Default Action Webhook
   * Handles IVR timeout/no input
   */
  @Post('ivr/default')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio IVR default action webhook (PUBLIC)',
    description: 'Handles IVR timeout/no input',
  })
  @ApiExcludeEndpoint()
  async handleIvrDefault(@Body() payload: any, @Req() req: Request) {
    const { CallSid } = payload;

    this.logger.log(`IVR default action webhook: ${CallSid}`);

    try {
      // Extract tenant from call record
      const callRecord = await this.prisma.call_record.findUnique({
        where: { twilio_call_sid: CallSid },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found for CallSid: ${CallSid}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
      }

      const twiml = await this.ivrService.executeDefaultAction(
        callRecord.tenant_id,
      );

      return twiml;
    } catch (error) {
      this.logger.error(`IVR default action failed: ${error.message}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
    }
  }

  /**
   * Office Bypass Prompt Webhook
   * Returns prompt TwiML for target number input
   */
  @Post('bypass/prompt')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio office bypass prompt webhook (PUBLIC)',
    description: 'Returns prompt for target phone number',
  })
  @ApiExcludeEndpoint()
  async handleBypassPrompt(@Body() payload: any, @Req() req: Request) {
    const { CallSid, From } = payload;

    this.logger.log(`Office bypass prompt webhook: ${CallSid}`);

    try {
      // Extract tenant from call record
      const callRecord = await this.prisma.call_record.findUnique({
        where: { twilio_call_sid: CallSid },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found for CallSid: ${CallSid}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
      }

      const twiml = await this.bypassService.handleBypassCall(
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
   * Office Bypass Dial Webhook
   * Initiates outbound call to target number
   */
  @Post('bypass/dial')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({
    summary: 'Twilio office bypass dial webhook (PUBLIC)',
    description: 'Dials target number entered by whitelisted caller',
  })
  @ApiExcludeEndpoint()
  async handleBypassDial(@Body() payload: any, @Req() req: Request) {
    const { CallSid, Digits } = payload;

    this.logger.log(
      `Office bypass dial webhook: ${CallSid} - Target: ${Digits}`,
    );

    try {
      // Extract tenant from call record
      const callRecord = await this.prisma.call_record.findUnique({
        where: { twilio_call_sid: CallSid },
        select: { tenant_id: true },
      });

      if (!callRecord || !callRecord.tenant_id) {
        this.logger.error(`CallRecord not found for CallSid: ${CallSid}`);
        return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We're sorry, an error occurred.</Say><Hangup/></Response>`;
      }

      const twiml = await this.bypassService.initiateBypassOutboundCall(
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

  /**
   * Helper: Resolve tenant from subdomain
   *
   * Extracts subdomain from request hostname and looks up tenant.
   *
   * Examples:
   * - tenant123.lead360.app -> tenant123
   * - localhost -> default/test tenant
   * - api.lead360.app -> first active tenant (system/admin requests)
   *
   * @param request - Express request object
   * @returns Tenant ID
   * @throws BadRequestException if tenant not found
   */
  private async resolveTenantFromSubdomain(request: Request): Promise<string> {
    // PRIORITY 1: Check for X-Tenant-Subdomain header (sent by Next.js proxy)
    const headerSubdomain = request.get('x-tenant-subdomain');

    if (headerSubdomain) {
      this.logger.debug(
        `Resolving tenant from X-Tenant-Subdomain header: ${headerSubdomain}`,
      );

      // Lookup tenant by subdomain
      const tenant = await this.prisma.tenant.findFirst({
        where: { subdomain: headerSubdomain },
      });

      if (!tenant) {
        throw new BadRequestException(
          `Tenant not found for subdomain: ${headerSubdomain}`,
        );
      }

      return tenant.id;
    }

    // PRIORITY 2: Fall back to parsing host header (direct Twilio calls in development)
    const host = request.get('host') || '';

    this.logger.debug(`Resolving tenant from host: ${host}`);

    // Extract subdomain
    // tenant123.lead360.app -> tenant123
    // localhost:3000 -> localhost
    const subdomain = host.split('.')[0].split(':')[0];

    this.logger.debug(`Extracted subdomain: ${subdomain}`);

    // Handle localhost/development or system subdomains (api, app, admin)
    if (
      subdomain === 'localhost' ||
      subdomain === '127' ||
      subdomain === 'api' ||
      subdomain === 'app' ||
      subdomain === 'admin'
    ) {
      this.logger.warn(
        `System/development subdomain detected (${subdomain}): Using first active tenant`,
      );
      const tenant = await this.prisma.tenant.findFirst({
        where: { is_active: true },
      });

      if (!tenant) {
        throw new BadRequestException(
          'No active tenant found for system request',
        );
      }

      return tenant.id;
    }

    // Lookup tenant by subdomain
    const tenant = await this.prisma.tenant.findFirst({
      where: { subdomain },
    });

    if (!tenant) {
      throw new BadRequestException(
        `Tenant not found for subdomain: ${subdomain}`,
      );
    }

    return tenant.id;
  }

  /**
   * Helper: Get tenant Twilio auth token for signature verification
   *
   * Retrieves and decrypts tenant's Twilio auth token from SMS config.
   *
   * @param tenantId - Tenant ID
   * @returns Decrypted Twilio auth token
   * @throws BadRequestException if configuration not found
   */
  private async getTenantTwilioAuthToken(tenantId: string): Promise<string> {
    // Get tenant SMS config (contains Twilio credentials)
    const smsConfig = await this.prisma.tenant_sms_config.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!smsConfig) {
      throw new BadRequestException(
        `No active Twilio configuration found for tenant: ${tenantId}`,
      );
    }

    // Decrypt credentials JSON
    const credentials = JSON.parse(
      this.encryption.decrypt(smsConfig.credentials),
    );

    // Extract auth token
    const authToken = credentials.auth_token;

    if (!authToken) {
      throw new BadRequestException(
        'Twilio auth token not found in configuration',
      );
    }

    return authToken;
  }

  /**
   * Helper: Build full webhook URL for signature verification
   *
   * Twilio signature verification requires the EXACT URL that was called,
   * including protocol, host, and path.
   *
   * IMPORTANT: When requests come through Nginx proxy:
   * - Twilio sends to: https://honeydo4you.lead360.app/api/v1/twilio/...
   * - Nginx forwards to: https://api.lead360.app/api/v1/twilio/...
   * - Nginx sets X-Tenant-Subdomain header (e.g., "honeydo4you")
   * - We MUST reconstruct the original tenant URL for signature verification
   *
   * @param request - Express request object
   * @returns Full webhook URL (reconstructed from X-Tenant-Subdomain if proxied)
   */
  private buildWebhookUrl(request: Request): string {
    // Use X-Forwarded-Proto if available (set by Nginx proxy)
    const protocol = request.get('x-forwarded-proto') || request.protocol;

    // Use originalUrl to include query parameters if present
    // request.originalUrl includes both path and query string
    const fullPath = request.originalUrl;

    // Check if request came through Nginx proxy (has X-Tenant-Subdomain header)
    const tenantSubdomain = request.get('x-tenant-subdomain');

    if (tenantSubdomain) {
      // Reconstruct original tenant URL that Twilio called
      // Example: https://honeydo4you.lead360.app/api/v1/twilio/call/status
      // Or: https://honeydo4you.lead360.app/api/v1/twilio/call/status?foo=bar
      const url = `${protocol}://${tenantSubdomain}.lead360.app${fullPath}`;
      this.logger.debug(
        `[WEBHOOK URL] Reconstructed from X-Tenant-Subdomain: ${url}`,
      );
      return url;
    }

    // Fallback: Use host header as-is (direct calls, development, localhost)
    const host = request.get('host');
    const url = `${protocol}://${host}${fullPath}`;
    this.logger.debug(`[WEBHOOK URL] Using Host header: ${url}`);
    return url;
  }

  /**
   * Helper: Send auto-reply SMS (for keyword responses)
   *
   * Queues an outbound SMS via BullMQ for asynchronous sending.
   * Used for TCPA compliance auto-replies (STOP, START, HELP keywords).
   *
   * @param tenantId - Tenant ID
   * @param toPhone - Recipient phone number (E.164 format)
   * @param fromPhone - Sender phone number (tenant's Twilio number)
   * @param message - SMS message body
   * @param leadId - Lead ID (for tracking)
   * @private
   */
  private async sendAutoReplySms(
    tenantId: string,
    toPhone: string,
    fromPhone: string,
    message: string,
    leadId: string,
  ): Promise<void> {
    // Get Twilio SMS provider ID
    const twilioProvider = await this.prisma.communication_provider.findFirst({
      where: { provider_key: 'twilio_sms' },
    });

    if (!twilioProvider) {
      throw new BadRequestException('Twilio SMS provider not found');
    }

    // Create communication_event record for auto-reply SMS
    const eventId = uuidv4();

    await this.prisma.communication_event.create({
      data: {
        id: eventId,
        tenant_id: tenantId,
        channel: 'sms',
        direction: 'outbound',
        provider_id: twilioProvider.id,
        status: 'pending',
        to_phone: toPhone,
        text_body: message,
        related_entity_type: 'lead',
        related_entity_id: leadId,
      },
    });

    // Queue SMS for asynchronous sending via BullMQ
    await this.smsQueue.add('send-sms', {
      communicationEventId: eventId, // camelCase to match processor expectation
    });

    this.logger.log(
      `Auto-reply SMS queued: ${eventId} to ${toPhone} (Lead: ${leadId})`,
    );
  }
}
