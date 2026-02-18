import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Data shape for a single per-provider usage entry.
 * Passed from CompleteCallDto.usage_records into the transaction.
 */
export interface UsageRecordData {
  provider_id: string;
  provider_type: 'STT' | 'LLM' | 'TTS';
  usage_quantity: number;
  usage_unit: 'seconds' | 'tokens' | 'characters';
  estimated_cost?: number;
}

export interface ProviderUsageSummary {
  provider_id: string;
  provider_type: string;
  provider_name: string;
  total_quantity: number;
  unit: string;
  estimated_cost: number;
}

export interface AdminUsageReport {
  year: number;
  month: number;
  total_calls: number;
  total_stt_seconds: number;
  total_estimated_cost: number;
  by_tenant: {
    tenant_id: string;
    tenant_name: string;
    total_calls: number;
    total_stt_seconds: number;
    estimated_cost: number;
  }[];
}

/**
 * VoiceUsageService — Sprint B07 (full implementation)
 *
 * Handles per-call, per-provider granular usage record creation and reporting.
 *
 * CRITICAL ARCHITECTURE: voice_usage_record is per-call per-provider — NOT a monthly counter.
 * Each completed call creates 1–3 rows (one per provider: STT, LLM, TTS).
 * Quota is derived by aggregating STT seconds for the current month.
 *
 * createUsageRecords() is called INSIDE a Prisma transaction from VoiceCallLogService.completeCall().
 * The caller passes the TransactionClient to ensure atomicity.
 */
