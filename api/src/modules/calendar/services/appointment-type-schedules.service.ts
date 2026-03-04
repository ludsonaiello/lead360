import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  BulkUpdateScheduleDto,
  UpdateSingleDayScheduleDto,
  DayScheduleDto,
} from '../dto';

@Injectable()
export class AppointmentTypeSchedulesService {
  private readonly logger = new Logger(AppointmentTypeSchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get all schedules for an appointment type (7 days)
   * If schedules don't exist, returns empty array
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param appointmentTypeId - Appointment type ID
   * @returns Array of 7 schedule entries (or less if not yet configured)
   */
  async findSchedules(
    tenantId: string,
    appointmentTypeId: string,
  ): Promise<any[]> {
    // Verify appointment type exists and belongs to tenant
    await this.verifyAppointmentTypeOwnership(tenantId, appointmentTypeId);

    const schedules = await this.prisma.appointment_type_schedule.findMany({
      where: {
        appointment_type_id: appointmentTypeId,
      },
      orderBy: {
        day_of_week: 'asc',
      },
    });

    this.logger.log(
      `Found ${schedules.length} schedules for appointment type: ${appointmentTypeId}`,
    );
    return schedules;
  }

  /**
   * Bulk update all 7 days of the week schedule
   * Creates or updates schedule entries for each day
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param appointmentTypeId - Appointment type ID
   * @param userId - User making the update
   * @param bulkUpdateDto - Schedule data for all 7 days
   * @returns Updated schedules
   */
  async bulkUpdateSchedules(
    tenantId: string,
    appointmentTypeId: string,
    userId: string | null,
    bulkUpdateDto: BulkUpdateScheduleDto,
  ): Promise<any[]> {
    this.logger.log(
      `Bulk updating schedules for appointment type: ${appointmentTypeId}, tenant: ${tenantId}`,
    );

    // Verify appointment type exists and belongs to tenant
    await this.verifyAppointmentTypeOwnership(tenantId, appointmentTypeId);

    // Validate that we have exactly 7 days (0-6)
    this.validateDaysOfWeek(bulkUpdateDto.schedules);

    // Get existing schedules for audit logging
    const existingSchedules = await this.findSchedules(
      tenantId,
      appointmentTypeId,
    );

    // Perform bulk upsert for each day
    const updatedSchedules = await Promise.all(
      bulkUpdateDto.schedules.map((daySchedule) =>
        this.upsertDaySchedule(appointmentTypeId, daySchedule),
      ),
    );

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'appointment_type_schedule',
      entityId: appointmentTypeId,
      tenantId,
      actorUserId: userId || 'system',
      before: existingSchedules,
      after: updatedSchedules,
      description: `Bulk updated schedules for appointment type`,
    });

    this.logger.log(
      `Bulk updated ${updatedSchedules.length} schedules for appointment type: ${appointmentTypeId}`,
    );

    return updatedSchedules;
  }

  /**
   * Update a single day's schedule
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param appointmentTypeId - Appointment type ID
   * @param dayOfWeek - Day of week (0-6)
   * @param userId - User making the update
   * @param updateDto - Schedule data for the day
   * @returns Updated schedule
   */
  async updateSingleDaySchedule(
    tenantId: string,
    appointmentTypeId: string,
    dayOfWeek: number,
    userId: string | null,
    updateDto: UpdateSingleDayScheduleDto,
  ): Promise<any> {
    this.logger.log(
      `Updating schedule for appointment type: ${appointmentTypeId}, day: ${dayOfWeek}`,
    );

    // Validate day of week
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new BadRequestException(
        'day_of_week must be between 0 (Sunday) and 6 (Saturday)',
      );
    }

    // Verify appointment type exists and belongs to tenant
    await this.verifyAppointmentTypeOwnership(tenantId, appointmentTypeId);

    // Get existing schedule for audit logging
    const existingSchedule =
      await this.prisma.appointment_type_schedule.findUnique({
        where: {
          appointment_type_id_day_of_week: {
            appointment_type_id: appointmentTypeId,
            day_of_week: dayOfWeek,
          },
        },
      });

    // Upsert the schedule
    const dayScheduleDto: DayScheduleDto = {
      day_of_week: dayOfWeek,
      is_available: updateDto.is_available,
      window1_start: updateDto.window1_start,
      window1_end: updateDto.window1_end,
      window2_start: updateDto.window2_start,
      window2_end: updateDto.window2_end,
    };

    const updatedSchedule = await this.upsertDaySchedule(
      appointmentTypeId,
      dayScheduleDto,
    );

    // Audit log
    await this.auditLogger.logTenantChange({
      action: existingSchedule ? 'updated' : 'created',
      entityType: 'appointment_type_schedule',
      entityId: updatedSchedule.id,
      tenantId,
      actorUserId: userId || 'system',
      before: existingSchedule || undefined,
      after: updatedSchedule,
      description: `Updated schedule for day ${dayOfWeek}`,
    });

    this.logger.log(
      `Updated schedule for appointment type: ${appointmentTypeId}, day: ${dayOfWeek}`,
    );

    return updatedSchedule;
  }

  /**
   * Private helper: Verify appointment type exists and belongs to tenant
   */
  private async verifyAppointmentTypeOwnership(
    tenantId: string,
    appointmentTypeId: string,
  ): Promise<void> {
    const appointmentType = await this.prisma.appointment_type.findFirst({
      where: {
        id: appointmentTypeId,
        tenant_id: tenantId,
      },
    });

    if (!appointmentType) {
      throw new NotFoundException(
        `Appointment type with ID ${appointmentTypeId} not found`,
      );
    }
  }

  /**
   * Private helper: Validate that schedules array contains exactly 7 unique days (0-6)
   */
  private validateDaysOfWeek(schedules: DayScheduleDto[]): void {
    const days = schedules.map((s) => s.day_of_week);
    const uniqueDays = new Set(days);

    if (uniqueDays.size !== 7) {
      throw new BadRequestException(
        'Must provide exactly 7 unique days (0-6, one for each day of the week)',
      );
    }

    for (let day = 0; day <= 6; day++) {
      if (!uniqueDays.has(day)) {
        throw new BadRequestException(
          `Missing schedule for day ${day} (0=Sunday, 1=Monday, ..., 6=Saturday)`,
        );
      }
    }
  }

  /**
   * Private helper: Upsert a single day's schedule
   * Uses Prisma upsert to create or update based on unique constraint
   */
  private async upsertDaySchedule(
    appointmentTypeId: string,
    daySchedule: DayScheduleDto,
  ): Promise<any> {
    return this.prisma.appointment_type_schedule.upsert({
      where: {
        appointment_type_id_day_of_week: {
          appointment_type_id: appointmentTypeId,
          day_of_week: daySchedule.day_of_week,
        },
      },
      update: {
        is_available: daySchedule.is_available,
        window1_start: daySchedule.window1_start || null,
        window1_end: daySchedule.window1_end || null,
        window2_start: daySchedule.window2_start || null,
        window2_end: daySchedule.window2_end || null,
      },
      create: {
        appointment_type_id: appointmentTypeId,
        day_of_week: daySchedule.day_of_week,
        is_available: daySchedule.is_available,
        window1_start: daySchedule.window1_start || null,
        window1_end: daySchedule.window1_end || null,
        window2_start: daySchedule.window2_start || null,
        window2_end: daySchedule.window2_end || null,
      },
    });
  }
}
