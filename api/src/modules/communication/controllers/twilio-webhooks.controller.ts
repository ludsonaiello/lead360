import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Logger,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../auth/decorators';
import { CallManagementService } from '../services/call-management.service';
import { LeadMatchingService } from '../services/lead-matching.service';
import { IvrConfigurationService } from '../services/ivr-configuration.service';
import { OfficeBypassService } from '../services/office-bypass.service';
import { WebhookVerificationService } from '../services/webhook-verification.service';
import { TranscriptionJobService } from '../services/transcription-job.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';

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

    // Step 1: Extract tenant from subdomain
    const tenantId = await this.resolveTenantFromSubdomain(request);

    this.logger.debug(`Tenant resolved: ${tenantId}`);

    // Step 2: Verify Twilio signature
    const authToken = await this.getTenantTwilioAuthToken(tenantId);
    const url = this.buildWebhookUrl(request);

    this.logger.debug(`Verifying signature for URL: ${url}`);

    if (!this.webhookVerification.verifyTwilio(url, body, signature, authToken)) {
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

    // Step 4: Create communication event for SMS (optional - mainly for tracking)
    // Note: For MVP, we're skipping communication_event creation for inbound SMS
    // as the primary tracking is done via Lead matching and notes
    // TODO: Future enhancement - create communication events for full audit trail

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

    // Extract tenant
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Verify signature
    const authToken = await this.getTenantTwilioAuthToken(tenantId);
    const url = this.buildWebhookUrl(request);

    if (!this.webhookVerification.verifyTwilio(url, body, signature, authToken)) {
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

    // Extract tenant
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Verify signature
    const authToken = await this.getTenantTwilioAuthToken(tenantId);
    const url = this.buildWebhookUrl(request);

    if (!this.webhookVerification.verifyTwilio(url, body, signature, authToken)) {
      this.logger.error('❌ Invalid Twilio signature for status webhook');
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    // Handle status update based on call state
    switch (CallStatus) {
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
        await this.callService.handleCallEnded(CallSid, parseInt(CallDuration || '0', 10));
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
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = body;

    this.logger.log(`SMS status webhook: ${MessageSid} - ${MessageStatus}`);

    // Extract tenant
    const tenantId = await this.resolveTenantFromSubdomain(request);

    // Verify signature
    const authToken = await this.getTenantTwilioAuthToken(tenantId);
    const url = this.buildWebhookUrl(request);

    if (!this.webhookVerification.verifyTwilio(url, body, signature, authToken)) {
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

    this.logger.log(`✅ SMS status updated: ${MessageSid} -> ${MessageStatus}`);

    return {};
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

    if (!this.webhookVerification.verifyTwilio(url, body, signature, authToken)) {
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

    if (!this.webhookVerification.verifyTwilio(url, body, signature, authToken)) {
      this.logger.error('❌ Invalid Twilio signature for IVR webhook');
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    // Execute IVR action based on digit pressed
    const twiml = await this.ivrService.executeIvrAction(tenantId, Digits);

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
    } else if (
      MessageStatus === 'failed' ||
      MessageStatus === 'undelivered'
    ) {
      updateData.error_message =
        ErrorMessage || `Error code: ${ErrorCode}`;
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
   * @param request - Express request object
   * @returns Full webhook URL
   */
  private buildWebhookUrl(request: Request): string {
    const protocol = request.protocol; // http or https
    const host = request.get('host'); // tenant123.lead360.app or localhost:3000
    const path = request.path; // /api/twilio/sms/inbound

    const url = `${protocol}://${host}${path}`;

    return url;
  }
}
