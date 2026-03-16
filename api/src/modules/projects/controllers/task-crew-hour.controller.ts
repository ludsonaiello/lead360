import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TaskCrewHourService } from '../services/task-crew-hour.service';
import { CreateTaskCrewHourDto } from '../dto/create-task-crew-hour.dto';

/**
 * Task-scoped crew hour endpoints — Sprint 29
 *
 * POST  /projects/:projectId/tasks/:taskId/crew-hours  — Log crew hours
 * GET   /projects/:projectId/tasks/:taskId/crew-hours  — List crew hours
 */
@ApiTags('Task Crew Hours')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks/:taskId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaskCrewHourController {
  constructor(
    private readonly taskCrewHourService: TaskCrewHourService,
  ) {}

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/tasks/:taskId/crew-hours
  // -------------------------------------------------------------------------
  @Post('crew-hours')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Log crew hours for a task',
    description:
      'Logs crew hours pre-filled with project_id and task_id from the URL. ' +
      'Delegates to CrewHourLogService. Phase 1: source is always "manual".',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 201, description: 'Crew hours logged successfully' })
  @ApiResponse({ status: 400, description: 'Validation error (e.g. hours_regular <= 0)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project, task, or crew member not found' })
  async logCrewHours(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateTaskCrewHourDto,
  ) {
    return this.taskCrewHourService.logTaskCrewHours(
      tenantId,
      userId,
      projectId,
      taskId,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/tasks/:taskId/crew-hours
  // -------------------------------------------------------------------------
  @Get('crew-hours')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'List crew hours for a task',
    description:
      'Returns all crew hour logs linked to the specified task within the project. ' +
      'Ordered by log_date descending.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'List of crew hour logs for the task' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project or task not found' })
  async listTaskCrewHours(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.taskCrewHourService.getTaskCrewHours(
      tenantId,
      projectId,
      taskId,
    );
  }
}

/**
 * Crew hour summary endpoint — Sprint 29
 *
 * GET /crew/:crewMemberId/hours — Crew member hour summary across all projects
 *
 * Separated from CrewMemberController because this endpoint includes Bookkeeper
 * in its allowed roles, while CrewMemberController does not.
 */
@ApiTags('Crew Hours')
@ApiBearerAuth()
@Controller('crew')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrewHourSummaryController {
  constructor(
    private readonly taskCrewHourService: TaskCrewHourService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /crew/:crewMemberId/hours
  // -------------------------------------------------------------------------
  @Get(':crewMemberId/hours')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get crew member hour summary',
    description:
      'Returns aggregated hours for a crew member across all projects. ' +
      'Includes total regular, overtime, and combined hours, plus a per-project breakdown.',
  })
  @ApiParam({ name: 'crewMemberId', description: 'Crew member UUID' })
  @ApiResponse({
    status: 200,
    description: 'Crew member hour summary',
    schema: {
      type: 'object',
      properties: {
        crew_member_id: { type: 'string', format: 'uuid' },
        total_regular_hours: { type: 'number', example: 160.0 },
        total_overtime_hours: { type: 'number', example: 12.5 },
        total_hours: { type: 'number', example: 172.5 },
        logs_by_project: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              project_id: { type: 'string', format: 'uuid' },
              project_name: { type: 'string', example: 'Kitchen Remodel' },
              regular_hours: { type: 'number', example: 80.0 },
              overtime_hours: { type: 'number', example: 5.0 },
              total_hours: { type: 'number', example: 85.0 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Crew member not found' })
  async getCrewHourSummary(
    @TenantId() tenantId: string,
    @Param('crewMemberId', ParseUUIDPipe) crewMemberId: string,
  ) {
    return this.taskCrewHourService.getCrewHourSummary(tenantId, crewMemberId);
  }
}
