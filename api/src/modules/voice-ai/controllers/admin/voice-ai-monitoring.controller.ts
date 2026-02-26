import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../admin/guards/platform-admin.guard';
import { VoiceAiMonitoringService } from '../../services/voice-ai-monitoring.service';
import { AdminOverrideTenantVoiceDto } from '../../dto/admin-override-tenant-voice.dto';
import { AgentStatusDto } from '../../dto/agent-status.dto';
import { ActiveRoomDto } from '../../dto/active-room.dto';

/**
 * VoiceAiMonitoringController — System Admin (Sprint B11)
 *
 * Platform admin endpoints for cross-tenant Voice AI monitoring and tenant override management.
 * All endpoints are admin-only (is_platform_admin: true).
 *
 * Route prefix: /api/v1/system/voice-ai
 * Access: Platform Admin only (JwtAuthGuard + PlatformAdminGuard)
 *
 * Endpoints:
 *   GET   /api/v1/system/voice-ai/tenants                      — all tenants with Voice AI summary
 *   GET   /api/v1/system/voice-ai/tenants/:tenantId/override   — get current override settings for tenant
 *   PATCH /api/v1/system/voice-ai/tenants/:tenantId/override   — admin override for specific tenant
 *
 * Note: GET /call-logs and GET /usage-report are implemented in VoiceAiAdminCallLogsController
 *       and intentionally kept there to avoid route conflicts.
 */
