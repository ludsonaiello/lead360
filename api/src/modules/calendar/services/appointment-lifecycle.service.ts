import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { DateTimeConverterService } from './datetime-converter.service';
import { GoogleCalendarSyncService } from '../../calendar-integration/services/google-calendar-sync.service';
import {
  LeadActivitiesService,
  ActivityType,
} from '../../leads/services/lead-activities.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import {
  AppointmentStatus,
  CancellationReason,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  CompleteAppointmentDto,
  NoShowAppointmentDto,
  ConfirmAppointmentDto,
} from '../dto';
import { AppointmentReminderService } from './appointment-reminder.service';

/**
 * Sprint 06: Appointment Lifecycle Service
 * Sprint 12: Google Calendar sync integration
 * Sprint 17: Lead activity logging integration
 * Sprint 20: Appointment reminder cancellation integration
 *
 * Centralized state machine for appointment status transitions.
 * Enforces business rules:
 * - Terminal state locks (completed, cancelled, no_show, rescheduled)
 * - Reschedule creates new appointment
 * - Cancellation requires reason
 * - Service request status updates
 * - Google Calendar event sync (create, update, delete)
 * - Lead activity timeline logging
 * - Appointment reminder cancellation (Sprint 20)
 *
 * State Machine:
 * scheduled ──> confirmed ──> completed
 *    │              │
 *    ├─────> cancelled (reason required)
 *    ├─────> no_show (reason = no_show)
 *    └─────> rescheduled (auto-set by reschedule action)
 */
@Injectable()
export class AppointmentLifecycleService {
  private readonly logger = new Logger(AppointmentLifecycleService.name);

