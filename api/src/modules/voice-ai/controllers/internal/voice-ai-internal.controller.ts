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
import { VoiceAiToolsService } from '../../services/voice-ai-tools.service';
import { StartCallDto } from '../../dto/start-call.dto';
import { CompleteCallDto } from '../../dto/complete-call.dto';
import { ToolCreateLeadDto } from '../../dto/tool-create-lead.dto';
import { ToolCheckAvailabilityDto } from '../../dto/tool-check-availability.dto';
import { ToolBookAppointmentDto } from '../../dto/tool-book-appointment.dto';
import { ToolTransferCallDto } from '../../dto/tool-transfer-call.dto';

/**
 * VoiceAiInternalController — Sprint B06a + B06b
 *
 * Internal endpoints consumed exclusively by the Python voice agent.
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
 * Sprint B06c endpoints (tool dispatch):
 *   POST /tenant/:tenantId/tools/create_lead
 *   POST /tenant/:tenantId/tools/check_availability
 *   POST /tenant/:tenantId/tools/book_appointment
 *   POST /tenant/:tenantId/tools/transfer_call
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
  constructor(
    private readonly internalService: VoiceAiInternalService,
    private readonly toolsService: VoiceAiToolsService,
  ) {}

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

  // ---------------------------------------------------------------------------
  // Sprint B06c — Tool Dispatch
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/create_lead
   *
   * Find or create a CRM lead for the caller's phone number.
   * Always returns HTTP 200 with { lead_id, created: bool }.
   * The agent checks the `created` field to distinguish new vs existing leads.
   */
  @Post('tenant/:tenantId/tools/create_lead')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create or find a CRM lead for the caller',
    description:
      'Called by the Python agent after collecting the caller phone number and optional details. ' +
      'Searches for an existing lead by phone number within the tenant. ' +
      'Always returns 200 — the `created` boolean distinguishes new vs existing leads.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiBody({ type: ToolCreateLeadDto })
  @ApiResponse({
    status: 200,
    description: 'Lead found or created',
    schema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', format: 'uuid' },
        created: { type: 'boolean', description: 'true = new lead, false = existing lead' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  @ApiResponse({ status: 404, description: 'No address available for tenant' })
  createLead(
    @Param('tenantId') tenantId: string,
    @Body() dto: ToolCreateLeadDto,
  ) {
    return this.toolsService.createLead(tenantId, dto);
  }

  /**
   * POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/check_availability
   *
   * Return 3 mocked appointment slots for the requested service and preferred date.
   * The real appointment scheduling module is a future sprint — slots are deterministic
   * based on the preferred_date and business-day calculation.
   */
  @Post('tenant/:tenantId/tools/check_availability')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Check appointment availability (mocked)',
    description:
      'Returns 3 deterministic appointment slots relative to the preferred_date. ' +
      'slot_1 is at 09:00 on the base date, slot_2 is the next business day at 13:00, ' +
      'slot_3 is the following business day at 16:00. ' +
      'NOTE: Availability is mocked — real scheduling is a future sprint.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiBody({ type: ToolCheckAvailabilityDto })
  @ApiResponse({
    status: 200,
    description: '3 availability slots',
    schema: {
      type: 'object',
      properties: {
        slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              slot_id: { type: 'string', enum: ['slot_1', 'slot_2', 'slot_3'] },
              date: { type: 'string', example: '2026-03-02' },
              time: { type: 'string', example: '09:00' },
              label: { type: 'string', example: 'Mon Mar 2, 9:00 AM' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  checkAvailability(
    @Param('tenantId') _tenantId: string,
    @Body() dto: ToolCheckAvailabilityDto,
  ) {
    return this.toolsService.checkAvailability(dto);
  }

  /**
   * POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/book_appointment
   *
   * Book an appointment by creating a service_request record.
   * The slot_id + preferred_date reconstruct the actual appointment datetime.
   * Appointment date/time is stored in service_request.extra_data.
   */
  @Post('tenant/:tenantId/tools/book_appointment')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Book an appointment (creates service_request)',
    description:
      'Creates a service_request record representing a pending appointment. ' +
      'Reconstructs the appointment datetime from preferred_date + slot_id. ' +
      'slot_1=09:00, slot_2=+1 business day 13:00, slot_3=+2 business days 16:00. ' +
      'Appointment details are stored in service_request.extra_data.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiBody({ type: ToolBookAppointmentDto })
  @ApiResponse({
    status: 201,
    description: 'Appointment booked',
    schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'pending' },
        appointment_date: { type: 'string', example: '2026-03-02' },
        appointment_time: { type: 'string', example: '09:00' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  bookAppointment(
    @Param('tenantId') tenantId: string,
    @Body() dto: ToolBookAppointmentDto,
  ) {
    return this.toolsService.bookAppointment(tenantId, dto);
  }

  /**
   * POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/transfer_call
   *
   * Look up the phone number the agent should transfer the call to.
   * Uses the specified transfer_number_id, or the tenant's default transfer number.
   * Returns success=false with phone_number="" when no transfer number is configured.
   */
  @Post('tenant/:tenantId/tools/transfer_call')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get transfer phone number for call transfer',
    description:
      'Returns the phone number the Python agent should SIP-transfer the call to. ' +
      'Uses the specified transfer_number_id if provided, otherwise uses the tenant default. ' +
      'Returns success=false when no transfer number is configured.',
  })
  @ApiParam({ name: 'tenantId', description: 'UUID of the tenant', type: String })
  @ApiBody({ type: ToolTransferCallDto })
  @ApiResponse({
    status: 200,
    description: 'Transfer number lookup result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        phone_number: { type: 'string', example: '+15551234567' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Voice-Agent-Key' })
  transferCall(
    @Param('tenantId') tenantId: string,
    @Body() dto: ToolTransferCallDto,
  ) {
    return this.toolsService.transferCall(tenantId, dto);
  }
}
