import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  VoiceAiContextBuilderService,
  FullVoiceAiContext,
} from './voice-ai-context-builder.service';
import { VoiceCallLogService } from './voice-call-log.service';
import { UsageRecordData } from './voice-usage.service';
import { VoiceTransferNumbersService } from './voice-transfer-numbers.service';
import { VoiceAiCallMetadataService } from './voice-ai-call-metadata.service';
import { StartCallDto } from '../dto/start-call.dto';
import { CompleteCallDto } from '../dto/complete-call.dto';
import { LookupTenantResponseDto } from '../dto/internal/lookup-tenant.dto';
import {
  CreateLeadToolDto,
  CreateLeadToolResponseDto,
} from '../dto/internal/tool-create-lead.dto';
import {
  FindLeadToolDto,
  FindLeadToolResponseDto,
} from '../dto/internal/tool-find-lead.dto';
import {
  CheckServiceAreaToolDto,
  CheckServiceAreaToolResponseDto,
} from '../dto/internal/tool-check-service-area.dto';
import {
  TransferCallToolDto,
  TransferCallToolResponseDto,
} from '../dto/internal/tool-transfer-call.dto';
import {
  FindLeadByPhoneDto,
  FindLeadByPhoneResponseDto,
} from '../dto/internal/find-lead-by-phone.dto';
import {
  BookAppointmentToolDto,
  BookAppointmentToolResponseDto,
} from '../dto/internal/tool-book-appointment.dto';
import {
  RescheduleAppointmentToolDto,
  RescheduleAppointmentToolResponseDto,
} from '../dto/internal/tool-reschedule-appointment.dto';
import {
  CancelAppointmentToolDto,
  CancelAppointmentToolResponseDto,
} from '../dto/internal/tool-cancel-appointment.dto';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadsService } from '../../leads/services/leads.service';
import { SlotCalculationService } from '../../calendar/services/slot-calculation.service';
import { AppointmentsService } from '../../calendar/services/appointments.service';
import { AppointmentTypesService } from '../../calendar/services/appointment-types.service';
import { AppointmentLifecycleService } from '../../calendar/services/appointment-lifecycle.service';
import { generatePhoneVariations } from '../utils/phone-normalizer.util';
import { addDays, format } from 'date-fns';

/**
 * Access check result returned by checkAccess().
 *
 * has_access: false → Python agent must reject the call and hang up.
 * has_access: true  → Agent may proceed; minutes_remaining reflects available quota.
 */
export interface VoiceAiAccessResult {
  has_access: boolean;
  reason?: string;
  minutes_remaining?: number;
  overage_rate?: number | null;
}

/**
 * VoiceAiInternalService — Sprint B06a + B06b + VAB-05
 *
 * Provides context, access-check, and call lifecycle logic for the Python voice agent.
 * These methods back the @Public() internal endpoints on /api/v1/internal/voice-ai/
 * authenticated exclusively via VoiceAgentKeyGuard (X-Voice-Agent-Key header).
 *
 * Sprint B06a: checkAccess() + getContext()
 * Sprint B06b: startCall() + completeCall()
 * Sprint VAB-05: Tool HTTP endpoints (create_lead, find_lead, check_service_area, transfer_call)
 */
@Injectable()
export class VoiceAiInternalService {
  private readonly logger = new Logger(VoiceAiInternalService.name);

  constructor(
    private readonly contextBuilder: VoiceAiContextBuilderService,
    private readonly callLogService: VoiceCallLogService,
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly transferNumbersService: VoiceTransferNumbersService,
    private readonly slotCalculationService: SlotCalculationService,
    private readonly appointmentsService: AppointmentsService,
    private readonly appointmentTypesService: AppointmentTypesService,
    private readonly appointmentLifecycleService: AppointmentLifecycleService,
    private readonly callMetadataService: VoiceAiCallMetadataService,
  ) {}

  /**
   * Pre-flight access check — API-026
   *
   * Called BEFORE the agent accepts a call job from the queue.
   * Performs a cheap quota + enabled check without returning decrypted credentials.
   *
   * Returns has_access: false with a reason string when the agent should reject:
   *   - 'tenant_not_found'  — tenant ID does not exist
   *   - 'not_enabled'       — Voice AI is disabled for this tenant
   *   - 'quota_exceeded'    — monthly minutes exhausted with no overage rate configured
   *
   * Returns has_access: true with remaining quota when the agent may proceed.
   * Tenants with an overage_rate configured can continue past their included minutes.
   *
   * @param tenantId  UUID of the tenant — sourced from call routing params
   */
  async checkAccess(tenantId: string): Promise<VoiceAiAccessResult> {
    let context: FullVoiceAiContext;

    try {
      context = await this.contextBuilder.buildContext(tenantId);
    } catch {
      // buildContext throws NotFoundException if tenant does not exist
      return { has_access: false, reason: 'tenant_not_found' };
    }

    if (!context.behavior.is_enabled) {
      return { has_access: false, reason: 'not_enabled' };
    }

    if (context.quota.quota_exceeded && context.quota.overage_rate === null) {
      return {
        has_access: false,
        reason: 'quota_exceeded',
        minutes_remaining: 0,
        overage_rate: null,
      };
    }

    return {
      has_access: true,
      minutes_remaining: context.quota.minutes_remaining,
      overage_rate: context.quota.overage_rate,
    };
  }

  /**
   * Full context fetch — API-022 + Sprint 8
   *
   * Called once per call after routing to the agent.
   * Returns the complete FullVoiceAiContext with decrypted provider credentials.
   *
   * Sprint 8: Now accepts optional callSid and agentProfileId parameters.
   * The agentProfileId is extracted from X-Agent-Profile-Id SIP header by the agent worker
   * and enables multi-language voice agent support.
   *
   * SECURITY: The returned object contains decrypted API keys.
   *   This response must NEVER be cached, stored, or logged by the agent.
   *
   * @param tenantId        UUID of the tenant — sourced from call routing params
   * @param callSid         Optional Twilio call SID for call identification tracking
   * @param agentProfileId  Optional voice agent profile ID for language/voice selection (Sprint 8)
   * @throws NotFoundException if tenant does not exist
   */
  async getContext(
    tenantId: string,
    callSid?: string,
    agentProfileId?: string,
  ): Promise<FullVoiceAiContext> {
    return this.contextBuilder.buildContext(tenantId, callSid, agentProfileId);
  }

  /**
   * Get call metadata (agent profile ID) from Redis
   *
   * Retrieves metadata stored by IVR before routing to SIP.
   * Used by voice agent to get agent profile ID without passing through SIP protocol.
   *
   * @param callSid Twilio call SID
   * @returns Metadata with agent profile ID or null
   */
  async getCallMetadata(callSid: string) {
    const metadata = await this.callMetadataService.getCallMetadata(callSid);
    return {
      found: !!metadata,
      agent_profile_id: metadata?.agent_profile_id || null,
      tenant_id: metadata?.tenant_id || null,
    };
  }

