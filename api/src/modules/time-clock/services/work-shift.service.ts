import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, work_shift_status } from '@prisma/client';
import { PrismaService } from '../../../core/database';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  BulkCreateWorkShiftDto,
  CreateWorkShiftDto,
  ListMyShiftsDto,
  ListWorkShiftsDto,
  UpdateWorkShiftDto,
} from '../dto/work-shift.dto';

const USER_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
} as const;

const SHIFT_LIST_INCLUDE = {
  employee_profile: {
    include: {
      user: { select: USER_SELECT },
    },
  },
  project: { select: { id: true, name: true } },
} as const;

const SHIFT_DETAIL_INCLUDE = {
  employee_profile: {
    include: {
      user: { select: USER_SELECT },
    },
  },
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
} as const;

const MY_SHIFT_INCLUDE = {
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
} as const;

@Injectable()
export class WorkShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async findAll(tenantId: string, query: ListWorkShiftsDto) {
    const {
      page = 1,
      limit = 20,
      employee_profile_id,
      project_id,
      date_from,
      date_to,
      status,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.work_shiftWhereInput = { tenant_id: tenantId };

    if (employee_profile_id) where.employee_profile_id = employee_profile_id;
    if (project_id) where.project_id = project_id;
    if (status) where.status = status as work_shift_status;

    if (date_from || date_to) {
      const range: Prisma.DateTimeFilter = {};
      if (date_from) range.gte = new Date(date_from);
      if (date_to) range.lte = new Date(date_to);
      where.scheduled_start = range;
    }

    const [data, total] = await Promise.all([
      this.prisma.work_shift.findMany({
        where,
        include: SHIFT_LIST_INCLUDE,
        orderBy: { scheduled_start: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.work_shift.count({ where }),
    ]);

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

  async create(tenantId: string, userId: string, dto: CreateWorkShiftDto) {
    const startDate = new Date(dto.scheduled_start);
    const endDate = new Date(dto.scheduled_end);
    if (endDate <= startDate) {
      throw new BadRequestException(
        'scheduled_end must be after scheduled_start',
      );
    }

    await this.assertEmployeeProfile(tenantId, dto.employee_profile_id);
    if (dto.project_id) {
      await this.assertProject(tenantId, dto.project_id);
    }
    if (dto.task_id) {
      await this.assertTask(tenantId, dto.task_id);
    }

    const shift = await this.prisma.work_shift.create({
      data: {
        tenant_id: tenantId,
        employee_profile_id: dto.employee_profile_id,
        project_id: dto.project_id ?? null,
        task_id: dto.task_id ?? null,
        scheduled_start: startDate,
        scheduled_end: endDate,
        title: dto.title ?? null,
        notes: dto.notes ?? null,
        status: 'scheduled',
        published_at: new Date(),
        created_by_user_id: userId,
      },
      include: SHIFT_LIST_INCLUDE,
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'work_shift',
      entityId: shift.id,
      tenantId,
      actorUserId: userId,
      after: shift,
      description: 'Created work shift for employee',
    });

    return shift;
  }

  async bulkCreate(
    tenantId: string,
    userId: string,
    dto: BulkCreateWorkShiftDto,
  ) {
    for (const shiftDto of dto.shifts) {
      const startDate = new Date(shiftDto.scheduled_start);
      const endDate = new Date(shiftDto.scheduled_end);
      if (endDate <= startDate) {
        throw new BadRequestException(
          `scheduled_end must be after scheduled_start for shift with employee_profile_id ${shiftDto.employee_profile_id}`,
        );
      }

      await this.assertEmployeeProfile(tenantId, shiftDto.employee_profile_id);

      if (shiftDto.project_id) {
        await this.assertProject(
          tenantId,
          shiftDto.project_id,
          `Project not found: ${shiftDto.project_id}`,
        );
      }

      if (shiftDto.task_id) {
        await this.assertTask(
          tenantId,
          shiftDto.task_id,
          `Task not found: ${shiftDto.task_id}`,
        );
      }
    }

    const shifts = await this.prisma.$transaction(
      dto.shifts.map((shiftDto) =>
        this.prisma.work_shift.create({
          data: {
            tenant_id: tenantId,
            employee_profile_id: shiftDto.employee_profile_id,
            project_id: shiftDto.project_id ?? null,
            task_id: shiftDto.task_id ?? null,
            scheduled_start: new Date(shiftDto.scheduled_start),
            scheduled_end: new Date(shiftDto.scheduled_end),
            title: shiftDto.title ?? null,
            notes: shiftDto.notes ?? null,
            status: 'scheduled',
            published_at: new Date(),
            created_by_user_id: userId,
          },
          include: SHIFT_LIST_INCLUDE,
        }),
      ),
    );

    for (const shift of shifts) {
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'work_shift',
        entityId: shift.id,
        tenantId,
        actorUserId: userId,
        after: shift,
        description: 'Created work shift (bulk) for employee',
      });
    }

    return { created: shifts.length, shifts };
  }

  async findOne(tenantId: string, id: string) {
    const shift = await this.prisma.work_shift.findFirst({
      where: { id, tenant_id: tenantId },
      include: SHIFT_DETAIL_INCLUDE,
    });

    if (!shift) {
      throw new NotFoundException('Work shift not found');
    }

    return shift;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateWorkShiftDto,
  ) {
    const existing = await this.prisma.work_shift.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Work shift not found');
    }

    const startDate = dto.scheduled_start
      ? new Date(dto.scheduled_start)
      : existing.scheduled_start;
    const endDate = dto.scheduled_end
      ? new Date(dto.scheduled_end)
      : existing.scheduled_end;
    if (endDate <= startDate) {
      throw new BadRequestException(
        'scheduled_end must be after scheduled_start',
      );
    }

    if (dto.employee_profile_id) {
      await this.assertEmployeeProfile(tenantId, dto.employee_profile_id);
    }
    if (dto.project_id) {
      await this.assertProject(tenantId, dto.project_id);
    }
    if (dto.task_id) {
      await this.assertTask(tenantId, dto.task_id);
    }

    const updateData: Prisma.work_shiftUncheckedUpdateInput = {};
    if (dto.employee_profile_id !== undefined) {
      updateData.employee_profile_id = dto.employee_profile_id;
    }
    if (dto.project_id !== undefined) {
      updateData.project_id = dto.project_id;
    }
    if (dto.task_id !== undefined) {
      updateData.task_id = dto.task_id;
    }
    if (dto.scheduled_start !== undefined) {
      updateData.scheduled_start = new Date(dto.scheduled_start);
    }
    if (dto.scheduled_end !== undefined) {
      updateData.scheduled_end = new Date(dto.scheduled_end);
    }
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.status !== undefined) {
      updateData.status = dto.status as work_shift_status;
    }

    const updated = await this.prisma.work_shift.update({
      where: { id },
      data: updateData,
      include: SHIFT_LIST_INCLUDE,
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'work_shift',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: 'Updated work shift',
    });

    return updated;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const shift = await this.prisma.work_shift.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!shift) {
      throw new NotFoundException('Work shift not found');
    }

