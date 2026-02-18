import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
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
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../admin/guards/platform-admin.guard';
import { VoiceAiMonitoringService } from '../../services/voice-ai-monitoring.service';
import { AdminOverrideTenantVoiceDto } from '../../dto/admin-override-tenant-voice.dto';

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
