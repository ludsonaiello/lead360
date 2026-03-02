import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  recording_url: string | null;
  recording_duration_seconds: number | null;
  recording_status: string;
  transcription_status: string;
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
  recording_url: true,
  recording_duration_seconds: true,
  recording_status: true,
  transcription_status: true,
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
  recording_url: string | null;
  recording_duration_seconds: number | null;
  recording_status: string;
  transcription_status: string;
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
    recording_url: row.recording_url,
    recording_duration_seconds: row.recording_duration_seconds,
    recording_status: row.recording_status,
    transcription_status: row.transcription_status,
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
  private readonly logger = new Logger(VoiceCallLogService.name);

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
    roomName?: string;
    direction?: string;
    languageUsed?: string;
    intent?: string;
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
        room_name: data.roomName ?? null,
        from_number: data.fromNumber,
        to_number: data.toNumber,
        direction: data.direction ?? 'inbound',
        language_used: data.languageUsed ?? null,
        intent: data.intent ?? null,
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
   * Transaction behavior:
   *   - If voice_call_log update succeeds but usage record creation fails,
   *     the entire transaction is rolled back (call log remains 'in_progress')
   *   - If call_sid is not found (P2025 error), throws NotFoundException
   *   - Any other database error will be thrown and logged by caller
   *
   * @param data  Call outcome data from CompleteCallDto fields (snake_case → camelCase mapping done in InternalService)
   * @throws NotFoundException  if no call_log exists for callSid
   */
  async completeCall(data: {
    callSid: string;
    status: string;
    durationSeconds?: number;
    outcome?: string;
    transcriptSummary?: string;
    fullTranscript?: string;
    actionsTaken?: string[];
    leadId?: string;
    transferredTo?: string;
    errorMessage?: string;
    isOverage?: boolean;
    usageRecords?: UsageRecordData[];
  }): Promise<void> {
    this.logger.log(`📝 Completing call log for call_sid: ${data.callSid}`);
    this.logger.log(`  - Status: ${data.status}`);
    this.logger.log(`  - Duration: ${data.durationSeconds ?? 'N/A'}s`);
    this.logger.log(`  - Outcome: ${data.outcome ?? 'N/A'}`);
    if (data.usageRecords && data.usageRecords.length > 0) {
      this.logger.log(`  - Usage records: ${data.usageRecords.length} providers`);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Update call log — throws P2025 if call_sid not found
        let callLog: { id: string; tenant_id: string };

        try {
          callLog = await tx.voice_call_log.update({
            where: { call_sid: data.callSid },
            data: {
              status: data.status,
              duration_seconds: data.durationSeconds ?? null,
              outcome: data.outcome ?? null,
              transcript_summary: data.transcriptSummary ?? null,
              full_transcript: data.fullTranscript ?? null,
              actions_taken: data.actionsTaken ? JSON.stringify(data.actionsTaken) : null,
              lead_id: data.leadId ?? null,
              transferred_to: data.transferredTo ?? null,
              error_message: data.errorMessage ?? null,
              is_overage: data.isOverage ?? false,
              ended_at: new Date(),
            },
            select: { id: true, tenant_id: true },
          });

          this.logger.log(`✅ Call log updated successfully: ${callLog.id}`);
        } catch (err: unknown) {
          const prismaError = err as { code?: string };
          if (prismaError.code === 'P2025') {
            this.logger.error(`❌ Call log not found for call_sid: ${data.callSid}`);
            throw new NotFoundException(
              `Call log not found for call_sid: ${data.callSid}`,
            );
          }
          this.logger.error(`❌ Database error while updating call log: ${(err as Error).message}`);
          throw err;
        }

        // 2. Create per-provider usage records (1–3 rows: STT, LLM, TTS)
        if (data.usageRecords?.length) {
          this.logger.log(`  - Creating ${data.usageRecords.length} usage record(s)...`);
          await this.usageService.createUsageRecords(
            tx,
            callLog.tenant_id,
            callLog.id,
            data.usageRecords,
          );
          this.logger.log(`  - Usage records created successfully`);
        }
      });

      this.logger.log(`✅ Call completion transaction committed for call_sid: ${data.callSid}`);
    } catch (error: unknown) {
      // Error already logged above, but ensure it's caught and re-thrown
      if (error instanceof NotFoundException) {
        throw error; // NotFoundException already logged
      }
      this.logger.error(`❌ Failed to complete call log for call_sid: ${data.callSid}`);
      this.logger.error(`  - Error: ${(error as Error).message}`);
      throw error;
    }
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

  /**
   * Get call log by Twilio call_sid — no tenant filter (used internally by agent worker).
   *
   * @param callSid  Twilio CallSid
   * @returns        Call log DTO or null if not found
   */
  async findByCallSid(callSid: string): Promise<VoiceCallLogDto | null> {
    const row = await this.prisma.voice_call_log.findUnique({
      where: { call_sid: callSid },
      select: CALL_LOG_SELECT,
    });

    if (!row) {
      return null;
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

  // ─── Usage Reports ──────────────────────────────────────────────────────────

  /**
   * Get aggregate usage report for admin — cross-tenant statistics.
   *
   * Returns call volume, duration, costs, and breakdowns by provider type and outcome.
   *
   * @param filters  Optional tenant_id, date range, provider_type filter
   */
  async getUsageReport(filters: {
    tenant_id?: string;
    from?: Date;
    to?: Date;
    provider_type?: string;
  }): Promise<{
    total_calls: number;
    total_duration_seconds: number;
    overage_calls: number;
    total_estimated_cost: number;
    by_provider_type: Array<{
      provider_type: string;
      total_quantity: number;
      usage_unit: string;
      estimated_cost: number;
    }>;
    by_outcome: Array<{
      outcome: string | null;
      count: number;
    }>;
  }> {
    // Build where clause for call logs
    const callWhere = {
      ...(filters.tenant_id ? { tenant_id: filters.tenant_id } : {}),
      ...(filters.from || filters.to
        ? {
            started_at: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      status: 'completed', // Only count completed calls
    };

    // Build where clause for usage records
    const usageWhere = {
      ...(filters.tenant_id ? { tenant_id: filters.tenant_id } : {}),
      ...(filters.provider_type ? { provider_type: filters.provider_type } : {}),
      call_log: {
        ...(filters.from || filters.to
          ? {
              started_at: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
    };

    // Run all aggregations in parallel
    const [
      totalCalls,
      callStats,
      overageCalls,
      usageByProvider,
      callsByOutcome,
    ] = await Promise.all([
      // Total call count
      this.prisma.voice_call_log.count({ where: callWhere }),

      // Sum of duration
      this.prisma.voice_call_log.aggregate({
        where: callWhere,
        _sum: { duration_seconds: true },
      }),

      // Overage call count
      this.prisma.voice_call_log.count({
        where: { ...callWhere, is_overage: true },
      }),

      // Group by provider type with sums
      this.prisma.voice_usage_record.groupBy({
        by: ['provider_type', 'usage_unit'],
        where: usageWhere,
        _sum: {
          usage_quantity: true,
          estimated_cost: true,
        },
      }),

      // Group by outcome
      this.prisma.voice_call_log.groupBy({
        by: ['outcome'],
        where: callWhere,
        _count: { id: true },
      }),
    ]);

    // Calculate total estimated cost across all usage records
    const totalEstimatedCost = usageByProvider.reduce(
      (sum, record) => sum + (Number(record._sum.estimated_cost) || 0),
      0,
    );

    // Format by_provider_type
    const byProviderType = usageByProvider.map((record) => ({
      provider_type: record.provider_type,
      total_quantity: Number(record._sum.usage_quantity) || 0,
      usage_unit: record.usage_unit,
      estimated_cost: Number(record._sum.estimated_cost) || 0,
    }));

    // Format by_outcome
    const byOutcome = callsByOutcome.map((record) => ({
      outcome: record.outcome,
      count: record._count.id,
    }));

    return {
      total_calls: totalCalls,
      total_duration_seconds: callStats._sum.duration_seconds || 0,
      overage_calls: overageCalls,
      total_estimated_cost: totalEstimatedCost,
      by_provider_type: byProviderType,
      by_outcome: byOutcome,
    };
  }
}
