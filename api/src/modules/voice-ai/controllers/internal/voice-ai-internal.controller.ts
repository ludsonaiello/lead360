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
 * Sprint B06c endpoints (tool dispatch) — added in next sprint.
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
}
