import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/public.decorator';
import { VoiceAgentKeyGuard } from '../../guards/voice-agent-key.guard';
import { VoiceAiInternalService } from '../../services/voice-ai-internal.service';
import { StartCallDto } from '../../dto/start-call.dto';
import { CompleteCallDto } from '../../dto/complete-call.dto';
import { LookupTenantDto, LookupTenantResponseDto } from '../../dto/internal/lookup-tenant.dto';
import { CreateLeadToolDto, CreateLeadToolResponseDto } from '../../dto/internal/tool-create-lead.dto';
import { FindLeadToolDto, FindLeadToolResponseDto } from '../../dto/internal/tool-find-lead.dto';
import { CheckServiceAreaToolDto, CheckServiceAreaToolResponseDto } from '../../dto/internal/tool-check-service-area.dto';
import { TransferCallToolDto, TransferCallToolResponseDto } from '../../dto/internal/tool-transfer-call.dto';
import { FindLeadByPhoneDto, FindLeadByPhoneResponseDto } from '../../dto/internal/find-lead-by-phone.dto';

/**
 * VoiceAiInternalController — Sprint B06a + B06b + VAB-05
 *
 * Internal endpoints consumed exclusively by the voice agent.
 * These routes bypass the global JwtAuthGuard (@Public()) and use
 * VoiceAgentKeyGuard instead, which validates the X-Voice-Agent-Key header.
 *
 * Route prefix: /api/v1/internal/voice-ai/
 *
 * Auth: X-Voice-Agent-Key header (NOT JWT).
 *   @Public() at class level skips the global JwtAuthGuard.
 *   @UseGuards(VoiceAgentKeyGuard) provides authentication.
 *
 * Sprint B06a endpoints (context/access):
 *   GET  /tenant/:tenantId/access   — pre-flight quota check
 *   GET  /tenant/:tenantId/context  — full merged context with decrypted keys
 *
 * Sprint B06b endpoints (call lifecycle):
 *   POST /calls/start               — create call log at call start
 *   POST /calls/:callSid/complete   — finalise call log + persist usage records
 *
 * Sprint VAB-05 endpoints (agent tools):
 *   POST /tenant/:tenantId/tools/create_lead         — create lead from call info
 *   POST /tenant/:tenantId/tools/find_lead           — find existing lead by phone
 *   POST /tenant/:tenantId/tools/check_service_area  — verify service area coverage
 *   POST /tenant/:tenantId/tools/transfer_call       — get transfer number for handoff
 */
@ApiTags('Internal — Voice Agent')
@ApiHeader({
  name: 'X-Voice-Agent-Key',
  description: 'Secret key issued by platform admin for Python voice agent authentication',
  required: true,
})
@Public()
@Controller('internal/voice-ai')
@UseGuards(VoiceAgentKeyGuard)
export class VoiceAiInternalController {
  constructor(private readonly internalService: VoiceAiInternalService) {}