  /**
   * Get parent call SID from child call SID
   *
   * Resolves child DialCallSid (SIP outbound) → parent CallSid (inbound).
   * Used by voice agent to retrieve metadata when only child SID is known.
   *
   * Flow:
   * 1. Voice agent knows child DialCallSid (from LiveKit SIP participant)
   * 2. Call this to resolve parent CallSid
   * 3. Use parent CallSid to retrieve metadata (agent profile ID)
   *
   * @param childCallSid Twilio DialCallSid (SIP outbound leg)
   * @returns Parent call SID mapping
   */
  async getParentCallSid(childCallSid: string) {
    const parentCallSid =
      await this.callMetadataService.getParentCallSid(childCallSid);
    return {
      found: !!parentCallSid,
      parent_call_sid: parentCallSid,
      child_call_sid: childCallSid,
    };
  }

  /**
   * Look up tenant by Twilio phone number — VAB-01 (HTTP API Bridge)
   *
   * Used by the agent (running in a separate process) to identify which tenant
   * owns a given Twilio phone number. The agent receives this number from
   * LiveKit SIP participant attributes (sip.trunkPhoneNumber).
   *
   * Query order:
   * 1. Check tenant_sms_config.from_phone
   * 2. If not found, check other phone allocation tables
   *
   * @param phoneNumber E.164 format phone number (+1XXXXXXXXXX)
   * @returns LookupTenantResponseDto with found status and tenant info
   */
  async lookupTenantByPhoneNumber(
    phoneNumber: string,
  ): Promise<LookupTenantResponseDto> {
    this.logger.log(`Looking up tenant for phone number: ${phoneNumber}`);

    try {
      // Normalize phone number (remove any whitespace, ensure E.164)
      const normalizedPhone = phoneNumber.trim();

      // Query tenant_sms_config for matching phone number
      const smsConfig = await this.prisma.tenant_sms_config.findFirst({
        where: {
          from_phone: normalizedPhone,
          is_active: true,
        },
        include: {
          tenant: {
            select: {
              id: true,
              company_name: true,
            },
          },
        },
      });

      if (smsConfig && smsConfig.tenant) {
        this.logger.log(
          `Tenant found: ${smsConfig.tenant.company_name} (${smsConfig.tenant.id})`,
        );
        return {
          found: true,
          tenant_id: smsConfig.tenant.id,
          tenant_name: smsConfig.tenant.company_name,
          phone_number: normalizedPhone,
        };
      }

      // Phone number not found in any tenant configuration
      this.logger.warn(`No tenant found for phone number: ${phoneNumber}`);
      return {
        found: false,
        phone_number: normalizedPhone,
      };
    } catch (error) {
      this.logger.error(
        `Error looking up tenant by phone: ${error.message}`,
        error.stack,
      );
      return {
        found: false,
        error: 'Internal error during tenant lookup',
      };
    }
  }

