import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { DashboardService } from '../services/dashboard.service';

@ApiTags('Admin - Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /admin/dashboard/metrics
   * Get all dashboard metrics
   * Accessible by: Platform Admin only
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Get all dashboard metrics',
    description: 'Returns comprehensive dashboard metrics including active tenants, total users, job success rate, storage usage, and system health',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        activeTenants: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 150 },
            growth: {
              type: 'object',
              properties: {
                count: { type: 'number', example: 12 },
                percentage: { type: 'number', example: 8.7 },
                trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' },
              },
            },
            sparkline: { type: 'array', items: { type: 'number' }, example: [1, 2, 3, 5, 4] },
          },
        },
        totalUsers: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 2450 },
            growth: {
              type: 'object',
              properties: {
                count: { type: 'number', example: 87 },
                percentage: { type: 'number', example: 3.7 },
                trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' },
              },
            },
            sparkline: { type: 'array', items: { type: 'number' } },
          },
        },
        jobSuccessRate: {
          type: 'object',
          properties: {
            percentage: { type: 'number', example: 98.5 },
            totalJobs: { type: 'number', example: 1247 },
            failedJobs: { type: 'number', example: 19 },
            status: { type: 'string', enum: ['healthy', 'warning', 'critical'], example: 'healthy' },
          },
        },
        storageUsed: {
          type: 'object',
          properties: {
            current: { type: 'number', example: 45.67, description: 'Storage used in GB' },
            limit: { type: 'number', example: 75000, description: 'Total storage limit in GB' },
            percentage: { type: 'number', example: 0.06 },
          },
        },
        systemHealth: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy'], example: 'healthy' },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'boolean', example: true },
                redis: { type: 'boolean', example: true },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getMetrics() {
    return this.dashboardService.getMetrics();
  }

  /**
   * GET /admin/dashboard/charts/:chartType
   * Get chart data for dashboard visualizations
   * Accessible by: Platform Admin only
   */
  @Get('charts/:chartType')
  @ApiOperation({
    summary: 'Get chart data',
    description: 'Returns time-series or distribution data for dashboard charts',
  })
  @ApiParam({
    name: 'chartType',
    required: true,
    enum: ['tenant-growth', 'user-signups', 'job-trends', 'tenants-by-industry', 'tenants-by-size', 'users-by-role'],
    description: 'Type of chart data to retrieve',
  })
  @ApiResponse({
    status: 200,
    description: 'Chart data retrieved successfully',
    schema: {
      oneOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2026-01-09' },
              count: { type: 'number', example: 5 },
              cumulative: { type: 'number', example: 150 },
            },
          },
          description: 'Time-series data (for tenant-growth, user-signups)',
        },
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2026-01-09' },
              success: { type: 'number', example: 120 },
              failed: { type: 'number', example: 3 },
              successRate: { type: 'number', example: 97.6 },
            },
          },
          description: 'Job trends data',
        },
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', example: 'Painting' },
              count: { type: 'number', example: 45 },
              percentage: { type: 'number', example: 30.0 },
            },
          },
          description: 'Distribution data (for industry, size, role charts)',
        },
      ],
    },
  })
  @ApiResponse({ status: 400, description: 'Unknown chart type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getChartData(@Param('chartType') chartType: string) {
    const validChartTypes = [
      'tenant-growth',
      'user-signups',
      'job-trends',
      'tenants-by-industry',
      'tenants-by-size',
      'users-by-role',
    ];

    if (!validChartTypes.includes(chartType)) {
      throw new BadRequestException(`Invalid chart type. Must be one of: ${validChartTypes.join(', ')}`);
    }

    return this.dashboardService.getChartData(chartType);
  }

  /**
   * GET /admin/dashboard/activity
   * Get recent activity feed
   * Accessible by: Platform Admin only
   */
  @Get('activity')
  @ApiOperation({
    summary: 'Get recent activity feed',
    description: 'Returns recent actions from audit log (last 10 by default)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Number of activity items to return (default: 10, max: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent activity retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'abc123' },
          action: { type: 'string', enum: ['created', 'updated', 'deleted', 'failed'], example: 'created' },
          entity: { type: 'string', example: 'tenant' },
          entityId: { type: 'string', example: 'tenant-123' },
          description: { type: 'string', example: 'New tenant created: Acme Roofing' },
          actor: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string', example: 'user-123' },
              name: { type: 'string', example: 'John Doe' },
              email: { type: 'string', example: 'john@example.com' },
            },
          },
          timestamp: { type: 'string', format: 'date-time', example: '2026-01-09T12:00:00Z' },
          status: { type: 'string', enum: ['success', 'failure'], example: 'success' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getRecentActivity(@Query('limit') limit?: number) {
    const activityLimit = Math.min(limit || 10, 50); // Max 50 items
    return this.dashboardService.getRecentActivity(activityLimit);
  }
}
