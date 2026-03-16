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
import { ProjectTaskService } from '../services/project-task.service';
import { TaskDependencyService } from '../services/task-dependency.service';
import { TaskAssignmentService } from '../services/task-assignment.service';
import { TaskCommunicationService } from '../services/task-communication.service';
import { TaskCalendarEventService } from '../services/task-calendar-event.service';
import { CreateProjectTaskDto } from '../dto/create-project-task.dto';
import { UpdateProjectTaskDto } from '../dto/update-project-task.dto';
import { CreateTaskDependencyDto } from '../dto/create-task-dependency.dto';
import { AssignTaskDto } from '../dto/assign-task.dto';
import { SendTaskSmsDto } from '../dto/send-task-sms.dto';
import { CreateTaskCalendarEventDto } from '../dto/create-task-calendar-event.dto';
import { UpdateTaskCalendarEventDto } from '../dto/update-task-calendar-event.dto';

@ApiTags('Project Tasks')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectTaskController {
  constructor(
    private readonly projectTaskService: ProjectTaskService,
    private readonly taskDependencyService: TaskDependencyService,
    private readonly taskAssignmentService: TaskAssignmentService,
    private readonly taskCommunicationService: TaskCommunicationService,
    private readonly taskCalendarEventService: TaskCalendarEventService,
  ) {}

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/tasks — Create task
  // -------------------------------------------------------------------------
  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectTaskDto,
  ) {
    return this.projectTaskService.create(tenantId, projectId, userId, dto);
  }

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/tasks — List tasks (paginated)
  // -------------------------------------------------------------------------
  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Field')
  @ApiOperation({ summary: 'List tasks for a project (paginated, ordered by order_index)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (not_started, in_progress, blocked, done)' })
  @ApiResponse({ status: 200, description: 'Paginated list of tasks' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  async findAll(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.projectTaskService.findAll(tenantId, projectId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
    });
  }

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/tasks/:id — Task detail
  // -------------------------------------------------------------------------
  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Field')
  @ApiOperation({ summary: 'Get task detail with assignees and dependencies' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task detail with computed is_delayed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectTaskService.findOne(tenantId, projectId, id);
  }

  // -------------------------------------------------------------------------
  // PATCH /projects/:projectId/tasks/:id — Update task
  // -------------------------------------------------------------------------
  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update task fields or transition status' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid status transition' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 409, description: 'Conflict — prerequisite tasks not complete' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectTaskDto,
  ) {
    return this.projectTaskService.update(tenantId, projectId, id, userId, dto);
  }

  // -------------------------------------------------------------------------
  // DELETE /projects/:projectId/tasks/:id — Soft delete task
  // -------------------------------------------------------------------------
  @Delete(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a task' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 204, description: 'Task deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async softDelete(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.projectTaskService.softDelete(tenantId, projectId, id, userId);
  }

  // =========================================================================
  // TASK DEPENDENCIES — Sprint 14
  // =========================================================================

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/tasks/:taskId/dependencies — Add dependency
  // -------------------------------------------------------------------------
  @Post(':taskId/dependencies')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a dependency to a task' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID (the dependent task)' })
  @ApiResponse({ status: 201, description: 'Dependency created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or self-reference' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Task or dependency target not found' })
  @ApiResponse({ status: 409, description: 'Conflict — duplicate dependency or circular dependency detected' })
  async addDependency(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateTaskDependencyDto,
  ) {
    return this.taskDependencyService.addDependency(
      tenantId,
      projectId,
      taskId,
      userId,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // DELETE /projects/:projectId/tasks/:taskId/dependencies/:depId — Remove
  // -------------------------------------------------------------------------
  @Delete(':taskId/dependencies/:depId')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a dependency from a task' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiParam({ name: 'depId', description: 'Dependency UUID' })
  @ApiResponse({ status: 204, description: 'Dependency removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Dependency not found' })
  async removeDependency(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('depId', ParseUUIDPipe) depId: string,
  ) {
    await this.taskDependencyService.removeDependency(
      tenantId,
      projectId,
      taskId,
      depId,
      userId,
    );
  }

  // =========================================================================
  // TASK ASSIGNEES — Sprint 15
  // =========================================================================

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/tasks/:taskId/assignees — Assign to task
  // -------------------------------------------------------------------------
  @Post(':taskId/assignees')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a crew member, subcontractor, or user to a task' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 201, description: 'Assignee added successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — type mismatch or missing ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Task, project, or assignee not found' })
  @ApiResponse({ status: 409, description: 'Conflict — assignee already assigned to this task' })
  async assignToTask(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AssignTaskDto,
  ) {
    return this.taskAssignmentService.assignToTask(
      tenantId,
      projectId,
      taskId,
      userId,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // DELETE /projects/:projectId/tasks/:taskId/assignees/:assigneeId — Remove
  // -------------------------------------------------------------------------
  @Delete(':taskId/assignees/:assigneeId')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an assignee from a task' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiParam({ name: 'assigneeId', description: 'Assignment UUID' })
  @ApiResponse({ status: 204, description: 'Assignment removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async removeAssignment(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('assigneeId', ParseUUIDPipe) assigneeId: string,
  ) {
    await this.taskAssignmentService.removeAssignment(
      tenantId,
      projectId,
      taskId,
      assigneeId,
      userId,
    );
  }

  // =========================================================================
  // TASK SMS — Sprint 20
  // =========================================================================

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/tasks/:taskId/sms — Send SMS from task context
  // -------------------------------------------------------------------------
  @Post(':taskId/sms')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send SMS from task context',
    description:
      'Send an SMS linked to both the task (via related_entity_type/related_entity_id) ' +
      'and the lead (via lead_id). Phone is resolved from the lead if not explicitly provided.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({
    status: 200,
    description: 'SMS queued for delivery',
  })
  @ApiResponse({ status: 400, description: 'Validation error or no phone available' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Task, project, or lead not found' })
  async sendSmsFromTask(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: SendTaskSmsDto,
  ) {
    return this.taskCommunicationService.sendSmsFromTask(
      tenantId,
      projectId,
      taskId,
      userId,
      dto,
    );
  }

  // =========================================================================
  // TASK CALENDAR EVENTS — Sprint 21
  // =========================================================================

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/tasks/:taskId/calendar-events — Create event
  // -------------------------------------------------------------------------
  @Post(':taskId/calendar-events')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a calendar event for a task' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 201, description: 'Calendar event created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — end_datetime must be after start_datetime' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async createCalendarEvent(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateTaskCalendarEventDto,
  ) {
    return this.taskCalendarEventService.createEvent(
      tenantId,
      projectId,
      taskId,
      userId,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/tasks/:taskId/calendar-events — List events
  // -------------------------------------------------------------------------
  @Get(':taskId/calendar-events')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List calendar events for a task' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'List of calendar events for the task' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async listCalendarEvents(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.taskCalendarEventService.listTaskEvents(
      tenantId,
      projectId,
      taskId,
    );
  }

  // -------------------------------------------------------------------------
  // PATCH /projects/:projectId/tasks/:taskId/calendar-events/:eventId — Update
  // -------------------------------------------------------------------------
  @Patch(':taskId/calendar-events/:eventId')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a task calendar event' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiParam({ name: 'eventId', description: 'Calendar event UUID' })
  @ApiResponse({ status: 200, description: 'Calendar event updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — end_datetime must be after start_datetime' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Calendar event not found' })
  async updateCalendarEvent(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateTaskCalendarEventDto,
  ) {
    return this.taskCalendarEventService.updateEvent(
      tenantId,
      projectId,
      taskId,
      eventId,
      userId,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // DELETE /projects/:projectId/tasks/:taskId/calendar-events/:eventId — Delete
  // -------------------------------------------------------------------------
  @Delete(':taskId/calendar-events/:eventId')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task calendar event' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiParam({ name: 'eventId', description: 'Calendar event UUID' })
  @ApiResponse({ status: 204, description: 'Calendar event deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Calendar event not found' })
  async deleteCalendarEvent(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    await this.taskCalendarEventService.deleteEvent(
      tenantId,
      projectId,
      taskId,
      eventId,
      userId,
    );
  }
}
