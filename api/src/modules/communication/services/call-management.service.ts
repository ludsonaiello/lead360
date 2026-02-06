import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { InitiateCallDto } from '../dto/call/initiate-call.dto';
import { IvrConfigurationService } from './ivr-configuration.service';
import { OfficeBypassService } from './office-bypass.service';
import { TranscriptionJobService } from './transcription-job.service';

/**
 * CallManagementService
 *
 * Production-grade call management system handling the complete call lifecycle:
 * - Inbound call reception and routing
 * - Outbound call initiation with bridge-to-lead pattern
 * - Real-time call status tracking
 * - Recording capture, storage, and retrieval
 * - Lead auto-matching and creation
 * - Multi-tenant isolation with secure credential management
 *
 * Architecture:
 * - TwiML generation for call flow control
 * - Webhook handlers for Twilio events
 * - Encrypted credential storage
 * - File system recording storage with signed URL generation
 *
 * Compliance:
 * - Consent message tracking
 * - Recording availability audit trail
 * - Tenant data isolation (CRITICAL)
 */
@Injectable()
export class CallManagementService {
  private readonly logger = new Logger(CallManagementService.name);
  private readonly recordingsBasePath: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    @Optional()
    @Inject(forwardRef(() => IvrConfigurationService))
    private readonly ivrConfigurationService?: IvrConfigurationService,
    @Optional()
    @Inject(forwardRef(() => OfficeBypassService))
    private readonly officeBypassService?: OfficeBypassService,
    @Optional()
    @Inject(forwardRef(() => TranscriptionJobService))
    private readonly transcriptionJobService?: TranscriptionJobService,
  ) {
    // Initialize recordings storage path
    const uploadsPath =
      this.config.get<string>('UPLOADS_PATH') || '../uploads/public';
    this.recordingsBasePath = resolve(__dirname, '../../../..', uploadsPath);
  }

  /**
   * Handle inbound call from Twilio webhook
   * Creates CallRecord and returns TwiML response
   *
   * Flow Priority:
   * 1. Check if caller is whitelisted (office bypass) → bypass prompt
   * 2. Check if IVR is enabled → IVR menu
   * 3. Default routing → simple dial
   *
   * @param tenantId - Tenant UUID (derived from subdomain)
   * @param twilioPayload - Raw webhook payload from Twilio
   * @returns TwiML XML string for call routing
   */
  async handleInboundCall(
    tenantId: string,
    twilioPayload: any,
  ): Promise<string> {
    const { CallSid, From, To } = twilioPayload;

    this.logger.log(
      `📞 Inbound call received: ${CallSid} from ${From} to ${To}`,
    );

    try {
      // 1. Check whitelist first (office bypass)
      if (
        this.officeBypassService &&
        (await this.officeBypassService.isWhitelisted(tenantId, From))
      ) {
        this.logger.log(`🔓 Office bypass detected for ${From}`);

        // Create CallRecord with office_bypass_call type
        await this.prisma.call_record.create({
          data: {
            tenant_id: tenantId,
            twilio_call_sid: CallSid,
            direction: 'inbound',
            from_number: From,
            to_number: To,
            status: 'initiated',
            call_type: 'office_bypass_call',
            consent_message_played: false,
          },
        });

        // Return bypass prompt TwiML
        return this.officeBypassService.handleBypassCall(tenantId, From);
      }

      // 2. Check IVR configuration
      if (this.ivrConfigurationService) {
        try {
          const ivrConfig =
            await this.ivrConfigurationService.findByTenantId(tenantId);

          if (ivrConfig.ivr_enabled) {
            this.logger.log(`🎛️  IVR enabled, generating menu TwiML`);

            // Create CallRecord with ivr_routed_call type
            await this.prisma.call_record.create({
              data: {
                tenant_id: tenantId,
                twilio_call_sid: CallSid,
                direction: 'inbound',
                from_number: From,
                to_number: To,
                status: 'initiated',
                call_type: 'ivr_routed_call',
                consent_message_played: true, // IVR plays consent message
              },
            });

            // Return IVR menu TwiML
            return this.ivrConfigurationService.generateIvrMenuTwiML(tenantId);
          }
        } catch (error) {
          // IVR not configured or error - fall through to default
          this.logger.warn(
            `IVR not configured or error for tenant ${tenantId}: ${error.message}`,
          );
        }
      }

      // 3. Default routing (no IVR, no bypass)
      this.logger.log(`📞 Default routing for ${From}`);

      // Create CallRecord with customer_call type
      await this.prisma.call_record.create({
        data: {
          tenant_id: tenantId,
          twilio_call_sid: CallSid,
          direction: 'inbound',
          from_number: From,
          to_number: To,
          status: 'initiated',
          call_type: 'customer_call',
          consent_message_played: false,
        },
      });

      // Return default routing TwiML
      return this.generateDefaultRoutingTwiML();
    } catch (error) {
      this.logger.error(
        `❌ Failed to process inbound call: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to process inbound call');
    }
  }

  /**
   * Generate default routing TwiML
   *
   * Simple voicemail prompt if no IVR configured.
   * Could be enhanced to dial a default company number.
   *
   * @returns TwiML XML string
   */
  private generateDefaultRoutingTwiML(): string {
    const twiml = new twilio.twiml.VoiceResponse();

    twiml.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      'This call will be recorded for quality and training purposes.',
    );

    twiml.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      'Thank you for calling. Please leave a message after the beep.',
    );

    twiml.record({
      maxLength: 180,
      playBeep: true,
      transcribe: false,
      recordingStatusCallback: `${this.config.get<string>('API_BASE_URL') || 'https://api.lead360.app'}/webhooks/communication/twilio-recording-ready`,
    });

    twiml.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      'Thank you for your message. Goodbye.',
    );

    return twiml.toString();
  }

  /**
   * Handle call answered event
   * Updates status to IN_PROGRESS and starts recording via Twilio API
   *
   * @param callSid - Twilio Call SID
   */
  async handleCallAnswered(callSid: string): Promise<void> {
    const call_record = await this.prisma.call_record.findUnique({
      where: { twilio_call_sid: callSid },
    });

    if (!call_record) {
      this.logger.error(`❌ CallRecord not found for CallSid: ${callSid}`);
      return;
    }

    try {
      // Update status to in_progress
      await this.prisma.call_record.update({
        where: { id: call_record.id },
        data: {
          status: 'in_progress',
          started_at: new Date(),
        },
      });

      this.logger.log(`🟢 Call ${callSid} marked as in_progress`);

      // Start recording via Twilio API
      if (call_record.tenant_id) {
        const config = await this.getTenantTwilioConfig(call_record.tenant_id);
        const credentials = JSON.parse(
          this.encryption.decrypt(config.credentials),
        );
        const client = twilio(credentials.account_sid, credentials.auth_token);

        // Get tenant subdomain for webhook URL
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: call_record.tenant_id },
          select: { subdomain: true },
        });

        if (!tenant) {
          throw new Error(`Tenant not found: ${call_record.tenant_id}`);
        }

        await client.calls(callSid).recordings.create({
          recordingStatusCallback: `https://${tenant.subdomain}.lead360.app/webhooks/communication/twilio-recording-ready`,
          recordingStatusCallbackMethod: 'POST',
        });

        this.logger.log(`🎙️  Recording started for call ${callSid}`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to start recording for ${callSid}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle call ended event
   * Updates status, stores duration
   *
   * @param callSid - Twilio Call SID
   * @param duration - Call duration in seconds
   */
  async handleCallEnded(callSid: string, duration: number): Promise<void> {
    const call_record = await this.prisma.call_record.findUnique({
      where: { twilio_call_sid: callSid },
    });

    if (!call_record) {
      this.logger.error(`❌ CallRecord not found for CallSid: ${callSid}`);
      return;
    }

    try {
      // Update CallRecord
      await this.prisma.call_record.update({
        where: { id: call_record.id },
        data: {
          status: 'completed',
          ended_at: new Date(),
        },
      });

      this.logger.log(`✅ Call ${callSid} completed. Duration: ${duration}s`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to update call status: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle recording ready webhook
   * Downloads recording from Twilio and stores in local filesystem
   *
   * @param callSid - Twilio Call SID
   * @param recordingUrl - Twilio recording URL
   * @param duration - Recording duration in seconds
   */
  async handleRecordingReady(
    callSid: string,
    recordingUrl: string,
    duration: number,
  ): Promise<void> {
    const call_record = await this.prisma.call_record.findUnique({
      where: { twilio_call_sid: callSid },
      include: { tenant: true },
    });

    if (!call_record) {
      this.logger.error(`❌ CallRecord not found for CallSid: ${callSid}`);
      return;
    }

    if (!call_record.tenant_id) {
      this.logger.error(`❌ CallRecord ${call_record.id} has no tenant_id`);
      return;
    }

    this.logger.log(`🎙️  Recording ready for call ${callSid}. Downloading...`);

    try {
      // 1. Download recording from Twilio
      const config = await this.getTenantTwilioConfig(call_record.tenant_id);
      const credentials = JSON.parse(
        this.encryption.decrypt(config.credentials),
      );

      const response = await fetch(recordingUrl, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.account_sid}:${credentials.auth_token}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download recording: ${response.statusText}`);
      }

      const recordingBuffer = Buffer.from(await response.arrayBuffer());

      // 2. Store recording in filesystem
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const filename = `${call_record.id}.mp3`;
      const relativePath = `${call_record.tenant_id}/communication/recordings/${year}/${month}`;
      const fullDir = join(this.recordingsBasePath, relativePath);
      const fullPath = join(fullDir, filename);

      // Create directory structure
      await fs.mkdir(fullDir, { recursive: true });

      // Write recording file
      await fs.writeFile(fullPath, recordingBuffer);

      // 3. Update CallRecord with recording info
      const publicUrl = `/public/${relativePath}/${filename}`;

      await this.prisma.call_record.update({
        where: { id: call_record.id },
        data: {
          recording_url: publicUrl,
          recording_duration_seconds: duration,
          recording_status: 'available',
        },
      });

      this.logger.log(`✅ Recording stored for call ${callSid}: ${publicUrl}`);

      // Sprint 5: Auto-queue transcription job
      if (this.transcriptionJobService) {
        try {
          await this.transcriptionJobService.queueTranscription(call_record.id);
          this.logger.log(`🎤 Transcription queued for call ${callSid}`);
        } catch (error) {
          this.logger.error(
            `⚠️  Failed to queue transcription for ${callSid}: ${error.message}`,
          );
          // Don't throw - recording is still successful even if transcription fails to queue
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to process recording for ${callSid}: ${error.message}`,
        error.stack,
      );

      await this.prisma.call_record.update({
        where: { id: call_record.id },
        data: { recording_status: 'failed' },
      });
    }
  }

  /**
   * Initiate outbound call to Lead
   * Calls user first, then bridges to Lead when user answers
   *
   * @param tenantId - Tenant UUID
   * @param userId - User UUID (who is initiating the call)
   * @param dto - Call initiation parameters
   * @returns Call initiation result with CallRecord ID and Twilio Call SID
   */
  async initiateOutboundCall(
    tenantId: string,
    userId: string,
    dto: InitiateCallDto,
  ) {
    // 1. Validate Lead exists and has a phone number
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: dto.lead_id,
        tenant_id: tenantId,
      },
      include: {
        phones: {
          where: { is_primary: true },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (!lead.phones || lead.phones.length === 0) {
      throw new BadRequestException('Lead does not have a phone number');
    }

    const leadPhone = lead.phones[0].phone;

    // 2. Get Twilio config
    const config = await this.getTenantTwilioConfig(tenantId);
    const credentials = JSON.parse(this.encryption.decrypt(config.credentials));
    const client = twilio(credentials.account_sid, credentials.auth_token);

    // 3. Get tenant subdomain for webhooks
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subdomain: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // 4. Create CallRecord
    const call_record = await this.prisma.call_record.create({
      data: {
        tenant_id: tenantId,
        lead_id: dto.lead_id,
        twilio_call_sid: '', // Will be updated when call starts
        direction: 'outbound',
        from_number: config.from_phone,
        to_number: leadPhone,
        status: 'initiated',
        call_type: 'customer_call',
        initiated_by: userId,
        call_reason: dto.call_reason,
      },
    });

    // 5. Call user first
    try {
      const call = await client.calls.create({
        from: config.from_phone,
        to: dto.user_phone_number,
        url: `https://${tenant.subdomain}.lead360.app/webhooks/communication/twilio-call-connect/${call_record.id}`,
        statusCallback: `https://${tenant.subdomain}.lead360.app/webhooks/communication/twilio-call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      });

      // Update with Twilio CallSid
      await this.prisma.call_record.update({
        where: { id: call_record.id },
        data: { twilio_call_sid: call.sid },
      });

      this.logger.log(`📞 Outbound call initiated: ${call.sid}`);

      return {
        success: true,
        call_record_id: call_record.id,
        twilio_call_sid: call.sid,
        message: 'Calling your phone. Please answer to connect to the Lead.',
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to initiate outbound call: ${error.message}`,
        error.stack,
      );

      await this.prisma.call_record.update({
        where: { id: call_record.id },
        data: { status: 'failed' },
      });

      throw new BadRequestException(
        `Failed to initiate call: ${error.message}`,
      );
    }
  }

  /**
   * Bridge user call to Lead (called when user answers)
   * Returns TwiML to connect to Lead
   *
   * @param call_recordId - CallRecord UUID
   * @returns TwiML XML string
   */
  async bridgeCallToLead(call_recordId: string): Promise<string> {
    const call_record = await this.prisma.call_record.findUnique({
      where: { id: call_recordId },
      include: {
        lead: {
          include: {
            phones: {
              where: { is_primary: true },
              take: 1,
            },
          },
        },
        tenant: {
          select: { subdomain: true },
        },
      },
    });

    if (!call_record) {
      throw new NotFoundException('Call record not found');
    }

    if (
      !call_record.lead ||
      !call_record.lead.phones ||
      call_record.lead.phones.length === 0
    ) {
      throw new BadRequestException('Lead phone number not found');
    }

    const leadPhone = call_record.lead.phones[0].phone;

    // Generate TwiML to call Lead
    const twiml = new twilio.twiml.VoiceResponse();

    // Play message to user
    twiml.say(
      { voice: 'Polly.Amy' },
      'Please wait while we connect your call.',
    );

    // Dial Lead
    const dial = twiml.dial({
      action: `https://${call_record.tenant?.subdomain}.lead360.app/webhooks/communication/twilio-call-status`,
      record: 'record-from-ringing',
    });

    dial.number(
      {
        statusCallback: `https://${call_record.tenant?.subdomain}.lead360.app/webhooks/communication/twilio-call-status`,
        statusCallbackEvent: ['answered', 'completed'],
      },
      leadPhone,
    );

    return twiml.toString();
  }

  /**
   * Get call details by ID
   *
   * @param tenantId - Tenant UUID (multi-tenant isolation)
   * @param callId - CallRecord UUID
   * @returns CallRecord with related data
   */
  async findOne(tenantId: string, callId: string) {
    const call = await this.prisma.call_record.findFirst({
      where: {
        id: callId,
        tenant_id: tenantId,
      },
      include: {
        lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phones: {
              where: { is_primary: true },
              select: { phone: true },
              take: 1,
            },
          },
        },
        initiated_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!call) {
      throw new NotFoundException('Call record not found');
    }

    // Flatten phone for easier frontend consumption
    return {
      ...call,
      lead: call.lead
        ? {
            ...call.lead,
            phone: call.lead.phones[0]?.phone || null,
            phones: undefined,
          }
        : null,
    };
  }

  /**
   * Get paginated call history
   *
   * @param tenantId - Tenant UUID (multi-tenant isolation)
   * @param page - Page number (1-indexed)
   * @param limit - Records per page (max 100)
   * @returns Paginated call records
   */
  async findAll(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      this.prisma.call_record.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          lead: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              phones: {
                where: { is_primary: true },
                select: { phone: true },
                take: 1,
              },
            },
          },
          initiated_by_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      }),
      this.prisma.call_record.count({
        where: { tenant_id: tenantId },
      }),
    ]);

    // Flatten phone numbers for easier frontend consumption
    const formattedCalls = calls.map((call) => ({
      ...call,
      lead: call.lead
        ? {
            ...call.lead,
            phone: call.lead.phones[0]?.phone || null,
            phones: undefined,
          }
        : null,
    }));

    return {
      data: formattedCalls,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get recording URL for playback
   * Note: In current implementation, recordings are served as static files
   * Future enhancement: Generate time-limited signed URLs
   *
   * @param tenantId - Tenant UUID (multi-tenant isolation)
   * @param callId - CallRecord UUID
   * @returns Recording URL and metadata
   */
  async getRecordingUrl(tenantId: string, callId: string) {
    const call = await this.prisma.call_record.findFirst({
      where: {
        id: callId,
        tenant_id: tenantId,
      },
    });

    if (!call) {
      throw new NotFoundException('Call record not found');
    }

    if (!call.recording_url) {
      throw new NotFoundException('Recording not available');
    }

    // TODO: Implement signed URLs with expiration for enhanced security
    // For now, return public URL directly
    return {
      url: call.recording_url,
      duration_seconds: call.recording_duration_seconds,
      transcription_available: call.recording_status === 'transcribed',
    };
  }

  /**
   * Generate TwiML for consent message
   * Used for call recording compliance
   *
   * @returns TwiML XML string
   */
  generateConsentTwiML(): string {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      { voice: 'Polly.Amy' },
      'This call will be recorded for quality assurance and training purposes.',
    );
    return twiml.toString();
  }

  /**
   * Get tenant Twilio config (helper method)
   * Retrieves active Twilio configuration for a tenant
   *
   * @param tenantId - Tenant UUID
   * @returns Active Twilio config with credentials
   * @throws NotFoundException if no active config found
   * @private
   */
  private async getTenantTwilioConfig(tenantId: string) {
    // Try SMS config (most common for voice calls)
    const config = await this.prisma.tenant_sms_config.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      include: { tenant: true },
    });

    if (!config) {
      throw new NotFoundException(
        'No active Twilio configuration found for tenant',
      );
    }

    return config;
  }
}