  // Terminal states that prevent further modifications
  private readonly TERMINAL_STATES = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.RESCHEDULED,
  ];

  // Valid transitions from each status
  private readonly ALLOWED_TRANSITIONS: Record<string, AppointmentStatus[]> = {
    [AppointmentStatus.SCHEDULED]: [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.RESCHEDULED,
    ],
    [AppointmentStatus.CONFIRMED]: [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.RESCHEDULED,
    ],
  };

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
   * Confirm an appointment (scheduled → confirmed)
   */
  async confirmAppointment(
    tenantId: string,
    appointmentId: string,
    userId: string,
    dto: ConfirmAppointmentDto,
  ): Promise<any> {
    this.logger.log(
      `Confirming appointment: ${appointmentId} for tenant: ${tenantId}`,
    );

    // Fetch appointment and verify ownership
    const appointment = await this.getAppointmentAndVerifyOwnership(
      tenantId,
      appointmentId,
    );

    // Validate transition
    this.validateTransition(
      appointment.status,
      AppointmentStatus.CONFIRMED,
      appointmentId,
    );

    // Update appointment
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CONFIRMED,
        notes: dto.notes
          ? `${appointment.notes || ''}\n[Confirmation] ${dto.notes}`.trim()
          : appointment.notes,
      },
      include: this.getAppointmentIncludes(),
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'appointment',
      entityId: appointmentId,
      tenantId,
      actorUserId: userId,
      before: appointment,
      after: updatedAppointment,
      description: `Confirmed appointment ${appointmentId}`,
    });

    // Sprint 17: Lead activity logging
    await this.leadActivitiesService.logActivity(tenantId, {
      lead_id: appointment.lead_id,
      activity_type: ActivityType.APPOINTMENT_CONFIRMED,
      description: `Appointment confirmed: ${updatedAppointment.appointment_type.name} on ${appointment.scheduled_date} at ${appointment.start_time}`,
      user_id: userId,
    });

    this.logger.log(`Appointment confirmed: ${appointmentId}`);
    return updatedAppointment;
  }

  /**
   * Cancel an appointment with reason
   * Updates service_request status if linked
   */
  async cancelAppointment(
    tenantId: string,
    appointmentId: string,
    userId: string | null,
    dto: CancelAppointmentDto,
  ): Promise<any> {
    this.logger.log(
      `Cancelling appointment: ${appointmentId} for tenant: ${tenantId}`,
    );

    // Fetch appointment and verify ownership
    const appointment = await this.getAppointmentAndVerifyOwnership(
      tenantId,
      appointmentId,
    );

    // Validate transition
    this.validateTransition(
      appointment.status,
      AppointmentStatus.CANCELLED,
      appointmentId,
    );

    // Validate cancellation notes required if reason is "other"
    if (
      dto.cancellation_reason === CancellationReason.OTHER &&
      (!dto.cancellation_notes || dto.cancellation_notes.trim().length === 0)
    ) {
      throw new BadRequestException(
        'cancellation_notes is required when cancellation_reason is "other"',
      );
    }

    // Update appointment
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancellation_reason: dto.cancellation_reason,
        cancellation_notes: dto.cancellation_notes,
        cancelled_at: new Date(),
        cancelled_by_user_id: userId,
      },
      include: this.getAppointmentIncludes(),
    });

    // Update service_request status if linked (revert to 'new')
    if (appointment.service_request_id) {
      await this.prisma.service_request.update({
        where: { id: appointment.service_request_id },
        data: { status: 'new' },
      });
      this.logger.log(
        `Reverted service_request ${appointment.service_request_id} to 'new' status`,
      );
    }

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'appointment',
      entityId: appointmentId,
      tenantId,
      actorUserId: userId || 'system',
      before: appointment,
      after: updatedAppointment,
      description: `Cancelled appointment ${appointmentId}. Reason: ${dto.cancellation_reason}`,
    });

    // Sprint 17: Lead activity logging
    await this.leadActivitiesService.logActivity(tenantId, {
      lead_id: appointment.lead_id,
      activity_type: ActivityType.APPOINTMENT_CANCELLED,
      description: `Appointment cancelled: ${updatedAppointment.appointment_type.name} on ${appointment.scheduled_date} at ${appointment.start_time}. Reason: ${dto.cancellation_reason}`,
      user_id: userId || undefined,
    });

    // Sprint 12: Queue Google Calendar sync (delete event)
    // Only sync if appointment had an external_calendar_event_id
    if (appointment.external_calendar_event_id) {
      try {
        await this.googleCalendarSync.queueDeleteEvent(
          appointmentId,
          appointment.external_calendar_event_id,
        );
      } catch (error) {
        // Log but don't fail cancellation if sync queueing fails
        this.logger.error(
          `Failed to queue Google Calendar sync for cancelled appointment ${appointmentId}: ${error.message}`,
        );
      }
    }

    // Sprint 20: Cancel appointment reminders
    try {
      await this.appointmentReminderService.cancelReminders(appointmentId);
    } catch (error) {
      // Log but don't fail cancellation if reminder cancellation fails
      this.logger.error(
        `Failed to cancel reminders for appointment ${appointmentId}: ${error.message}`,
      );
    }

    // Sprint 22: Create notification for Owner/Admin/Estimator
    try {
      const leadName = `${appointment.lead.first_name} ${appointment.lead.last_name}`;
      await this.notificationsService.createNotification({
        tenant_id: tenantId,
        user_id: null, // Tenant-wide broadcast to Owner/Admin/Estimator
        type: 'appointment_cancelled',
        title: 'Appointment Cancelled',
        message: `Appointment cancelled: ${updatedAppointment.appointment_type.name} with ${leadName} on ${appointment.scheduled_date} at ${appointment.start_time}. Reason: ${dto.cancellation_reason}`,
        action_url: `/calendar/appointments/${appointmentId}`,
        related_entity_type: 'appointment',
        related_entity_id: appointmentId,
      });
      this.logger.log(
        `Created notification for cancelled appointment ${appointmentId}`,
      );
    } catch (error) {
      // Log but don't fail cancellation if notification fails
      this.logger.error(
        `Failed to create notification for cancelled appointment ${appointmentId}: ${error.message}`,
      );
    }

    this.logger.log(`Appointment cancelled: ${appointmentId}`);
    return updatedAppointment;
  }

  /**
   * Reschedule an appointment to a new date/time
   * Creates NEW appointment and marks OLD as rescheduled
   * @returns Object with { oldAppointment, newAppointment }
   */
  async rescheduleAppointment(
    tenantId: string,
    appointmentId: string,
    userId: string | null,
    dto: RescheduleAppointmentDto,
  ): Promise<any> {
    this.logger.log(
      `Rescheduling appointment: ${appointmentId} for tenant: ${tenantId}`,
    );

    // Fetch appointment and verify ownership
    const oldAppointment = await this.getAppointmentAndVerifyOwnership(
      tenantId,
      appointmentId,
    );

    // Validate transition
    this.validateTransition(
      oldAppointment.status,
      AppointmentStatus.RESCHEDULED,
      appointmentId,
    );

    // Fetch tenant to get timezone
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Fetch appointment type to calculate end_time
    const appointmentType = await this.prisma.appointment_type.findFirst({
      where: {
        id: oldAppointment.appointment_type_id,
        tenant_id: tenantId,
      },
    });

    if (!appointmentType) {
      throw new NotFoundException(
        `Appointment type with ID ${oldAppointment.appointment_type_id} not found`,
      );
    }

    // Validate new date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (dto.new_scheduled_date < today) {
      throw new BadRequestException(
        'Cannot reschedule to a past date. New date must be today or in the future.',
      );
    }

    // Calculate new end_time based on slot_duration_minutes
    const newEndTime = this.calculateEndTime(
      dto.new_start_time,
      appointmentType.slot_duration_minutes,
    );

    // Convert local time to UTC
    const startDatetimeUtc = this.dateTimeConverter.localToUtc(
      dto.new_scheduled_date,
      dto.new_start_time,
      tenant.timezone,
    );
    const endDatetimeUtc = this.dateTimeConverter.localToUtc(
      dto.new_scheduled_date,
      newEndTime,
      tenant.timezone,
    );

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Mark old appointment as rescheduled
      const updatedOldAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.RESCHEDULED,
          cancellation_reason: CancellationReason.RESCHEDULED,
          cancelled_at: new Date(),
          cancelled_by_user_id: userId,
        },
      });

      // 2. Create new appointment with same details but new date/time
      const newAppointment = await tx.appointment.create({
        data: {
          tenant_id: tenantId,
          appointment_type_id: oldAppointment.appointment_type_id,
          lead_id: oldAppointment.lead_id,
          service_request_id: oldAppointment.service_request_id,
          scheduled_date: dto.new_scheduled_date,
          start_time: dto.new_start_time,
          end_time: newEndTime,
          start_datetime_utc: startDatetimeUtc,
          end_datetime_utc: endDatetimeUtc,
          notes: dto.reason
            ? `${oldAppointment.notes || ''}\n[Rescheduled] ${dto.reason}`.trim()
            : oldAppointment.notes,
          assigned_user_id: oldAppointment.assigned_user_id,
          created_by_user_id: userId,
          status: AppointmentStatus.SCHEDULED,
          source: oldAppointment.source,
          rescheduled_from_id: appointmentId,
          external_calendar_event_id:
            oldAppointment.external_calendar_event_id, // Inherit for Google Calendar update
        },
        include: this.getAppointmentIncludes(),
      });

      return { oldAppointment: updatedOldAppointment, newAppointment };
    });

    this.logger.log(`[RESCHEDULE DEBUG] Transaction result: has oldAppointment=${!!result.oldAppointment}, has newAppointment=${!!result.newAppointment}`);

    // Audit log for old appointment
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'appointment',
      entityId: appointmentId,
      tenantId,
      actorUserId: userId || 'system',
      before: oldAppointment,
      after: result.oldAppointment,
      description: `Marked appointment ${appointmentId} as rescheduled. New appointment: ${result.newAppointment.id}`,
    });

    // Audit log for new appointment
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'appointment',
      entityId: result.newAppointment.id,
      tenantId,
      actorUserId: userId || 'system',
      after: result.newAppointment,
      description: `Created rescheduled appointment from ${appointmentId}`,
    });

    // Sprint 17: Lead activity logging
    await this.leadActivitiesService.logActivity(tenantId, {
      lead_id: oldAppointment.lead_id,
      activity_type: ActivityType.APPOINTMENT_RESCHEDULED,
      description: `Appointment rescheduled: ${result.newAppointment.appointment_type.name} from ${oldAppointment.scheduled_date} ${oldAppointment.start_time} to ${dto.new_scheduled_date} ${dto.new_start_time}`,
      user_id: userId || undefined,
    });

    // Sprint 12: Queue Google Calendar sync (update event)
    // The new appointment inherits external_calendar_event_id from the old one
    // This updates the existing Google Calendar event with new date/time
    if (result.newAppointment.external_calendar_event_id) {
      try {
        await this.googleCalendarSync.queueUpdateEvent(result.newAppointment.id);
      } catch (error) {
        // Log but don't fail reschedule if sync queueing fails
        this.logger.error(
          `Failed to queue Google Calendar sync for rescheduled appointment ${result.newAppointment.id}: ${error.message}`,
        );
      }
    }

    // Sprint 20: Cancel reminders for OLD appointment
    try {
      await this.appointmentReminderService.cancelReminders(appointmentId);
    } catch (error) {
      // Log but don't fail reschedule if reminder cancellation fails
      this.logger.error(
        `Failed to cancel reminders for old appointment ${appointmentId}: ${error.message}`,
      );
    }

    // Sprint 20: Schedule reminders for NEW appointment
    try {
      await this.appointmentReminderService.scheduleReminders(
        result.newAppointment.id,
        tenantId,
        result.newAppointment.start_datetime_utc,
        result.newAppointment.scheduled_date,
        result.newAppointment.start_time,
        result.newAppointment.lead_id,
        result.newAppointment.appointment_type.name,
      );
    } catch (error) {
      // Log but don't fail reschedule if reminder scheduling fails
      this.logger.error(
        `Failed to schedule reminders for new appointment ${result.newAppointment.id}: ${error.message}`,
      );
    }

    // Sprint 22: Create notification for Owner/Admin/Estimator
    try {
      const leadName = `${oldAppointment.lead.first_name} ${oldAppointment.lead.last_name}`;
      await this.notificationsService.createNotification({
        tenant_id: tenantId,
        user_id: null, // Tenant-wide broadcast to Owner/Admin/Estimator
        type: 'appointment_rescheduled',
        title: 'Appointment Rescheduled',
        message: `Appointment rescheduled: ${result.newAppointment.appointment_type.name} with ${leadName} from ${oldAppointment.scheduled_date} ${oldAppointment.start_time} to ${dto.new_scheduled_date} ${dto.new_start_time}`,
        action_url: `/calendar/appointments/${result.newAppointment.id}`,
        related_entity_type: 'appointment',
        related_entity_id: result.newAppointment.id,
      });
      this.logger.log(
        `Created notification for rescheduled appointment ${result.newAppointment.id}`,
      );
    } catch (error) {
      // Log but don't fail reschedule if notification fails
      this.logger.error(
        `Failed to create notification for rescheduled appointment ${result.newAppointment.id}: ${error.message}`,
      );
    }

    this.logger.log(
      `Appointment rescheduled: Old ${appointmentId} → New ${result.newAppointment.id}`,
    );
    this.logger.log(`[RESCHEDULE DEBUG] Final result structure: ${JSON.stringify({
      hasOldAppointment: !!result.oldAppointment,
      hasNewAppointment: !!result.newAppointment,
      oldId: result.oldAppointment?.id,
      newId: result.newAppointment?.id,
      resultKeys: Object.keys(result)
    })}`);
    return result; // Return both old and new appointments
  }

  /**
   * Mark appointment as completed
   */
  async completeAppointment(
    tenantId: string,
    appointmentId: string,
    userId: string,
    dto: CompleteAppointmentDto,
  ): Promise<any> {
    this.logger.log(
      `Completing appointment: ${appointmentId} for tenant: ${tenantId}`,
    );

    // Fetch appointment and verify ownership
    const appointment = await this.getAppointmentAndVerifyOwnership(
      tenantId,
      appointmentId,
    );

    // Validate transition
    this.validateTransition(
      appointment.status,
      AppointmentStatus.COMPLETED,
      appointmentId,
    );

    // Update appointment
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.COMPLETED,
        completed_at: new Date(),
        notes: dto.completion_notes
          ? `${appointment.notes || ''}\n[Completed] ${dto.completion_notes}`.trim()
          : appointment.notes,
      },
      include: this.getAppointmentIncludes(),
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'appointment',
      entityId: appointmentId,
      tenantId,
      actorUserId: userId,
      before: appointment,
      after: updatedAppointment,
      description: `Marked appointment ${appointmentId} as completed`,
    });

    // Sprint 17: Lead activity logging
    await this.leadActivitiesService.logActivity(tenantId, {
      lead_id: appointment.lead_id,
      activity_type: ActivityType.APPOINTMENT_COMPLETED,
      description: `Appointment completed: ${updatedAppointment.appointment_type.name} on ${appointment.scheduled_date} at ${appointment.start_time}`,
      user_id: userId,
    });

    // Sprint 20: Cancel appointment reminders
    try {
      await this.appointmentReminderService.cancelReminders(appointmentId);
    } catch (error) {
      // Log but don't fail completion if reminder cancellation fails
      this.logger.error(
        `Failed to cancel reminders for appointment ${appointmentId}: ${error.message}`,
      );
    }

    this.logger.log(`Appointment completed: ${appointmentId}`);
    return updatedAppointment;
  }

  /**
   * Mark appointment as no-show
   */
  async markAsNoShow(
    tenantId: string,
    appointmentId: string,
    userId: string,
    dto: NoShowAppointmentDto,
  ): Promise<any> {
    this.logger.log(
      `Marking appointment as no-show: ${appointmentId} for tenant: ${tenantId}`,
    );

    // Fetch appointment and verify ownership
    const appointment = await this.getAppointmentAndVerifyOwnership(
      tenantId,
      appointmentId,
    );

    // Validate transition
    this.validateTransition(
      appointment.status,
      AppointmentStatus.NO_SHOW,
      appointmentId,
    );

    // Update appointment
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.NO_SHOW,
        cancellation_reason: CancellationReason.NO_SHOW,
        cancellation_notes: dto.notes,
        cancelled_at: new Date(),
        cancelled_by_user_id: userId,
      },
      include: this.getAppointmentIncludes(),
    });

    // Update service_request status if linked (revert to 'new')
    if (appointment.service_request_id) {
      await this.prisma.service_request.update({
        where: { id: appointment.service_request_id },
        data: { status: 'new' },
      });
      this.logger.log(
        `Reverted service_request ${appointment.service_request_id} to 'new' status`,
      );
    }

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'appointment',
      entityId: appointmentId,
      tenantId,
      actorUserId: userId,
      before: appointment,
      after: updatedAppointment,
      description: `Marked appointment ${appointmentId} as no-show`,
    });

    // Sprint 17: Lead activity logging
    await this.leadActivitiesService.logActivity(tenantId, {
      lead_id: appointment.lead_id,
      activity_type: ActivityType.APPOINTMENT_NO_SHOW,
      description: `Appointment no-show: ${updatedAppointment.appointment_type.name} on ${appointment.scheduled_date} at ${appointment.start_time}`,
      user_id: userId,
    });

    // Sprint 20: Cancel appointment reminders
    try {
      await this.appointmentReminderService.cancelReminders(appointmentId);
    } catch (error) {
      // Log but don't fail no-show if reminder cancellation fails
      this.logger.error(
        `Failed to cancel reminders for appointment ${appointmentId}: ${error.message}`,
      );
    }

    this.logger.log(`Appointment marked as no-show: ${appointmentId}`);
    return updatedAppointment;
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Get appointment and verify it belongs to the tenant
   */
  private async getAppointmentAndVerifyOwnership(
    tenantId: string,
    appointmentId: string,
  ): Promise<any> {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenant_id: tenantId,
      },
      include: this.getAppointmentIncludes(),
    });

    if (!appointment) {
      throw new NotFoundException(
        `Appointment with ID ${appointmentId} not found or access denied`,
      );
    }

    return appointment;
  }

  /**
   * Validate if transition from current status to new status is allowed
   * Enforces terminal state locks
   */
  private validateTransition(
    currentStatus: string,
    newStatus: AppointmentStatus,
    appointmentId: string,
  ): void {
    // Check if current status is terminal (cannot modify)
    if (this.TERMINAL_STATES.includes(currentStatus as AppointmentStatus)) {
      throw new BadRequestException(
        `Cannot modify appointment ${appointmentId}. Status '${currentStatus}' is a terminal state and cannot be changed.`,
      );
    }

    // Check if transition is allowed
    const allowedTransitions = this.ALLOWED_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${newStatus}' for appointment ${appointmentId}`,
      );
    }
  }

  /**
   * Calculate end time based on start time and duration
   */
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;

    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;

    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  }

  /**
   * Get standard appointment includes for consistent responses
   */
  private getAppointmentIncludes() {
    return {
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
      cancelled_by: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      },
    };
  }
}
