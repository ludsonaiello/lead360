import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { ProjectDashboardService } from '../services/project-dashboard.service';
import { DashboardQueryDto, GanttQueryDto } from '../dto/dashboard-query.dto';

@ApiTags('Project Dashboard')
@ApiBearerAuth()
@Controller('projects/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectDashboardController {
  constructor(
    private readonly dashboardService: ProjectDashboardService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /projects/dashboard — Aggregated dashboard data
  // -------------------------------------------------------------------------
  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get project dashboard aggregated data',
    description:
      'Returns aggregated dashboard data including status distribution, ' +
      'active project counts, delayed/overdue task counts, upcoming deadlines, ' +
      'and recent activity feed. All data scoped to tenant.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by project status' })
  @ApiQuery({ name: 'assigned_pm_user_id', required: false, description: 'Filter by assigned PM user ID' })
  @ApiQuery({ name: 'date_from', required: false, description: 'Filter projects created on or after (ISO 8601)' })
  @ApiQuery({ name: 'date_to', required: false, description: 'Filter projects created on or before (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard aggregated data',
    schema: {
      type: 'object',
      properties: {
        total_projects: { type: 'number', example: 25 },
        status_distribution: {
          type: 'object',
          properties: {
            planned: { type: 'number', example: 5 },
            in_progress: { type: 'number', example: 12 },
            on_hold: { type: 'number', example: 3 },
            completed: { type: 'number', example: 4 },
            canceled: { type: 'number', example: 1 },
          },
        },
        active_projects: { type: 'number', example: 15 },
        delayed_tasks_count: { type: 'number', example: 8 },
        projects_with_delays: { type: 'number', example: 4 },
        overdue_tasks_count: { type: 'number', example: 3 },
        upcoming_deadlines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              project_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              project_name: { type: 'string', example: 'Kitchen Remodel' },
              target_completion_date: { type: 'string', example: '2026-04-15' },
              days_remaining: { type: 'number', example: 5 },
            },
          },
        },
        recent_activity: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              activity_type: { type: 'string', example: 'task_completed' },
              project_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              project_name: { type: 'string', example: 'Kitchen Remodel' },
              description: { type: 'string', example: 'Completed task: Install countertops' },
              user_id: { type: 'string', example: '660e8400-e29b-41d4-a716-446655440001' },
              user_name: { type: 'string', example: 'John Smith' },
              created_at: { type: 'string', example: '2026-03-16T10:30:00.000Z' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  async getDashboardData(
    @TenantId() tenantId: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getDashboardData(tenantId, {
      status: query.status,
      assigned_pm_user_id: query.assigned_pm_user_id,
      date_from: query.date_from,
      date_to: query.date_to,
    });
  }

  // -------------------------------------------------------------------------
  // GET /projects/dashboard/gantt — Project list for gantt/summary view
  // -------------------------------------------------------------------------
  @Get('gantt')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get projects with summary for gantt chart / list view',
    description:
      'Returns a paginated list of projects with task counts (total, completed, delayed), ' +
      'date ranges, contract values, and progress percentage. Suitable for rendering ' +
      'a gantt chart or detailed project list view.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by project status' })
  @ApiQuery({ name: 'assigned_pm_user_id', required: false, description: 'Filter by assigned PM user ID' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by project name or number' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated project list with summary data',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              project_number: { type: 'string', example: 'PRJ-0042' },
              name: { type: 'string', example: 'Kitchen Remodel' },
              status: { type: 'string', example: 'in_progress' },
              start_date: { type: 'string', example: '2026-03-01', nullable: true },
              target_completion_date: { type: 'string', example: '2026-04-15', nullable: true },
              actual_completion_date: { type: 'string', example: null, nullable: true },
              contract_value: { type: 'number', example: 25000.0, nullable: true },
              progress_percent: { type: 'number', example: 45.0 },
              assigned_pm: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                },
              },
              customer: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                },
              },
              task_count: { type: 'number', example: 12 },
              completed_task_count: { type: 'number', example: 5 },
              delayed_task_count: { type: 'number', example: 2 },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 25 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 2 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  async getProjectsWithSummary(
    @TenantId() tenantId: string,
    @Query() query: GanttQueryDto,
  ) {
    return this.dashboardService.getProjectsWithSummary(tenantId, {
      status: query.status,
      assigned_pm_user_id: query.assigned_pm_user_id,
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }
}
