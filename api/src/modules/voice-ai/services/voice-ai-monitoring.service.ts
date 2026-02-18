import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AdminOverrideTenantVoiceDto } from '../dto/admin-override-tenant-voice.dto';

// ─── Response Interfaces ────────────────────────────────────────────────────

export interface TenantVoiceAiOverview {
  tenant_id: string;
  company_name: string;
  plan_name: string | null;
  voice_ai_included_in_plan: boolean;
  is_enabled: boolean;
  minutes_included: number;
  minutes_used: number;
  has_admin_override: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * VoiceAiMonitoringService — Sprint B11
 *
 * Platform admin service for cross-tenant Voice AI monitoring and override management.
 *
 * Responsibilities:
 *   - Aggregate tenant Voice AI usage overview (plan info, quota, usage, overrides)
 *   - Apply admin infrastructure overrides to individual tenant settings
 *
 * No tenant scoping — this service operates across all tenants.
 * Admin-only: must never be called from tenant-scoped controllers.
 */
@Injectable()
export class VoiceAiMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Tenant Voice AI Overview ─────────────────────────────────────────────

  /**
   * getTenantsVoiceAiOverview
   *
   * Returns a paginated list of all tenants with a Voice AI summary.
   * Joins tenant → subscription_plan (voice_ai_enabled, voice_ai_minutes_included)
   *         tenant → tenant_voice_ai_settings (is_enabled, override fields)
   *         voice_usage_record (STT seconds this month, aggregated)
   *
   * @param params.page   - 1-based page (default: 1)
   * @param params.limit  - records per page (default: 20, max: 100)
   * @param params.search - optional company_name substring filter
   */
  async getTenantsVoiceAiOverview(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: TenantVoiceAiOverview[]; meta: PaginationMeta }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.tenantWhereInput = params.search
      ? { company_name: { contains: params.search } }
      : {};

    // Fetch total count and paginated tenants in parallel
    const [total, tenants] = await Promise.all([
      this.prisma.tenant.count({ where: whereClause }),
      this.prisma.tenant.findMany({
        where: whereClause,
        select: {
          id: true,
          company_name: true,
          subscription_plan: {
            select: {
              name: true,
              voice_ai_enabled: true,
              voice_ai_minutes_included: true,
            },
          },
          voice_ai_settings: {
            select: {
              is_enabled: true,
              monthly_minutes_override: true,
              stt_provider_override_id: true,
              llm_provider_override_id: true,
              tts_provider_override_id: true,
              stt_config_override: true,
              llm_config_override: true,
              tts_config_override: true,
              voice_id_override: true,
            },
          },
        },
        orderBy: { company_name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    // Aggregate STT usage for current month for all returned tenants in one query
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const tenantIds = tenants.map((t) => t.id);
    const usageAggRows =
      tenantIds.length > 0
        ? await this.prisma.voice_usage_record.groupBy({
            by: ['tenant_id'],
            where: {
              tenant_id: { in: tenantIds },
              year,
              month,
              provider_type: 'STT',
            },
            _sum: { usage_quantity: true },
          })
        : [];

    // Build lookup: tenant_id → STT seconds this month
    const usageByTenantId = new Map<string, number>();
    for (const row of usageAggRows) {
      usageByTenantId.set(
        row.tenant_id,
        row._sum.usage_quantity ? Number(row._sum.usage_quantity) : 0,
      );
    }

    const data: TenantVoiceAiOverview[] = tenants.map((tenant) => {
      const settings = tenant.voice_ai_settings;
      const plan = tenant.subscription_plan;

      // STT seconds → minutes (ceiling)
      const sttSeconds = usageByTenantId.get(tenant.id) ?? 0;
      const minutesUsed = sttSeconds > 0 ? Math.ceil(sttSeconds / 60) : 0;

      // Effective quota: admin override takes precedence over plan default
      const planMinutes = plan?.voice_ai_minutes_included ?? 0;
      const minutesIncluded = settings?.monthly_minutes_override ?? planMinutes;

      // Tenant has an admin override if any infrastructure override field is set
      const hasAdminOverride =
        settings !== null &&
        settings !== undefined &&
        (settings.monthly_minutes_override !== null ||
          settings.stt_provider_override_id !== null ||
          settings.llm_provider_override_id !== null ||
          settings.tts_provider_override_id !== null ||
          settings.stt_config_override !== null ||
          settings.llm_config_override !== null ||
          settings.tts_config_override !== null ||
          settings.voice_id_override !== null);

      return {
        tenant_id: tenant.id,
        company_name: tenant.company_name,
        plan_name: plan?.name ?? null,
        voice_ai_included_in_plan: plan?.voice_ai_enabled ?? false,
        is_enabled: settings?.is_enabled ?? false,
        minutes_included: minutesIncluded,
        minutes_used: minutesUsed,
        has_admin_override: hasAdminOverride,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Admin Override ───────────────────────────────────────────────────────

  /**
   * overrideTenantVoiceSettings
   *
   * Upserts tenant_voice_ai_settings with the provided infrastructure override fields.
   * Only fields explicitly included in the DTO are modified.
   * Sending null for a field clears the override (reverts to plan/global default).
   *
   * If dto.force_enabled is a boolean (not null), is_enabled is set accordingly.
   * If dto.force_enabled is null, is_enabled is left untouched.
   *
   * @param tenantId  - Target tenant UUID
   * @param dto       - Override fields from request body
   */
  async overrideTenantVoiceSettings(
    tenantId: string,
    dto: AdminOverrideTenantVoiceDto,
  ): Promise<void> {
    // Verify tenant exists before upserting settings
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${tenantId}" not found`);
    }

    // Build partial update — only include fields that were explicitly sent in the DTO
    // Note: updated_at is managed automatically by Prisma @updatedAt
    const updateData: Prisma.tenant_voice_ai_settingsUncheckedUpdateInput = {};

    // force_enabled → updates is_enabled when not null
    if (dto.force_enabled !== undefined) {
      if (dto.force_enabled !== null) {
        updateData.is_enabled = dto.force_enabled;
      }
      // null → admin force removed; tenant controls is_enabled (no change applied)
    }

    if (dto.monthly_minutes_override !== undefined) {
      updateData.monthly_minutes_override = dto.monthly_minutes_override;
    }
    if (dto.stt_provider_override_id !== undefined) {
      updateData.stt_provider_override_id = dto.stt_provider_override_id;
    }
    if (dto.llm_provider_override_id !== undefined) {
      updateData.llm_provider_override_id = dto.llm_provider_override_id;
    }
    if (dto.tts_provider_override_id !== undefined) {
      updateData.tts_provider_override_id = dto.tts_provider_override_id;
    }
    if (dto.admin_notes !== undefined) {
      updateData.admin_notes = dto.admin_notes;
    }

    // Build create data — for new rows, set sensible defaults + override values
    const createData: Prisma.tenant_voice_ai_settingsUncheckedCreateInput = {
      tenant_id: tenantId,
      is_enabled:
        dto.force_enabled !== null && dto.force_enabled !== undefined
          ? dto.force_enabled
          : false,
      monthly_minutes_override: dto.monthly_minutes_override ?? null,
      stt_provider_override_id: dto.stt_provider_override_id ?? null,
      llm_provider_override_id: dto.llm_provider_override_id ?? null,
      tts_provider_override_id: dto.tts_provider_override_id ?? null,
      admin_notes: dto.admin_notes ?? null,
    };

    await this.prisma.tenant_voice_ai_settings.upsert({
      where: { tenant_id: tenantId },
      update: updateData,
      create: createData,
    });
  }
}
