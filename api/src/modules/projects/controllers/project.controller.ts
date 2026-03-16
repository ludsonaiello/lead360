import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ProjectService } from '../services/project.service';
import { ProjectTaskService } from '../services/project-task.service';
import { GanttDataService } from '../services/gantt-data.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateProjectFromQuoteDto } from '../dto/create-project-from-quote.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly projectTaskService: ProjectTaskService,
    private readonly ganttDataService: GanttDataService,
  ) {}

  // -------------------------------------------------------------------------
  // POST /projects — Create standalone project
  // -------------------------------------------------------------------------
  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a standalone project' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  async createStandalone(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.createStandalone(tenantId, userId, dto);
  }

  // -------------------------------------------------------------------------
  // POST /projects/from-quote/:quoteId — Create project from accepted quote
  // -------------------------------------------------------------------------
  @Post('from-quote/:quoteId')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a project from an accepted quote' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID to convert to project' })
  @ApiResponse({ status: 201, description: 'Project created from quote' })
  @ApiResponse({ status: 400, description: 'Quote status is invalid for conversion' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({ status: 409, description: 'A project already exists for this quote' })
  async createFromQuote(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: CreateProjectFromQuoteDto,
  ) {
    return this.projectService.createFromQuote(tenantId, userId, quoteId, dto);
  }

  // -------------------------------------------------------------------------
  // GET /projects — List projects (paginated)
  // -------------------------------------------------------------------------
  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Field')
  @ApiOperation({ summary: 'List projects (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (planned, in_progress, on_hold, completed, canceled)' })
  @ApiQuery({ name: 'assigned_pm_user_id', required: false, description: 'Filter by assigned PM user ID' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or project number' })
  @ApiResponse({ status: 200, description: 'Paginated list of projects' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('assigned_pm_user_id') assigned_pm_user_id?: string,
    @Query('search') search?: string,
  ) {
    return this.projectService.findAll(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      assigned_pm_user_id,
      search,
    });
  }

  // -------------------------------------------------------------------------
  // GET /projects/dashboard/delays — Sprint 16: Delay counts per project
  // -------------------------------------------------------------------------
  @Get('dashboard/delays')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get delayed task counts per project for the tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Delay dashboard with counts per project',
    schema: {
      type: 'object',
      properties: {
        total_delayed_tasks: { type: 'number', example: 12 },
        projects_with_delays: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              project_id: {
                type: 'string',
                example: '550e8400-e29b-41d4-a716-446655440000',
              },
              project_name: {
                type: 'string',
                example: 'Kitchen Remodel',
              },
              delayed_task_count: { type: 'number', example: 3 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  async getDelayDashboard(@TenantId() tenantId: string) {
    return this.projectTaskService.getDelayDashboard(tenantId);
  }

  // -------------------------------------------------------------------------
  // GET /projects/:id — Project detail
  // -------------------------------------------------------------------------
  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Field')
  @ApiOperation({ summary: 'Get project detail' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project detail with relations' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectService.findOne(tenantId, id);
  }

  // -------------------------------------------------------------------------
  // PATCH /projects/:id — Update project
  // -------------------------------------------------------------------------
  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(tenantId, id, userId, dto);
  }

  // -------------------------------------------------------------------------
  // DELETE /projects/:id — Soft delete project
  // -------------------------------------------------------------------------
  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete — active tasks exist or project is locked' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async softDelete(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectService.softDelete(tenantId, id, userId);
  }

  // -------------------------------------------------------------------------
  // POST /projects/:id/apply-template/:templateId — Apply template
  // -------------------------------------------------------------------------
  @Post(':id/apply-template/:templateId')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a project template to an existing project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiParam({ name: 'templateId', description: 'Template UUID to apply' })
  @ApiResponse({
    status: 200,
    description: 'Template applied successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Template applied successfully' },
        tasks_created: { type: 'number', example: 8 },
        dependencies_created: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Template is inactive' })
  @ApiResponse({ status: 404, description: 'Project or template not found' })
  async applyTemplate(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    const result = await this.projectService.applyTemplate(
      tenantId,
      id,
      templateId,
      userId,
    );
    return {
      message: 'Template applied successfully',
      ...result,
    };
  }

  // -------------------------------------------------------------------------
  // GET /projects/:id/change-orders-redirect — Sprint 24
  // -------------------------------------------------------------------------
  @Get(':id/change-orders-redirect')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get redirect URL for change orders tab on the linked quote',
    description:
      'Returns the frontend route to the Change Orders tab of the quote linked to this project. ' +
      'Returns 400 if the project is standalone (not created from a quote).',
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({
    status: 200,
    description: 'Redirect URL for change orders tab',
    schema: {
      type: 'object',
      properties: {
        redirect_url: {
          type: 'string',
          example: '/quotes/550e8400-e29b-41d4-a716-446655440000?tab=change-orders',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Project is standalone — no quote linked',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getChangeOrdersRedirect(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectService.getChangeOrdersRedirect(tenantId, id);
  }

  // -------------------------------------------------------------------------
  // GET /projects/:id/gantt — Sprint 35: Single project Gantt data
  // -------------------------------------------------------------------------
  @Get(':id/gantt')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get single project Gantt chart data',
    description:
      'Returns all tasks for a project structured for Gantt chart rendering. ' +
      'Each task includes estimated/actual dates, computed delay status, ' +
      'assignees (flattened to type + name), dependencies (upstream), and ' +
      'dependents (downstream) for arrow rendering.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({
    status: 200,
    description: 'Project Gantt data with tasks, dependencies, and assignees',
    schema: {
      type: 'object',
      properties: {
        project: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
            name: { type: 'string', example: 'Kitchen Remodel' },
            start_date: { type: 'string', example: '2026-04-01', nullable: true },
            target_completion_date: { type: 'string', example: '2026-06-15', nullable: true },
            progress_percent: { type: 'number', example: 45.0 },
          },
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string', example: 'Demo existing kitchen' },
              status: { type: 'string', enum: ['not_started', 'in_progress', 'blocked', 'done'] },
              estimated_start_date: { type: 'string', example: '2026-04-01', nullable: true },
              estimated_end_date: { type: 'string', example: '2026-04-03', nullable: true },
              actual_start_date: { type: 'string', example: '2026-04-01', nullable: true },
              actual_end_date: { type: 'string', example: '2026-04-03', nullable: true },
              is_delayed: { type: 'boolean', example: false },
              order_index: { type: 'number', example: 0 },
              assignees: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['crew_member', 'subcontractor', 'user'] },
                    name: { type: 'string', example: 'Mike Johnson' },
                  },
                },
              },
              dependencies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    depends_on_task_id: { type: 'string' },
                    type: { type: 'string', enum: ['finish_to_start', 'start_to_start', 'finish_to_finish'] },
                  },
                },
              },
              dependents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    task_id: { type: 'string' },
                    type: { type: 'string', enum: ['finish_to_start', 'start_to_start', 'finish_to_finish'] },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectGantt(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ganttDataService.getProjectGantt(tenantId, id);
  }

  // -------------------------------------------------------------------------
  // GET /projects/:id/summary — Financial summary
  // -------------------------------------------------------------------------
  @Get(':id/summary')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Get project financial summary' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project financial summary with cost breakdown' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getFinancialSummary(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectService.getFinancialSummary(tenantId, id);
  }
}
