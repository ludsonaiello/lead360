import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuoteDashboardService } from '../services/quote-dashboard.service';
import {
  GetDashboardOverviewDto,
  DashboardOverviewResponseDto,
  GetQuotesOverTimeDto,
  QuotesOverTimeResponseDto,
  GetTopItemsDto,
  TopItemsResponseDto,
  GetWinLossAnalysisDto,
  WinLossAnalysisResponseDto,
  GetConversionFunnelDto,
  ConversionFunnelResponseDto,
  GetRevenueByVendorDto,
  RevenueByVendorResponseDto,
  GetAvgPricingByTaskDto,
  AvgPricingByTaskResponseDto,
  ExportDashboardDto,
  ExportDashboardResponseDto,
} from '../dto/dashboard';

/**
 * QuoteDashboardController
 *
 * Tenant-specific dashboard analytics (8 endpoints)
 *
 * @author Developer 5
 */
@ApiTags('Quotes - Dashboard')
@ApiBearerAuth()
@Controller('quotes/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteDashboardController {
  private readonly logger = new Logger(QuoteDashboardController.name);

  constructor(private readonly dashboardService: QuoteDashboardService) {}

  /**
   * Parse date range with defaults (last 30 days)
   */
  private parseDateRange(dateFrom?: string, dateTo?: string): { from: Date; to: Date } {
    const to = dateTo ? new Date(dateTo) : new Date();
    const from = dateFrom ? new Date(dateFrom) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  @Get('overview')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get dashboard overview' })
  @ApiResponse({ status: 200, description: 'Dashboard overview returned', type: DashboardOverviewResponseDto })
  async getOverview(
    @Query() query: GetDashboardOverviewDto,
    @Request() req,
  ): Promise<DashboardOverviewResponseDto> {
    const tenantId = req.user.tenant_id;
    const { from, to } = this.parseDateRange(query.date_from, query.date_to);

    return await this.dashboardService.getOverview(tenantId, from, to, query.compare_to_previous || false);
  }

  @Get('quotes-over-time')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get quotes over time (time series)' })
  @ApiResponse({ status: 200, description: 'Time series data returned', type: QuotesOverTimeResponseDto })
  async getQuotesOverTime(
    @Query() query: GetQuotesOverTimeDto,
    @Request() req,
  ): Promise<QuotesOverTimeResponseDto> {
    const tenantId = req.user.tenant_id;
    const { from, to } = this.parseDateRange(query.date_from, query.date_to);

    return await this.dashboardService.getQuotesOverTime(tenantId, from, to, query.interval || 'day');
  }

  @Get('top-items')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get top items by usage' })
  @ApiResponse({ status: 200, description: 'Top items returned', type: TopItemsResponseDto })
  async getTopItems(
    @Query() query: GetTopItemsDto,
    @Request() req,
  ): Promise<TopItemsResponseDto> {
    const tenantId = req.user.tenant_id;
    const { from, to } = this.parseDateRange(query.date_from, query.date_to);

    return await this.dashboardService.getTopItems(tenantId, from, to, query.limit || 10);
  }

  @Get('win-loss-analysis')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get win/loss analysis' })
  @ApiResponse({ status: 200, description: 'Win/loss data returned', type: WinLossAnalysisResponseDto })
  async getWinLossAnalysis(
    @Query() query: GetWinLossAnalysisDto,
    @Request() req,
  ): Promise<WinLossAnalysisResponseDto> {
    const tenantId = req.user.tenant_id;
    const { from, to } = this.parseDateRange(query.date_from, query.date_to);

    return await this.dashboardService.getWinLossAnalysis(tenantId, from, to);
  }

  @Get('conversion-funnel')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get conversion funnel' })
  @ApiResponse({ status: 200, description: 'Conversion funnel returned', type: ConversionFunnelResponseDto })
  async getConversionFunnel(
    @Query() query: GetConversionFunnelDto,
    @Request() req,
  ): Promise<ConversionFunnelResponseDto> {
    const tenantId = req.user.tenant_id;
    const { from, to } = this.parseDateRange(query.date_from, query.date_to);

    return await this.dashboardService.getConversionFunnel(tenantId, from, to);
  }

  @Get('revenue-by-vendor')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get revenue by vendor' })
  @ApiResponse({ status: 200, description: 'Vendor revenue returned', type: RevenueByVendorResponseDto })
  async getRevenueByVendor(
    @Query() query: GetRevenueByVendorDto,
    @Request() req,
  ): Promise<RevenueByVendorResponseDto> {
    const tenantId = req.user.tenant_id;
    const { from, to } = this.parseDateRange(query.date_from, query.date_to);

    return await this.dashboardService.getRevenueByVendor(tenantId, from, to);
  }

  @Get('avg-pricing-by-task')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get average pricing by task' })
  @ApiResponse({ status: 200, description: 'Task pricing returned', type: AvgPricingByTaskResponseDto })
  async getAvgPricingByTask(
    @Query() query: GetAvgPricingByTaskDto,
    @Request() req,
  ): Promise<AvgPricingByTaskResponseDto> {
    const tenantId = req.user.tenant_id;
    const { from, to } = this.parseDateRange(query.date_from, query.date_to);

    return await this.dashboardService.getAvgPricingByTask(tenantId, from, to);
  }

  @Post('export')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export dashboard data' })
  @ApiResponse({ status: 200, description: 'Export file URL returned', type: ExportDashboardResponseDto })
  async exportDashboard(
    @Body() dto: ExportDashboardDto,
    @Request() req,
  ): Promise<ExportDashboardResponseDto> {
    const tenantId = req.user.tenant_id;
    const { from, to } = this.parseDateRange(dto.date_from, dto.date_to);

    return await this.dashboardService.exportDashboard(tenantId, dto.format, from, to, dto.sections);
  }
}
