import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectService } from './project.service';
import { ProjectActivityService } from './project-activity.service';
import { TaskDependencyService } from './task-dependency.service';
import { CreateProjectTaskDto } from '../dto/create-project-task.dto';
import { UpdateProjectTaskDto } from '../dto/update-project-task.dto';

interface ListTasksQuery {
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Valid status transitions for project tasks (Phase 1).
 * Key = current status, Value = array of allowed next statuses.
 */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  not_started: ['in_progress', 'blocked'],
  in_progress: ['blocked', 'done'],
  blocked: ['in_progress'],
  done: [], // No transitions back in Phase 1
};

@Injectable()
export class ProjectTaskService {
  private readonly logger = new Logger(ProjectTaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly projectService: ProjectService,
    private readonly projectActivityService: ProjectActivityService,
    private readonly taskDependencyService: TaskDependencyService,
  ) {}

  // ---------------------------------------------------------------------------
  // is_delayed computation — applied on every read
  // ---------------------------------------------------------------------------

  /**
   * Compute whether a task is delayed based on estimated vs actual dates.
   * Rules:
   * - If status is 'done', never delayed
   * - If actual_end_date > estimated_end_date, delayed
   * - If no actual_end_date AND estimated_end_date is past AND status != 'done', delayed
   * - Otherwise, not delayed
   */
  private computeIsDelayed(task: {
    status: string;
    actual_end_date: Date | null;
    estimated_end_date: Date | null;
  }): boolean {
    if (task.status === 'done') return false;

    if (
      task.actual_end_date &&
      task.estimated_end_date &&
      new Date(task.actual_end_date) > new Date(task.estimated_end_date)
    ) {
      return true;
    }

    if (
      !task.actual_end_date &&
      task.estimated_end_date &&
      new Date() > new Date(task.estimated_end_date) &&
      task.status !== 'done'
    ) {
      return true;
    }

    return false;
  }

  /**
   * Enrich a single task record with computed is_delayed.
   */
  private enrichTask(task: any) {
    if (!task) return task;
    return {
      ...task,
      is_delayed: this.computeIsDelayed(task),
    };
  }

  // ---------------------------------------------------------------------------
  // Shared includes for task queries
  // ---------------------------------------------------------------------------

