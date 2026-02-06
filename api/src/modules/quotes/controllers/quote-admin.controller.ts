import {
  Controller,
  Get,
  Delete,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
  ForbiddenException,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuoteDashboardService } from '../services/quote-dashboard.service';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { AdminTenantService } from '../services/admin-tenant.service';
import { AdminOperationsService } from '../services/admin-operations.service';
import { AdminReportingService } from '../services/admin-reporting.service';
import {
  DashboardOverviewQueryDto,
  DashboardOverviewResponseDto,
  QuoteTrendsQueryDto,
  QuoteTrendsResponseDto,
  ConversionFunnelQueryDto,
  ConversionFunnelResponseDto,
  SystemHealthResponseDto,
  RevenueAnalyticsQueryDto,
  RevenueAnalyticsResponseDto,
  TenantsListQueryDto,
  TenantsListResponseDto,
  TenantStatsQueryDto,
  TenantStatsResponseDto,
  TenantComparisonQueryDto,
  TenantComparisonResponseDto,
  TenantActivityQueryDto,
  TenantActivityResponseDto,
  TenantConfigurationResponseDto,
  PricingBenchmarksQueryDto,
  PricingBenchmarksResponseDto,
  GenerateReportDto,
  GenerateReportResponseDto,
  ReportStatusResponseDto,
  CreateScheduledReportDto,
  UpdateScheduledReportDto,
  ScheduledReportResponseDto,
  ScheduledReportsListResponseDto,
} from '../dto/admin';
import {
  HardDeleteQuoteDto,
  HardDeleteQuoteResponseDto,
  BulkUpdateQuoteStatusDto,
  BulkUpdateResponseDto,
  RepairQuoteDto,
  RepairQuoteResponseDto,
  RunDiagnosticsQueryDto,
  DiagnosticsResponseDto,
  CleanupOrphansDto,
  CleanupOrphansResponseDto,
  ListQuotesCrossTenantQueryDto,
  CrossTenantQuotesResponseDto,
} from '../dto/operational';

/**
 * QuoteAdminController
 *
 * Platform admin dashboard (PLATFORM ADMIN ONLY)
 * Global analytics across all tenants (6 endpoints)
 *
 * @author Developer 5
 */
@ApiTags('Admin - Quotes Dashboard')
@ApiBearerAuth()
@Controller('admin/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PlatformAdmin')
export class QuoteAdminController {
  private readonly logger = new Logger(QuoteAdminController.name);

