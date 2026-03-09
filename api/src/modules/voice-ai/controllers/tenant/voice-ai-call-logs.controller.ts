import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { VoiceCallLogService } from '../../services/voice-call-log.service';
import { VoiceUsageService } from '../../services/voice-usage.service';

/**
 * VoiceAiCallLogsController — Tenant
 *
 * Read-only access to the authenticated tenant's call history and usage summary.
 *
 * Route prefix: /api/v1/voice-ai/call-logs and /api/v1/voice-ai/usage
 * Auth: JwtAuthGuard — any authenticated tenant user (tenant_id extracted from JWT)
 *
 * Endpoints:
 *   GET /api/v1/voice-ai/call-logs              — paginated call log list
 *   GET /api/v1/voice-ai/call-logs/:id          — single call log with full transcript
 *   GET /api/v1/voice-ai/usage                  — monthly usage summary
 */
@ApiTags('Voice AI - Tenant Call Logs & Usage')
@ApiBearerAuth()
@Controller('voice-ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceAiCallLogsController {
  constructor(
    private readonly callLogService: VoiceCallLogService,
    private readonly usageService: VoiceUsageService,
  ) {}

  // ─── Call Logs ──────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/voice-ai/call-logs
   *
   * Returns a paginated list of call logs for the authenticated tenant.
   * Ordered by started_at descending (most recent first).
   *
   * Query params:
   *   from    — ISO date string (inclusive lower bound on started_at)
   *   to      — ISO date string (inclusive upper bound on started_at)
   *   outcome — filter by outcome (lead_created | transferred | abandoned)
   *   page    — 1-based page index (default: 1)
   *   limit   — records per page (default: 20, max: 100)
   */
  @Get('call-logs')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'List tenant call logs',
    description:
      'Returns paginated call logs for the authenticated tenant, ' +
      'ordered by started_at descending. Supports date range, outcome, and pagination filters.',
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
    description: 'Paginated call log list with meta',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — valid JWT required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — Owner, Admin, or Manager role required',
  })
  findCallLogs(
    @Request() req: { user: { tenant_id: string } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('outcome') outcome?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.callLogService.findByTenantId(req.user.tenant_id, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      outcome: outcome || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /api/v1/voice-ai/call-logs/:id
   *
   * Returns a single call log by ID including the full transcript.
   * The log must belong to the authenticated tenant — cross-tenant access is blocked.
   */
  @Get('call-logs/:id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get single call log detail',
    description:
      'Returns a single call log by UUID, including full_transcript and actions_taken. ' +
      'The log must belong to the authenticated tenant.',
  })
  @ApiParam({ name: 'id', description: 'voice_call_log UUID' })
  @ApiResponse({ status: 200, description: 'Call log detail returned' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — valid JWT required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — Owner, Admin, or Manager role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Call log not found or belongs to a different tenant',
  })
  findCallLogById(
    @Request() req: { user: { tenant_id: string } },
    @Param('id') id: string,
  ) {
    return this.callLogService.findById(req.user.tenant_id, id);
  }

  // ─── Usage ──────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/voice-ai/usage
   *
   * Returns the monthly usage summary for the authenticated tenant.
   * Aggregates STT seconds, LLM tokens, TTS characters, and estimated cost
   * from per-call voice_usage_record rows, grouped by provider.
   *
   * Query params:
   *   year   — integer year (default: current year)
   *   month  — integer month 1–12 (default: current month)
   */
  @Get('usage')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get tenant monthly usage summary',
    description:
      'Returns monthly usage aggregated from per-call voice_usage_record rows. ' +
      'Includes total STT seconds (used for quota calculation), LLM tokens, ' +
      'TTS characters, estimated cost, and a per-provider breakdown. ' +
      'Defaults to the current calendar month.',
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
  @ApiResponse({ status: 200, description: 'Monthly usage summary returned' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — valid JWT required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — Owner, Admin, or Manager role required',
  })
  getUsageSummary(
    @Request() req: { user: { tenant_id: string } },
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    // Use || so NaN (from parseInt("abc")) falls back to the current date component
    const resolvedYear = year
      ? parseInt(year, 10) || now.getFullYear()
      : now.getFullYear();
    const resolvedMonth = month
      ? parseInt(month, 10) || now.getMonth() + 1
      : now.getMonth() + 1;

    return this.usageService.getUsageSummary(
      req.user.tenant_id,
      resolvedYear,
      resolvedMonth,
    );
  }
}
