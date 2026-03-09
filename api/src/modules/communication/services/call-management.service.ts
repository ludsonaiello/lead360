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
      // CRITICAL: Look up lead by phone number BEFORE creating call record
      // This enables automatic lead association for inbound calls
      const leadId = await this.findLeadByPhoneNumber(tenantId, From);

      if (leadId) {
        this.logger.log(`👤 Lead found for ${From}: ${leadId}`);
      } else {
        this.logger.debug(
          `👤 No lead found for ${From} - call will show as Unknown`,
        );
      }

      // 1. Check whitelist first (office bypass)
      if (
        this.officeBypassService &&
        (await this.officeBypassService.isWhitelisted(tenantId, From))
      ) {
        this.logger.log(`🔓 Office bypass detected for ${From}`);

        // Create or update CallRecord with office_bypass_call type
        await this.prisma.call_record.upsert({
          where: { twilio_call_sid: CallSid },
          create: {
            tenant_id: tenantId,
            twilio_call_sid: CallSid,
            direction: 'inbound',
            from_number: From,
            to_number: To,
            status: 'initiated',
            call_type: 'office_bypass_call',
            consent_message_played: false,
            lead_id: leadId, // Link to lead if found
          },
          update: {
            status: 'initiated',
            lead_id: leadId, // Update lead if found
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

          this.logger.log(
            `🔍 IVR Configuration found - Enabled: ${ivrConfig.ivr_enabled}`,
          );

          if (ivrConfig.ivr_enabled) {
            this.logger.log(
              `🎛️  IVR ENABLED → Generating interactive menu for ${From}`,
            );

            // Create or update CallRecord with ivr_routed_call type
            await this.prisma.call_record.upsert({
              where: { twilio_call_sid: CallSid },
              create: {
                tenant_id: tenantId,
                twilio_call_sid: CallSid,
                direction: 'inbound',
                from_number: From,
                to_number: To,
                status: 'initiated',
                call_type: 'ivr_routed_call',
                consent_message_played: true, // IVR plays consent message
                lead_id: leadId, // Link to lead if found
              },
              update: {
                status: 'initiated',
                lead_id: leadId, // Update lead if found
              },
            });

            this.logger.log(`📋 Call type: ivr_routed_call`);
            // Return IVR menu TwiML
            return this.ivrConfigurationService.generateIvrMenuTwiML(tenantId);
          } else {
            this.logger.log(
              `⚠️  IVR DISABLED → Checking for default action configuration`,
            );
          }
        } catch (error) {
          // IVR not configured or error - fall through to default
          this.logger.warn(
            `⚠️  IVR configuration error for tenant ${tenantId}: ${error.message}`,
          );
        }
      } else {
        this.logger.debug(`ℹ️  No IVR service available`);
      }

      // 3. Default routing (no IVR, no bypass)
      this.logger.log(`📞 DEFAULT ROUTING triggered for ${From}`);
      this.logger.log(`📋 Call type: customer_call`);

      // Create or update CallRecord with customer_call type
      await this.prisma.call_record.upsert({
        where: { twilio_call_sid: CallSid },
        create: {
          tenant_id: tenantId,
          twilio_call_sid: CallSid,
          direction: 'inbound',
          from_number: From,
          to_number: To,
          status: 'initiated',
          call_type: 'customer_call',
          consent_message_played: false,
          lead_id: leadId, // Link to lead if found
        },
        update: {
          status: 'initiated',
          lead_id: leadId, // Update lead if found
        },
      });

      // Return default routing TwiML
      return await this.generateDefaultRoutingTwiML(tenantId);
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
   * @param tenantId - Tenant UUID for webhook URL generation
   * @returns TwiML XML string
   */
  private async generateDefaultRoutingTwiML(tenantId: string): Promise<string> {
    // Fetch tenant for subdomain
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Check if there's an IVR configuration with a default_action
    // Even if IVR is disabled, use the default_action if configured
    if (this.ivrConfigurationService) {
      try {
        const ivrConfig =
          await this.ivrConfigurationService.findByTenantId(tenantId);

        if (ivrConfig && ivrConfig.default_action) {
          this.logger.log(
            `🎯 IVR default_action found → Using for direct routing (IVR disabled)`,
          );

          // Parse default_action (it's stored as JSON)
          const defaultAction =
            typeof ivrConfig.default_action === 'string'
              ? JSON.parse(ivrConfig.default_action)
              : ivrConfig.default_action;

          this.logger.log(`📞 Action Type: ${defaultAction.action}`);

          // Generate TwiML based on action type
          const twiml = new twilio.twiml.VoiceResponse();

          if (defaultAction.action === 'route_to_number') {
            // Route to configured phone number (no announcement, direct dial)
            this.logger.log(
              `☎️  ROUTING CALL → Dialing ${defaultAction.config.phone_number} (dual-channel recording enabled)`,
            );

            twiml.dial(
              {
                callerId: defaultAction.config.phone_number,
                record: 'record-from-answer-dual', // Dual-channel stereo recording
                recordingStatusCallback: `https://${tenant.subdomain}.lead360.app/api/v1/twilio/recording/ready`,
              },
              defaultAction.config.phone_number,
            );

            this.logger.log(`✅ TwiML generated for direct dial`);
          } else if (defaultAction.action === 'voicemail') {
            // Route to voicemail
            this.logger.log(
              `📧 VOICEMAIL → Recording message (max ${defaultAction.config.max_duration_seconds || 180}s)`,
            );

            twiml.say(
              {
                voice: 'Polly.Joanna',
                language: 'en-US',
              },
              'Please leave a message after the beep.',
            );

            twiml.record({
              maxLength: defaultAction.config.max_duration_seconds || 180,
              playBeep: true,
              transcribe: false,
              recordingStatusCallback: `https://${tenant.subdomain}.lead360.app/api/v1/twilio/recording/ready`,
            });

            this.logger.log(`✅ TwiML generated for voicemail`);
          }

          return twiml.toString();
        }
      } catch (error) {
        this.logger.warn(
          `⚠️  Could not load IVR default_action: ${error.message}. Falling back to voicemail.`,
        );
      }
    }

    // Fallback to voicemail if no default action configured
    this.logger.log(
      `📧 NO DEFAULT ACTION CONFIGURED → Falling back to voicemail`,
    );
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
      recordingStatusCallback: `https://${tenant.subdomain}.lead360.app/api/v1/twilio/recording/ready`,
    });

    twiml.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      'Thank you for your message. Goodbye.',
    );

    this.logger.log(`✅ TwiML generated for fallback voicemail`);
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

    // Check if call is already in progress (prevent duplicate handling)
    if (call_record.status === 'in_progress' && call_record.started_at) {
      this.logger.debug(
        `Call ${callSid} already marked as in_progress. Skipping duplicate handleCallAnswered.`,
      );
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
          recordingStatusCallback: `https://${tenant.subdomain}.lead360.app/api/v1/twilio/recording/ready`,
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
      include: {
        tenant: {
          select: { id: true },
        },
      },
    });

    if (!call_record) {
      this.logger.error(`❌ CallRecord not found for CallSid: ${callSid}`);
      return;
    }

    try {
      // Fetch call cost from Twilio API
      let cost: number | null = null;
      try {
        if (call_record.tenant_id) {
          const config = await this.getTenantTwilioConfig(
            call_record.tenant_id,
          );
          const credentials = JSON.parse(
            this.encryption.decrypt(config.credentials),
          );
          const client = twilio(
            credentials.account_sid,
            credentials.auth_token,
          );

          // Fetch call details from Twilio to get price
          const callDetails = await client.calls(callSid).fetch();

          if (callDetails.price && callDetails.price !== null) {
            // Twilio returns price as string (e.g., "-0.0085")
            // Convert to positive decimal for storage
            cost = Math.abs(parseFloat(callDetails.price));
            this.logger.debug(`💰 Call ${callSid} cost: $${cost}`);
          }
        }
      } catch (priceError) {
        // Don't fail the entire update if price fetch fails
        this.logger.warn(
          `⚠️ Failed to fetch call price from Twilio: ${priceError.message}`,
        );
      }

      // Update CallRecord
      await this.prisma.call_record.update({
        where: { id: call_record.id },
        data: {
          status: 'completed',
          ended_at: new Date(),
          duration_seconds: duration,
          ...(cost !== null && { cost }),
        },
      });

      this.logger.log(
        `✅ Call ${callSid} completed. Duration: ${duration}s${cost !== null ? `, Cost: $${cost}` : ''}`,
      );
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
   * Supports both regular IVR calls (call_record) and Voice AI calls (voice_call_log)
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
    // Try to find call in regular call_record table first (IVR calls)
    const call_record = await this.prisma.call_record.findUnique({
      where: { twilio_call_sid: callSid },
      include: { tenant: true },
    });

    // If not found in call_record, try voice_call_log (Voice AI calls)
    let voice_call_log: Awaited<
      ReturnType<typeof this.prisma.voice_call_log.findUnique>
    > = null;
    let isVoiceAiCall = false;

    if (!call_record) {
      voice_call_log = await this.prisma.voice_call_log.findUnique({
        where: { call_sid: callSid },
        include: { tenant: true },
      });

      if (voice_call_log) {
        isVoiceAiCall = true;
        this.logger.log(`🤖 Voice AI call recording ready for ${callSid}`);
      }
    }

    // If call not found in either table, log error and return
    if (!call_record && !voice_call_log) {
      this.logger.error(
        `❌ Call not found in call_record or voice_call_log for CallSid: ${callSid}`,
      );
      return;
    }

    // TypeScript guard: at this point, either call_record or voice_call_log must exist
    const callRecord = (call_record || voice_call_log)!;
    const callType = isVoiceAiCall ? 'voice_ai' : 'ivr';

    if (!callRecord.tenant_id) {
      this.logger.error(`❌ Call ${callRecord.id} has no tenant_id`);
      return;
    }

    this.logger.log(
      `🎙️  Recording ready for ${callType} call ${callSid}. Downloading...`,
    );

    try {
      // 1. Download recording from Twilio
      const config = await this.getTenantTwilioConfig(callRecord.tenant_id);
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
      const filename = `${callRecord.id}.mp3`;
      // Use different path for voice AI calls vs regular calls
      const recordingType = isVoiceAiCall ? 'voice-ai' : 'communication';
      const relativePath = `${callRecord.tenant_id}/${recordingType}/recordings/${year}/${month}`;
      const fullDir = join(this.recordingsBasePath, relativePath);
      const fullPath = join(fullDir, filename);

      // Create directory structure
      await fs.mkdir(fullDir, { recursive: true });

      // Write recording file
      await fs.writeFile(fullPath, recordingBuffer);

      // 3. Update call record with recording info
      // IMPORTANT: Store full URL (not relative path) for transcription processor
      // Transcription processor needs to download the file via HTTP/HTTPS
      // Get tenant separately since voice_call_log doesn't have tenant included
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: callRecord.tenant_id },
        select: { subdomain: true },
      });

      if (!tenant) {
        throw new Error(`Tenant not found for call ${callSid}`);
      }

      const publicUrl = `https://${tenant.subdomain}.lead360.app/uploads/public/${relativePath}/${filename}`;

      // Update the appropriate table based on call type
      if (isVoiceAiCall) {
        await this.prisma.voice_call_log.update({
          where: { id: callRecord.id },
          data: {
            recording_url: publicUrl,
            recording_duration_seconds: duration,
            recording_status: 'available',
          },
        });
      } else {
        await this.prisma.call_record.update({
          where: { id: callRecord.id },
          data: {
            recording_url: publicUrl,
            recording_duration_seconds: duration,
            recording_status: 'available',
          },
        });
      }

      this.logger.log(
        `✅ Recording stored for ${callType} call ${callSid}: ${publicUrl}`,
      );

      // Auto-queue transcription job (only for IVR calls)
      // Voice AI calls already have real-time transcription via STT
      if (this.transcriptionJobService && !isVoiceAiCall) {
        try {
          await this.transcriptionJobService.queueTranscription(callRecord.id);
          this.logger.log(
            `🎤 Transcription queued for ${callType} call ${callSid}`,
          );
        } catch (error) {
          this.logger.error(
            `⚠️  Failed to queue transcription for ${callSid}: ${error.message}`,
          );
          // Don't throw - recording is still successful even if transcription fails to queue
        }
      } else if (isVoiceAiCall) {
        this.logger.log(
          `🤖 Voice AI call already has real-time transcription, skipping recording transcription`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to process recording for ${callSid}: ${error.message}`,
        error.stack,
      );

      // Update recording status to failed in the appropriate table
      if (isVoiceAiCall) {
        await this.prisma.voice_call_log.update({
          where: { id: callRecord.id },
          data: { recording_status: 'failed' },
        });
      } else {
        await this.prisma.call_record.update({
          where: { id: callRecord.id },
          data: { recording_status: 'failed' },
        });
      }
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
        url: `https://${tenant.subdomain}.lead360.app/api/v1/twilio/call/connect/${call_record.id}`,
        statusCallback: `https://${tenant.subdomain}.lead360.app/api/v1/twilio/call/status`,
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
      action: `https://${call_record.tenant?.subdomain}.lead360.app/api/v1/twilio/call/status`,
      record: 'record-from-ringing-dual', // Enable dual-channel stereo recording
    });

    dial.number(
      {
        statusCallback: `https://${call_record.tenant?.subdomain}.lead360.app/api/v1/twilio/call/status`,
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
          transcriptions: {
            where: { is_current: true },
            select: {
              transcription_text: true,
              language_detected: true,
              confidence_score: true,
              transcription_provider: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.call_record.count({
        where: { tenant_id: tenantId },
      }),
    ]);

    // Flatten phone numbers and format transcription for easier frontend consumption
    const formattedCalls = calls.map((call) => {
      const currentTranscription = call.transcriptions?.[0] || null;
      return {
        ...call,
        lead: call.lead
          ? {
              ...call.lead,
              phone: call.lead.phones[0]?.phone || null,
              phones: undefined,
            }
          : null,
        transcription: currentTranscription
          ? {
              transcription_text: currentTranscription.transcription_text,
              language_detected: currentTranscription.language_detected,
              confidence_score: currentTranscription.confidence_score
                ? parseFloat(currentTranscription.confidence_score.toString())
                : null,
              transcription_provider:
                currentTranscription.transcription_provider,
              status: currentTranscription.status,
            }
          : null,
        transcriptions: undefined, // Remove array from response
      };
    });

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
   * Get unified call history including both IVR calls and Voice AI calls
   * Returns both call types merged and sorted by date with a call_type flag
   *
   * @param tenantId - Tenant UUID (multi-tenant isolation)
   * @param page - Page number (1-indexed)
   * @param limit - Records per page (max 100)
   * @returns Paginated unified call records
   */
  async findAllUnified(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Fetch both call types in parallel
    const [ivrCalls, voiceAiCalls, ivrTotal, voiceAiTotal] = await Promise.all([
      // IVR calls (call_record)
      this.prisma.call_record.findMany({
        where: { tenant_id: tenantId },
        skip: 0, // We'll handle pagination after merging
        take: limit * 2, // Fetch more to ensure we have enough after merge
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
          transcriptions: {
            where: { is_current: true },
            select: {
              transcription_text: true,
              language_detected: true,
              confidence_score: true,
              transcription_provider: true,
              status: true,
            },
          },
        },
      }),
      // Voice AI calls (voice_call_log)
      this.prisma.voice_call_log.findMany({
        where: { tenant_id: tenantId },
        skip: 0, // We'll handle pagination after merging
        take: limit * 2, // Fetch more to ensure we have enough after merge
        orderBy: { started_at: 'desc' },
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
        },
      }),
      this.prisma.call_record.count({ where: { tenant_id: tenantId } }),
      this.prisma.voice_call_log.count({ where: { tenant_id: tenantId } }),
    ]);

    // Format IVR calls
    const formattedIvrCalls = ivrCalls.map((call) => {
      const currentTranscription = call.transcriptions?.[0] || null;

      return {
        id: call.id,
        call_type: 'ivr' as const,
        call_sid: call.twilio_call_sid,
        from_number: call.from_number,
        to_number: call.to_number,
        direction: call.direction,
        status: call.status,
        outcome: call.outcome,
        duration_seconds: call.duration_seconds,
        recording_url: call.recording_url,
        recording_duration_seconds: call.recording_duration_seconds,
        recording_status: call.recording_status,
        created_at: call.created_at,
        ended_at: call.ended_at,
        lead: call.lead
          ? {
              ...call.lead,
              phone: call.lead.phones[0]?.phone || null,
              phones: undefined,
            }
          : null,
        initiated_by_user: call.initiated_by_user || null,
        transcription: currentTranscription
          ? {
              transcription_text: currentTranscription.transcription_text,
              language_detected: currentTranscription.language_detected,
              confidence_score: currentTranscription.confidence_score
                ? parseFloat(currentTranscription.confidence_score.toString())
                : null,
              transcription_provider:
                currentTranscription.transcription_provider,
              status: currentTranscription.status,
            }
          : null,
      };
    });

    // Format Voice AI calls
    const formattedVoiceAiCalls = voiceAiCalls.map((call) => ({
      id: call.id,
      call_type: 'voice_ai' as const,
      call_sid: call.call_sid,
      from_number: call.from_number,
      to_number: call.to_number,
      direction: call.direction,
      status: call.status,
      outcome: call.outcome,
      duration_seconds: call.duration_seconds,
      recording_url: call.recording_url,
      recording_duration_seconds: call.recording_duration_seconds,
      recording_status: call.recording_status,
      created_at: call.started_at, // Use started_at for consistency with created_at
      ended_at: call.ended_at,
      lead: call.lead
        ? {
            ...call.lead,
            phone: call.lead.phones[0]?.phone || null,
            phones: undefined,
          }
        : null,
      initiated_by_user: null, // Voice AI calls are always inbound
      transcription: call.full_transcript
        ? {
            transcription_text: call.full_transcript,
            language_detected: call.language_used || null,
            confidence_score: null,
            transcription_provider: 'voice_ai_stt' as const,
            status: call.transcription_status || 'completed',
          }
        : null,
    }));

    // Merge and sort by date
    const allCalls = [...formattedIvrCalls, ...formattedVoiceAiCalls].sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    );

    // Apply pagination after merging
    const paginatedCalls = allCalls.slice(skip, skip + limit);
    const total = ivrTotal + voiceAiTotal;

    return {
      data: paginatedCalls,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        ivr_count: ivrTotal,
        voice_ai_count: voiceAiTotal,
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
      include: {
        transcriptions: {
          where: { is_current: true },
          select: {
            transcription_text: true,
            language_detected: true,
            confidence_score: true,
            transcription_provider: true,
            status: true,
          },
        },
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

    // Fix legacy URLs: old recordings stored as /public/ instead of /uploads/public/
    // New recordings already have correct format with /uploads/public/
    let recordingUrl = call.recording_url;
    if (
      recordingUrl.includes('/public/') &&
      !recordingUrl.includes('/uploads/public/')
    ) {
      recordingUrl = recordingUrl.replace('/public/', '/uploads/public/');
      this.logger.debug(
        `[LEGACY URL FIX] Transformed recording URL from ${call.recording_url} to ${recordingUrl}`,
      );
    }

    const currentTranscription = call.transcriptions?.[0] || null;

    return {
      url: recordingUrl,
      duration_seconds: call.recording_duration_seconds,
      transcription_available: call.recording_status === 'transcribed',
      transcription: currentTranscription
        ? {
            transcription_text: currentTranscription.transcription_text,
            language_detected: currentTranscription.language_detected,
            confidence_score: currentTranscription.confidence_score
              ? parseFloat(currentTranscription.confidence_score.toString())
              : null,
            transcription_provider: currentTranscription.transcription_provider,
            status: currentTranscription.status,
          }
        : null,
    };
  }

  /**
   * Get transcription for a call
   * Retrieves transcription text and metadata for a specific call
   *
   * @param tenantId - Tenant UUID (multi-tenant isolation)
   * @param callId - CallRecord UUID
   * @returns Transcription data
   */
  async getTranscription(tenantId: string, callId: string) {
    const call = await this.prisma.call_record.findFirst({
      where: {
        id: callId,
        tenant_id: tenantId,
      },
      include: {
        transcriptions: {
          where: { is_current: true },
        },
      },
    });

    if (!call) {
      throw new NotFoundException('Call record not found');
    }

    const currentTranscription = call.transcriptions?.[0];

    if (!currentTranscription) {
      throw new NotFoundException('Transcription not available for this call');
    }

    return {
      transcription_text: currentTranscription.transcription_text,
      language_detected: currentTranscription.language_detected,
      confidence_score: currentTranscription.confidence_score
        ? parseFloat(currentTranscription.confidence_score.toString())
        : null,
      transcription_provider: currentTranscription.transcription_provider,
      status: currentTranscription.status,
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

  /**
   * Find lead by phone number (helper method)
   *
   * Matches phone numbers using sanitization logic:
   * - Twilio sends: +1234567890 (E.164 format)
   * - Database stores: 1234567890 (10 digits, no formatting)
   *
   * Sanitization removes all non-digits, then takes last 10 digits to handle:
   * - E.164 format: +1234567890 → 1234567890
   * - International: +441234567890 → 1234567890 (matches if stored as 10 digits)
   * - Formatted: (123) 456-7890 → 1234567890
   *
   * @param tenantId - Tenant UUID (multi-tenant isolation)
   * @param phoneNumber - Phone number from Twilio (any format)
   * @returns Lead UUID if found, null otherwise
   * @private
   */
  private async findLeadByPhoneNumber(
    tenantId: string,
    phoneNumber: string,
  ): Promise<string | null> {
    try {
      // Sanitize phone: remove all non-digits
      const sanitized = phoneNumber.replace(/\D/g, '');

      // Take last 10 digits (handles +1 prefix for US numbers)
      // Examples:
      // +1234567890 → 1234567890 → 1234567890 (last 10)
      // +11234567890 → 11234567890 → 1234567890 (last 10)
      const last10Digits = sanitized.slice(-10);

      this.logger.debug(
        `[LEAD LOOKUP] Sanitized phone ${phoneNumber} → ${sanitized} → ${last10Digits}`,
      );

      // Look up lead_phone by sanitized 10-digit phone
      const leadPhone = await this.prisma.lead_phone.findFirst({
        where: {
          phone: last10Digits,
          lead: {
            tenant_id: tenantId, // CRITICAL: Tenant isolation
          },
        },
        select: {
          lead_id: true,
        },
      });

      if (leadPhone) {
        this.logger.log(
          `[LEAD LOOKUP] ✅ Lead found for ${phoneNumber}: ${leadPhone.lead_id}`,
        );
        return leadPhone.lead_id;
      }

      this.logger.debug(
        `[LEAD LOOKUP] ❌ No lead found for ${phoneNumber} (sanitized: ${last10Digits})`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        `[LEAD LOOKUP] Error finding lead by phone ${phoneNumber}: ${error.message}`,
        error.stack,
      );
      // Don't throw - just return null so call can proceed without lead association
      return null;
    }
  }
}
