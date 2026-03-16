import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { AssignTaskDto, AssigneeTypeEnum } from '../dto/assign-task.dto';

@Injectable()
export class TaskAssignmentService {
  private readonly logger = new Logger(TaskAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // ---------------------------------------------------------------------------
  // Shared includes for assignee queries
  // ---------------------------------------------------------------------------

  private readonly assigneeInclude = {
    crew_member: {
      select: { id: true, first_name: true, last_name: true },
    },
    subcontractor: {
      select: { id: true, business_name: true },
    },
    assignee_user: {
      select: { id: true, first_name: true, last_name: true },
    },
  };

  // ---------------------------------------------------------------------------
  // Format helpers — shape response to match API contract
  // ---------------------------------------------------------------------------

  private formatAssigneeResponse(assignee: any) {
    if (!assignee) return assignee;
    return {
      id: assignee.id,
      task_id: assignee.task_id,
      assignee_type: assignee.assignee_type,
      crew_member: assignee.crew_member
        ? {
            id: assignee.crew_member.id,
            first_name: assignee.crew_member.first_name,
            last_name: assignee.crew_member.last_name,
          }
        : null,
      subcontractor: assignee.subcontractor
        ? {
            id: assignee.subcontractor.id,
            business_name: assignee.subcontractor.business_name,
          }
        : null,
      user: assignee.assignee_user
        ? {
            id: assignee.assignee_user.id,
            first_name: assignee.assignee_user.first_name,
            last_name: assignee.assignee_user.last_name,
          }
        : null,
      assigned_at: assignee.assigned_at,
      assigned_by_user_id: assignee.assigned_by_user_id,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. assignToTask
  // ---------------------------------------------------------------------------

  async assignToTask(
    tenantId: string,
    projectId: string,
    taskId: string,
    userId: string,
    dto: AssignTaskDto,
  ) {
    // 1. Validate exactly one ID matches the assignee_type
    this.validateAssigneeFields(dto);

    // 2. Validate the task exists and belongs to tenant + project
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
      select: { id: true, title: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // 3. Validate the project belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 4. Validate the assignee exists and belongs to tenant
    await this.validateAssigneeExists(tenantId, dto);

    // 5. Check for duplicate assignment
    await this.checkDuplicateAssignment(tenantId, taskId, dto);

    // 6. Create the assignment
    const assignee = await this.prisma.task_assignee.create({
      data: {
        tenant_id: tenantId,
        task_id: taskId,
        assignee_type: dto.assignee_type,
        crew_member_id:
          dto.assignee_type === AssigneeTypeEnum.crew_member
            ? dto.crew_member_id
            : null,
        subcontractor_id:
          dto.assignee_type === AssigneeTypeEnum.subcontractor
            ? dto.subcontractor_id
            : null,
        user_id:
          dto.assignee_type === AssigneeTypeEnum.user ? dto.user_id : null,
        assigned_by_user_id: userId,
      },
      include: this.assigneeInclude,
    });

    // 7. Audit log
    this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'task_assignee',
      entityId: assignee.id,
      tenantId,
      actorUserId: userId,
      after: assignee,
      description: `Assigned ${dto.assignee_type} to task "${task.title}"`,
    });

    return this.formatAssigneeResponse(assignee);
  }

  // ---------------------------------------------------------------------------
  // 2. removeAssignment
  // ---------------------------------------------------------------------------

  async removeAssignment(
    tenantId: string,
    projectId: string,
    taskId: string,
    assigneeId: string,
    userId: string,
  ) {
    // Find the assignment with tenant + project + task isolation
    const assignee = await this.prisma.task_assignee.findFirst({
      where: {
        id: assigneeId,
        tenant_id: tenantId,
        task_id: taskId,
        task: {
          project_id: projectId,
          deleted_at: null,
        },
      },
      include: {
        ...this.assigneeInclude,
        task: { select: { title: true } },
      },
    });

    if (!assignee) {
      throw new NotFoundException('Assignment not found');
    }

    await this.prisma.task_assignee.delete({
      where: { id: assigneeId },
    });

    // Audit log
    this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'task_assignee',
      entityId: assigneeId,
      tenantId,
      actorUserId: userId,
      before: assignee,
      description: `Removed ${assignee.assignee_type} assignment from task "${assignee.task.title}"`,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. getTaskAssignees
  // ---------------------------------------------------------------------------

  async getTaskAssignees(tenantId: string, taskId: string) {
    const assignees = await this.prisma.task_assignee.findMany({
      where: {
        tenant_id: tenantId,
        task_id: taskId,
      },
      include: this.assigneeInclude,
      orderBy: { assigned_at: 'asc' },
    });

    return assignees.map((a) => this.formatAssigneeResponse(a));
  }

  // ---------------------------------------------------------------------------
  // 4. getCrewMemberTasks — all tasks assigned to a crew member across projects
  // ---------------------------------------------------------------------------

  async getCrewMemberTasks(tenantId: string, crewMemberId: string) {
    // Validate crew member exists and belongs to tenant
    const crewMember = await this.prisma.crew_member.findFirst({
      where: {
        id: crewMemberId,
        tenant_id: tenantId,
      },
      select: { id: true },
    });

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    const assignments = await this.prisma.task_assignee.findMany({
      where: {
        tenant_id: tenantId,
        crew_member_id: crewMemberId,
        assignee_type: 'crew_member',
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            project_id: true,
            estimated_start_date: true,
            estimated_end_date: true,
            actual_start_date: true,
            actual_end_date: true,
            order_index: true,
            deleted_at: true,
          },
        },
      },
      orderBy: { assigned_at: 'desc' },
    });

    // Exclude soft-deleted tasks
    return assignments
      .filter((a) => a.task && a.task.deleted_at === null)
      .map((a) => ({
        assignment_id: a.id,
        task_id: a.task.id,
        task_title: a.task.title,
        task_status: a.task.status,
        project_id: a.task.project_id,
        estimated_start_date: a.task.estimated_start_date,
        estimated_end_date: a.task.estimated_end_date,
        actual_start_date: a.task.actual_start_date,
        actual_end_date: a.task.actual_end_date,
        assigned_at: a.assigned_at,
      }));
  }

  // ---------------------------------------------------------------------------
  // 5. getSubcontractorTasks — all tasks assigned to a subcontractor
  // ---------------------------------------------------------------------------

  async getSubcontractorTasks(tenantId: string, subcontractorId: string) {
    // Validate subcontractor exists and belongs to tenant
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: {
        id: subcontractorId,
        tenant_id: tenantId,
      },
      select: { id: true },
    });

    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    const assignments = await this.prisma.task_assignee.findMany({
      where: {
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
        assignee_type: 'subcontractor',
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            project_id: true,
            estimated_start_date: true,
            estimated_end_date: true,
            actual_start_date: true,
            actual_end_date: true,
            order_index: true,
            deleted_at: true,
          },
        },
      },
      orderBy: { assigned_at: 'desc' },
    });

    // Exclude soft-deleted tasks
    return assignments
      .filter((a) => a.task && a.task.deleted_at === null)
      .map((a) => ({
        assignment_id: a.id,
        task_id: a.task.id,
        task_title: a.task.title,
        task_status: a.task.status,
        project_id: a.task.project_id,
        estimated_start_date: a.task.estimated_start_date,
        estimated_end_date: a.task.estimated_end_date,
        actual_start_date: a.task.actual_start_date,
        actual_end_date: a.task.actual_end_date,
        assigned_at: a.assigned_at,
      }));
  }

  // ---------------------------------------------------------------------------
  // Private validation helpers
  // ---------------------------------------------------------------------------

  /**
   * Validate that exactly one assignee ID is provided and it matches
   * the specified assignee_type.
   */
  private validateAssigneeFields(dto: AssignTaskDto) {
    const { assignee_type, crew_member_id, subcontractor_id, user_id } = dto;

    switch (assignee_type) {
      case AssigneeTypeEnum.crew_member:
        if (!crew_member_id) {
          throw new BadRequestException(
            'crew_member_id is required when assignee_type is crew_member',
          );
        }
        if (subcontractor_id || user_id) {
          throw new BadRequestException(
            'Only crew_member_id should be provided when assignee_type is crew_member',
          );
        }
        break;

      case AssigneeTypeEnum.subcontractor:
        if (!subcontractor_id) {
          throw new BadRequestException(
            'subcontractor_id is required when assignee_type is subcontractor',
          );
        }
        if (crew_member_id || user_id) {
          throw new BadRequestException(
            'Only subcontractor_id should be provided when assignee_type is subcontractor',
          );
        }
        break;

      case AssigneeTypeEnum.user:
        if (!user_id) {
          throw new BadRequestException(
            'user_id is required when assignee_type is user',
          );
        }
        if (crew_member_id || subcontractor_id) {
          throw new BadRequestException(
            'Only user_id should be provided when assignee_type is user',
          );
        }
        break;

      default:
        throw new BadRequestException(
          `Invalid assignee_type: ${assignee_type}`,
        );
    }
  }

  /**
   * Validate that the assignee entity exists and belongs to the tenant.
   */
  private async validateAssigneeExists(tenantId: string, dto: AssignTaskDto) {
    switch (dto.assignee_type) {
      case AssigneeTypeEnum.crew_member: {
        const crew = await this.prisma.crew_member.findFirst({
          where: { id: dto.crew_member_id, tenant_id: tenantId },
          select: { id: true },
        });
        if (!crew) {
          throw new NotFoundException(
            'Crew member not found or does not belong to this tenant',
          );
        }
        break;
      }

      case AssigneeTypeEnum.subcontractor: {
        const sub = await this.prisma.subcontractor.findFirst({
          where: { id: dto.subcontractor_id, tenant_id: tenantId },
          select: { id: true },
        });
        if (!sub) {
          throw new NotFoundException(
            'Subcontractor not found or does not belong to this tenant',
          );
        }
        break;
      }

      case AssigneeTypeEnum.user: {
        const user = await this.prisma.user.findFirst({
          where: {
            id: dto.user_id,
            memberships: { some: { tenant_id: tenantId, status: 'ACTIVE' } },
          },
          select: { id: true },
        });
        if (!user) {
          throw new NotFoundException(
            'User not found or does not belong to this tenant',
          );
        }
        break;
      }
    }
  }

  /**
   * Check if the same assignee is already assigned to the same task.
   * Duplicate prevention at application level.
   */
  private async checkDuplicateAssignment(
    tenantId: string,
    taskId: string,
    dto: AssignTaskDto,
  ) {
    const where: any = {
      tenant_id: tenantId,
      task_id: taskId,
      assignee_type: dto.assignee_type,
    };

    switch (dto.assignee_type) {
      case AssigneeTypeEnum.crew_member:
        where.crew_member_id = dto.crew_member_id;
        break;
      case AssigneeTypeEnum.subcontractor:
        where.subcontractor_id = dto.subcontractor_id;
        break;
      case AssigneeTypeEnum.user:
        where.user_id = dto.user_id;
        break;
    }

    const existing = await this.prisma.task_assignee.findFirst({ where });

    if (existing) {
      throw new ConflictException(
        'This assignee is already assigned to this task',
      );
    }
  }
}
