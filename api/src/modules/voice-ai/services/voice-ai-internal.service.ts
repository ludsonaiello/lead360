import { Injectable } from '@nestjs/common';
import {
  VoiceAiContextBuilderService,
  FullVoiceAiContext,
} from './voice-ai-context-builder.service';
import { VoiceCallLogService } from './voice-call-log.service';
import { UsageRecordData } from './voice-usage.service';
import { StartCallDto } from '../dto/start-call.dto';
import { CompleteCallDto } from '../dto/complete-call.dto';

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
 * VoiceAiInternalService — Sprint B06a + B06b
 *
 * Provides context, access-check, and call lifecycle logic for the Python voice agent.
 * These methods back the @Public() internal endpoints on /api/v1/internal/voice-ai/
 * authenticated exclusively via VoiceAgentKeyGuard (X-Voice-Agent-Key header).
 *
 * Sprint B06a: checkAccess() + getContext()
 * Sprint B06b: startCall() + completeCall()
 */
@Injectable()
export class VoiceAiInternalService {
  constructor(
    private readonly contextBuilder: VoiceAiContextBuilderService,
    private readonly callLogService: VoiceCallLogService,
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
      fromNumber: dto.from_number,
      toNumber: dto.to_number,
      direction: dto.direction ?? 'inbound',
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
      durationSeconds: dto.duration_seconds,
      outcome: dto.outcome,
      transcriptSummary: dto.transcript_summary,
      fullTranscript: dto.full_transcript,
      actionsTaken: dto.actions_taken,
      leadId: dto.lead_id,
      isOverage: dto.is_overage ?? false,
      usageRecords: dto.usage_records as UsageRecordData[] | undefined,
    });
  }
}
