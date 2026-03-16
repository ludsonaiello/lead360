import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { ProjectActivityService } from './project-activity.service';

interface DashboardFilters {
  status?: string;
  assigned_pm_user_id?: string;
  date_from?: string;
  date_to?: string;
}

interface ProjectSummaryQuery {
  status?: string;
  assigned_pm_user_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ProjectDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectActivityService: ProjectActivityService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. getDashboardData
  // ---------------------------------------------------------------------------

  /**
   * Returns aggregated dashboard data for the management dashboard.
   *
   * Includes:
   * - Total project count
   * - Status distribution (planned, in_progress, on_hold, completed, canceled)
   * - Active project count (planned + in_progress)
   * - Delayed task count (is_delayed flag, set by scheduled job)
   * - Overdue task count (live: estimated_end_date < today, status != done)
   * - Projects with delays count
   * - Upcoming deadlines (next 30 days)
   * - Recent activity feed (last 10 entries)
   *
   * All queries scoped to tenant_id. Filters narrow the project scope.
   */
  async getDashboardData(tenantId: string, filters: DashboardFilters) {
    const now = new Date();

    // Build project-level WHERE clause
    const projectWhere: any = { tenant_id: tenantId };

    if (filters.status) {
      projectWhere.status = filters.status;
    }
    if (filters.assigned_pm_user_id) {
      projectWhere.assigned_pm_user_id = filters.assigned_pm_user_id;
    }
    if (filters.date_from || filters.date_to) {
      projectWhere.created_at = {};
      if (filters.date_from) {
        projectWhere.created_at.gte = new Date(filters.date_from);
      }
      if (filters.date_to) {
        projectWhere.created_at.lte = new Date(filters.date_to);
      }
    }

    // Build task-level WHERE for delay/overdue counts.
    // If project-level filters are applied, scope tasks to matching projects.
    const hasProjectFilters =
      filters.status ||
      filters.assigned_pm_user_id ||
      filters.date_from ||
      filters.date_to;

    const taskProjectFilter = hasProjectFilters
      ? { project: projectWhere }
      : {};

    // Execute all queries in parallel for performance
    const [
      totalProjects,
      statusGroups,
      delayedTasksCount,
      overdueTasksCount,
      projectsWithDelaysGroups,
      upcomingDeadlines,
      recentActivity,
    ] = await Promise.all([
      // 1. Total projects matching filters
      this.prisma.project.count({ where: projectWhere }),

      // 2. Status distribution (always tenant-wide for the donut chart,
      //    regardless of filters, so the user sees the full picture)
      this.prisma.project.groupBy({
        by: ['status'],
        where: { tenant_id: tenantId },
        _count: { id: true },
      }),

      // 3. Delayed tasks count — uses is_delayed flag set by the delay check job
      this.prisma.project_task.count({
        where: {
          tenant_id: tenantId,
          is_delayed: true,
          status: { not: 'done' },
          deleted_at: null,
          ...taskProjectFilter,
        },
      }),

      // 4. Overdue tasks count — live computation using estimated_end_date
      this.prisma.project_task.count({
        where: {
          tenant_id: tenantId,
          estimated_end_date: { lt: now },
          status: { not: 'done' },
          deleted_at: null,
          ...taskProjectFilter,
        },
      }),

      // 5. Distinct projects with at least one delayed task
      this.prisma.project_task.groupBy({
        by: ['project_id'],
        where: {
          tenant_id: tenantId,
          is_delayed: true,
          status: { not: 'done' },
          deleted_at: null,
          ...taskProjectFilter,
        },
      }),

      // 6. Upcoming deadlines — active projects within 30 days of target_completion_date
      this.prisma.project.findMany({
        where: {
          tenant_id: tenantId,
          status: { in: ['planned', 'in_progress'] },
          target_completion_date: {
            gte: now,
            lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          name: true,
          target_completion_date: true,
        },
        orderBy: { target_completion_date: 'asc' },
        take: 10,
      }),

      // 7. Recent activity — last 10 across all projects for the tenant
      this.projectActivityService.getTenantRecentActivity(tenantId, 10),
    ]);

    // Build status distribution map with all statuses initialized to 0
    const statusDistribution: Record<string, number> = {
      planned: 0,
      in_progress: 0,
      on_hold: 0,
      completed: 0,
      canceled: 0,
    };
    for (const group of statusGroups) {
      if (group.status in statusDistribution) {
        statusDistribution[group.status] = group._count.id;
      }
    }

    // Active projects = planned + in_progress
    const activeProjects =
      statusDistribution.planned + statusDistribution.in_progress;

    // Format upcoming deadlines with days_remaining
    const formattedDeadlines = upcomingDeadlines.map((p) => {
      const targetDate = p.target_completion_date
        ? new Date(p.target_completion_date)
        : null;
      const daysRemaining = targetDate
        ? Math.ceil(
            (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

      return {
        project_id: p.id,
        project_name: p.name,
        target_completion_date: p.target_completion_date,
        days_remaining: daysRemaining,
      };
    });

    // Format recent activity with flattened project/user names
    const formattedActivity = recentActivity.map((a: any) => ({
      activity_type: a.activity_type,
      project_id: a.project_id,
      project_name: a.project?.name ?? null,
      description: a.description,
      user_id: a.user_id,
      user_name: a.user
        ? `${a.user.first_name} ${a.user.last_name}`.trim()
        : null,
      created_at: a.created_at,
    }));

    return {
      total_projects: totalProjects,
      status_distribution: statusDistribution,
      active_projects: activeProjects,
      delayed_tasks_count: delayedTasksCount,
      projects_with_delays: projectsWithDelaysGroups.length,
      overdue_tasks_count: overdueTasksCount,
      upcoming_deadlines: formattedDeadlines,
      recent_activity: formattedActivity,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. getProjectsWithSummary
  // ---------------------------------------------------------------------------

  /**
   * Paginated project list with task counts and financial summary per project.
   * Designed for the Gantt chart / project list view on the dashboard.
   *
   * Each project includes:
   * - Basic project fields (id, name, number, status, dates)
   * - Assigned PM info
   * - task_count, completed_task_count, delayed_task_count
   * - contract_value, progress_percent
   */
  async getProjectsWithSummary(
    tenantId: string,
    query: ProjectSummaryQuery,
  ) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = { tenant_id: tenantId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.assigned_pm_user_id) {
      where.assigned_pm_user_id = query.assigned_pm_user_id;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { project_number: { contains: query.search } },
      ];
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          assigned_pm_user: {
            select: { id: true, first_name: true, last_name: true },
          },
          lead: {
            select: { id: true, first_name: true, last_name: true },
          },
          _count: {
            select: {
              tasks: { where: { deleted_at: null } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    if (projects.length === 0) {
      return {
        data: [],
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const projectIds = projects.map((p) => p.id);

    // Fetch completed and delayed task counts per project in parallel
    const [completedGroups, delayedGroups] = await Promise.all([
      this.prisma.project_task.groupBy({
        by: ['project_id'],
        where: {
          tenant_id: tenantId,
          project_id: { in: projectIds },
          status: 'done',
          deleted_at: null,
        },
        _count: { id: true },
      }),
      this.prisma.project_task.groupBy({
        by: ['project_id'],
        where: {
          tenant_id: tenantId,
          project_id: { in: projectIds },
          is_delayed: true,
          status: { not: 'done' },
          deleted_at: null,
        },
        _count: { id: true },
      }),
    ]);

    const completedMap = new Map(
      completedGroups.map((c) => [c.project_id, c._count.id]),
    );
    const delayedMap = new Map(
      delayedGroups.map((d) => [d.project_id, d._count.id]),
    );

    const data = projects.map((project) => ({
      id: project.id,
      project_number: project.project_number,
      name: project.name,
      status: project.status,
      start_date: project.start_date,
      target_completion_date: project.target_completion_date,
      actual_completion_date: project.actual_completion_date,
      contract_value:
        project.contract_value != null ? Number(project.contract_value) : null,
      progress_percent:
        project.progress_percent != null
          ? Number(project.progress_percent)
          : 0,
      assigned_pm: project.assigned_pm_user
        ? {
            id: project.assigned_pm_user.id,
            first_name: project.assigned_pm_user.first_name,
            last_name: project.assigned_pm_user.last_name,
          }
        : null,
      customer: project.lead
        ? {
            id: project.lead.id,
            first_name: project.lead.first_name,
            last_name: project.lead.last_name,
          }
        : null,
      task_count: project._count.tasks,
      completed_task_count: completedMap.get(project.id) || 0,
      delayed_task_count: delayedMap.get(project.id) || 0,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
