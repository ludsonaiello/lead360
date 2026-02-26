import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoomServiceClient } from 'livekit-server-sdk';
import { PrismaService } from '../../../core/database/prisma.service';
import { VoiceAgentService } from '../agent/voice-agent.service';
import { VoiceAiGlobalConfigService } from './voice-ai-global-config.service';
import { AdminOverrideTenantVoiceDto } from '../dto/admin-override-tenant-voice.dto';
import { AgentStatusDto } from '../dto/agent-status.dto';
import { ActiveRoomDto } from '../dto/active-room.dto';

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
  private readonly logger = new Logger(VoiceAiMonitoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly voiceAgentService: VoiceAgentService,
    private readonly globalConfigService: VoiceAiGlobalConfigService,
  ) {}

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
   * getTenantOverride
   *
   * Retrieves current admin override settings for a specific tenant.
   * Returns null for all fields if no overrides exist.
   * Used by frontend to pre-populate the override form.
   *
   * @param tenantId - Target tenant UUID
   * @returns Override settings or null for each field if not set
   */
  async getTenantOverride(tenantId: string): Promise<{
    force_enabled: boolean | null;
    monthly_minutes_override: number | null;
    stt_provider_override_id: string | null;
    llm_provider_override_id: string | null;
    tts_provider_override_id: string | null;
    admin_notes: string | null;
  }> {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${tenantId}" not found`);
    }

    // Fetch tenant_voice_ai_settings
    const settings = await this.prisma.tenant_voice_ai_settings.findUnique({
      where: { tenant_id: tenantId },
      select: {
        is_enabled: true,
        monthly_minutes_override: true,
        stt_provider_override_id: true,
        llm_provider_override_id: true,
        tts_provider_override_id: true,
        admin_notes: true,
      },
    });

    // If no settings row exists, return all nulls
    if (!settings) {
      return {
        force_enabled: null,
        monthly_minutes_override: null,
        stt_provider_override_id: null,
        llm_provider_override_id: null,
        tts_provider_override_id: null,
        admin_notes: null,
      };
    }

    // Return override values
    // Note: force_enabled is NOT stored directly - we return is_enabled
    // Frontend interprets: if is_enabled exists and admin_override=true, it's forced
    return {
      force_enabled: settings.is_enabled, // Best approximation - frontend decides if forced
      monthly_minutes_override: settings.monthly_minutes_override,
      stt_provider_override_id: settings.stt_provider_override_id,
      llm_provider_override_id: settings.llm_provider_override_id,
      tts_provider_override_id: settings.tts_provider_override_id,
      admin_notes: settings.admin_notes,
    };
  }

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

  // ─── Agent Status ─────────────────────────────────────────────────────────

  /**
   * getAgentStatus
   *
   * Returns the health status and metrics of the Voice AI agent worker.
   * Used by platform admin to monitor agent health and call volume.
   *
   * Metrics:
   *   - is_running: VoiceAgentService.isRunning()
   *   - agent_enabled: From voice_ai_global_config
   *   - livekit_connected: Same as is_running (if worker is running, it's connected)
   *   - active_calls: Count of voice_call_log WHERE status='in_progress'
   *   - today_calls: Count of voice_call_log WHERE started_at >= today
   *   - this_month_calls: Count of voice_call_log WHERE started_at >= this month
   *
   * @returns Agent status metrics
   */
  async getAgentStatus(): Promise<AgentStatusDto> {
    // Get global config to check if agent is enabled
    const config = await this.globalConfigService.getConfig();

    // Get worker running status
    const isRunning = this.voiceAgentService.isRunning();

    // Get call counts — run in parallel for efficiency
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeCalls, todayCalls, thisMonthCalls] = await Promise.all([
      // Active calls (status = 'in_progress')
      this.prisma.voice_call_log.count({
        where: { status: 'in_progress' },
      }),

      // Today's calls
      this.prisma.voice_call_log.count({
        where: { started_at: { gte: todayStart } },
      }),

      // This month's calls
      this.prisma.voice_call_log.count({
        where: { started_at: { gte: monthStart } },
      }),
    ]);

    return {
      is_running: isRunning,
      agent_enabled: config.agent_enabled,
      livekit_connected: isRunning, // If worker is running, it's connected
      active_calls: activeCalls,
      today_calls: todayCalls,
      this_month_calls: thisMonthCalls,
    };
  }

  // ─── Active Rooms ─────────────────────────────────────────────────────────

  /**
   * getActiveRooms
   *
   * Returns a list of all active calls (voice_call_log WHERE status='in_progress').
   * Joins with tenant to get company_name for display.
   * Calculates duration_seconds as (now - started_at).
   *
   * @returns List of active call rooms
   */
  async getActiveRooms(): Promise<ActiveRoomDto[]> {
    const activeCalls = await this.prisma.voice_call_log.findMany({
      where: { status: 'in_progress' },
      select: {
        id: true,
        tenant_id: true,
        call_sid: true,
        room_name: true,
        from_number: true,
        to_number: true,
        direction: true,
        started_at: true,
        tenant: {
          select: {
            company_name: true,
          },
        },
      },
      orderBy: { started_at: 'desc' },
    });

    const now = new Date();

    return activeCalls.map((call) => ({
      id: call.id,
      tenant_id: call.tenant_id,
      company_name: call.tenant.company_name,
      call_sid: call.call_sid,
      room_name: call.room_name,
      from_number: call.from_number,
      to_number: call.to_number,
      direction: call.direction,
      duration_seconds: Math.floor((now.getTime() - call.started_at.getTime()) / 1000),
      started_at: call.started_at,
    }));
  }

  // ─── Force End Room ───────────────────────────────────────────────────────

  /**
   * forceEndRoom
   *
   * Force-terminates a specific call by room name.
   * Admin-only operation for emergency call termination.
   *
   * Steps:
   *   1. Find voice_call_log by room_name — throw NotFoundException if not found
   *   2. Update status to 'failed', ended_at = now, error_message = 'Force terminated by admin'
   *   3. Attempt to delete LiveKit room via RoomServiceClient.deleteRoom(roomName)
   *      - Do not throw if LiveKit deletion fails (log the error)
   *      - The call log update is what matters (admin forced termination)
   *
   * @param roomName LiveKit room name to terminate
   * @throws NotFoundException if room_name not found in voice_call_log
   */
  async forceEndRoom(roomName: string): Promise<void> {
    // Step 1: Find the call log by room_name
    const callLog = await this.prisma.voice_call_log.findFirst({
      where: { room_name: roomName },
      select: { id: true, status: true },
    });

    if (!callLog) {
      throw new NotFoundException(`Call with room_name "${roomName}" not found`);
    }

    // Step 2: Update status to 'failed' and mark as force-terminated
    await this.prisma.voice_call_log.update({
      where: { id: callLog.id },
      data: {
        status: 'failed',
        ended_at: new Date(),
        error_message: 'Force terminated by admin',
      },
    });

    this.logger.log(`Call ${roomName} marked as force-terminated in database`);

    // Step 3: Attempt to delete LiveKit room (best effort — do not throw if fails)
    try {
      const livekitConfig = await this.globalConfigService.getLiveKitConfig();

      if (!livekitConfig.url || !livekitConfig.apiKey || !livekitConfig.apiSecret) {
        this.logger.warn('LiveKit credentials not configured — cannot delete room remotely');
        return;
      }

      const roomService = new RoomServiceClient(
        livekitConfig.url,
        livekitConfig.apiKey,
        livekitConfig.apiSecret,
      );

      await roomService.deleteRoom(roomName);
      this.logger.log(`LiveKit room ${roomName} deleted successfully`);

    } catch (error) {
      // Log the error but do not throw — call log update already succeeded
      this.logger.error(
        `Failed to delete LiveKit room ${roomName}: ${error.message}`,
        error.stack,
      );
    }
  }
}
