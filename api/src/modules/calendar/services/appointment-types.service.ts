import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateAppointmentTypeDto,
  UpdateAppointmentTypeDto,
  ListAppointmentTypesDto,
} from '../dto';

@Injectable()
export class AppointmentTypesService {
  private readonly logger = new Logger(AppointmentTypesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create a new appointment type
   * If is_default is true, unsets previous default for this tenant
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - User creating the appointment type
   * @param createDto - Appointment type data
   * @returns Created appointment type
   */
  async create(
    tenantId: string,
    userId: string | null,
    createDto: CreateAppointmentTypeDto,
  ): Promise<any> {
    this.logger.log(
      `Creating appointment type for tenant: ${tenantId}, user: ${userId}`,
    );

    // If setting as default, unset previous default
    if (createDto.is_default) {
      await this.unsetPreviousDefault(tenantId);
    }

    const appointmentType = await this.prisma.appointment_type.create({
      data: {
        tenant_id: tenantId,
        created_by_user_id: userId,
        name: createDto.name,
        description: createDto.description,
        slot_duration_minutes: createDto.slot_duration_minutes ?? 60,
        max_lookahead_weeks: createDto.max_lookahead_weeks ?? 8,
        reminder_24h_enabled: createDto.reminder_24h_enabled ?? true,
        reminder_1h_enabled: createDto.reminder_1h_enabled ?? true,
        is_default: createDto.is_default ?? false,
        is_active: createDto.is_active ?? true,
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'appointment_type',
      entityId: appointmentType.id,
      tenantId,
      actorUserId: userId || 'system',
      after: appointmentType,
      description: `Created appointment type: ${appointmentType.name}`,
    });

    this.logger.log(`Created appointment type: ${appointmentType.id}`);
    return appointmentType;
  }

  /**
   * Get all appointment types for a tenant with filters and pagination
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param listDto - Filter and pagination options
   * @returns Paginated list of appointment types
   */
  async findAll(
    tenantId: string,
    listDto: ListAppointmentTypesDto,
  ): Promise<any> {
    const page = listDto.page ?? 1;
    const limit = listDto.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
    };

    if (listDto.is_active !== undefined) {
      where.is_active = listDto.is_active;
    }

    if (listDto.is_default !== undefined) {
      where.is_default = listDto.is_default;
    }

    if (listDto.search) {
      where.name = {
        contains: listDto.search,
      };
    }

    // Build orderBy
    const orderBy: any = {};
    const sortBy = listDto.sort_by ?? 'created_at';
    const sortOrder = listDto.sort_order ?? 'desc';
    orderBy[sortBy] = sortOrder;

    // Execute query
    const [items, total] = await Promise.all([
      this.prisma.appointment_type.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          created_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          schedules: {
            orderBy: {
              day_of_week: 'asc',
            },
          },
        },
      }),
      this.prisma.appointment_type.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single appointment type by ID
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param id - Appointment type ID
   * @returns Appointment type with relations
   */
  async findOne(tenantId: string, id: string): Promise<any> {
    const appointmentType = await this.prisma.appointment_type.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        schedules: {
          orderBy: {
            day_of_week: 'asc',
          },
        },
      },
    });

    if (!appointmentType) {
      throw new NotFoundException(`Appointment type with ID ${id} not found`);
    }

    return appointmentType;
  }

  /**
   * Update an appointment type
   * If is_default is set to true, unsets previous default for this tenant
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param id - Appointment type ID
   * @param userId - User updating the appointment type
   * @param updateDto - Updated data
   * @returns Updated appointment type
   */
  async update(
    tenantId: string,
    id: string,
    userId: string | null,
    updateDto: UpdateAppointmentTypeDto,
  ): Promise<any> {
    // Verify appointment type exists and belongs to tenant
    const existing = await this.findOne(tenantId, id);

    // If setting as default, unset previous default (excluding current record)
    if (updateDto.is_default && !existing.is_default) {
      await this.unsetPreviousDefault(tenantId, id);
    }

    // Build update data (only include provided fields)
    const updateData: any = {};

    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description;
    if (updateDto.slot_duration_minutes !== undefined) {
      updateData.slot_duration_minutes = updateDto.slot_duration_minutes;
    }
    if (updateDto.max_lookahead_weeks !== undefined) {
      updateData.max_lookahead_weeks = updateDto.max_lookahead_weeks;
    }
    if (updateDto.reminder_24h_enabled !== undefined) {
      updateData.reminder_24h_enabled = updateDto.reminder_24h_enabled;
    }
    if (updateDto.reminder_1h_enabled !== undefined) {
      updateData.reminder_1h_enabled = updateDto.reminder_1h_enabled;
    }
    if (updateDto.is_default !== undefined) {
      updateData.is_default = updateDto.is_default;
    }
    if (updateDto.is_active !== undefined) {
      updateData.is_active = updateDto.is_active;
    }

    const updated = await this.prisma.appointment_type.update({
      where: {
        id,
        tenant_id: tenantId,
      },
      data: updateData,
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        schedules: {
          orderBy: {
            day_of_week: 'asc',
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'appointment_type',
      entityId: id,
      tenantId,
      actorUserId: userId || 'system',
      before: existing,
      after: updated,
      description: `Updated appointment type: ${updated.name}`,
    });

    this.logger.log(`Updated appointment type: ${id}`);
    return updated;
  }

  /**
   * Soft delete an appointment type (set is_active = false)
   * Validates that there are no upcoming appointments for this type
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param id - Appointment type ID
   * @param userId - User deleting the appointment type
   */
  async delete(
    tenantId: string,
    id: string,
    userId: string | null,
  ): Promise<void> {
    // Verify appointment type exists and belongs to tenant
    const existing = await this.findOne(tenantId, id);

    // Check if there are any active appointments for this type
    const activeAppointments = await this.prisma.appointment.count({
      where: {
        tenant_id: tenantId,
        appointment_type_id: id,
        status: {
          in: ['scheduled', 'confirmed'],
        },
      },
    });

    if (activeAppointments > 0) {
      throw new BadRequestException(
        `Cannot deactivate appointment type with ${activeAppointments} active appointment(s). Please cancel or complete them first.`,
      );
    }

    // Soft delete (set is_active = false, is_default = false)
    await this.prisma.appointment_type.update({
      where: {
        id,
        tenant_id: tenantId,
      },
      data: {
        is_active: false,
        is_default: false,
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'appointment_type',
      entityId: id,
      tenantId,
      actorUserId: userId || 'system',
      before: existing,
      after: { is_active: false, is_default: false },
      description: `Deactivated appointment type: ${existing.name}`,
    });

    this.logger.log(`Soft deleted appointment type: ${id}`);
  }

  /**
   * Hard delete an appointment type (permanently remove from database)
   * Validates that there are NO appointments (active or historical) for this type
   * This is a destructive operation and should be used with caution
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param id - Appointment type ID
   * @param userId - User deleting the appointment type
   */
  async hardDelete(
    tenantId: string,
    id: string,
    userId: string | null,
  ): Promise<void> {
    // Verify appointment type exists and belongs to tenant
    const existing = await this.findOne(tenantId, id);

    // Check if there are ANY appointments for this type (active or historical)
    const totalAppointments = await this.prisma.appointment.count({
      where: {
        tenant_id: tenantId,
        appointment_type_id: id,
      },
    });

    if (totalAppointments > 0) {
      throw new BadRequestException(
        `Cannot permanently delete appointment type with ${totalAppointments} appointment(s) in history. Use soft delete (deactivate) instead.`,
      );
    }

    // Audit log BEFORE deletion
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'appointment_type',
      entityId: id,
      tenantId,
      actorUserId: userId || 'system',
      before: existing,
      description: `Permanently deleted appointment type: ${existing.name}`,
    });

    // Hard delete (permanently remove from database)
    await this.prisma.appointment_type.delete({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    this.logger.log(`Hard deleted appointment type: ${id}`);
  }

  /**
   * Unset the previous default appointment type for a tenant
   * This ensures only one default exists at a time
   *
   * @param tenantId - Tenant ID
   * @param excludeId - Optional ID to exclude from the update (for update operations)
   */
  private async unsetPreviousDefault(
    tenantId: string,
    excludeId?: string,
  ): Promise<void> {
    const where: any = {
      tenant_id: tenantId,
      is_default: true,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    await this.prisma.appointment_type.updateMany({
      where,
      data: {
        is_default: false,
      },
    });

    this.logger.log(`Unset previous default for tenant: ${tenantId}`);
  }
}