    if (shift.status !== 'scheduled' && shift.status !== 'cancelled') {
      throw new BadRequestException(
        `Cannot delete shift with status ${shift.status}`,
      );
    }

    await this.prisma.work_shift.delete({ where: { id } });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'work_shift',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: shift,
      description: 'Deleted work shift',
    });

    return { message: 'Shift deleted successfully' };
  }

  async findMine(tenantId: string, userId: string, query: ListMyShiftsDto) {
    const { page = 1, limit = 20, date_from, date_to, status } = query;
    const skip = (page - 1) * limit;

    const employeeProfile = await this.prisma.employee_profile.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
    });
    if (!employeeProfile) {
      throw new NotFoundException('No employee profile found for current user');
    }

    const where: Prisma.work_shiftWhereInput = {
      tenant_id: tenantId,
      employee_profile_id: employeeProfile.id,
      published_at: { not: null },
    };

    if (status) where.status = status as work_shift_status;

    if (date_from || date_to) {
      const range: Prisma.DateTimeFilter = {};
      if (date_from) range.gte = new Date(date_from);
      if (date_to) range.lte = new Date(date_to);
      where.scheduled_start = range;
    }

    const [data, total] = await Promise.all([
      this.prisma.work_shift.findMany({
        where,
        include: MY_SHIFT_INCLUDE,
        orderBy: { scheduled_start: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.work_shift.count({ where }),
    ]);

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

  private async assertEmployeeProfile(
    tenantId: string,
    employeeProfileId: string,
    message = 'Employee profile not found',
  ): Promise<void> {
    const employeeProfile = await this.prisma.employee_profile.findFirst({
      where: { id: employeeProfileId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!employeeProfile) {
      throw new NotFoundException(message);
    }
  }

  private async assertProject(
    tenantId: string,
    projectId: string,
    message = 'Project not found',
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(message);
    }
  }

  private async assertTask(
    tenantId: string,
    taskId: string,
    message = 'Task not found',
  ): Promise<void> {
    const task = await this.prisma.project_task.findFirst({
      where: { id: taskId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException(message);
    }
  }
}
