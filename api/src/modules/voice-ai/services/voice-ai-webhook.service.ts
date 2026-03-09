import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { VoiceCallLogService } from './voice-call-log.service';
import {
  LiveKitWebhookEvent,
  LiveKitRoomMetadata,
  LIVEKIT_EVENTS,
} from '../interfaces/livekit-webhook.interface';

/**
 * VoiceAiWebhookService — Sprint B14
 *
 * Handles inbound LiveKit webhook events and provides a server-side safety net
 * to finalise call records when the Python agent crashes before calling
 * POST /api/v1/internal/voice-ai/calls/:callSid/complete.
 *
 * Event handling:
 *   room_started      → Creates voice_call_log if agent never called /calls/start
 *   room_finished     → Finalises voice_call_log if still in_progress (agent crash fallback)
 *   participant_left  → No-op (logged for debugging only)
 *   participant_joined → No-op (ignored)
 *
 * Idempotency:
 *   - room_started:   skips creation if call_sid already exists
 *   - room_finished:  only updates if status is still 'in_progress'
 */
@Injectable()
export class VoiceAiWebhookService {
  private readonly logger = new Logger(VoiceAiWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly callLogService: VoiceCallLogService,
  ) {}

  /**
   * Dispatch an incoming LiveKit webhook event to the appropriate handler.
   */
  async handleEvent(event: LiveKitWebhookEvent): Promise<void> {
    switch (event.event) {
      case LIVEKIT_EVENTS.ROOM_STARTED:
        await this.handleRoomStarted(event);
        break;

      case LIVEKIT_EVENTS.ROOM_FINISHED:
        await this.handleRoomFinished(event);
        break;

      case LIVEKIT_EVENTS.PARTICIPANT_LEFT:
        this.handleParticipantLeft(event);
        break;

      default:
        this.logger.debug(
          `Unhandled LiveKit event: ${event.event} (id=${event.id})`,
        );
    }
  }

  // ─── Event Handlers ──────────────────────────────────────────────────────────

  /**
   * room_started — safety net for agent crash before /calls/start.
   *
   * Checks whether a voice_call_log row already exists for the callSid from
   * the room metadata. If it does not exist, creates one as a fallback so that
   * room_finished can later finalise it correctly.
   */
  private async handleRoomStarted(event: LiveKitWebhookEvent): Promise<void> {
    const meta = this.parseRoomMetadata(event.room?.metadata);
    if (!meta?.callSid || !meta?.tenantId) {
      this.logger.debug(
        `room_started: missing or invalid room metadata — skipping (event.id=${event.id})`,
      );
      return;
    }

    const existing = await this.prisma.voice_call_log.findUnique({
      where: { call_sid: meta.callSid },
      select: { id: true },
    });

    if (!existing) {
      this.logger.warn(
        `room_started: agent did not call /calls/start — creating call log as fallback ` +
          `(callSid=${meta.callSid}, tenantId=${meta.tenantId})`,
      );
      await this.callLogService.startCall({
        tenantId: meta.tenantId,
        callSid: meta.callSid,
        fromNumber: meta.fromNumber ?? 'unknown',
        toNumber: meta.toNumber ?? 'unknown',
        direction: 'inbound',
      });
    }
  }

  /**
   * room_finished — finalise in-progress call when agent crashed before /calls/complete.
   *
   * Only acts if the call log status is still 'in_progress'. Calls already
   * finalised by the agent are left untouched (idempotent).
   */
  private async handleRoomFinished(event: LiveKitWebhookEvent): Promise<void> {
    const meta = this.parseRoomMetadata(event.room?.metadata);
    if (!meta?.callSid) {
      this.logger.debug(
        `room_finished: missing callSid in room metadata — skipping (event.id=${event.id})`,
      );
      return;
    }

    const callLog = await this.prisma.voice_call_log.findUnique({
      where: { call_sid: meta.callSid },
      select: { id: true, status: true, started_at: true },
    });

    if (!callLog) {
      this.logger.warn(
        `room_finished: no call log found for callSid=${meta.callSid} — cannot finalise`,
      );
      return;
    }

    // Only finalise if the agent has not already completed it
    if (callLog.status !== 'in_progress') {
      this.logger.debug(
        `room_finished: call log already in status='${callLog.status}' for callSid=${meta.callSid} — skipping`,
      );
      return;
    }

    this.logger.warn(
      `room_finished: agent did not call /calls/complete — finalising via webhook fallback ` +
        `(callSid=${meta.callSid})`,
    );

    const now = new Date();
    const durationSeconds = callLog.started_at
      ? Math.floor((now.getTime() - callLog.started_at.getTime()) / 1000)
      : 0;

    await this.prisma.voice_call_log.update({
      where: { id: callLog.id },
      data: {
        status: 'completed',
        outcome: 'abandoned', // fallback — agent should have set the real outcome
        duration_seconds: durationSeconds,
        ended_at: now,
      },
    });
  }

  /**
   * participant_left — no business logic required.
   * Logged at debug level for traceability during incident investigation.
   */
  private handleParticipantLeft(event: LiveKitWebhookEvent): void {
    this.logger.debug(
      `participant_left: identity=${event.participant?.identity ?? 'unknown'} ` +
        `(event.id=${event.id})`,
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Parse the LiveKit room metadata JSON string.
   * Returns null if metadata is absent or not valid JSON.
   */
  private parseRoomMetadata(
    metadata: string | undefined,
  ): LiveKitRoomMetadata | null {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata) as LiveKitRoomMetadata;
    } catch {
      this.logger.warn(`Failed to parse room metadata: ${metadata}`);
      return null;
    }
  }
}
