import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CrewHourLogService } from '../../financial/services/crew-hour-log.service';
import { CreateTaskCrewHourDto } from '../dto/create-task-crew-hour.dto';

@Injectable()
export class TaskCrewHourService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crewHourLogService: CrewHourLogService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. logTaskCrewHours — POST /projects/:projectId/tasks/:taskId/crew-hours
  // ---------------------------------------------------------------------------

  /**
   * Log crew hours from task context.
   * Validates project/task ownership, then delegates to CrewHourLogService
   * with project_id and task_id pre-filled from URL params.
   */
  async logTaskCrewHours(
    tenantId: string,
    userId: string,
    projectId: string,
    taskId: string,
    dto: CreateTaskCrewHourDto,
  ) {
    await this.validateTaskBelongsToProject(tenantId, projectId, taskId);

    return this.crewHourLogService.logHours(tenantId, userId, {
      crew_member_id: dto.crew_member_id,
      project_id: projectId,
      task_id: taskId,
      log_date: dto.log_date,
      hours_regular: dto.hours_regular,
      hours_overtime: dto.hours_overtime,
      notes: dto.notes,
    });
  }

  // ---------------------------------------------------------------------------
  // 2. getTaskCrewHours — GET /projects/:projectId/tasks/:taskId/crew-hours
  // ---------------------------------------------------------------------------

  /**
   * List all crew hour logs for a specific task within a project.
   * Validates task ownership first, then queries directly because
   * CrewHourLogService.getHoursForProject() does not filter by task_id.
   */
  async getTaskCrewHours(
    tenantId: string,
    projectId: string,
    taskId: string,
  ) {
    await this.validateTaskBelongsToProject(tenantId, projectId, taskId);

    return this.prisma.crew_hour_log.findMany({
      where: {
        tenant_id: tenantId,
        project_id: projectId,
        task_id: taskId,
      },
      include: {
        crew_member: {
          select: { id: true, first_name: true, last_name: true },
        },
        project: {
          select: { id: true, name: true, project_number: true },
        },
        task: {
          select: { id: true, title: true },
        },
      },
      orderBy: { log_date: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // 3. getCrewHourSummary — GET /crew/:crewMemberId/hours
  // ---------------------------------------------------------------------------

  /**
   * Get a crew member's hour summary across all projects.
   * Returns totals for regular, overtime, and combined hours,
   * plus a per-project breakdown.
   */
  async getCrewHourSummary(tenantId: string, crewMemberId: string) {
    // Validate crew member exists and belongs to tenant
    const crewMember = await this.prisma.crew_member.findFirst({
      where: { id: crewMemberId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    // Get all hour logs for this crew member within this tenant
    const hourLogs = await this.prisma.crew_hour_log.findMany({
      where: {
        tenant_id: tenantId,
        crew_member_id: crewMemberId,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    // Aggregate totals and per-project breakdown
    let totalRegular = 0;
    let totalOvertime = 0;

    const projectMap = new Map<
      string,
      {
        project_id: string;
        project_name: string;
        regular_hours: number;
        overtime_hours: number;
      }
    >();

    for (const log of hourLogs) {
      const regular = Number(log.hours_regular);
      const overtime = Number(log.hours_overtime);

      totalRegular += regular;
      totalOvertime += overtime;

      const existing = projectMap.get(log.project_id);
      if (existing) {
        existing.regular_hours += regular;
        existing.overtime_hours += overtime;
      } else {
        projectMap.set(log.project_id, {
          project_id: log.project_id,
          project_name: log.project?.name ?? 'Unknown',
          regular_hours: regular,
          overtime_hours: overtime,
        });
      }
    }

    const logsByProject = Array.from(projectMap.values()).map((p) => ({
      project_id: p.project_id,
      project_name: p.project_name,
      regular_hours: parseFloat(p.regular_hours.toFixed(2)),
      overtime_hours: parseFloat(p.overtime_hours.toFixed(2)),
      total_hours: parseFloat((p.regular_hours + p.overtime_hours).toFixed(2)),
    }));

    return {
      crew_member_id: crewMemberId,
      total_regular_hours: parseFloat(totalRegular.toFixed(2)),
      total_overtime_hours: parseFloat(totalOvertime.toFixed(2)),
      total_hours: parseFloat((totalRegular + totalOvertime).toFixed(2)),
      logs_by_project: logsByProject,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Validate that a task exists, belongs to the specified project,
   * and both belong to the tenant. Throws NotFoundException if not.
   */
  private async validateTaskBelongsToProject(
    tenantId: string,
    projectId: string,
    taskId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        project_id: projectId,
        tenant_id: tenantId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found in this project');
    }
  }
}