  private readonly taskInclude = {
    task_assignees: {
      include: {
        crew_member: {
          select: { id: true, first_name: true, last_name: true },
        },
        subcontractor: {
          select: { id: true, business_name: true },
        },
        assignee_user: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    },
    dependencies: {
      include: {
        depends_on_task: {
          select: { id: true, title: true },
        },
      },
    },
  };

  // ---------------------------------------------------------------------------
  // Format helpers — shape response to match API contract
  // ---------------------------------------------------------------------------

  private formatAssignees(assignees: any[]) {
    if (!assignees) return [];
    return assignees.map((a) => ({
      id: a.id,
      assignee_type: a.assignee_type,
      crew_member: a.crew_member || null,
      subcontractor: a.subcontractor || null,
      user: a.assignee_user || null,
      assigned_at: a.assigned_at,
    }));
  }

  private formatDependencies(dependencies: any[]) {
    if (!dependencies) return [];
    return dependencies.map((d) => ({
      id: d.id,
      depends_on_task_id: d.depends_on_task_id,
      depends_on_task_title: d.depends_on_task?.title || null,
      dependency_type: d.dependency_type,
    }));
  }

  private formatTaskResponse(task: any) {
    if (!task) return task;
    const enriched = this.enrichTask(task);
    return {
      ...enriched,
      assignees: this.formatAssignees(enriched.task_assignees),
      dependencies: this.formatDependencies(enriched.dependencies),
      // Remove raw relation fields
      task_assignees: undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. create
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    projectId: string,
    userId: string,
    dto: CreateProjectTaskDto,
  ) {
    // Validate project belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true, project_number: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const task = await this.prisma.project_task.create({
      data: {
        tenant_id: tenantId,
        project_id: projectId,
        title: dto.title,
        description: dto.description || null,
        estimated_duration_days: dto.estimated_duration_days || null,
        estimated_start_date: dto.estimated_start_date
          ? new Date(dto.estimated_start_date)
          : null,
        estimated_end_date: dto.estimated_end_date
          ? new Date(dto.estimated_end_date)
          : null,
        category: dto.category || null,
        order_index: dto.order_index,
        notes: dto.notes || null,
        created_by_user_id: userId,
      },
      include: this.taskInclude,
    });

    // Recompute project progress
    await this.projectService.recomputeProgress(tenantId, projectId);

    // Audit log
    this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'project_task',
      entityId: task.id,
      tenantId,
      actorUserId: userId,
      after: task,
      description: `Created task "${task.title}" on project ${project.project_number}`,
    });

    // Activity log
    this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'task_created',
      description: `Created task "${task.title}"`,
      metadata: { task_id: task.id, title: task.title },
    });

    return this.formatTaskResponse(task);
  }

  // ---------------------------------------------------------------------------
  // 2. findAll — paginated, ordered by order_index
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    projectId: string,
    query: ListTasksQuery = {},
  ) {
    let page = query.page || 1;
    let limit = query.limit || 20;
    if (limit > 100) limit = 100;
    if (page < 1) page = 1;

    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
      project_id: projectId,
      deleted_at: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.project_task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { order_index: 'asc' },
        include: this.taskInclude,
      }),
      this.prisma.project_task.count({ where }),
    ]);

    return {
      data: data.map((task) => this.formatTaskResponse(task)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 3. findOne — full detail with assignees and dependencies
  // ---------------------------------------------------------------------------

  async findOne(tenantId: string, projectId: string, taskId: string) {
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
      include: this.taskInclude,
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.formatTaskResponse(task);
  }

  // ---------------------------------------------------------------------------
  // 4. update — with status transition validation + auto date fields
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    projectId: string,
    taskId: string,
    userId: string,
    dto: UpdateProjectTaskDto,
  ) {
    // Fetch existing task
    const existing = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    // Build update data
    const updateData: any = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.estimated_duration_days !== undefined)
      updateData.estimated_duration_days = dto.estimated_duration_days;
    if (dto.estimated_start_date !== undefined)
      updateData.estimated_start_date = dto.estimated_start_date
        ? new Date(dto.estimated_start_date)
        : null;
    if (dto.estimated_end_date !== undefined)
      updateData.estimated_end_date = dto.estimated_end_date
        ? new Date(dto.estimated_end_date)
        : null;
    if (dto.actual_start_date !== undefined)
      updateData.actual_start_date = dto.actual_start_date
        ? new Date(dto.actual_start_date)
        : null;
    if (dto.actual_end_date !== undefined)
      updateData.actual_end_date = dto.actual_end_date
        ? new Date(dto.actual_end_date)
        : null;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.order_index !== undefined) updateData.order_index = dto.order_index;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    // Status transition logic
    let statusChanged = false;
    if (dto.status !== undefined && dto.status !== existing.status) {
      const currentStatus = existing.status;
      const newStatus = dto.status;

      // Validate transition
      const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
      if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
        throw new BadRequestException(
          `Invalid status transition: '${currentStatus}' → '${newStatus}'. Allowed transitions from '${currentStatus}': [${(allowedTransitions || []).join(', ')}]`,
        );
      }

      // Validate dependency constraints (finish_to_start)
      const blockingDeps =
        await this.taskDependencyService.validateStatusTransition(
          tenantId,
          taskId,
          newStatus,
        );

      if (blockingDeps.length > 0) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Cannot transition status: prerequisite tasks are not complete',
          error: 'Conflict',
          blocking_dependencies: blockingDeps,
        });
      }

      updateData.status = newStatus;
      statusChanged = true;

      // Auto-set actual_start_date on first move to 'in_progress'
      // Only if not already set AND user didn't explicitly provide one
      if (
        newStatus === 'in_progress' &&
        !existing.actual_start_date &&
        dto.actual_start_date === undefined
      ) {
        updateData.actual_start_date = new Date();
      }

      // Auto-set actual_end_date when moving to 'done'
      // Only if user didn't explicitly provide one
      if (newStatus === 'done' && dto.actual_end_date === undefined) {
        updateData.actual_end_date = new Date();
      }
    }

    // Perform update with tenant isolation
    const updated = await this.prisma.project_task.update({
      where: { id: taskId },
      data: updateData,
      include: this.taskInclude,
    });

    // Verify tenant isolation (belt-and-suspenders)
    if (updated.tenant_id !== tenantId) {
      this.logger.error(
        `SECURITY: Task ${taskId} tenant mismatch after update. Expected ${tenantId}, got ${updated.tenant_id}`,
      );
      throw new NotFoundException('Task not found');
    }

    // Recompute project progress if status changed
    if (statusChanged) {
      await this.projectService.recomputeProgress(tenantId, projectId);

      // Activity log for status changes
      this.projectActivityService.logActivity(tenantId, {
        project_id: projectId,
        user_id: userId,
        activity_type: 'status_changed',
        description: `Task "${existing.title}" status changed: ${existing.status} → ${dto.status}`,
        metadata: {
          task_id: taskId,
          old_status: existing.status,
          new_status: dto.status,
        },
      });

      // Log task_completed activity if moved to done
      if (dto.status === 'done') {
        this.projectActivityService.logActivity(tenantId, {
          project_id: projectId,
          user_id: userId,
          activity_type: 'task_completed',
          description: `Task "${existing.title}" completed`,
          metadata: { task_id: taskId },
        });
      }

      // Log task_delayed activity if task becomes delayed after update
      const enriched = this.enrichTask(updated);
      if (enriched.is_delayed && !this.computeIsDelayed(existing)) {
        this.projectActivityService.logActivity(tenantId, {
          project_id: projectId,
          user_id: userId,
          activity_type: 'task_delayed',
          description: `Task "${existing.title}" is now delayed`,
          metadata: { task_id: taskId },
        });
      }
    }

    // Audit log
    this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'project_task',
      entityId: taskId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated task "${existing.title}"${statusChanged ? ` (status: ${existing.status} → ${dto.status})` : ''}`,
    });

    return this.formatTaskResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // 5. softDelete
  // ---------------------------------------------------------------------------

  async softDelete(
    tenantId: string,
    projectId: string,
    taskId: string,
    userId: string,
  ) {
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.project_task.update({
      where: { id: taskId },
      data: { deleted_at: new Date() },
    });

    // Recompute project progress
    await this.projectService.recomputeProgress(tenantId, projectId);

    // Audit log
    this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'project_task',
      entityId: taskId,
      tenantId,
      actorUserId: userId,
      before: task,
      description: `Soft-deleted task "${task.title}"`,
    });

    // Activity log
    this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'status_changed',
      description: `Task "${task.title}" deleted`,
      metadata: { task_id: taskId, action: 'deleted' },
    });
  }

  // ---------------------------------------------------------------------------
  // 6. getDelayDashboard — Sprint 16
  // ---------------------------------------------------------------------------

  /**
   * Returns count of delayed tasks per project for the tenant.
   * Uses live computation: estimated_end_date < now AND status != 'done'.
   */
  async getDelayDashboard(tenantId: string) {
    const now = new Date();

    // Group delayed tasks by project
    const delayedGroups = await this.prisma.project_task.groupBy({
      by: ['project_id'],
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        estimated_end_date: { lt: now },
        status: { not: 'done' },
      },
      _count: { id: true },
    });

    if (delayedGroups.length === 0) {
      return {
        total_delayed_tasks: 0,
        projects_with_delays: [],
      };
    }

    // Fetch project names
    const projectIds = delayedGroups.map((g) => g.project_id);
    const projects = await this.prisma.project.findMany({
      where: {
        id: { in: projectIds },
        tenant_id: tenantId,
      },
      select: { id: true, name: true },
    });
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const projectsWithDelays = delayedGroups.map((g) => ({
      project_id: g.project_id,
      project_name: projectMap.get(g.project_id) || 'Unknown',
      delayed_task_count: g._count.id,
    }));

    const totalDelayedTasks = projectsWithDelays.reduce(
      (sum, p) => sum + p.delayed_task_count,
      0,
    );

    return {
      total_delayed_tasks: totalDelayedTasks,
      projects_with_delays: projectsWithDelays,
    };
  }
}
