import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { GoogleCalendarSyncService } from '../../calendar-integration/services/google-calendar-sync.service';
import {
  LeadActivitiesService,
  ActivityType,
} from '../../leads/services/lead-activities.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ListAppointmentsDto,
} from '../dto';
import { DateTimeConverterService } from './datetime-converter.service';
import { AppointmentReminderService } from './appointment-reminder.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly dateTimeConverter: DateTimeConverterService,
    private readonly googleCalendarSync: GoogleCalendarSyncService,
    private readonly leadActivitiesService: LeadActivitiesService,
    private readonly appointmentReminderService: AppointmentReminderService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new appointment with validation
   * Validates: lead exists, service_request belongs to lead, appointment_type exists
   * Sprint 05b: Full timezone conversion with DST support
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param userId - User creating the appointment
   * @param createDto - Appointment data
   * @returns Created appointment with relations
   */
  async create(
    tenantId: string,
    userId: string | null,
    createDto: CreateAppointmentDto,
  ): Promise<any> {
    this.logger.log(
      `Creating appointment for tenant: ${tenantId}, lead: ${createDto.lead_id}`,
    );

    // Fetch tenant to get timezone
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Validate: Lead exists and belongs to tenant
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: createDto.lead_id,
        tenant_id: tenantId,
      },
    });

    if (!lead) {
      throw new NotFoundException(
        `Lead with ID ${createDto.lead_id} not found or access denied`,
      );
    }

    // Validate: Appointment type exists and belongs to tenant
    const appointmentType = await this.prisma.appointment_type.findFirst({
      where: {
        id: createDto.appointment_type_id,
        tenant_id: tenantId,
      },
    });

    if (!appointmentType) {
      throw new NotFoundException(
        `Appointment type with ID ${createDto.appointment_type_id} not found or access denied`,
      );
    }

    // Validate: Service request (if provided) exists and belongs to the same lead
    if (createDto.service_request_id) {
      const serviceRequest = await this.prisma.service_request.findFirst({
        where: {
          id: createDto.service_request_id,
          tenant_id: tenantId,
          lead_id: createDto.lead_id,
        },
      });

      if (!serviceRequest) {
        throw new BadRequestException(
          `Service request with ID ${createDto.service_request_id} not found or does not belong to lead ${createDto.lead_id}`,
        );
      }
    }

    // Validate: Assigned user (if provided) exists and belongs to tenant
    if (createDto.assigned_user_id) {
      const assignedUser = await this.prisma.user.findFirst({
        where: {
          id: createDto.assigned_user_id,
          tenant_id: tenantId,
        },
      });

      if (!assignedUser) {
        throw new NotFoundException(
          `User with ID ${createDto.assigned_user_id} not found or access denied`,
        );
      }
    }

    // Validate: Date is not in the past
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (createDto.scheduled_date < today) {
      throw new BadRequestException(
        'Cannot create appointment in the past. Scheduled date must be today or in the future.',
      );
    }

    // Validate: Start time is before end time
    if (createDto.start_time >= createDto.end_time) {
      throw new BadRequestException(
        'Start time must be before end time',
      );
    }

    // Sprint 05b: Proper timezone conversion with DST support
    // Convert local time to UTC using tenant's timezone
    const startDatetimeUtc = this.dateTimeConverter.localToUtc(
      createDto.scheduled_date,
      createDto.start_time,
      tenant.timezone,
    );
    const endDatetimeUtc = this.dateTimeConverter.localToUtc(
      createDto.scheduled_date,
      createDto.end_time,
      tenant.timezone,
    );

    // Create appointment
    const appointment = await this.prisma.appointment.create({
      data: {
        tenant_id: tenantId,
        appointment_type_id: createDto.appointment_type_id,
        lead_id: createDto.lead_id,
        service_request_id: createDto.service_request_id,
        scheduled_date: createDto.scheduled_date,
        start_time: createDto.start_time,
        end_time: createDto.end_time,
        start_datetime_utc: startDatetimeUtc,
        end_datetime_utc: endDatetimeUtc,
        notes: createDto.notes,
        assigned_user_id: createDto.assigned_user_id,
        created_by_user_id: userId,
        status: 'scheduled',
        source: createDto.source || 'manual', // Sprint 18: Allow Voice AI to set source
      },
      include: {
        appointment_type: {
          select: {
            id: true,
            name: true,
            slot_duration_minutes: true,
          },
        },
        lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            emails: {
              where: { is_primary: true },
              take: 1,
            },
            phones: {
              where: { is_primary: true },
              take: 1,
            },
          },
        },
        service_request: {
          select: {
            id: true,
            service_name: true,
            status: true,
          },
        },
        assigned_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'appointment',
      entityId: appointment.id,
      tenantId,
      actorUserId: userId || 'system',
      after: appointment,
      description: `Created appointment for ${lead.first_name} ${lead.last_name} on ${createDto.scheduled_date} at ${createDto.start_time}`,
    });

    // Sprint 17: Lead activity logging
    await this.leadActivitiesService.logActivity(tenantId, {
      lead_id: appointment.lead_id,
      activity_type: ActivityType.APPOINTMENT_SCHEDULED,
      description: `Appointment scheduled: ${appointmentType.name} on ${createDto.scheduled_date} at ${createDto.start_time}`,
      user_id: userId || undefined,
    });

    // Sprint 17: Update service_request status if linked
    if (appointment.service_request_id) {
      await this.prisma.service_request.update({
        where: { id: appointment.service_request_id },
        data: { status: 'scheduled_visit' },
      });
      this.logger.log(
        `Updated service_request ${appointment.service_request_id} to 'scheduled_visit' status`,
      );
    }

    // Sprint 12: Queue Google Calendar sync (create event)
    // This is fire-and-forget - sync happens asynchronously in background
    try {
      await this.googleCalendarSync.queueCreateEvent(appointment.id);
    } catch (error) {
      // Log but don't fail appointment creation if sync queueing fails
      this.logger.error(
        `Failed to queue Google Calendar sync for appointment ${appointment.id}: ${error.message}`,
      );
    }

    // Sprint 20: Schedule appointment reminders (24h and 1h before)
    try {
      await this.appointmentReminderService.scheduleReminders(
        appointment.id,
        tenantId,
        appointment.start_datetime_utc,
        appointment.scheduled_date,
        appointment.start_time,
        appointment.lead_id,
        appointmentType.name,
      );
    } catch (error) {
      // Log but don't fail appointment creation if reminder scheduling fails
      this.logger.error(
        `Failed to schedule reminders for appointment ${appointment.id}: ${error.message}`,
      );
    }

    // Sprint 22: Create notification for Owner/Admin/Estimator
    try {
      const leadName = `${lead.first_name} ${lead.last_name}`;
      await this.notificationsService.createNotification({
        tenant_id: tenantId,
        user_id: null, // Tenant-wide broadcast to Owner/Admin/Estimator
        type: 'appointment_booked',
        title: 'New Appointment Booked',
        message: `New appointment: ${appointmentType.name} with ${leadName} on ${createDto.scheduled_date} at ${createDto.start_time}`,
        action_url: `/calendar/appointments/${appointment.id}`,
        related_entity_type: 'appointment',
        related_entity_id: appointment.id,
      });
      this.logger.log(
        `Created notification for new appointment ${appointment.id}`,
      );
    } catch (error) {
      // Log but don't fail appointment creation if notification fails
      this.logger.error(
        `Failed to create notification for appointment ${appointment.id}: ${error.message}`,
      );
    }

    this.logger.log(`Created appointment: ${appointment.id}`);
    return appointment;
  }

  /**
   * Get all appointments for a tenant with filters and pagination
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param listDto - Filter and pagination options
   * @returns Paginated list of appointments
   */
  async findAll(
    tenantId: string,
    listDto: ListAppointmentsDto,
  ): Promise<any> {
    const page = listDto.page ?? 1;
    const limit = Math.min(listDto.limit ?? 50, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
    };

    // Filter by status
    if (listDto.status) {
      where.status = listDto.status;
    }

    // Filter by lead_id
    if (listDto.lead_id) {
      where.lead_id = listDto.lead_id;
    }

    // Filter by date range
    if (listDto.date_from || listDto.date_to) {
      where.scheduled_date = {};

      if (listDto.date_from) {
        where.scheduled_date.gte = listDto.date_from;
      }

      if (listDto.date_to) {
        where.scheduled_date.lte = listDto.date_to;
      }
    }

    // Build orderBy
    const sortBy = listDto.sort_by ?? 'scheduled_date';
    const sortOrder = listDto.sort_order ?? 'asc';

    let orderBy: any;
    if (sortBy === 'scheduled_date') {
      // Sort by date first, then by start_time
      orderBy = [
        { scheduled_date: sortOrder },
        { start_time: sortOrder },
      ];
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    // Execute query
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          appointment_type: {
            select: {
              id: true,
              name: true,
              slot_duration_minutes: true,
            },
          },
          lead: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              emails: {
                where: { is_primary: true },
                take: 1,
              },
              phones: {
                where: { is_primary: true },
                take: 1,
              },
            },
          },
          service_request: {
            select: {
              id: true,
              service_name: true,
              status: true,
            },
          },
          assigned_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.appointment.count({ where }),
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
   * Get a single appointment by ID with full details
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param appointmentId - Appointment ID
   * @returns Appointment with full relations
   */
  async findOne(tenantId: string, appointmentId: string): Promise<any> {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenant_id: tenantId,
      },
      include: {
        appointment_type: {
          select: {
            id: true,
            name: true,
            description: true,
            slot_duration_minutes: true,
          },
        },
        lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            status: true,
            emails: {
              orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
            },
            phones: {
              orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
            },
            addresses: {
              orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
            },
          },
        },
        service_request: {
          select: {
            id: true,
            service_name: true,
            service_type: true,
            description: true,
            status: true,
          },
        },
        assigned_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        cancelled_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException(
        `Appointment with ID ${appointmentId} not found or access denied`,
      );
    }

    return appointment;
  }

  /**
   * Update an appointment
   * Sprint 05a: Only notes and assigned_user_id can be updated
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param appointmentId - Appointment ID
   * @param userId - User performing the update
   * @param updateDto - Update data
   * @returns Updated appointment
   */
  async update(
    tenantId: string,
    appointmentId: string,
    userId: string,
    updateDto: UpdateAppointmentDto,
  ): Promise<any> {
    // Verify appointment exists and belongs to tenant
    const existingAppointment = await this.findOne(tenantId, appointmentId);

    // Validate: Assigned user (if provided) exists and belongs to tenant
    if (updateDto.assigned_user_id) {
      const assignedUser = await this.prisma.user.findFirst({
        where: {
          id: updateDto.assigned_user_id,
          tenant_id: tenantId,
        },
      });

      if (!assignedUser) {
        throw new NotFoundException(
          `User with ID ${updateDto.assigned_user_id} not found or access denied`,
        );
      }
    }

    // Update appointment
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        notes: updateDto.notes,
        assigned_user_id: updateDto.assigned_user_id,
      },
      include: {
        appointment_type: {
          select: {
            id: true,
            name: true,
            slot_duration_minutes: true,
          },
        },
        lead: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            emails: {
              where: { is_primary: true },
              take: 1,
            },
            phones: {
              where: { is_primary: true },
              take: 1,
            },
          },
        },
        service_request: {
          select: {
            id: true,
            service_name: true,
            status: true,
          },
        },
        assigned_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'appointment',
      entityId: appointmentId,
      tenantId,
      actorUserId: userId,
      before: existingAppointment,
      after: updatedAppointment,
      description: `Updated appointment ${appointmentId}`,
    });

    this.logger.log(`Updated appointment: ${appointmentId}`);
    return updatedAppointment;
  }
}