@ApiTags('Voice AI - System Admin Monitoring')
@ApiBearerAuth()
@Controller('system/voice-ai')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class VoiceAiMonitoringController {
  constructor(private readonly monitoringService: VoiceAiMonitoringService) {}

  // ─── Agent Status ───────────────────────────────────────────────────────────

  /**
   * GET /api/v1/system/voice-ai/agent/status
   *
   * Returns the health status and metrics of the Voice AI agent worker.
   * Used by platform admin to monitor agent health, connectivity, and call volume.
   *
   * Response includes:
   *   - is_running: Whether the LiveKit worker is running
   *   - agent_enabled: Whether agent is enabled in global config
   *   - livekit_connected: Whether agent is connected to LiveKit
   *   - active_calls: Number of calls currently in progress
   *   - today_calls: Total calls today
   *   - this_month_calls: Total calls this month
   */
  @Get('agent/status')
  @ApiOperation({
    summary: 'Get Voice AI agent health status',
    description:
      'Returns the health status and metrics of the Voice AI agent worker. ' +
      'Includes running status, connectivity, and call volume statistics. ' +
      'Platform Admin access required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent status retrieved successfully',
    type: AgentStatusDto,
    schema: {
      example: {
        is_running: true,
        agent_enabled: true,
        livekit_connected: true,
        active_calls: 3,
        today_calls: 47,
        this_month_calls: 342,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  getAgentStatus(): Promise<AgentStatusDto> {
    return this.monitoringService.getAgentStatus();
  }

  // ─── Active Rooms ───────────────────────────────────────────────────────────

  /**
   * GET /api/v1/system/voice-ai/rooms
   *
   * Returns a list of all active calls (calls with status='in_progress').
   * Each room represents an ongoing Voice AI conversation.
   *
   * Response includes call details, tenant info, duration, and room name.
   */
  @Get('rooms')
  @ApiOperation({
    summary: 'List all active Voice AI calls',
    description:
      'Returns a list of all active calls (status=in_progress). ' +
      'Includes call details, tenant info, and duration. ' +
      'Platform Admin access required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active calls list retrieved successfully',
    type: [ActiveRoomDto],
    schema: {
      example: [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          company_name: 'Acme Plumbing',
          call_sid: 'CA123456789abcdef',
          room_name: 'tenant_abc123_call_CA123456',
          from_number: '+15551234567',
          to_number: '+15559876543',
          direction: 'inbound',
          duration_seconds: 127,
          started_at: '2026-02-22T14:30:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  getActiveRooms(): Promise<ActiveRoomDto[]> {
    return this.monitoringService.getActiveRooms();
  }

  // ─── Force End Room ─────────────────────────────────────────────────────────

  /**
   * POST /api/v1/system/voice-ai/rooms/:roomName/end
   *
   * Force-terminates a specific call by room name.
   * Admin-only emergency operation for terminating problematic calls.
   *
   * Actions performed:
   *   1. Updates voice_call_log status to 'failed'
   *   2. Sets ended_at to current timestamp
   *   3. Sets error_message to 'Force terminated by admin'
   *   4. Attempts to delete the LiveKit room (best effort)
   *
   * Returns 204 No Content on success.
   */
  @Post('rooms/:roomName/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Force-terminate a specific call',
    description:
      'Force-terminates a call by room name. Updates the call log to failed status ' +
      'and attempts to disconnect the LiveKit room. Emergency admin-only operation. ' +
      'Platform Admin access required.',
  })
  @ApiParam({
    name: 'roomName',
    description: 'LiveKit room name to terminate',
    example: 'tenant_abc123_call_CA123456',
  })
  @ApiResponse({ status: 204, description: 'Call terminated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async forceEndRoom(@Param('roomName') roomName: string): Promise<void> {
    return this.monitoringService.forceEndRoom(roomName);
  }

  // ─── Agent Logs (SSE) ───────────────────────────────────────────────────────

  /**
   * GET /api/v1/system/voice-ai/agent/logs
   *
   * Streams agent logs via Server-Sent Events (SSE).
   * Returns a continuous stream of log entries from the Voice AI agent.
   *
   * Response format: EventSource stream of log entries
   * Each event contains: { timestamp, level, message, data }
   *
   * NOTE: This is a placeholder implementation that emits heartbeat events.
   * Full implementation would integrate with a log buffer or Winston transport.
   */
  @Sse('agent/logs')
  @ApiOperation({
    summary: 'Stream agent logs via SSE',
    description:
      'Returns a Server-Sent Events (SSE) stream of Voice AI agent log entries. ' +
      'Useful for real-time monitoring of agent activity. ' +
      'Platform Admin access required.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream of log entries',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  streamLogs(@Req() req): Observable<MessageEvent> {
    // Placeholder implementation: emits a heartbeat every 5 seconds
    // TODO: Integrate with actual log buffer/stream from VoiceAgentService
    return interval(5000).pipe(
      map((index) => ({
        data: {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Agent heartbeat',
          data: { index },
        },
      })),
    );
  }

  // ─── Tenant Overview ────────────────────────────────────────────────────────

  /**
   * GET /api/v1/system/voice-ai/tenants
   *
   * Returns a paginated list of all tenants with their Voice AI summary.
   * Includes plan info, enabled status, monthly quota, current usage, and override flag.
   *
   * Query params:
   *   page   — 1-based page index (default: 1)
   *   limit  — records per page (default: 20, max: 100)
   *   search — optional company_name substring filter (case-insensitive)
   */
  @Get('tenants')
  @ApiOperation({
    summary: 'List all tenants with Voice AI summary',
    description:
      'Returns a paginated list of all tenants with their Voice AI status, ' +
      'plan info, monthly quota, current usage (minutes), and whether admin overrides are active. ' +
      'Platform Admin access required.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number, 1-based (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Records per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter by company name (partial match)',
    example: 'Acme',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated tenant Voice AI overview list with meta',
    schema: {
      example: {
        data: [
          {
            tenant_id: 'uuid',
            company_name: 'Acme Plumbing',
            plan_name: 'Professional',
            voice_ai_included_in_plan: true,
            is_enabled: true,
            minutes_included: 500,
            minutes_used: 47,
            has_admin_override: false,
          },
        ],
        meta: {
          total: 42,
          page: 1,
          limit: 20,
          total_pages: 3,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  getTenantsOverview(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.monitoringService.getTenantsVoiceAiOverview({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search: search || undefined,
    });
  }

  // ─── Tenant Override ────────────────────────────────────────────────────────

  /**
   * GET /api/v1/system/voice-ai/tenants/:tenantId/override
   *
   * Retrieves current admin override settings for a specific tenant.
   * Returns all override fields (null if not set).
   * Used by frontend to pre-populate the override form with existing values.
   *
   * Response includes:
   *   - force_enabled: boolean | null (is_enabled value if overridden)
   *   - monthly_minutes_override: number | null
   *   - stt_provider_override_id: string | null
   *   - llm_provider_override_id: string | null
   *   - tts_provider_override_id: string | null
   *   - admin_notes: string | null
   */
  @Get('tenants/:tenantId/override')
  @ApiOperation({
    summary: 'Get current tenant override settings',
    description:
      'Retrieves the current admin override settings for a specific tenant. ' +
      'Returns all override fields with null for unset values. ' +
      'Used by frontend to pre-populate the override form. ' +
      'Platform Admin access required.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Target tenant UUID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: 200,
    description: 'Current override settings (null values indicate no override)',
    schema: {
      example: {
        force_enabled: true,
        monthly_minutes_override: 1000,
        stt_provider_override_id: 'uuid-here',
        llm_provider_override_id: null,
        tts_provider_override_id: null,
        admin_notes: 'VIP customer - extra quota',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getTenantOverride(@Param('tenantId') tenantId: string) {
    return this.monitoringService.getTenantOverride(tenantId);
  }

  /**
   * PATCH /api/v1/system/voice-ai/tenants/:tenantId/override
   *
   * Applies admin infrastructure overrides to a specific tenant's Voice AI settings.
   * Upserts tenant_voice_ai_settings — creates the row if it doesn't exist.
   *
   * Only fields explicitly included in the body are modified.
   * Sending null for a field clears that override (reverts to plan/global default).
   *
   * If force_enabled is true/false, is_enabled is set accordingly.
   * If force_enabled is null, is_enabled is left unchanged (tenant controls again).
   */
  @Patch('tenants/:tenantId/override')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Apply admin override to a tenant Voice AI settings',
    description:
      "Upserts the tenant's Voice AI settings with admin infrastructure overrides. " +
      'Fields not included in the request body are left unchanged. ' +
      'Sending null for a field clears that override. ' +
      'Platform Admin access required.',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Target tenant UUID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({ status: 204, description: 'Override applied successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  overrideTenantSettings(
    @Param('tenantId') tenantId: string,
    @Body() dto: AdminOverrideTenantVoiceDto,
  ) {
    return this.monitoringService.overrideTenantVoiceSettings(tenantId, dto);
  }
}
