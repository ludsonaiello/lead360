import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class GanttDataService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Delay computation — mirrors ProjectTaskService.computeIsDelayed
  // ---------------------------------------------------------------------------

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
      new Date() > new Date(task.estimated_end_date)
    ) {
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Assignee name resolution — flattens to { type, name } for Gantt rendering
  // ---------------------------------------------------------------------------

  private formatGanttAssignee(assignee: any): {
    type: string;
    name: string;
  } {
    if (
      assignee.assignee_type === 'crew_member' &&
      assignee.crew_member
    ) {
      return {
        type: 'crew_member',
        name:
          `${assignee.crew_member.first_name} ${assignee.crew_member.last_name}`.trim(),
      };
    }

    if (
      assignee.assignee_type === 'subcontractor' &&
      assignee.subcontractor
    ) {
      return {
        type: 'subcontractor',
        name: assignee.subcontractor.business_name,
      };
    }

    if (assignee.assignee_type === 'user' && assignee.assignee_user) {
      return {
        type: 'user',
        name:
          `${assignee.assignee_user.first_name} ${assignee.assignee_user.last_name}`.trim(),
      };
    }

    return { type: assignee.assignee_type, name: 'Unknown' };
  }

  // ---------------------------------------------------------------------------
  // getProjectGantt — Single project Gantt data
  // ---------------------------------------------------------------------------

  /**
   * Returns all tasks for a single project structured for Gantt chart rendering.
   *
   * Includes:
   * - Project metadata (id, name, dates, progress)
   * - All non-deleted tasks ordered by order_index
   * - Each task includes:
   *   - Estimated & actual dates
   *   - Computed is_delayed flag
   *   - Flattened assignees (type + display name)
   *   - Dependencies (tasks this task depends on)
   *   - Dependents (tasks that depend on this task)
   *
   * All queries scoped to tenant_id.
   */
  async getProjectGantt(tenantId: string, projectId: string) {
    // 1. Fetch project with tenant isolation
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        name: true,
        start_date: true,
        target_completion_date: true,
        progress_percent: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 2. Fetch all non-deleted tasks with assignees, dependencies, AND dependents
    const tasks = await this.prisma.project_task.findMany({
      where: {
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
      orderBy: { order_index: 'asc' },
      include: {
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
        dependent_on_this: {
          include: {
            task: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    // 3. Shape response for Gantt rendering
    const ganttTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      estimated_start_date: task.estimated_start_date,
      estimated_end_date: task.estimated_end_date,
      actual_start_date: task.actual_start_date,
      actual_end_date: task.actual_end_date,
      is_delayed: this.computeIsDelayed(task),
      order_index: task.order_index,
      assignees: (task.task_assignees || []).map((a) =>
        this.formatGanttAssignee(a),
      ),
      dependencies: (task.dependencies || []).map((d) => ({
        depends_on_task_id: d.depends_on_task_id,
        type: d.dependency_type,
      })),
      dependents: (task.dependent_on_this || []).map((d) => ({
        task_id: d.task_id,
        type: d.dependency_type,
      })),
    }));

    return {
      project: {
        id: project.id,
        name: project.name,
        start_date: project.start_date,
        target_completion_date: project.target_completion_date,
        progress_percent:
          project.progress_percent != null
            ? Number(project.progress_percent)
            : 0,
      },
      tasks: ganttTasks,
    };
  }
}
