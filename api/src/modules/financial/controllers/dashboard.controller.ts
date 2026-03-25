import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { DashboardService } from '../services/dashboard.service';
import { PlQueryDto } from '../dto/pl-query.dto';
import { ArQueryDto } from '../dto/ar-query.dto';
import { ApQueryDto } from '../dto/ap-query.dto';
import { ForecastQueryDto } from '../dto/forecast-query.dto';

@ApiTags('Financial Dashboard')
@ApiBearerAuth()
@Controller('financial/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ===========================================================================
  // Endpoint 1 — GET /financial/dashboard/overview
  // ===========================================================================

  @Get('overview')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Get combined financial dashboard overview' })
  @ApiResponse({
    status: 200,
    description:
      'Dashboard overview with P&L, AR, AP, forecast, and alerts',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiQuery({
    name: 'forecast_days',
    required: false,
    type: Number,
    description: 'Forecast period: 30, 60, or 90 days (default 30)',
  })
  async getOverview(
    @TenantId() tenantId: string,
    @Query('forecast_days') forecastDays?: number,
  ) {
    return this.dashboardService.getOverview(tenantId, {
      forecast_days: forecastDays ? Number(forecastDays) : 30,
    });
  }

  // ===========================================================================
  // Endpoint 2 — GET /financial/dashboard/pl
  // ===========================================================================

  @Get('pl')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Monthly Profit & Loss report' })
  @ApiResponse({
    status: 200,
    description: 'P&L data for the requested year/month',
  })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({
    name: 'month',
    required: false,
    type: Number,
    description: '1-12. Omit for full year.',
  })
  @ApiQuery({
    name: 'include_pending',
    required: false,
    type: Boolean,
    description: 'Include pending_review entries in total_with_pending',
  })
  async getPL(
    @TenantId() tenantId: string,
    @Query() query: PlQueryDto,
  ) {
    return this.dashboardService.getPL(
      tenantId,
      query.year,
      query.month,
      query.include_pending,
    );
  }

  // ===========================================================================
  // Endpoint 3 — GET /financial/dashboard/ar
  // ===========================================================================

  @Get('ar')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Accounts receivable summary with aging buckets',
  })
  @ApiResponse({
    status: 200,
    description: 'AR summary, aging buckets, and invoice list',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by invoice status',
  })
  @ApiQuery({ name: 'overdue_only', required: false, type: Boolean })
  async getAR(
    @TenantId() tenantId: string,
    @Query() query: ArQueryDto,
  ) {
    return this.dashboardService.getAR(tenantId, {
      status: query.status,
      overdue_only: query.overdue_only,
    });
  }

  // ===========================================================================
  // Endpoint 4 — GET /financial/dashboard/ap
  // ===========================================================================

  @Get('ap')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Accounts payable awareness — what the business owes',
  })
  @ApiResponse({
    status: 200,
    description:
      'AP summary with subcontractor invoices, recurring upcoming, crew hours',
  })
  @ApiQuery({
    name: 'days_ahead',
    required: false,
    type: Number,
    description: 'Days ahead to look (default 30)',
  })
  async getAP(
    @TenantId() tenantId: string,
    @Query() query: ApQueryDto,
  ) {
    return this.dashboardService.getAP(
      tenantId,
      query.days_ahead ?? 30,
    );
  }

  // ===========================================================================
  // Endpoint 5 — GET /financial/dashboard/forecast
  // ===========================================================================

  @Get('forecast')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Cash flow forecast for next 30/60/90 days' })
  @ApiResponse({
    status: 200,
    description: 'Expected inflows, outflows, and net forecast',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid days parameter — must be 30, 60, or 90',
  })
  @ApiQuery({
    name: 'days',
    required: true,
    type: Number,
    description: 'Must be 30, 60, or 90',
  })
  async getForecast(
    @TenantId() tenantId: string,
    @Query() query: ForecastQueryDto,
  ) {
    return this.dashboardService.getForecast(tenantId, query.days);
  }

  // ===========================================================================
  // Endpoint 6 — GET /financial/dashboard/alerts
  // ===========================================================================

  @Get('alerts')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({
    summary:
      'Financial health alerts — automated flags for conditions requiring attention',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert list sorted by severity, max 50',
  })
  async getAlerts(@TenantId() tenantId: string) {
    return this.dashboardService.getAlerts(tenantId);
  }

  // ===========================================================================
  // Endpoint 7 — GET /financial/dashboard/pl/export
  // ===========================================================================

  @Get('pl/export')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export P&L as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  async exportPL(
    @TenantId() tenantId: string,
    @Query() query: PlQueryDto,
    @Res() res: Response,
  ) {
    const csvBuffer = await this.dashboardService.exportPL(
      tenantId,
      query.year,
      query.month,
    );

    const filename = query.month
      ? `pl-${query.year}-${String(query.month).padStart(2, '0')}.csv`
      : `pl-${query.year}.csv`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    res.send(csvBuffer);
  }
}
