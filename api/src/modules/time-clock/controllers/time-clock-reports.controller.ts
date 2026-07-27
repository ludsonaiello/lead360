import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import type { AuthenticatedUser } from '../../auth/entities/jwt-payload.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import {
  ActivityFeedDto,
  GeoViolationsReportDto,
  PayrollReportDto,
  ShiftVarianceReportDto,
  TimesheetReportDto,
} from '../dto/reports.dto';
import { TimeClockReportsService } from '../services/time-clock-reports.service';

@ApiTags('Time Clock - Reports')
@ApiBearerAuth()
@Controller('time-clock/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeClockReportsController {
  constructor(private readonly reportsService: TimeClockReportsService) {}

  @Get('timesheet')
  @Roles('Owner', 'Admin', 'Project Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get timesheet report grouped by employee and day',
  })
  @ApiResponse({ status: 200, description: 'Timesheet report' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getTimesheetReport(
    @TenantId() tenantId: string,
    @Query() query: TimesheetReportDto,
  ) {
    return this.reportsService.getTimesheetReport(tenantId, query);
  }

  @Get('payroll')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Get payroll summary report' })
  @ApiResponse({
    status: 200,
    description: 'Payroll report with pay calculations',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getPayrollReport(
    @TenantId() tenantId: string,
    @Query() query: PayrollReportDto,
  ) {
    return this.reportsService.getPayrollReport(tenantId, query);
  }

  @Get('payroll/export')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export payroll report as CSV file' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async exportPayrollCsv(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PayrollReportDto,
    @Res() res: Response,
  ): Promise<void> {
    const { csv, filename } = await this.reportsService.exportPayrollCsv(
      tenantId,
      user.id,
      query,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('shift-variance')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Get shift variance report' })
  @ApiResponse({
    status: 200,
    description: 'Shift variance data with scheduled vs actual',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getShiftVarianceReport(
    @TenantId() tenantId: string,
    @Query() query: ShiftVarianceReportDto,
  ) {
    return this.reportsService.getShiftVarianceReport(tenantId, query);
  }

  @Get('geo-violations')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get geo-violation report' })
  @ApiResponse({
    status: 200,
    description: 'Sessions flagged for geofence violations',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getGeoViolationsReport(
    @TenantId() tenantId: string,
    @Query() query: GeoViolationsReportDto,
  ) {
    return this.reportsService.getGeoViolationsReport(tenantId, query);
  }

  @Get('activity-feed')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({
    summary: 'Get activity feed of recent time clock events',
  })
  @ApiResponse({ status: 200, description: 'Unified activity feed' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getActivityFeed(
    @TenantId() tenantId: string,
    @Query() query: ActivityFeedDto,
  ) {
    return this.reportsService.getActivityFeed(tenantId, query);
  }
}