  // ---------------------------------------------------------------------------
  // Sprint VAB-01 — Tenant Lookup
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/internal/voice-ai/lookup-tenant
   *
   * Looks up a tenant by their Twilio phone number.
   * Used by the agent to identify which tenant a call belongs to.
   *
   * The agent receives the Twilio number from LiveKit SIP participant
   * attributes (sip.trunkPhoneNumber) and needs to map it to a tenant.
   *
   * Response:
   *   { found: true, tenant_id: "uuid", tenant_name: "Business Name", phone_number: "+1..." }
   *   { found: false, phone_number: "+1..." }
   *   { found: false, error: "..." }
   */
  @Post('lookup-tenant')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Look up tenant by Twilio phone number',
    description:
      'Called by the agent to identify which tenant owns a Twilio phone number. ' +
      'The agent receives this number from LiveKit SIP participant attributes.',
  })
  @ApiBody({ type: LookupTenantDto })
  @ApiResponse({
    status: 200,
    description: 'Lookup result (found or not found)',
    type: LookupTenantResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  async lookupTenant(@Body() dto: LookupTenantDto): Promise<LookupTenantResponseDto> {
    return this.internalService.lookupTenantByPhoneNumber(dto.phone_number);
  }

  // ---------------------------------------------------------------------------
  // Sprint B06a — Context & Access
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/internal/voice-ai/tenant/:tenantId/access — API-026
   *
   * Pre-flight check before the agent accepts a call job.
   * Returns whether the tenant is enabled and has quota remaining.
   * Cheap operation — does NOT decrypt provider credentials.
   *
   * Response shape:
   *   { has_access: true,  minutes_remaining: 453, overage_rate: null }
   *   { has_access: false, reason: 'quota_exceeded', minutes_remaining: 0, overage_rate: null }
   *   { has_access: false, reason: 'not_enabled' }
   *   { has_access: false, reason: 'tenant_not_found' }
   */
  @Get('tenant/:tenantId/access')
  @ApiOperation({
    summary: 'Pre-flight access check',
    description:
      'Called by the Python agent BEFORE accepting a call. Checks whether Voice AI is ' +
      'enabled for the tenant and whether the tenant has remaining quota. ' +
      'Returns has_access: false with a reason string when the agent should reject the call.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiResponse({
    status: 200,
    description: 'Access check result',
    schema: {
      type: 'object',
      properties: {
        has_access: { type: 'boolean' },
        reason: {
          type: 'string',
          enum: ['tenant_not_found', 'not_enabled', 'quota_exceeded'],
          nullable: true,
        },
        minutes_remaining: { type: 'number', nullable: true },
        overage_rate: { type: 'number', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  checkAccess(@Param('tenantId') tenantId: string) {
    return this.internalService.checkAccess(tenantId);
  }

  /**
   * GET /api/v1/internal/voice-ai/tenant/:tenantId/context — API-022
   *
   * Returns the complete FullVoiceAiContext for the tenant.
   * Called once per call after routing to the agent room.
   * Includes decrypted provider credentials (STT, LLM, TTS API keys).
   *
   * SECURITY: Response contains plaintext API keys.
   *   The agent MUST NOT cache, log, or persist this response.
   */
  @Get('tenant/:tenantId/context')
  @ApiOperation({
    summary: 'Get full voice AI context',
    description:
      'Returns the complete merged context for the tenant including decrypted provider credentials. ' +
      'Called once per call after routing. ' +
      'SECURITY: Response contains plaintext API keys — do not cache or log.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiResponse({
    status: 200,
    description: 'Full FullVoiceAiContext object with decrypted keys',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getContext(@Param('tenantId') tenantId: string) {
    return this.internalService.getContext(tenantId);
  }

  // ---------------------------------------------------------------------------
  // Sprint B06b — Call Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/internal/voice-ai/calls/start — API-024
   *
   * Creates a voice_call_log row with status='in_progress'.
   * Called by the Python agent once it has been dispatched to the LiveKit room,
   * BEFORE the audio stream begins.
   *
   * Idempotent on call_sid: if the agent retries (crash/restart), returns the
   * existing call_log_id instead of creating a duplicate.
   *
   * Response: { call_log_id: string }
   */
  @Post('calls/start')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Start a call — create voice_call_log row',
    description:
      'Called by the Python agent at the start of a call (before audio). ' +
      'Creates a voice_call_log with status=in_progress. ' +
      'Idempotent on call_sid — returns existing call_log_id on duplicate.',
  })
  @ApiBody({ type: StartCallDto })
  @ApiResponse({
    status: 201,
    description: 'Call log created',
    schema: {
      type: 'object',
      properties: {
        call_log_id: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  startCall(@Body() dto: StartCallDto): Promise<{ call_log_id: string }> {
    return this.internalService.startCall(dto);
  }

  /**
   * POST /api/v1/internal/voice-ai/calls/:callSid/complete — API-030
   *
   * Finalises the call log and persists per-provider usage records.
   * Called by the Python agent AFTER the call ends (audio stream closed).
   *
   * The :callSid path param is the authoritative identifier.
   * The call_sid in the body is accepted for confirmation but the path value is used.
   *
   * All DB writes (call log update + usage record creation) execute in a single transaction.
   *
   * Response: { success: true }
   */
  @Post('calls/:callSid/complete')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Complete a call — update log and persist usage records',
    description:
      'Called by the Python agent after the call ends. ' +
      'Updates call log status to completed and creates per-provider voice_usage_record rows. ' +
      'All writes are atomic (single transaction).',
  })
  @ApiParam({ name: 'callSid', description: 'Twilio CallSid', type: String })
  @ApiBody({ type: CompleteCallDto })
  @ApiResponse({
    status: 200,
    description: 'Call completed and usage records persisted',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  @ApiResponse({ status: 404, description: 'Call log not found for the given callSid' })
  async completeCall(
    @Param('callSid') callSid: string,
    @Body() dto: CompleteCallDto,
  ): Promise<{ success: true }> {
    await this.internalService.completeCall(callSid, dto);
    return { success: true };
  }

  /**
   * GET /api/v1/internal/voice-ai/calls/:callSid/status
   *
   * Returns the current status of a call log.
   * Used for verification/debugging purposes - allows the agent to check
   * if a call completion request was successful.
   *
   * Response: { status: string, ended_at: Date | null }
   */
  @Get('calls/:callSid/status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get call status',
    description:
      'Returns the current status and ended_at timestamp of a call log. ' +
      'Used for verification after completion attempts.',
  })
  @ApiParam({ name: 'callSid', description: 'Twilio CallSid', type: String })
  @ApiResponse({
    status: 200,
    description: 'Call status retrieved',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'completed' },
        ended_at: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  @ApiResponse({ status: 404, description: 'Call log not found for the given callSid' })
  async getCallStatus(
    @Param('callSid') callSid: string,
  ): Promise<{ status: string; ended_at: Date | null }> {
    return this.internalService.getCallStatus(callSid);
  }

  // ---------------------------------------------------------------------------
  // Sprint VAB-05 — Agent Tools
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/create_lead
   *
   * Creates a new lead from information collected during a voice call.
   * Called by the agent LLM tool when it decides to create a lead.
   *
   * Uses LeadsService to handle validation, phone uniqueness, and persistence.
   * The agent acts as a system user (userId = null).
   */
  @Post('tenant/:tenantId/tools/create_lead')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Tool: Create Lead',
    description:
      'Creates a new lead from call information. ' +
      'Called by the agent when the LLM decides to create a lead after collecting caller info.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiBody({ type: CreateLeadToolDto })
  @ApiResponse({
    status: 200,
    description: 'Lead creation result',
    type: CreateLeadToolResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  createLead(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateLeadToolDto,
  ): Promise<CreateLeadToolResponseDto> {
    return this.internalService.toolCreateLead(tenantId, dto);
  }

  /**
   * POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/find_lead
   *
   * Finds an existing lead by phone number.
   * Called by the agent LLM tool at the start of a conversation to check
   * if the caller is already in the system.
   */
  @Post('tenant/:tenantId/tools/find_lead')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Tool: Find Lead',
    description:
      'Finds an existing lead by phone number. ' +
      'Called by the agent at the start of a call to check if the caller is already a customer.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiBody({ type: FindLeadToolDto })
  @ApiResponse({
    status: 200,
    description: 'Lead search result',
    type: FindLeadToolResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  findLead(
    @Param('tenantId') tenantId: string,
    @Body() dto: FindLeadToolDto,
  ): Promise<FindLeadToolResponseDto> {
    return this.internalService.toolFindLead(tenantId, dto);
  }

  /**
   * POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/check_service_area
   *
   * Checks if a location is within the tenant's service area.
   * Called by the agent LLM tool before creating a lead to verify coverage.
   */
  @Post('tenant/:tenantId/tools/check_service_area')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Tool: Check Service Area',
    description:
      'Checks if a location (ZIP, city, state) is within the service area. ' +
      'Called by the agent before creating a lead to confirm coverage.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiBody({ type: CheckServiceAreaToolDto })
  @ApiResponse({
    status: 200,
    description: 'Service area check result',
    type: CheckServiceAreaToolResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  checkServiceArea(
    @Param('tenantId') tenantId: string,
    @Body() dto: CheckServiceAreaToolDto,
  ): Promise<CheckServiceAreaToolResponseDto> {
    return this.internalService.toolCheckServiceArea(tenantId, dto);
  }

  /**
   * POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/transfer_call
   *
   * Gets the transfer number for call handoff to a human agent.
   * Called by the agent LLM tool when the caller requests to speak with a person.
   */
  @Post('tenant/:tenantId/tools/transfer_call')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Tool: Transfer Call',
    description:
      'Gets the transfer number for call handoff to a human. ' +
      'Called by the agent when the caller requests to speak with a person or for complex issues.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiBody({ type: TransferCallToolDto })
  @ApiResponse({
    status: 200,
    description: 'Transfer call result',
    type: TransferCallToolResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  transferCall(
    @Param('tenantId') tenantId: string,
    @Body() dto: TransferCallToolDto,
  ): Promise<TransferCallToolResponseDto> {
    return this.internalService.toolTransferCall(tenantId, dto);
  }

  // ---------------------------------------------------------------------------
  // Sprint 4 — Lead Context for First Interaction (agent_sprint_fixes_feb27_4)
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/internal/voice-ai/leads/find-by-phone
   *
   * Looks up a lead by phone number and tenant ID BEFORE the first LLM interaction.
   * This allows the agent to personalize the greeting for returning callers.
   *
   * CRITICAL SECURITY REQUIREMENT:
   *   - MUST filter by BOTH phone_number AND tenant_id
   *   - This prevents cross-tenant data leakage
   *
   * Response:
   *   { found: true, lead: { id, first_name, last_name, ... } }
   *   { found: false, lead: null }
   */
  @Post('leads/find-by-phone')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Find lead by phone number for call context',
    description:
      'Called by the agent BEFORE the first LLM interaction to check if the caller is a known lead. ' +
      'Returns lead details if found, allowing the agent to personalize the greeting. ' +
      'CRITICAL: Enforces tenant_id filtering to prevent cross-tenant data leakage.',
  })
  @ApiBody({ type: FindLeadByPhoneDto })
  @ApiResponse({
    status: 200,
    description: 'Lead lookup result (found or not found)',
    type: FindLeadByPhoneResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  findLeadByPhone(@Body() dto: FindLeadByPhoneDto): Promise<FindLeadByPhoneResponseDto> {
    return this.internalService.findLeadByPhone(dto.tenant_id, dto.phone_number);
  }
}
