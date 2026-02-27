import { Injectable, Logger } from '@nestjs/common';
import {
  VoiceAiContextBuilderService,
  FullVoiceAiContext,
} from './voice-ai-context-builder.service';
import { VoiceCallLogService } from './voice-call-log.service';
import { UsageRecordData } from './voice-usage.service';
import { VoiceTransferNumbersService } from './voice-transfer-numbers.service';
import { StartCallDto } from '../dto/start-call.dto';
import { CompleteCallDto } from '../dto/complete-call.dto';
import { LookupTenantResponseDto } from '../dto/internal/lookup-tenant.dto';
import { CreateLeadToolDto, CreateLeadToolResponseDto } from '../dto/internal/tool-create-lead.dto';
import { FindLeadToolDto, FindLeadToolResponseDto } from '../dto/internal/tool-find-lead.dto';
import { CheckServiceAreaToolDto, CheckServiceAreaToolResponseDto } from '../dto/internal/tool-check-service-area.dto';
import { TransferCallToolDto, TransferCallToolResponseDto } from '../dto/internal/tool-transfer-call.dto';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadsService } from '../../leads/services/leads.service';

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
   * Full context fetch — API-022
   *
   * Called once per call after routing to the agent.
   * Returns the complete FullVoiceAiContext with decrypted provider credentials.
   *
   * SECURITY: The returned object contains decrypted API keys.
   *   This response must NEVER be cached, stored, or logged by the agent.
   *
   * @param tenantId  UUID of the tenant — sourced from call routing params
   * @throws NotFoundException if tenant does not exist
   */
  async getContext(tenantId: string): Promise<FullVoiceAiContext> {
    return this.contextBuilder.buildContext(tenantId);
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
  async lookupTenantByPhoneNumber(phoneNumber: string): Promise<LookupTenantResponseDto> {
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
        this.logger.log(`Tenant found: ${smsConfig.tenant.company_name} (${smsConfig.tenant.id})`);
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
      this.logger.error(`Error looking up tenant by phone: ${error.message}`, error.stack);
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
  async toolCreateLead(tenantId: string, dto: CreateLeadToolDto): Promise<CreateLeadToolResponseDto> {
    this.logger.log(`[Tool] Creating lead for tenant: ${tenantId}`);

    try {
      // Build CreateLeadDto matching the exact structure from leads module
      const createLeadDto = {
        first_name: dto.first_name,
        last_name: dto.last_name,
        source: 'phone_call',
        language_spoken: dto.language ? dto.language.toUpperCase() : 'EN',
        accept_sms: false,
        preferred_communication: 'phone',
        phones: [{
          phone: dto.phone_number,
          phone_type: 'mobile',
          is_primary: true,
        }],
        emails: dto.email ? [{
          email: dto.email,
          email_type: 'personal',
          is_primary: true,
        }] : [],
        addresses: [{
          address_line1: dto.address,
          city: dto.city,
          state: dto.state,
          zip_code: dto.zip_code,
          country: 'US',
          address_type: 'service',
          is_primary: true,
        }],
        service_request: dto.service_description ? {
          service_name: 'Voice AI Call',
          service_description: dto.service_description,
          urgency: 'medium',
        } : undefined,
      };

      // Call LeadsService.create() with tenant_id and null userId (system action)
      const lead = await this.leadsService.create(tenantId, null, createLeadDto as any);

      return {
        success: true,
        lead_id: lead.id,
        message: `Lead created for ${dto.first_name} ${dto.last_name}`,
      };
    } catch (error) {
      this.logger.error(`[Tool] Error creating lead: ${error.message}`, error.stack);
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
  async toolFindLead(tenantId: string, dto: FindLeadToolDto): Promise<FindLeadToolResponseDto> {
    this.logger.log(`[Tool] Finding lead for phone: ${dto.phone_number}`);

    try {
      // Sanitize phone number to match database format (digits only)
      const sanitizedPhone = dto.phone_number.replace(/\D/g, '');

      // Query lead_phone table with tenant isolation
      const leadPhone = await this.prisma.lead_phone.findFirst({
        where: {
          phone: { contains: sanitizedPhone },
          lead: { tenant_id: tenantId },  // CRITICAL: Tenant isolation
        },
        include: {
          lead: {
            select: { id: true, first_name: true, last_name: true, status: true },
          },
        },
      });

      if (!leadPhone?.lead) {
        return {
          success: true,
          found: false,
        };
      }

      return {
        success: true,
        found: true,
        lead_id: leadPhone.lead.id,
        lead_name: `${leadPhone.lead.first_name} ${leadPhone.lead.last_name}`,
      };
    } catch (error) {
      this.logger.error(`[Tool] Error finding lead: ${error.message}`, error.stack);
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
  async toolCheckServiceArea(tenantId: string, dto: CheckServiceAreaToolDto): Promise<CheckServiceAreaToolResponseDto> {
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
      this.logger.error(`[Tool] Error checking service area: ${error.message}`, error.stack);
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
  async toolTransferCall(tenantId: string, dto: TransferCallToolDto): Promise<TransferCallToolResponseDto> {
    this.logger.log(`[Tool] Getting transfer number, reason: ${dto.reason}`);

    try {
      // Get all transfer numbers for this tenant
      const numbers = await this.transferNumbersService.findAll(tenantId);

      // Find default number, or use first available
      const defaultNumber = numbers.find(n => n.is_default) || numbers[0];

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
      this.logger.error(`[Tool] Error getting transfer number: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message || 'Could not retrieve transfer number',
      };
    }
  }
}