@Injectable()
export class VoiceUsageService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Write ───────────────────────────────────────────────────────────────────

  /**
   * Create one voice_usage_record row per usage entry.
   * Called inside VoiceCallLogService.completeCall() transaction — do NOT start a nested transaction.
   *
   * @param tx           Prisma transaction client from the outer transaction
   * @param tenantId     Tenant UUID (from call log row)
   * @param callLogId    voice_call_log.id (from the updated call log row)
   * @param records      Per-provider usage data from CompleteCallDto.usage_records
   */
  async createUsageRecords(
    tx: Prisma.TransactionClient,
    tenantId: string,
    callLogId: string,
    records: UsageRecordData[],
  ): Promise<void> {
    if (!records.length) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await tx.voice_usage_record.createMany({
      data: records.map((r) => ({
        tenant_id: tenantId,
        call_log_id: callLogId,
        provider_id: r.provider_id,
        provider_type: r.provider_type,
        usage_quantity: r.usage_quantity,
        usage_unit: r.usage_unit,
        estimated_cost: r.estimated_cost ?? null,
        year,
        month,
      })),
    });
  }

  // ─── Quota ───────────────────────────────────────────────────────────────────

  /**
   * Compute quota for a tenant by aggregating per-call STT records for the current month.
   * STT usage_quantity (seconds) is the authoritative proxy for call duration.
   *
   * @param tenantId  Tenant UUID
   */
  async getQuota(tenantId: string): Promise<{
    minutes_included: number;
    minutes_used: number;
    minutes_remaining: number;
    overage_rate: number | null;
    quota_exceeded: boolean;
  }> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [tenant, settings] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { subscription_plan: true },
      }),
      this.prisma.tenant_voice_ai_settings.findUnique({
        where: { tenant_id: tenantId },
      }),
    ]);

    const minutesIncluded =
      settings?.monthly_minutes_override ??
      (tenant?.subscription_plan?.voice_ai_minutes_included ?? 0);

    const overageRate =
      tenant?.subscription_plan?.voice_ai_overage_rate != null
        ? Number(tenant.subscription_plan.voice_ai_overage_rate)
        : null;

    const sttUsage = await this.prisma.voice_usage_record.aggregate({
      where: {
        tenant_id: tenantId,
        provider_type: 'STT',
        year,
        month,
      },
      _sum: { usage_quantity: true },
    });

    const totalSeconds = Number(sttUsage._sum.usage_quantity ?? 0);
    const minutesUsed = Math.ceil(totalSeconds / 60);
    const minutesRemaining = Math.max(0, minutesIncluded - minutesUsed);
    const quotaExceeded = minutesUsed >= minutesIncluded && overageRate === null;

    return {
      minutes_included: minutesIncluded,
      minutes_used: minutesUsed,
      minutes_remaining: minutesRemaining,
      overage_rate: overageRate,
      quota_exceeded: quotaExceeded,
    };
  }

  // ─── Quota Guard ─────────────────────────────────────────────────────────────

  /**
   * Check whether a new call is allowed under the tenant's monthly quota.
   *
   * This is an informational pre-flight check — the Python agent makes the
   * final acceptance decision via the `quota_exceeded` + `overage_rate` fields
   * returned by the context endpoint (Sprint B06a / B04).
   *
   * Logic:
   *   - minutes_used < minutes_included        → allowed, not overage
   *   - minutes_used >= minutes_included
   *     + overage_rate === null                → blocked (no overage billing)
   *   - minutes_used >= minutes_included
   *     + overage_rate !== null                → allowed, marked as overage
   *
   * @param tenantId  Tenant UUID
   */
  async checkAndReserveMinute(tenantId: string): Promise<{
    allowed: boolean;
    is_overage: boolean;
    reason?: string;
  }> {
    const quota = await this.getQuota(tenantId);

    if (quota.minutes_used < quota.minutes_included) {
      return { allowed: true, is_overage: false };
    }

    if (quota.overage_rate === null) {
      return { allowed: false, is_overage: false, reason: 'quota_exceeded' };
    }

    // Quota exceeded but overage billing is configured — allow the call
    return { allowed: true, is_overage: true };
  }

  // ─── Tenant Usage Summary ────────────────────────────────────────────────────

  /**
   * Monthly usage summary for a single tenant.
   * Groups by provider to show per-provider consumption and estimated cost.
   *
   * @param tenantId  Tenant UUID
   * @param year      Year to query (e.g. 2026)
   * @param month     Month to query (1–12)
   */
  async getUsageSummary(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<{
    year: number;
    month: number;
    total_calls: number;
    total_stt_seconds: number;
    total_llm_tokens: number;
    total_tts_characters: number;
    estimated_cost: number;
    by_provider: ProviderUsageSummary[];
  }> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    // 1. Aggregate usage grouped by provider_id + provider_type + usage_unit
    const grouped = await this.prisma.voice_usage_record.groupBy({
      by: ['provider_id', 'provider_type', 'usage_unit'],
      where: { tenant_id: tenantId, year, month },
      _sum: { usage_quantity: true, estimated_cost: true },
    });

    // 2. Total calls for the month (count voice_call_log rows, not usage records)
    const totalCalls = await this.prisma.voice_call_log.count({
      where: {
        tenant_id: tenantId,
        started_at: { gte: monthStart, lt: monthEnd },
      },
    });

    // 3. Fetch provider display names for the aggregated provider_ids
    const providerIds = [...new Set(grouped.map((g) => g.provider_id))];
    const providers =
      providerIds.length > 0
        ? await this.prisma.voice_ai_provider.findMany({
            where: { id: { in: providerIds } },
            select: { id: true, display_name: true },
          })
        : [];

    const providerNameMap = new Map(providers.map((p) => [p.id, p.display_name]));

    // 4. Build provider breakdown
    const byProvider: ProviderUsageSummary[] = grouped.map((g) => ({
      provider_id: g.provider_id,
      provider_type: g.provider_type,
      provider_name: providerNameMap.get(g.provider_id) ?? g.provider_id,
      total_quantity: Number(g._sum.usage_quantity ?? 0),
      unit: g.usage_unit,
      estimated_cost: Number(g._sum.estimated_cost ?? 0),
    }));

    // 5. Compute totals from the grouped data
    let totalSttSeconds = 0;
    let totalLlmTokens = 0;
    let totalTtsCharacters = 0;
    let totalCost = 0;

    for (const g of grouped) {
      const qty = Number(g._sum.usage_quantity ?? 0);
      const cost = Number(g._sum.estimated_cost ?? 0);
      totalCost += cost;

      if (g.provider_type === 'STT') totalSttSeconds += qty;
      else if (g.provider_type === 'LLM') totalLlmTokens += qty;
      else if (g.provider_type === 'TTS') totalTtsCharacters += qty;
    }

    return {
      year,
      month,
      total_calls: totalCalls,
      total_stt_seconds: totalSttSeconds,
      total_llm_tokens: totalLlmTokens,
      total_tts_characters: totalTtsCharacters,
      estimated_cost: totalCost,
      by_provider: byProvider,
    };
  }

  // ─── Admin Cross-Tenant Report ───────────────────────────────────────────────

  /**
   * Cross-tenant usage report for platform admins.
   * Aggregates all tenants' usage for the given year+month into a structured report.
   *
   * @param year   Year to query (e.g. 2026)
   * @param month  Month to query (1–12)
   */
  async getAdminUsageReport(year: number, month: number): Promise<AdminUsageReport> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    // 1. Group usage records by tenant_id and provider_type to build per-tenant totals
    const usageByTenant = await this.prisma.voice_usage_record.groupBy({
      by: ['tenant_id', 'provider_type'],
      where: { year, month },
      _sum: { usage_quantity: true, estimated_cost: true },
    });

    // 2. Count calls per tenant for the month
    const callsByTenant = await this.prisma.voice_call_log.groupBy({
      by: ['tenant_id'],
      where: {
        started_at: { gte: monthStart, lt: monthEnd },
      },
      _count: { id: true },
    });

    const callCountMap = new Map(
      callsByTenant.map((c) => [c.tenant_id, c._count.id]),
    );

    // 3. Collect all unique tenant_ids from both datasets (O(1) per insertion with Set)
    const tenantIdSet = new Set(usageByTenant.map((u) => u.tenant_id));
    for (const c of callsByTenant) {
      tenantIdSet.add(c.tenant_id);
    }
    const tenantIds = [...tenantIdSet];

    // 4. Fetch tenant names
    const tenants =
      tenantIds.length > 0
        ? await this.prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, company_name: true },
          })
        : [];

    const tenantNameMap = new Map(tenants.map((t) => [t.id, t.company_name]));

    // 5. Build per-tenant aggregates from the grouped usage records
    type TenantAgg = {
      stt_seconds: number;
      estimated_cost: number;
    };
    const tenantAggMap = new Map<string, TenantAgg>();

    for (const row of usageByTenant) {
      const existing = tenantAggMap.get(row.tenant_id) ?? {
        stt_seconds: 0,
        estimated_cost: 0,
      };

      if (row.provider_type === 'STT') {
        existing.stt_seconds += Number(row._sum.usage_quantity ?? 0);
      }
      existing.estimated_cost += Number(row._sum.estimated_cost ?? 0);
      tenantAggMap.set(row.tenant_id, existing);
    }

    // 6. Compute platform-wide totals
    let totalCalls = 0;
    let totalSttSeconds = 0;
    let totalEstimatedCost = 0;

    for (const c of callsByTenant) {
      totalCalls += c._count.id;
    }

    for (const [, agg] of tenantAggMap) {
      totalSttSeconds += agg.stt_seconds;
      totalEstimatedCost += agg.estimated_cost;
    }

    // 7. Build by_tenant array — include all tenants that appear in either dataset
    const byTenant = tenantIds.map((tid) => {
      const agg = tenantAggMap.get(tid) ?? { stt_seconds: 0, estimated_cost: 0 };
      return {
        tenant_id: tid,
        tenant_name: tenantNameMap.get(tid) ?? tid,
        total_calls: callCountMap.get(tid) ?? 0,
        total_stt_seconds: agg.stt_seconds,
        estimated_cost: agg.estimated_cost,
      };
    });

    // Sort by estimated_cost descending for a sensible admin view
    byTenant.sort((a, b) => b.estimated_cost - a.estimated_cost);

    return {
      year,
      month,
      total_calls: totalCalls,
      total_stt_seconds: totalSttSeconds,
      total_estimated_cost: totalEstimatedCost,
      by_tenant: byTenant,
    };
  }
}
