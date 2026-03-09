import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../admin/guards/platform-admin.guard';
import { VoiceCallLogService } from '../../services/voice-call-log.service';
import { VoiceUsageService } from '../../services/voice-usage.service';

/**
 * VoiceAiAdminCallLogsController — System Admin
 *
 * Cross-tenant call log visibility and platform-wide usage reporting.
 * No tenant scoping is applied — returns data across all tenants.
 *
 * Route prefix: /api/v1/system/voice-ai
 * Access: Platform Admin only (JwtAuthGuard + PlatformAdminGuard)
 *
 * Endpoints:
 *   GET /api/v1/system/voice-ai/call-logs      — cross-tenant paginated call logs
 *   GET /api/v1/system/voice-ai/usage-report   — aggregate usage report across all tenants
 */
@ApiTags('Voice AI - System Admin Call Logs & Usage')
@ApiBearerAuth()
@Controller('system/voice-ai')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class VoiceAiAdminCallLogsController {
  constructor(
    private readonly callLogService: VoiceCallLogService,
    private readonly usageService: VoiceUsageService,
  ) {}

  // ─── Cross-Tenant Call Logs ─────────────────────────────────────────────────

  /**
   * GET /api/v1/system/voice-ai/call-logs
   *
   * Returns a paginated list of call logs across ALL tenants.
   * Optionally filter by tenant, date range, and outcome.
   *
   * Query params:
   *   tenantId — filter by a specific tenant UUID
   *   from     — ISO date string (inclusive lower bound on started_at)
   *   to       — ISO date string (inclusive upper bound on started_at)
   *   outcome  — filter by outcome (lead_created | transferred | abandoned)
   *   page     — 1-based page index (default: 1)
   *   limit    — records per page (default: 20, max: 100)
   */
  @Get('call-logs')
  @ApiOperation({
    summary: 'List all call logs (cross-tenant)',
    description:
      'Returns paginated call logs across all tenants. ' +
      'Optionally filtered by tenantId, date range, and outcome. ' +
      'Platform Admin access required.',
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    description: 'Filter by tenant UUID',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Start date (ISO 8601)',
    example: '2026-02-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'End date (ISO 8601)',
    example: '2026-02-28',
  })
  @ApiQuery({
    name: 'outcome',
    required: false,
    description: 'Filter by call outcome',
    enum: ['lead_created', 'transferred', 'abandoned'],
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Records per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Cross-tenant paginated call log list with meta',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  findAllCallLogs(
    @Query('tenantId') tenantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('outcome') outcome?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.callLogService.findAllAdmin({
      tenantId: tenantId || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      outcome: outcome || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── Cross-Tenant Usage Report ──────────────────────────────────────────────

  /**
   * GET /api/v1/system/voice-ai/usage-report
   *
   * Returns a platform-wide usage aggregate for the given year+month.
   * Includes total calls, total STT seconds, total estimated cost,
   * and a per-tenant breakdown sorted by estimated cost descending.
   *
   * Query params:
   *   year   — integer year (default: current year)
   *   month  — integer month 1–12 (default: current month)
   */
  @Get('usage-report')
  @ApiOperation({
    summary: 'Platform-wide usage report',
    description:
      'Returns an aggregate usage report across all tenants for the specified month. ' +
      'Includes total calls, STT seconds, estimated cost, and a per-tenant breakdown. ' +
      'Platform Admin access required.',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Year (default: current year)',
    example: 2026,
  })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Month 1–12 (default: current month)',
    example: 2,
  })
  @ApiResponse({ status: 200, description: 'Platform usage report returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  getUsageReport(@Query('year') year?: string, @Query('month') month?: string) {
    const now = new Date();
    // Use || so NaN (from parseInt("abc")) falls back to the current date component
    const resolvedYear = year
      ? parseInt(year, 10) || now.getFullYear()
      : now.getFullYear();
    const resolvedMonth = month
      ? parseInt(month, 10) || now.getMonth() + 1
      : now.getMonth() + 1;

    return this.usageService.getAdminUsageReport(resolvedYear, resolvedMonth);
  }
}
