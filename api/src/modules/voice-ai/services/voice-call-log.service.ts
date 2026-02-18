import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { VoiceUsageService, UsageRecordData } from './voice-usage.service';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface VoiceCallLogDto {
  id: string;
  tenant_id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  direction: string;
  status: string;
  outcome: string | null;
  is_overage: boolean;
  duration_seconds: number | null;
  transcript_summary: string | null;
  full_transcript: string | null;
  actions_taken: string[] | null;
  lead_id: string | null;
  stt_provider_id: string | null;
  llm_provider_id: string | null;
  tts_provider_id: string | null;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ─── Select shape re-used by all queries ─────────────────────────────────────

const CALL_LOG_SELECT = {
  id: true,
  tenant_id: true,
  call_sid: true,
  from_number: true,
  to_number: true,
  direction: true,
  status: true,
  outcome: true,
  is_overage: true,
  duration_seconds: true,
  transcript_summary: true,
  full_transcript: true,
  actions_taken: true,
  lead_id: true,
  stt_provider_id: true,
  llm_provider_id: true,
  tts_provider_id: true,
  started_at: true,
  ended_at: true,
  created_at: true,
} as const;

/**
 * Map a raw Prisma row to VoiceCallLogDto.
 * Deserialises the JSON `actions_taken` string into a string array.
 */
function mapRow(row: {
  id: string;
  tenant_id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  direction: string;
  status: string;
  outcome: string | null;
  is_overage: boolean;
  duration_seconds: number | null;
  transcript_summary: string | null;
  full_transcript: string | null;
  actions_taken: string | null;
  lead_id: string | null;
  stt_provider_id: string | null;
  llm_provider_id: string | null;
  tts_provider_id: string | null;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}): VoiceCallLogDto {
  let actionsTaken: string[] | null = null;
  if (row.actions_taken) {
    try {
      actionsTaken = JSON.parse(row.actions_taken) as string[];
    } catch {
      actionsTaken = null;
    }
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    call_sid: row.call_sid,
    from_number: row.from_number,
    to_number: row.to_number,
    direction: row.direction,
    status: row.status,
    outcome: row.outcome,
    is_overage: row.is_overage,
    duration_seconds: row.duration_seconds,
    transcript_summary: row.transcript_summary,
    full_transcript: row.full_transcript,
    actions_taken: actionsTaken,
    lead_id: row.lead_id,
    stt_provider_id: row.stt_provider_id,
    llm_provider_id: row.llm_provider_id,
    tts_provider_id: row.tts_provider_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    created_at: row.created_at,
  };
}

/**
 * VoiceCallLogService — Sprint B07 (full implementation)
 *
 * Manages voice_call_log lifecycle and coordinates usage record creation.
 *
 * startCall():        Creates a voice_call_log row with status='in_progress'.
 *                     Idempotent: returns existing call_log_id on duplicate call_sid.
 *
 * completeCall():     Finalises the call log (status='completed', duration, outcome,
 *                     transcript, actions) and creates per-provider voice_usage_record
 *                     rows — all in a single Prisma transaction.
 *
 * findByTenantId():   Paginated call history for a single tenant.
 * findById():         Single call log detail with full transcript (tenant-scoped).
 * findAllAdmin():     Cross-tenant paginated call log (admin only, no tenant filter).
 */
@Injectable()
export class VoiceCallLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageService: VoiceUsageService,
  ) {}

  // ─── Call Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Create a voice_call_log row at the start of a call — API-024.
   *
   * Idempotent on call_sid: if a log for this call_sid already exists
   * (e.g. agent crashed and retried), returns the existing call_log_id
   * rather than throwing a 409.
   *
   * @param data  Call metadata from StartCallDto fields
   * @returns     { call_log_id: string } — UUID of the voice_call_log row
   */
  async startCall(data: {
    tenantId: string;
    callSid: string;
    fromNumber: string;
    toNumber: string;
    direction?: string;
    sttProviderId?: string;
    llmProviderId?: string;
    ttsProviderId?: string;
  }): Promise<{ call_log_id: string }> {
    // Idempotency: check for existing call_sid before creating
    const existing = await this.prisma.voice_call_log.findUnique({
      where: { call_sid: data.callSid },
      select: { id: true },
    });

    if (existing) {
      return { call_log_id: existing.id };
    }

    const log = await this.prisma.voice_call_log.create({
      data: {
        tenant_id: data.tenantId,
        call_sid: data.callSid,
        from_number: data.fromNumber,
        to_number: data.toNumber,
        direction: data.direction ?? 'inbound',
        status: 'in_progress',
        stt_provider_id: data.sttProviderId ?? null,
        llm_provider_id: data.llmProviderId ?? null,
        tts_provider_id: data.ttsProviderId ?? null,
      },
      select: { id: true },
    });

    return { call_log_id: log.id };
  }

  /**
   * Finalise a call log and persist usage records — API-030.
   *
   * All writes (call log update + usage record creation) execute in a single
   * Prisma transaction to guarantee atomicity. If usage records fail to save,
   * the call log update is rolled back.
   *
   * @param data  Call outcome data from CompleteCallDto fields (snake_case → camelCase mapping done in InternalService)
   * @throws NotFoundException  if no call_log exists for callSid
   */
  async completeCall(data: {
    callSid: string;
    durationSeconds: number;
    outcome: string;
    transcriptSummary?: string;
    fullTranscript?: string;
    actionsTaken?: string[];
    leadId?: string;
    isOverage?: boolean;
    usageRecords?: UsageRecordData[];
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Update call log — throws P2025 if call_sid not found
      let callLog: { id: string; tenant_id: string };

      try {
        callLog = await tx.voice_call_log.update({
          where: { call_sid: data.callSid },
          data: {
            status: 'completed',
            duration_seconds: data.durationSeconds,
            outcome: data.outcome,
            transcript_summary: data.transcriptSummary ?? null,
            full_transcript: data.fullTranscript ?? null,
            actions_taken: data.actionsTaken ? JSON.stringify(data.actionsTaken) : null,
            lead_id: data.leadId ?? null,
            is_overage: data.isOverage ?? false,
            ended_at: new Date(),
          },
          select: { id: true, tenant_id: true },
        });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        if (prismaError.code === 'P2025') {
          throw new NotFoundException(
            `Call log not found for call_sid: ${data.callSid}`,
          );
        }
        throw err;
      }

      // 2. Create per-provider usage records (1–3 rows: STT, LLM, TTS)
      if (data.usageRecords?.length) {
        await this.usageService.createUsageRecords(
          tx,
          callLog.tenant_id,
          callLog.id,
          data.usageRecords,
        );
      }
    });
  }

  // ─── Tenant Queries ─────────────────────────────────────────────────────────

  /**
   * List call logs for a specific tenant with pagination and optional filters.
   *
   * @param tenantId  Tenant UUID from JWT
   * @param filters   Optional date range, outcome filter, and pagination
   */
  async findByTenantId(
    tenantId: string,
    filters: {
      from?: Date;
      to?: Date;
      outcome?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: VoiceCallLogDto[]; meta: PaginationMeta }> {
    // Use || instead of ?? so NaN (from parseInt("abc")) falls back to the default
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where = {
      tenant_id: tenantId,
      ...(filters.from || filters.to
        ? {
            started_at: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(filters.outcome ? { outcome: filters.outcome } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.voice_call_log.findMany({
        where,
        select: CALL_LOG_SELECT,
        orderBy: { started_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.voice_call_log.count({ where }),
    ]);

    return {
      data: rows.map(mapRow),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Return a single call log by ID — tenant-scoped (tenant cannot read other tenants' logs).
   *
   * @param tenantId  Tenant UUID from JWT
   * @param id        voice_call_log UUID
   * @throws NotFoundException  if the log does not exist or belongs to a different tenant
   */
  async findById(tenantId: string, id: string): Promise<VoiceCallLogDto> {
    const row = await this.prisma.voice_call_log.findFirst({
      where: { id, tenant_id: tenantId },
      select: CALL_LOG_SELECT,
    });

    if (!row) {
      throw new NotFoundException(`Call log ${id} not found`);
    }

    return mapRow(row);
  }

  // ─── Admin Queries ──────────────────────────────────────────────────────────

  /**
   * Cross-tenant call log list for platform admins.
   * No tenant_id filter is applied — returns logs across all tenants.
   *
   * @param filters  Optional tenantId, date range, outcome, and pagination
   */
  async findAllAdmin(filters: {
    tenantId?: string;
    from?: Date;
    to?: Date;
    outcome?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: VoiceCallLogDto[]; meta: PaginationMeta }> {
    // Use || instead of ?? so NaN (from parseInt("abc")) falls back to the default
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where = {
      ...(filters.tenantId ? { tenant_id: filters.tenantId } : {}),
      ...(filters.from || filters.to
        ? {
            started_at: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(filters.outcome ? { outcome: filters.outcome } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.voice_call_log.findMany({
        where,
        select: CALL_LOG_SELECT,
        orderBy: { started_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.voice_call_log.count({ where }),
    ]);

    return {
      data: rows.map(mapRow),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}
