import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateCrewHourLogDto } from '../dto/create-crew-hour-log.dto';
import { UpdateCrewHourLogDto } from '../dto/update-crew-hour-log.dto';
import { ListCrewHoursDto } from '../dto/list-crew-hours.dto';

@Injectable()
export class CrewHourLogService {
  private readonly logger = new Logger(CrewHourLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Log hours for a crew member.
   * source='manual', clockin_event_id=null. hours_regular > 0.
   */
  async logHours(
    tenantId: string,
    userId: string,
    dto: CreateCrewHourLogDto,
  ) {
    // Validate crew member belongs to tenant
    await this.validateCrewMemberBelongsToTenant(tenantId, dto.crew_member_id);

    // Validate project belongs to tenant
    await this.validateProjectBelongsToTenant(tenantId, dto.project_id);

    // Validate task belongs to project (if provided)
    if (dto.task_id) {
      await this.validateTaskBelongsToProject(tenantId, dto.task_id, dto.project_id);
    }

    const hourLog = await this.prisma.crew_hour_log.create({
      data: {
        tenant_id: tenantId,
        crew_member_id: dto.crew_member_id,
        project_id: dto.project_id,
        task_id: dto.task_id ?? null,
        log_date: new Date(dto.log_date),
        hours_regular: dto.hours_regular,
        hours_overtime: dto.hours_overtime ?? 0,
        source: 'manual',
        clockin_event_id: null,
        notes: dto.notes ?? null,
        created_by_user_id: userId,
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
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'crew_hour_log',
      entityId: hourLog.id,
      tenantId,
      actorUserId: userId,
      after: hourLog,
      description: `Logged ${dto.hours_regular}h regular + ${dto.hours_overtime ?? 0}h OT for crew member ${dto.crew_member_id} on project ${dto.project_id}`,
    });

    return hourLog;
  }

  /**
   * Get hours for a project, optionally filtered by crew member.
   */
  async getHoursForProject(
    tenantId: string,
    projectId: string,
    crewMemberId?: string,
  ) {
    const where: any = {
      tenant_id: tenantId,
      project_id: projectId,
    };

    if (crewMemberId) {
      where.crew_member_id = crewMemberId;
    }

    return this.prisma.crew_hour_log.findMany({
      where,
      include: {
        crew_member: {
          select: { id: true, first_name: true, last_name: true },
        },
        task: {
          select: { id: true, title: true },
        },
      },
      orderBy: { log_date: 'desc' },
    });
  }

  /**
   * Get hours for a crew member with optional date range.
   */
  async getHoursForCrew(
    tenantId: string,
    crewMemberId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const where: any = {
      tenant_id: tenantId,
      crew_member_id: crewMemberId,
    };

    if (dateFrom || dateTo) {
      where.log_date = {};
      if (dateFrom) where.log_date.gte = new Date(dateFrom);
      if (dateTo) where.log_date.lte = new Date(dateTo);
    }

    return this.prisma.crew_hour_log.findMany({
      where,
      include: {
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

  /**
   * List crew hours (paginated) with optional filters.
   */
  async listHours(tenantId: string, query: ListCrewHoursDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenant_id: tenantId };

    if (query.project_id) where.project_id = query.project_id;
    if (query.crew_member_id) where.crew_member_id = query.crew_member_id;

    if (query.date_from || query.date_to) {
      where.log_date = {};
      if (query.date_from) where.log_date.gte = new Date(query.date_from);
      if (query.date_to) where.log_date.lte = new Date(query.date_to);
    }

    const [data, total] = await Promise.all([
      this.prisma.crew_hour_log.findMany({
        where,
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
        skip,
        take: limit,
      }),
      this.prisma.crew_hour_log.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Update a crew hour log entry.
   * Audit log with before/after.
   */
  async updateHours(
    tenantId: string,
    hourLogId: string,
    userId: string,
    dto: UpdateCrewHourLogDto,
  ) {
    const existing = await this.getHourLogById(tenantId, hourLogId);

    // Validate task if being changed
    if (dto.task_id) {
      await this.validateTaskBelongsToProject(tenantId, dto.task_id, existing.project_id);
    }

    const data: any = {};
    if (dto.task_id !== undefined) data.task_id = dto.task_id ?? null;
    if (dto.log_date !== undefined) data.log_date = new Date(dto.log_date);
    if (dto.hours_regular !== undefined) data.hours_regular = dto.hours_regular;
    if (dto.hours_overtime !== undefined) data.hours_overtime = dto.hours_overtime;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;

    const updated = await this.prisma.crew_hour_log.update({
      where: { id: hourLogId },
      data,
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
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'crew_hour_log',
      entityId: hourLogId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated crew hour log ${hourLogId}`,
    });

    return updated;
  }

  /**
   * Hard-delete a crew hour log entry.
   */
  async deleteHours(
    tenantId: string,
    hourLogId: string,
    userId: string,
  ) {
    const existing = await this.prisma.crew_hour_log.findFirst({
      where: { id: hourLogId, tenant_id: tenantId },
      include: {
        crew_member: {
          select: { id: true, first_name: true, last_name: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Crew hour log not found');
    }

    await this.prisma.crew_hour_log.delete({
      where: { id: hourLogId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'crew_hour_log',
      entityId: hourLogId,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Deleted crew hour log of ${existing.hours_regular}h regular + ${existing.hours_overtime}h OT for ${existing.crew_member.first_name} ${existing.crew_member.last_name}`,
    });

    return { message: 'Hour log deleted successfully' };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getHourLogById(tenantId: string, hourLogId: string) {
    const hourLog = await this.prisma.crew_hour_log.findFirst({
      where: {
        id: hourLogId,
        tenant_id: tenantId,
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
    });

    if (!hourLog) {
      throw new NotFoundException('Crew hour log not found');
    }

    return hourLog;
  }

  private async validateCrewMemberBelongsToTenant(
    tenantId: string,
    crewMemberId: string,
  ) {
    const crewMember = await this.prisma.crew_member.findFirst({
      where: { id: crewMemberId, tenant_id: tenantId },
    });

    if (!crewMember) {
      throw new NotFoundException(
        'Crew member not found or does not belong to this tenant',
      );
    }
  }

  private async validateProjectBelongsToTenant(
    tenantId: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException(
        'Project not found or does not belong to this tenant',
      );
    }
  }

  private async validateTaskBelongsToProject(
    tenantId: string,
    taskId: string,
    projectId: string,
  ) {
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        tenant_id: tenantId,
        project_id: projectId,
      },
    });

    if (!task) {
      throw new NotFoundException(
        'Task not found or does not belong to this project',
      );
    }
  }
}