  /**
   * Start call — API-024
   *
   * Creates a voice_call_log row with status='in_progress'.
   * Called by the Python agent BEFORE audio starts, once the agent has been
   * dispatched to the LiveKit room.
   *
   * Idempotent on call_sid: returns existing call_log_id if the agent retried.
   *
   * @param dto  StartCallDto from the request body
   * @returns    { call_log_id: string }
   */
  async startCall(dto: StartCallDto): Promise<{ call_log_id: string }> {
    // Resolve call_record_id from Redis metadata
    // The voice agent knows the child CallSid; metadata is stored with parent CallSid
    let callRecordId: string | undefined;
    let parentCallSid: string | undefined;

    try {
      // Try direct metadata lookup first (child CallSid might match parent)
      let metadata = await this.callMetadataService.getCallMetadata(
        dto.call_sid,
      );

      // If not found, resolve parent CallSid from child mapping
      if (!metadata) {
        const parentSid = await this.callMetadataService.getParentCallSid(
          dto.call_sid,
        );
        if (parentSid) {
          metadata = await this.callMetadataService.getCallMetadata(parentSid);
          parentCallSid = parentSid;
        }
      } else {
        parentCallSid = metadata.parent_call_sid ?? undefined;
      }

      if (metadata?.call_record_id) {
        callRecordId = metadata.call_record_id;
        this.logger.log(
          `🔗 Resolved call_record_id=${callRecordId} for call_sid=${dto.call_sid}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `⚠️ Failed to resolve call_record_id for ${dto.call_sid}: ${err.message}`,
      );
    }

    return this.callLogService.startCall({
      tenantId: dto.tenant_id,
      callSid: dto.call_sid,
      roomName: dto.room_name,
      fromNumber: dto.from_number,
      toNumber: dto.to_number,
      direction: dto.direction ?? 'inbound',
      languageUsed: dto.language_used,
      intent: dto.intent,
      sttProviderId: dto.stt_provider_id,
      llmProviderId: dto.llm_provider_id,
      ttsProviderId: dto.tts_provider_id,
      callRecordId,
      parentCallSid,
    });
  }

  /**
   * Complete call — API-030
   *
   * Finalises the call log and persists per-provider usage records.
   * Called by the Python agent AFTER the call ends (audio stream closed).
   *
   * All writes (call log update + usage records) execute in a single transaction.
   *
   * @param callSid  Twilio CallSid from the URL path parameter
   * @param dto      CompleteCallDto from the request body
   * @throws NotFoundException if no call log exists for callSid
   */
  async completeCall(callSid: string, dto: CompleteCallDto): Promise<void> {
    await this.callLogService.completeCall({
      callSid,
      status: dto.status,
      durationSeconds: dto.duration_seconds,
      outcome: dto.outcome,
      transcriptSummary: dto.transcript_summary,
      fullTranscript: dto.full_transcript,
      actionsTaken: dto.actions_taken,
      leadId: dto.lead_id,
      transferredTo: dto.transferred_to,
      errorMessage: dto.error_message,
      isOverage: dto.is_overage ?? false,
      usageRecords: dto.usage_records as UsageRecordData[] | undefined,
    });
  }

  /**
   * Get call status — Verification endpoint
   *
   * Returns the current status and ended_at timestamp of a call log.
   * Used for verification/debugging purposes - allows the agent to check
   * if a call completion request was successful.
   *
   * @param callSid  Twilio CallSid
   * @returns        { status: string, ended_at: Date | null }
   * @throws NotFoundException if no call log exists for callSid
   */
  async getCallStatus(
    callSid: string,
  ): Promise<{ status: string; ended_at: Date | null }> {
    const callLog = await this.callLogService.findByCallSid(callSid);

    if (!callLog) {
      throw new NotFoundException(
        `Call log not found for call_sid: ${callSid}`,
      );
    }

    return {
      status: callLog.status,
      ended_at: callLog.ended_at,
    };
  }

  // ---------------------------------------------------------------------------
  // Sprint VAB-05 — Agent Tool HTTP Endpoints
  // ---------------------------------------------------------------------------

  /**
   * Tool: Create Lead — VAB-05
   *
   * Creates a new lead from call information collected by the voice agent.
   * Uses LeadsService to handle validation, phone uniqueness checks, and persistence.
   *
   * CRITICAL:
   *   - Enforces tenant_id isolation
   *   - userId is null (voice agent is a system actor)
   *   - Phone uniqueness validated by LeadsService
   *
   * @param tenantId UUID of the tenant
   * @param dto      CreateLeadToolDto with lead information
   * @returns        CreateLeadToolResponseDto with success/error status
   */
  async toolCreateLead(
    tenantId: string,
    dto: CreateLeadToolDto,
  ): Promise<CreateLeadToolResponseDto> {
    this.logger.log(`[Tool] Creating lead for tenant: ${tenantId}`);

    try {
      // Check if lead already exists with this phone number (tenant-scoped)
      const sanitizedPhone = dto.phone_number.replace(/\D/g, '');
      this.logger.log(
        `[Tool] Checking for existing lead with phone: ${sanitizedPhone}`,
      );

      const existingLeadPhone = await this.prisma.lead_phone.findFirst({
        where: {
          phone: sanitizedPhone,
          lead: { tenant_id: tenantId },
        },
        include: {
          lead: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (existingLeadPhone?.lead) {
        this.logger.log(
          `[Tool] Lead already exists: ${existingLeadPhone.lead.first_name} ${existingLeadPhone.lead.last_name}`,
        );
        return {
          success: true,
          lead_id: existingLeadPhone.lead.id,
          message: `Lead already exists for ${existingLeadPhone.lead.first_name} ${existingLeadPhone.lead.last_name}`,
          lead_exists: true,
        };
      }

      // Build CreateLeadDto matching the exact structure from leads module
      const createLeadDto = {
        first_name: dto.first_name,
        last_name: dto.last_name,
        source: 'phone_call',
        language_spoken: dto.language ? dto.language.toUpperCase() : 'EN',
        accept_sms: false,
        preferred_communication: 'phone',
        phones: [
          {
            phone: dto.phone_number,
            phone_type: 'mobile',
            is_primary: true,
          },
        ],
        emails: dto.email
          ? [
              {
                email: dto.email,
                email_type: 'personal',
                is_primary: true,
              },
            ]
          : [],
        addresses: [
          {
            address_line1: dto.address,
            city: dto.city,
            state: dto.state,
            zip_code: dto.zip_code,
            country: 'US',
            address_type: 'service',
            is_primary: true,
          },
        ],
        service_request:
          dto.service_description || dto.requested_service_ids?.length
            ? {
                service_name: 'Voice AI Call',
                service_description: dto.service_description || '',
                urgency: 'medium',
                // Store requested service IDs in extra_data for proper service association
                extra_data: dto.requested_service_ids?.length
                  ? {
                      requested_service_ids: dto.requested_service_ids,
                      source: 'voice_ai',
                    }
                  : { source: 'voice_ai' },
              }
            : undefined,
      };

      // Call LeadsService.create() with tenant_id and null userId (system action)
      const lead = await this.leadsService.create(
        tenantId,
        null,
        createLeadDto as any,
      );

      this.logger.log(`[Tool] Lead created successfully: ${lead.id}`);
      return {
        success: true,
        lead_id: lead.id,
        message: `Lead created for ${dto.first_name} ${dto.last_name}`,
        lead_exists: false,
      };
    } catch (error) {
      this.logger.error(
        `[Tool] Error creating lead: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message || 'Could not create lead',
      };
    }
  }

  /**
   * Tool: Find Lead — VAB-05
   *
   * Finds an existing lead by phone number for the specified tenant.
   * Queries the lead_phone table with tenant isolation.
   *
   * CRITICAL:
   *   - Enforces tenant_id filtering
   *   - Phone numbers stored as sanitized digits (10 digits)
   *
   * @param tenantId UUID of the tenant
   * @param dto      FindLeadToolDto with phone number
   * @returns        FindLeadToolResponseDto with found status and lead info
   */
  async toolFindLead(
    tenantId: string,
    dto: FindLeadToolDto,
  ): Promise<FindLeadToolResponseDto> {
    this.logger.log(`[Tool] Finding lead for phone: ${dto.phone_number}`);

    try {
      // Generate all possible phone number variations for lookup
      const phoneVariations = generatePhoneVariations(dto.phone_number);
      this.logger.log(
        `[Tool] Checking phone variations: ${phoneVariations.join(', ')}`,
      );

      // Query lead_phone table with tenant isolation
      // Uses OR to check all variations, AND to enforce tenant isolation
      const leadPhone = await this.prisma.lead_phone.findFirst({
        where: {
          AND: [
            {
              // CRITICAL: Try all phone variations with OR
              OR: phoneVariations.map((variant) => ({
                phone: variant, // Exact match (not contains)
              })),
            },
            {
              // CRITICAL: Tenant isolation MUST be in AND clause
              lead: { tenant_id: tenantId },
            },
          ],
        },
        include: {
          lead: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              status: true,
              emails: {
                where: { is_primary: true },
                take: 1,
                select: { email: true },
              },
              addresses: {
                where: { is_primary: true },
                take: 1,
                select: {
                  address_line1: true,
                  address_line2: true,
                  city: true,
                  state: true,
                  zip_code: true,
                  country: true,
                },
              },
            },
          },
        },
      });

      if (!leadPhone?.lead) {
        return {
          success: true,
          found: false,
        };
      }

      const lead = leadPhone.lead;
      const primaryEmail = lead.emails?.[0]?.email || undefined;
      const primaryAddress = lead.addresses?.[0] || undefined;

      return {
        success: true,
        found: true,
        lead_id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        full_name: `${lead.first_name} ${lead.last_name}`,
        email: primaryEmail,
        phone_number: leadPhone.phone,
        status: lead.status,
        address: primaryAddress
          ? {
              address_line1: primaryAddress.address_line1,
              address_line2: primaryAddress.address_line2,
              city: primaryAddress.city,
              state: primaryAddress.state,
              zip_code: primaryAddress.zip_code,
              country: primaryAddress.country,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error(
        `[Tool] Error finding lead: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        found: false,
        error: 'Could not search records',
      };
    }
  }

  /**
   * Tool: Check Service Area — VAB-05
   *
   * Checks if a location (ZIP code, city, state) is within the tenant's service area.
   * Queries the tenant_service_area table with various matching strategies.
   *
   * CRITICAL:
   *   - Enforces tenant_id filtering
   *   - If no service areas configured, assumes all areas are covered
   *
   * @param tenantId UUID of the tenant
   * @param dto      CheckServiceAreaToolDto with location information
   * @returns        CheckServiceAreaToolResponseDto with coverage status
   */
  async toolCheckServiceArea(
    tenantId: string,
    dto: CheckServiceAreaToolDto,
  ): Promise<CheckServiceAreaToolResponseDto> {
    this.logger.log(`[Tool] Checking service area for ZIP: ${dto.zip_code}`);

    try {
      // Check if tenant has any service areas configured
      const serviceAreaCount = await this.prisma.tenant_service_area.count({
        where: { tenant_id: tenantId },
      });

      // If no service areas configured, assume all areas are covered
      if (serviceAreaCount === 0) {
        return {
          success: true,
          in_service_area: true,
          message: 'Service area check not configured — assuming coverage',
        };
      }

      // Check for exact ZIP code match
      const zipMatch = await this.prisma.tenant_service_area.findFirst({
        where: {
          tenant_id: tenantId,
          zipcode: dto.zip_code,
        },
      });

      if (zipMatch) {
        return {
          success: true,
          in_service_area: true,
          message: 'ZIP code is in service area',
        };
      }

      // Check for state-level coverage (entire_state = true)
      if (dto.state) {
        const stateMatch = await this.prisma.tenant_service_area.findFirst({
          where: {
            tenant_id: tenantId,
            state: dto.state,
            entire_state: true,
          },
        });

        if (stateMatch) {
          return {
            success: true,
            in_service_area: true,
            message: `Entire state ${dto.state} is in service area`,
          };
        }
      }

      // Check for city-level coverage
      if (dto.city && dto.state) {
        const cityMatch = await this.prisma.tenant_service_area.findFirst({
          where: {
            tenant_id: tenantId,
            city_name: dto.city,
            state: dto.state,
            type: 'city',
          },
        });

        if (cityMatch) {
          return {
            success: true,
            in_service_area: true,
            message: `City ${dto.city}, ${dto.state} is in service area`,
          };
        }
      }

      // Not covered
      return {
        success: true,
        in_service_area: false,
        message: 'This location is outside our service area',
      };
    } catch (error) {
      this.logger.error(
        `[Tool] Error checking service area: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        in_service_area: false,
        error: 'Service area check failed',
      };
    }
  }

  /**
   * Tool: Transfer Call — VAB-05
   *
   * Gets the transfer number for call handoff to a human agent.
   * Uses VoiceTransferNumbersService to fetch configured transfer numbers.
   *
   * CRITICAL:
   *   - Enforces tenant_id filtering via VoiceTransferNumbersService
   *   - Returns action: 'TRANSFER' to signal the pipeline
   *
   * @param tenantId UUID of the tenant
   * @param dto      TransferCallToolDto with reason and optional destination
   * @returns        TransferCallToolResponseDto with transfer number and action
   */
  async toolTransferCall(
    tenantId: string,
    dto: TransferCallToolDto,
  ): Promise<TransferCallToolResponseDto> {
    this.logger.log(`[Tool] Getting transfer number, reason: ${dto.reason}`);

    try {
      // Get all transfer numbers for this tenant
      const numbers = await this.transferNumbersService.findAll(tenantId);

      // Find default number, or use first available
      const defaultNumber = numbers.find((n) => n.is_default) || numbers[0];

      if (!defaultNumber) {
        return {
          success: false,
          error: 'No transfer number configured',
        };
      }

      return {
        success: true,
        transfer_to: defaultNumber.phone_number,
        label: defaultNumber.label,
        reason: dto.reason,
        action: 'TRANSFER',
      };
    } catch (error) {
      this.logger.error(
        `[Tool] Error getting transfer number: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message || 'Could not retrieve transfer number',
      };
    }
  }

  /**
   * Tool: Book Appointment — Sprint 18 (voice_ai_book_upgrade)
   *
   * Books appointments for quote visits via Voice AI.
   * Replaces the placeholder that created lead_note with real appointment booking.
   *
   * Two modes of operation:
   * 1. SEARCH MODE: Only lead_id provided (+ optional preferred_date)
   *    - Returns available slots for next 14 days (or from preferred_date)
   *    - Expands to max_lookahead_weeks if no slots in 14 days
   *    - Returns no_availability if no slots found in max range
   *
   * 2. CONFIRM MODE: lead_id + confirmed_date + confirmed_start_time provided
   *    - Creates the actual appointment
   *    - Returns appointment details
   *
   * CRITICAL:
   *   - Enforces tenant_id isolation
   *   - Uses default appointment type for tenant
   *   - Validates lead belongs to tenant
   *   - Source set to 'voice_ai'
   *   - userId is null (system action)
   *
   * @param tenantId UUID of the tenant
   * @param dto BookAppointmentToolDto with booking parameters
   * @returns BookAppointmentToolResponseDto with slots or appointment confirmation
   */
  async toolBookAppointment(
    tenantId: string,
    dto: BookAppointmentToolDto,
  ): Promise<BookAppointmentToolResponseDto> {
    this.logger.log(
      `[Tool] Booking appointment for tenant: ${tenantId}, lead: ${dto.lead_id}`,
    );

    try {
      // Step 1: Validate lead exists and belongs to tenant (include address + phone for calendar)
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: dto.lead_id,
          tenant_id: tenantId,
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          addresses: {
            where: { is_primary: true },
            take: 1,
          },
          phones: {
            where: { is_primary: true },
            take: 1,
          },
          service_requests: {
            where: { status: { not: 'completed' } },
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { id: true, lead_address_id: true },
          },
        },
      });

      if (!lead) {
        this.logger.error(
          `[Tool] Lead ${dto.lead_id} not found or access denied for tenant ${tenantId}`,
        );
        return {
          status: 'error',
          error: 'Lead not found or access denied',
        };
      }

      // Step 2: Get default appointment type for tenant
      const appointmentTypes = await this.appointmentTypesService.findAll(
        tenantId,
        {
          is_active: true,
        },
      );

      const defaultType =
        appointmentTypes.items?.find((t: any) => t.is_default) ||
        appointmentTypes.items?.[0];

      if (!defaultType) {
        this.logger.error(
          `[Tool] No active appointment type found for tenant ${tenantId}`,
        );
        return {
          status: 'error',
          error: 'No appointment type configured. Please contact support.',
        };
      }

      this.logger.log(
        `[Tool] Using appointment type: ${defaultType.name} (${defaultType.id})`,
      );

      // MODE DETECTION: Confirm mode vs Search mode
      const isConfirmMode = !!(dto.confirmed_date && dto.confirmed_start_time);

      if (isConfirmMode) {
        // ========== CONFIRM MODE: Create appointment ==========
        this.logger.log(
          `[Tool] CONFIRM MODE: Booking appointment for ${dto.confirmed_date} at ${dto.confirmed_start_time}`,
        );

        // Calculate end_time based on slot_duration_minutes
        const [hours, minutes] = dto
          .confirmed_start_time!.split(':')
          .map(Number);
        const totalMinutes =
          hours * 60 + minutes + defaultType.slot_duration_minutes;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        const end_time = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

        // Find or create service_request so Google Calendar gets location + service info
        let serviceRequestId: string | undefined;
        const primaryAddress = lead.addresses?.[0];

        if (lead.service_requests?.[0]) {
          // Use existing active service_request
          serviceRequestId = lead.service_requests[0].id;
          this.logger.log(`[Tool] Using existing service_request: ${serviceRequestId}`);
        } else if (primaryAddress) {
          // Create a service_request linked to lead's address for calendar location
          const sr = await this.prisma.service_request.create({
            data: {
              id: uuidv4(),
              tenant_id: tenantId,
              lead_id: dto.lead_id,
              lead_address_id: primaryAddress.id,
              service_name: defaultType.name,
              status: 'new',
              description: dto.notes || null,
            },
          });
          serviceRequestId = sr.id;
          this.logger.log(`[Tool] Created service_request: ${serviceRequestId} with address ${primaryAddress.id}`);
        }

        // Create appointment using AppointmentsService
        const appointment = await this.appointmentsService.create(
          tenantId,
          null, // Voice AI is a system actor (no userId)
          {
            appointment_type_id: defaultType.id,
            lead_id: dto.lead_id,
            service_request_id: serviceRequestId,
            scheduled_date: dto.confirmed_date!,
            start_time: dto.confirmed_start_time!,
            end_time: end_time,
            notes: dto.notes,
            source: 'voice_ai', // CRITICAL: Mark as Voice AI booking
          },
        );

        this.logger.log(`[Tool] Appointment created: ${appointment.id}`);

        // Build human-readable date/time for voice
        const bookedDate = new Date(dto.confirmed_date! + 'T12:00:00');
        const bookedDayName = bookedDate.toLocaleDateString('en-US', { weekday: 'long' });
        const bookedTimeDisplay = this.formatTimeForVoice(dto.confirmed_start_time!);

        return {
          status: 'appointment_booked',
          message: `Appointment confirmed for ${lead.first_name} ${lead.last_name} on ${bookedDayName} at ${bookedTimeDisplay}`,
          appointment_id: appointment.id,
          appointment: {
            id: appointment.id,
            appointment_type: defaultType.name,
            scheduled_date: appointment.scheduled_date,
            day_name: bookedDayName,
            start_time: appointment.start_time,
            end_time: appointment.end_time,
            start_time_display: bookedTimeDisplay,
            end_time_display: this.formatTimeForVoice(appointment.end_time),
            lead_name: `${lead.first_name} ${lead.last_name}`,
          },
        };
      } else {
        // ========== SEARCH MODE: Find available slots ==========
        this.logger.log(`[Tool] SEARCH MODE: Finding available slots`);

        // Determine search date range
        const today = new Date();
        const searchStartDate = dto.preferred_date
          ? new Date(dto.preferred_date)
          : today;

        // Initial search: next 14 days from search start
        const initialSearchEnd = addDays(searchStartDate, 14);
        const dateFrom = format(searchStartDate, 'yyyy-MM-dd');
        const dateTo = format(initialSearchEnd, 'yyyy-MM-dd');

        this.logger.log(
          `[Tool] Initial search range: ${dateFrom} to ${dateTo}`,
        );

        // Query slot availability
        let slotsResult = await this.slotCalculationService.getAvailableSlots(
          tenantId,
          defaultType.id,
          dateFrom,
          dateTo,
        );

        // If no slots in initial 14 days, expand to max_lookahead_weeks
        if (slotsResult.total_available_slots === 0) {
          this.logger.log(
            `[Tool] No slots in initial 14 days, expanding to ${defaultType.max_lookahead_weeks} weeks`,
          );

          const expandedSearchEnd = addDays(
            searchStartDate,
            defaultType.max_lookahead_weeks * 7,
          );
          const expandedDateTo = format(expandedSearchEnd, 'yyyy-MM-dd');

          slotsResult = await this.slotCalculationService.getAvailableSlots(
            tenantId,
            defaultType.id,
            dateFrom,
            expandedDateTo,
          );
        }

        // No availability found
        if (slotsResult.total_available_slots === 0) {
          this.logger.warn(
            `[Tool] No availability found for tenant ${tenantId} within ${defaultType.max_lookahead_weeks} weeks`,
          );

          return {
            status: 'no_availability',
            message: `Unfortunately, we don't have any available appointment slots in the next ${defaultType.max_lookahead_weeks} weeks. I'll have someone from our team call you back to schedule a time that works for you.`,
            total_slots: 0,
          };
        }

        // Flatten available slots for Voice AI (easier to present conversationally)
        // Times are converted to human-readable 12-hour AM/PM format so the LLM
        // never has to interpret raw 24-hour codes (avoids TTS reading "zero nine zero zero")
        const flatSlots: Array<{
          date: string;
          day_name: string;
          start_time: string;
          end_time: string;
          start_time_display: string;
          end_time_display: string;
        }> = [];

        for (const dateEntry of slotsResult.available_dates) {
          for (const slot of dateEntry.slots) {
            flatSlots.push({
              date: dateEntry.date,
              day_name: dateEntry.day_name,
              start_time: slot.start_time,
              end_time: slot.end_time,
              start_time_display: this.formatTimeForVoice(slot.start_time),
              end_time_display: this.formatTimeForVoice(slot.end_time),
            });
          }
        }

        this.logger.log(`[Tool] Found ${flatSlots.length} available slots`);

        return {
          status: 'availability_found',
          message: `I found ${flatSlots.length} available appointment slots. Let me share some options with you.`,
          available_slots: flatSlots,
          total_slots: flatSlots.length,
        };
      }
    } catch (error) {
      this.logger.error(
        `[Tool] Error booking appointment: ${error.message}`,
        error.stack,
      );
      return {
        status: 'error',
        error: error.message || 'Could not book appointment',
      };
    }
  }

  /**
   * Tool: Reschedule Appointment — Sprint 19 (voice_ai_reschedule_cancel)
   *
   * Reschedules an existing appointment with identity verification.
   * Two modes of operation:
   * 1. INITIAL MODE: Only call_log_id + lead_id provided
   *    - Verifies caller phone matches lead phone
   *    - Returns current appointment + available slots for rescheduling
   *    - If multiple appointments, asks caller to choose one
   *
   * 2. CONFIRM MODE: call_log_id + lead_id + appointment_id + new_date + new_time provided
   *    - Executes the reschedule
   *    - Returns new appointment details
   *
   * CRITICAL:
   *   - Identity verification: caller phone from call_log must match lead phone
   *   - Enforces tenant_id isolation
   *   - Only appointments with status 'scheduled' or 'confirmed' can be rescheduled
   *   - userId is null (Voice AI is system actor)
   *
   * @param tenantId UUID of the tenant
   * @param dto RescheduleAppointmentToolDto with reschedule parameters
   * @returns RescheduleAppointmentToolResponseDto with verification/slots/confirmation
   */
  async toolRescheduleAppointment(
    tenantId: string,
    dto: RescheduleAppointmentToolDto,
  ): Promise<RescheduleAppointmentToolResponseDto> {
    this.logger.log(
      `[Tool] Rescheduling appointment for tenant: ${tenantId}, lead: ${dto.lead_id}`,
    );

    try {
      // Step 1: Verify caller identity (phone match)
      const callLog = await this.prisma.voice_call_log.findFirst({
        where: {
          id: dto.call_log_id,
          tenant_id: tenantId,
        },
        select: {
          from_number: true,
        },
      });

      if (!callLog) {
        this.logger.error(
          `[Tool] Call log ${dto.call_log_id} not found for tenant ${tenantId}`,
        );
        return {
          status: 'error',
          error: 'Call log not found',
        };
      }

      // Get lead and verify phone match
      const phoneVariations = generatePhoneVariations(callLog.from_number);
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: dto.lead_id,
          tenant_id: tenantId,
        },
        include: {
          phones: true,
        },
      });

      if (!lead) {
        this.logger.error(
          `[Tool] Lead ${dto.lead_id} not found for tenant ${tenantId}`,
        );
        return {
          status: 'error',
          error: 'Lead not found',
        };
      }

      // Verify phone number matches
      const phoneMatch = lead.phones.some((phone) =>
        phoneVariations.includes(phone.phone),
      );

      if (!phoneMatch) {
        this.logger.warn(
          `[Tool] Phone verification failed for lead ${dto.lead_id}. Caller: ${callLog.from_number}, Lead phones: ${lead.phones.map((p) => p.phone).join(', ')}`,
        );
        return {
          status: 'verification_failed',
          message: 'Phone number does not match our records.',
          action:
            'Voice AI should ask for name + appointment date for manual verification',
        };
      }

      this.logger.log(
        `[Tool] Phone verification passed for lead ${dto.lead_id}`,
      );

      // Step 2: Find active appointments for this lead
      const activeAppointments = await this.prisma.appointment.findMany({
        where: {
          tenant_id: tenantId,
          lead_id: dto.lead_id,
          status: {
            in: ['scheduled', 'confirmed'],
          },
        },
        include: {
          appointment_type: {
            select: {
              id: true,
              name: true,
              slot_duration_minutes: true,
              max_lookahead_weeks: true,
            },
          },
        },
        orderBy: {
          start_datetime_utc: 'asc',
        },
      });

      if (activeAppointments.length === 0) {
        this.logger.log(
          `[Tool] No active appointments found for lead ${dto.lead_id}`,
        );
        return {
          status: 'no_appointment_found',
          message: 'No active appointments found for this lead.',
          action: 'Voice AI should offer to book a new appointment',
        };
      }

      // MODE DETECTION: Confirm mode vs Initial mode
      const isConfirmMode = !!(
        dto.appointment_id &&
        dto.new_date &&
        dto.new_time
      );

      if (isConfirmMode) {
        // ========== CONFIRM MODE: Execute reschedule ==========
        this.logger.log(
          `[Tool] CONFIRM MODE: Rescheduling appointment ${dto.appointment_id} to ${dto.new_date} at ${dto.new_time}`,
        );

        // Verify the appointment_id belongs to this lead
        const appointmentToReschedule = activeAppointments.find(
          (apt) => apt.id === dto.appointment_id,
        );

        if (!appointmentToReschedule) {
          this.logger.error(
            `[Tool] Appointment ${dto.appointment_id} not found in active appointments for lead ${dto.lead_id}`,
          );
          return {
            status: 'error',
            error: 'Appointment not found or cannot be rescheduled',
          };
        }

        // Execute reschedule using AppointmentLifecycleService
        const result =
          await this.appointmentLifecycleService.rescheduleAppointment(
            tenantId,
            dto.appointment_id!, // Non-null assertion: validated in CONFIRM MODE check
            null, // Voice AI is system actor (no userId)
            {
              new_scheduled_date: dto.new_date!,
              new_start_time: dto.new_time!,
              reason: dto.reason,
            },
          );

        this.logger.log(
          `[Tool] Appointment rescheduled successfully. New appointment: ${result.newAppointment.id}`,
        );

        // Human-readable date/time for voice
        const reschDate = new Date(dto.new_date! + 'T12:00:00');
        const reschDayName = reschDate.toLocaleDateString('en-US', { weekday: 'long' });
        const reschTimeDisplay = this.formatTimeForVoice(dto.new_time!);

        return {
          status: 'rescheduled',
          new_appointment_id: result.newAppointment.id,
          old_appointment_id: dto.appointment_id!,
          message: `Your appointment has been rescheduled to ${reschDayName} at ${reschTimeDisplay}`,
          confirmation_sent: true,
        };
      } else {
        // ========== INITIAL MODE: Return appointments + available slots ==========
        this.logger.log(
          `[Tool] INITIAL MODE: Returning active appointments and available slots`,
        );

        // If multiple appointments, ask caller to choose one
        if (activeAppointments.length > 1) {
          return {
            status: 'multiple_appointments',
            appointments: activeAppointments.map((apt) => ({
              id: apt.id,
              date: apt.scheduled_date,
              time: apt.start_time,
              type: apt.appointment_type.name,
            })),
            message:
              'You have multiple appointments. Which one would you like to reschedule?',
            action:
              'Voice AI should read appointments and ask caller to choose one',
          };
        }

        // Single appointment - return current appointment + available slots
        const currentAppointment = activeAppointments[0];
        const appointmentType = currentAppointment.appointment_type;

        this.logger.log(
          `[Tool] Current appointment: ${currentAppointment.scheduled_date} at ${currentAppointment.start_time}`,
        );

        // Get available slots for next 14 days (expand to max_lookahead_weeks if needed)
        const today = new Date();
        const searchStartDate = today;
        const initialSearchEnd = addDays(searchStartDate, 14);
        const dateFrom = format(searchStartDate, 'yyyy-MM-dd');
        const dateTo = format(initialSearchEnd, 'yyyy-MM-dd');

        this.logger.log(`[Tool] Searching slots from ${dateFrom} to ${dateTo}`);

        let slotsResult = await this.slotCalculationService.getAvailableSlots(
          tenantId,
          appointmentType.id,
          dateFrom,
          dateTo,
        );

        // If no slots in initial 14 days, expand to max_lookahead_weeks
        if (slotsResult.total_available_slots === 0) {
          this.logger.log(
            `[Tool] No slots in 14 days, expanding to ${appointmentType.max_lookahead_weeks} weeks`,
          );
          const expandedSearchEnd = addDays(
            searchStartDate,
            appointmentType.max_lookahead_weeks * 7,
          );
          const expandedDateTo = format(expandedSearchEnd, 'yyyy-MM-dd');

          slotsResult = await this.slotCalculationService.getAvailableSlots(
            tenantId,
            appointmentType.id,
            dateFrom,
            expandedDateTo,
          );
        }

        if (slotsResult.total_available_slots === 0) {
          this.logger.warn(`[Tool] No availability for rescheduling`);
          return {
            status: 'error',
            error: 'No available slots found for rescheduling',
          };
        }

        // Flatten and add display times for voice readability
        const flatSlots = slotsResult.available_dates.flatMap((dateEntry) =>
          dateEntry.slots.map((slot) => ({
            date: dateEntry.date,
            day_name: dateEntry.day_name,
            start_time: slot.start_time,
            end_time: slot.end_time,
            start_time_display: this.formatTimeForVoice(slot.start_time),
            end_time_display: this.formatTimeForVoice(slot.end_time),
          })),
        );

        // Get day name for current appointment date
        const currentDate = new Date(currentAppointment.scheduled_date + 'T12:00:00');
        const currentDayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

        return {
          status: 'slots_available',
          current_appointment: {
            id: currentAppointment.id,
            date: currentAppointment.scheduled_date,
            day_name: currentDayName,
            time: currentAppointment.start_time,
            time_display: this.formatTimeForVoice(currentAppointment.start_time),
            type: appointmentType.name,
          },
          available_slots: flatSlots,
          message: `Your current appointment is on ${currentDayName} at ${this.formatTimeForVoice(currentAppointment.start_time)}. Here are the available times to reschedule.`,
          action:
            'Voice AI should present slots conversationally using day_name and start_time_display fields',
        };
      }
    } catch (error) {
      this.logger.error(
        `[Tool] Error rescheduling appointment: ${error.message}`,
        error.stack,
      );
      return {
        status: 'error',
        error: error.message || 'Could not reschedule appointment',
      };
    }
  }

  /**
   * Tool: Cancel Appointment — Sprint 19 (voice_ai_reschedule_cancel)
   *
   * Cancels an existing appointment with identity verification.
   * Two modes of operation:
   * 1. INITIAL MODE: Only call_log_id + lead_id provided
   *    - Verifies caller phone matches lead phone
   *    - Returns active appointments
   *    - If multiple appointments, asks caller to choose one
   *
   * 2. CONFIRM MODE: call_log_id + lead_id + appointment_id + reason provided
   *    - Executes the cancellation
   *    - Returns cancellation confirmation
   *
   * CRITICAL:
   *   - Identity verification: caller phone from call_log must match lead phone
   *   - Enforces tenant_id isolation
   *   - Only appointments with status 'scheduled' or 'confirmed' can be cancelled
   *   - userId is null (Voice AI is system actor)
   *
   * @param tenantId UUID of the tenant
   * @param dto CancelAppointmentToolDto with cancellation parameters
   * @returns CancelAppointmentToolResponseDto with verification/confirmation
   */
  async toolCancelAppointment(
    tenantId: string,
    dto: CancelAppointmentToolDto,
  ): Promise<CancelAppointmentToolResponseDto> {
    this.logger.log(
      `[Tool] Cancelling appointment for tenant: ${tenantId}, lead: ${dto.lead_id}`,
    );

    try {
      // Step 1: Verify caller identity (phone match)
      const callLog = await this.prisma.voice_call_log.findFirst({
        where: {
          id: dto.call_log_id,
          tenant_id: tenantId,
        },
        select: {
          from_number: true,
        },
      });

      if (!callLog) {
        this.logger.error(
          `[Tool] Call log ${dto.call_log_id} not found for tenant ${tenantId}`,
        );
        return {
          status: 'error',
          error: 'Call log not found',
        };
      }

      // Get lead and verify phone match
      const phoneVariations = generatePhoneVariations(callLog.from_number);
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: dto.lead_id,
          tenant_id: tenantId,
        },
        include: {
          phones: true,
        },
      });

      if (!lead) {
        this.logger.error(
          `[Tool] Lead ${dto.lead_id} not found for tenant ${tenantId}`,
        );
        return {
          status: 'error',
          error: 'Lead not found',
        };
      }

      // Verify phone number matches
      const phoneMatch = lead.phones.some((phone) =>
        phoneVariations.includes(phone.phone),
      );

      if (!phoneMatch) {
        this.logger.warn(
          `[Tool] Phone verification failed for lead ${dto.lead_id}. Caller: ${callLog.from_number}, Lead phones: ${lead.phones.map((p) => p.phone).join(', ')}`,
        );
        return {
          status: 'verification_failed',
          message: 'Phone number does not match our records.',
          action:
            'Voice AI should ask for name + appointment date for manual verification',
        };
      }

      this.logger.log(
        `[Tool] Phone verification passed for lead ${dto.lead_id}`,
      );

      // Step 2: Find active appointments for this lead
      const activeAppointments = await this.prisma.appointment.findMany({
        where: {
          tenant_id: tenantId,
          lead_id: dto.lead_id,
          status: {
            in: ['scheduled', 'confirmed'],
          },
        },
        include: {
          appointment_type: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          start_datetime_utc: 'asc',
        },
      });

      if (activeAppointments.length === 0) {
        this.logger.log(
          `[Tool] No active appointments found for lead ${dto.lead_id}`,
        );
        return {
          status: 'no_appointment_found',
          message: 'No active appointments found for this lead.',
          action:
            'Voice AI should inform caller and offer to book a new appointment',
        };
      }

      // MODE DETECTION: Confirm mode vs Initial mode
      const isConfirmMode = !!dto.appointment_id;

      if (isConfirmMode) {
        // ========== CONFIRM MODE: Execute cancellation ==========
        this.logger.log(
          `[Tool] CONFIRM MODE: Cancelling appointment ${dto.appointment_id}`,
        );

        // Verify the appointment_id belongs to this lead
        const appointmentToCancel = activeAppointments.find(
          (apt) => apt.id === dto.appointment_id,
        );

        if (!appointmentToCancel) {
          this.logger.error(
            `[Tool] Appointment ${dto.appointment_id} not found in active appointments for lead ${dto.lead_id}`,
          );
          return {
            status: 'error',
            error: 'Appointment not found or cannot be cancelled',
          };
        }

        // Execute cancellation using AppointmentLifecycleService
        const cancellationReason = dto.reason || 'customer_cancelled';
        await this.appointmentLifecycleService.cancelAppointment(
          tenantId,
          dto.appointment_id!, // Non-null assertion: validated in CONFIRM MODE check
          null, // Voice AI is system actor (no userId)
          {
            cancellation_reason: cancellationReason as any,
            cancellation_notes: undefined,
          },
        );

        this.logger.log(
          `[Tool] Appointment cancelled successfully: ${dto.appointment_id!}`,
        );

        return {
          status: 'cancelled',
          appointment_id: dto.appointment_id,
          appointment_date: appointmentToCancel.scheduled_date,
          appointment_time: appointmentToCancel.start_time,
          cancellation_reason: cancellationReason,
          message: `Your appointment on ${appointmentToCancel.scheduled_date} at ${appointmentToCancel.start_time} has been cancelled.`,
          confirmation_sent: true,
        };
      } else {
        // ========== INITIAL MODE: Return active appointments ==========
        this.logger.log(`[Tool] INITIAL MODE: Returning active appointments`);

        // If multiple appointments, ask caller to choose one
        if (activeAppointments.length > 1) {
          return {
            status: 'multiple_appointments',
            appointments: activeAppointments.map((apt) => ({
              id: apt.id,
              date: apt.scheduled_date,
              time: apt.start_time,
              type: apt.appointment_type.name,
            })),
            message:
              'You have multiple appointments. Which one would you like to cancel?',
            action:
              'Voice AI should read appointments and ask caller to choose one',
          };
        }

        // Single appointment - confirm cancellation
        const appointment = activeAppointments[0];
        return {
          status: 'multiple_appointments', // Reuse same status to trigger confirmation flow
          appointments: [
            {
              id: appointment.id,
              date: appointment.scheduled_date,
              time: appointment.start_time,
              type: appointment.appointment_type.name,
            },
          ],
          message: `I found your appointment on ${appointment.scheduled_date} at ${appointment.start_time}. Would you like to cancel this appointment?`,
          action: 'Voice AI should confirm cancellation before proceeding',
        };
      }
    } catch (error) {
      this.logger.error(
        `[Tool] Error cancelling appointment: ${error.message}`,
        error.stack,
      );
      return {
        status: 'error',
        error: error.message || 'Could not cancel appointment',
      };
    }
  }

  /**
   * Find Lead by Phone Number — Sprint 4 (agent_sprint_fixes_feb27_4)
   *
   * Looks up a lead by phone number BEFORE the first LLM interaction.
   * This allows the agent to personalize the greeting for returning callers.
   *
   * CRITICAL SECURITY REQUIREMENT:
   *   - MUST filter by BOTH phone_number AND tenant_id
   *   - This prevents cross-tenant data leakage
   *
   * @param tenantId UUID of the tenant
   * @param phoneNumber Phone number in E.164 format (+1XXXXXXXXXX)
   * @returns FindLeadByPhoneResponseDto with found status and lead info
   */
  async findLeadByPhone(
    tenantId: string,
    phoneNumber: string,
  ): Promise<FindLeadByPhoneResponseDto> {
    this.logger.log(
      `🔍 Looking up lead for phone: ${phoneNumber}, tenant: ${tenantId}`,
    );

    try {
      // Generate all possible phone number variations for lookup
      const phoneVariations = generatePhoneVariations(phoneNumber);
      this.logger.log(
        `🔍 Checking phone variations: ${phoneVariations.join(', ')}`,
      );

      // Query lead_phone table with CRITICAL tenant isolation
      // Uses OR to check all variations, AND to enforce tenant isolation
      const leadPhone = await this.prisma.lead_phone.findFirst({
        where: {
          AND: [
            {
              // CRITICAL: Try all phone variations with OR
              OR: phoneVariations.map((variant) => ({
                phone: variant, // Exact match (not contains)
              })),
            },
            {
              // CRITICAL: Tenant isolation MUST be in AND clause
              lead: { tenant_id: tenantId },
            },
          ],
        },
        include: {
          lead: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              status: true,
              emails: {
                where: { is_primary: true },
                take: 1,
                select: { email: true },
              },
              notes: {
                where: { is_pinned: true },
                orderBy: { created_at: 'desc' },
                take: 1,
                select: { note_text: true },
              },
              voice_call_logs: {
                where: { status: 'completed' },
                orderBy: { ended_at: 'desc' },
                take: 1,
                select: { ended_at: true },
              },
              call_records: {
                orderBy: { created_at: 'desc' },
                select: { id: true },
              },
            },
          },
        },
      });

      if (!leadPhone?.lead) {
        this.logger.log(
          `ℹ️  No lead found for phone ${phoneNumber} (tried: ${phoneVariations.join(', ')})`,
        );
        return { found: false, lead: null };
      }

      const lead = leadPhone.lead;
      const fullName = `${lead.first_name} ${lead.last_name}`;

      // Calculate total contacts (voice calls + other call records)
      const voiceCallCount = lead.voice_call_logs?.length || 0;
      const otherCallCount = lead.call_records?.length || 0;
      const totalContacts = voiceCallCount + otherCallCount;

      // Get last contact date from most recent voice call
      const lastContactDate = lead.voice_call_logs?.[0]?.ended_at || null;

      // Get primary email
      const primaryEmail = lead.emails?.[0]?.email || null;

      // Get most recent pinned note
      const pinnedNote = lead.notes?.[0]?.note_text || null;

      this.logger.log(`✅ Known caller detected: ${fullName} (${lead.id})`);
      this.logger.log(`  - Status: ${lead.status}`);
      this.logger.log(`  - Total contacts: ${totalContacts}`);
      this.logger.log(
        `  - Last contact: ${lastContactDate ? new Date(lastContactDate).toLocaleDateString() : 'N/A'}`,
      );

      return {
        found: true,
        lead: {
          id: lead.id,
          first_name: lead.first_name,
          last_name: lead.last_name,
          full_name: fullName,
          email: primaryEmail,
          phone_number: phoneNumber,
          status: lead.status,
          last_contact_date: lastContactDate,
          total_contacts: totalContacts,
          notes: pinnedNote,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Error finding lead by phone: ${error.message}`,
        error.stack,
      );
      // Fail gracefully - return not found instead of throwing
      // This prevents the call from crashing if lead lookup fails
      return { found: false, lead: null };
    }
  }

  /**
   * Convert 24-hour time (HH:MM) to human-readable 12-hour format for voice.
   * Examples: "09:00" → "9 AM", "14:30" → "2:30 PM", "12:00" → "12 PM"
   */
  private formatTimeForVoice(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'P.M' : 'A.M';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }
}