  constructor(
    private readonly dashboardService: QuoteDashboardService,
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminTenantService: AdminTenantService,
    private readonly adminOperationsService: AdminOperationsService,
    private readonly adminReportingService: AdminReportingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard/overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get platform-wide quote statistics and trends (Platform Admin)',
  })
  @ApiResponse({
    status: 200,
    type: DashboardOverviewResponseDto,
    description: 'Dashboard overview returned',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async getGlobalOverview(
    @Query() query: DashboardOverviewQueryDto,
    @Request() req,
  ): Promise<DashboardOverviewResponseDto> {
    // Defensive check (redundant with @Roles guard, but safe)
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const dateFrom = query.date_from ? new Date(query.date_from) : undefined;
    const dateTo = query.date_to ? new Date(query.date_to) : undefined;

    return await this.adminAnalyticsService.getDashboardOverview(
      dateFrom,
      dateTo,
    );
  }

  @Get('dashboard/quote-trends')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get quote volume and revenue trends over time (Platform Admin)',
  })
  @ApiResponse({
    status: 200,
    type: QuoteTrendsResponseDto,
    description: 'Quote trends data returned',
  })
  @ApiResponse({ status: 400, description: 'Invalid date range or interval' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async getQuoteTrends(
    @Query() query: QuoteTrendsQueryDto,
    @Request() req,
  ): Promise<QuoteTrendsResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const dateFrom = new Date(query.date_from);
    const dateTo = new Date(query.date_to);
    const interval = query.interval || 'day';

    return await this.adminAnalyticsService.getQuoteTrends(
      dateFrom,
      dateTo,
      interval,
    );
  }

  @Get('dashboard/conversion-funnel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get quote conversion funnel stages and rates (Platform Admin)',
  })
  @ApiResponse({
    status: 200,
    type: ConversionFunnelResponseDto,
    description: 'Conversion funnel data returned',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async getConversionFunnel(
    @Query() query: ConversionFunnelQueryDto,
    @Request() req,
  ): Promise<ConversionFunnelResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const dateFrom = query.date_from ? new Date(query.date_from) : undefined;
    const dateTo = query.date_to ? new Date(query.date_to) : undefined;

    return await this.adminAnalyticsService.getConversionFunnel(
      dateFrom,
      dateTo,
    );
  }

  @Get('dashboard/system-health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get real-time system health metrics (Platform Admin)',
  })
  @ApiResponse({
    status: 200,
    type: SystemHealthResponseDto,
    description: 'System health metrics returned',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async getSystemHealth(@Request() req): Promise<SystemHealthResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminAnalyticsService.getSystemHealth();
  }

  @Get('dashboard/revenue-analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get revenue analytics grouped by vendor or tenant (Platform Admin)',
  })
  @ApiResponse({
    status: 200,
    type: RevenueAnalyticsResponseDto,
    description: 'Revenue analytics returned',
  })
  @ApiResponse({ status: 400, description: 'Invalid date range or grouping' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async getRevenueAnalytics(
    @Query() query: RevenueAnalyticsQueryDto,
    @Request() req,
  ): Promise<RevenueAnalyticsResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const dateFrom = new Date(query.date_from);
    const dateTo = new Date(query.date_to);
    const groupBy = query.group_by === 'none' ? undefined : query.group_by;

    return await this.adminAnalyticsService.getRevenueAnalytics(
      dateFrom,
      dateTo,
      groupBy,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all quotes across all tenants (Platform Admin)',
  })
  @ApiResponse({
    status: 200,
    type: CrossTenantQuotesResponseDto,
    description: 'Quotes list returned',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async listAllQuotes(
    @Query() query: ListQuotesCrossTenantQueryDto,
    @Request() req,
  ): Promise<CrossTenantQuotesResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminOperationsService.listQuotesCrossTenant(
      {
        tenantId: query.tenant_id,
        status: query.status,
        search: query.search,
        dateFrom: query.date_from ? new Date(query.date_from) : undefined,
        dateTo: query.date_to ? new Date(query.date_to) : undefined,
      },
      {
        page: query.page || 1,
        limit: query.limit || 50,
      },
    );
  }

  @Get('diagnostics/run-tests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run system diagnostics (Platform Admin)' })
  @ApiResponse({
    status: 200,
    type: DiagnosticsResponseDto,
    description: 'Diagnostics results',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async runDiagnostics(
    @Query() query: RunDiagnosticsQueryDto,
    @Request() req,
  ): Promise<DiagnosticsResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminOperationsService.runDiagnostics(
      query.test_type || 'all',
    );
  }

  @Post('maintenance/cleanup-orphans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cleanup orphaned records (Platform Admin)' })
  @ApiResponse({
    status: 200,
    type: CleanupOrphansResponseDto,
    description: 'Cleanup completed',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async cleanupOrphans(
    @Body() dto: CleanupOrphansDto,
    @Request() req,
  ): Promise<CleanupOrphansResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminOperationsService.cleanupOrphans(
      dto.entity_type,
      dto.dry_run !== false, // Default to true if not specified
    );
  }

  @Get('dashboard/global-item-pricing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get global item pricing benchmarks (Platform Admin)',
  })
  @ApiResponse({
    status: 200,
    type: PricingBenchmarksResponseDto,
    description: 'Global pricing benchmarks returned',
  })
  @ApiResponse({ status: 400, description: 'Invalid date range or parameters' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async getGlobalItemPricing(
    @Query() query: PricingBenchmarksQueryDto,
    @Request() req,
  ): Promise<PricingBenchmarksResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminReportingService.generatePricingBenchmarks({
      item_title_contains: query.item_title_contains,
      min_tenant_count: query.min_tenant_count || 5,
      date_from: query.date_from ? new Date(query.date_from) : undefined,
      date_to: query.date_to ? new Date(query.date_to) : undefined,
      limit: query.limit || 50,
    });
  }

  // ============================================================================
  // TENANT MANAGEMENT ENDPOINTS (Developer 2)
  // ============================================================================

  @Get('tenants')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List tenants with quote activity (Platform Admin)',
  })
  @ApiResponse({
    status: 200,
    type: TenantsListResponseDto,
    description: 'Tenants list returned successfully',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async listTenants(
    @Query() query: TenantsListQueryDto,
    @Request() req,
  ): Promise<TenantsListResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminTenantService.listTenantsWithQuoteActivity(
      {
        status: query.status,
        search: query.search,
        sortBy: query.sort_by,
      },
      {
        page: query.page,
        limit: query.limit,
      },
    );
  }

  @Get('tenants/compare')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compare tenants by metric (Platform Admin)' })
  @ApiResponse({
    status: 200,
    type: TenantComparisonResponseDto,
    description: 'Tenant comparison returned successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid metric or parameters' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async compareTenants(
    @Query() query: TenantComparisonQueryDto,
    @Request() req,
  ): Promise<TenantComparisonResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const dateFrom = query.date_from ? new Date(query.date_from) : undefined;
    const dateTo = query.date_to ? new Date(query.date_to) : undefined;

    return await this.adminTenantService.compareTenantsByMetric(
      query.metric,
      query.limit,
      { dateFrom, dateTo },
    );
  }

  @Get('tenants/:tenantId/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get tenant quote statistics (Platform Admin)' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant UUID',
    example: 'abc-123-def-456',
  })
  @ApiResponse({
    status: 200,
    type: TenantStatsResponseDto,
    description: 'Tenant statistics returned successfully',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenantStats(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query() query: TenantStatsQueryDto,
    @Request() req,
  ): Promise<TenantStatsResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const dateFrom = query.date_from ? new Date(query.date_from) : undefined;
    const dateTo = query.date_to ? new Date(query.date_to) : undefined;

    return await this.adminTenantService.getTenantQuoteStatistics(
      tenantId,
      dateFrom,
      dateTo,
    );
  }

  @Get('tenants/:tenantId/activity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get tenant activity timeline (Platform Admin)' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant UUID',
    example: 'abc-123-def-456',
  })
  @ApiResponse({
    status: 200,
    type: TenantActivityResponseDto,
    description: 'Activity timeline returned successfully',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenantActivity(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query() query: TenantActivityQueryDto,
    @Request() req,
  ): Promise<TenantActivityResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const dateFrom = query.date_from ? new Date(query.date_from) : undefined;
    const dateTo = query.date_to ? new Date(query.date_to) : undefined;

    return await this.adminTenantService.getTenantActivityTimeline(
      tenantId,
      dateFrom,
      dateTo,
      query.limit,
    );
  }

  @Get('tenants/:tenantId/config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get tenant configuration (Platform Admin)' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant UUID',
    example: 'abc-123-def-456',
  })
  @ApiResponse({
    status: 200,
    type: TenantConfigurationResponseDto,
    description: 'Configuration returned successfully',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenantConfiguration(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Request() req,
  ): Promise<TenantConfigurationResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminTenantService.getTenantConfiguration(tenantId);
  }

  // ============================================================================
  // REPORT GENERATION ENDPOINTS (Developer 4)
  // ============================================================================

  @Post('reports/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Generate custom report (Platform Admin)' })
  @ApiResponse({
    status: 202,
    type: GenerateReportResponseDto,
    description: 'Report generation queued',
  })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async generateReport(
    @Body() dto: GenerateReportDto,
    @Request() req,
  ): Promise<GenerateReportResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    // Support both root-level dates and parameters object
    const dateFrom = dto.date_from || dto.parameters?.date_from;
    const dateTo = dto.date_to || dto.parameters?.date_to;

    if (!dateFrom || !dateTo) {
      throw new BadRequestException('date_from and date_to are required');
    }

    return await this.adminReportingService.queueReportGeneration(
      dto.report_type,
      {
        date_from: new Date(dateFrom),
        date_to: new Date(dateTo),
        tenant_ids: dto.parameters?.tenant_ids,
        group_by: dto.parameters?.group_by,
      },
      dto.format,
      req.user.id,
    );
  }

  @Get('reports/:jobId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get report generation status (Platform Admin)' })
  @ApiParam({
    name: 'jobId',
    description: 'Job ID returned from generate endpoint',
  })
  @ApiResponse({
    status: 200,
    type: ReportStatusResponseDto,
    description: 'Report status returned',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Report job not found' })
  async getReportStatus(
    @Param('jobId') jobId: string,
    @Request() req,
  ): Promise<ReportStatusResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminReportingService.getReportStatus(jobId);
  }

  @Get('reports/:jobId/download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download generated report (Platform Admin)' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Report file stream' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Report not found or not ready' })
  async downloadReport(
    @Param('jobId') jobId: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    // Get job status to get file path
    const status = await this.adminReportingService.getReportStatus(jobId);

    if (status.status !== 'completed' || !status.download_url) {
      throw new BadRequestException('Report is not ready for download');
    }

    // Get export job to get file path
    const job = await this.prisma.export_job.findUnique({
      where: { id: jobId },
    });

    if (!job || !job.file_path) {
      throw new BadRequestException('Report file not found');
    }

    // Determine content type based on file extension
    const extension = job.file_path.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (extension === 'csv') contentType = 'text/csv';
    else if (extension === 'xlsx')
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (extension === 'pdf') contentType = 'application/pdf';

    // Set response headers
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="report_${jobId}.${extension}"`,
    });

    // Stream file
    const file = createReadStream(job.file_path);
    return new StreamableFile(file);
  }

  @Get('reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List recent report generation jobs (Platform Admin)',
  })
  @ApiResponse({ status: 200, description: 'Report jobs list returned' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async listReportJobs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?,
  ): Promise<any> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const pageNum = page || 1;
    const limitNum = limit || 20;
    const skip = (pageNum - 1) * limitNum;

    const [jobs, total] = await Promise.all([
      this.prisma.export_job.findMany({
        where: {
          export_type: {
            in: [
              'quote_summary',
              'tenant_performance',
              'revenue_analysis',
              'conversion_analysis',
            ],
          },
        },
        orderBy: { created_at: 'desc' },
        take: limitNum,
        skip,
        include: {
          admin_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.export_job.count({
        where: {
          export_type: {
            in: [
              'quote_summary',
              'tenant_performance',
              'revenue_analysis',
              'conversion_analysis',
            ],
          },
        },
      }),
    ]);

    return {
      reports: jobs.map((job) => ({
        job_id: job.id,
        report_type: job.export_type,
        format: job.format,
        status: job.status,
        progress:
          job.status === 'processing'
            ? 50
            : job.status === 'completed'
              ? 100
              : 0,
        download_url:
          job.status === 'completed' && job.file_path
            ? `/admin/quotes/reports/${job.id}/download`
            : null,
        expires_at:
          job.status === 'completed' && job.completed_at
            ? new Date(
                job.completed_at.getTime() + 24 * 60 * 60 * 1000,
              ).toISOString()
            : null,
        error_message: job.error_message,
        created_at: job.created_at.toISOString(),
        completed_at: job.completed_at?.toISOString() || null,
        row_count: job.row_count,
        created_by: job.admin_user
          ? {
              id: job.admin_user.id,
              name: `${job.admin_user.first_name} ${job.admin_user.last_name}`,
              email: job.admin_user.email,
            }
          : null,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }

  // ========================================================================
  // SCHEDULED REPORTS (Phase 3)
  // ========================================================================

  /**
   * List all scheduled reports
   * GET /api/v1/admin/quotes/reports/scheduled
   */
  @Get('reports/scheduled')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all scheduled reports (Platform Admin)' })
  @ApiResponse({ status: 200, type: ScheduledReportsListResponseDto })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async listScheduledReports(
    @Request() req,
  ): Promise<ScheduledReportsListResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const reports = await this.adminReportingService.listScheduledReports();

    return {
      reports: reports.map((r) => ({
        id: r.id,
        admin_user_id: r.admin_user_id,
        name: r.name,
        report_type: r.report_type,
        schedule: r.schedule,
        parameters: r.parameters,
        format: r.format,
        recipients: r.recipients,
        is_active: r.is_active,
        next_run_at: r.next_run_at.toISOString(),
        last_run_at: r.last_run_at?.toISOString() || null,
        created_at: r.created_at.toISOString(),
        updated_at: r.updated_at.toISOString(),
        admin_user: r.admin_user,
      })),
      total: reports.length,
    };
  }

  /**
   * Create a scheduled report
   * POST /api/v1/admin/quotes/reports/scheduled
   */
  @Post('reports/scheduled')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a scheduled report (Platform Admin)' })
  @ApiBody({ type: CreateScheduledReportDto })
  @ApiResponse({ status: 201, type: ScheduledReportResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async createScheduledReport(
    @Body() dto: CreateScheduledReportDto,
    @Request() req,
  ): Promise<ScheduledReportResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const report = await this.adminReportingService.createScheduledReport(
      req.user.id,
      dto,
    );

    return {
      id: report.id,
      admin_user_id: report.admin_user_id,
      name: report.name,
      report_type: report.report_type,
      schedule: report.schedule,
      parameters: report.parameters,
      format: report.format,
      recipients: report.recipients,
      is_active: report.is_active,
      next_run_at: report.next_run_at.toISOString(),
      last_run_at: report.last_run_at?.toISOString() || null,
      created_at: report.created_at.toISOString(),
      updated_at: report.updated_at.toISOString(),
      admin_user: report.admin_user,
    };
  }

  /**
   * Get a single scheduled report
   * GET /api/v1/admin/quotes/reports/scheduled/:id
   */
  @Get('reports/scheduled/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get scheduled report details (Platform Admin)' })
  @ApiParam({ name: 'id', description: 'Scheduled report ID' })
  @ApiResponse({ status: 200, type: ScheduledReportResponseDto })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Scheduled report not found' })
  async getScheduledReport(
    @Param('id') id: string,
    @Request() req,
  ): Promise<ScheduledReportResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const report = await this.adminReportingService.getScheduledReport(id);

    return {
      id: report.id,
      admin_user_id: report.admin_user_id,
      name: report.name,
      report_type: report.report_type,
      schedule: report.schedule,
      parameters: report.parameters,
      format: report.format,
      recipients: report.recipients,
      is_active: report.is_active,
      next_run_at: report.next_run_at.toISOString(),
      last_run_at: report.last_run_at?.toISOString() || null,
      created_at: report.created_at.toISOString(),
      updated_at: report.updated_at.toISOString(),
      admin_user: report.admin_user,
    };
  }

  /**
   * Update a scheduled report
   * PATCH /api/v1/admin/quotes/reports/scheduled/:id
   */
  @Patch('reports/scheduled/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a scheduled report (Platform Admin)' })
  @ApiParam({ name: 'id', description: 'Scheduled report ID' })
  @ApiBody({ type: UpdateScheduledReportDto })
  @ApiResponse({ status: 200, type: ScheduledReportResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Scheduled report not found' })
  async updateScheduledReport(
    @Param('id') id: string,
    @Body() dto: UpdateScheduledReportDto,
    @Request() req,
  ): Promise<ScheduledReportResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    const report = await this.adminReportingService.updateScheduledReport(
      id,
      dto,
    );

    return {
      id: report.id,
      admin_user_id: report.admin_user_id,
      name: report.name,
      report_type: report.report_type,
      schedule: report.schedule,
      parameters: report.parameters,
      format: report.format,
      recipients: report.recipients,
      is_active: report.is_active,
      next_run_at: report.next_run_at.toISOString(),
      last_run_at: report.last_run_at?.toISOString() || null,
      created_at: report.created_at.toISOString(),
      updated_at: report.updated_at.toISOString(),
      admin_user: report.admin_user,
    };
  }

  /**
   * Delete a scheduled report
   * DELETE /api/v1/admin/quotes/reports/scheduled/:id
   */
  @Delete('reports/scheduled/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scheduled report (Platform Admin)' })
  @ApiParam({ name: 'id', description: 'Scheduled report ID' })
  @ApiResponse({
    status: 204,
    description: 'Scheduled report deleted successfully',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Scheduled report not found' })
  async deleteScheduledReport(
    @Param('id') id: string,
    @Request() req,
  ): Promise<void> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    await this.adminReportingService.deleteScheduledReport(id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get quote by ID (any tenant, Platform Admin)' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'Quote returned' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async getQuoteById(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.adminOperationsService.getQuoteById(id);
  }

  @Delete(':id/hard-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hard delete quote permanently (emergency only, Platform Admin)',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    type: HardDeleteQuoteResponseDto,
    description: 'Quote deleted permanently',
  })
  @ApiResponse({ status: 400, description: 'Confirmation required' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete - child quotes exist',
  })
  async hardDeleteQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HardDeleteQuoteDto,
    @Request() req,
  ): Promise<HardDeleteQuoteResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminOperationsService.hardDeleteQuote(
      id,
      dto.reason,
      dto.confirm,
      req.user.id,
      req.ip,
    );
  }

  @Post('bulk-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update quote status (Platform Admin)' })
  @ApiResponse({
    status: 200,
    type: BulkUpdateResponseDto,
    description: 'Bulk update completed',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  async bulkUpdateQuoteStatus(
    @Body() dto: BulkUpdateQuoteStatusDto,
    @Request() req,
  ): Promise<BulkUpdateResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminOperationsService.bulkUpdateQuoteStatus(
      dto.quote_ids,
      dto.new_status,
      dto.reason,
      req.user.id,
    );
  }

  @Post(':id/repair')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Repair broken quote (Platform Admin)' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    type: RepairQuoteResponseDto,
    description: 'Quote repaired successfully',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async repairQuote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepairQuoteDto,
    @Request() req,
  ): Promise<RepairQuoteResponseDto> {
    if (!req.user?.is_platform_admin) {
      throw new ForbiddenException('Platform Admin privileges required');
    }

    return await this.adminOperationsService.repairQuote(
      id,
      dto.issue_type,
      dto.notes,
      req.user.id,
    );
  }
}
