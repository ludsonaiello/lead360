import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Sprint 20: Appointment Reminder Service
 *
 * Manages scheduling and cancellation of appointment reminders via BullMQ.
 *
 * Responsibilities:
 * - Schedule 24h and 1h reminders for new appointments
 * - Cancel reminders when appointments are rescheduled, cancelled, completed, or marked as no-show
 * - Calculate reminder send times based on appointment start time
 *
 * Integration Points:
 * - Called by AppointmentsService.create() after appointment creation
 * - Called by AppointmentLifecycleService on status changes (cancel, reschedule, complete, no-show)
 *
 * Multi-Tenant Isolation:
 * - All jobs include tenant_id
 * - Job IDs are namespaced by appointment_id for easy cancellation
 */
@Injectable()
export class AppointmentReminderService {
  private readonly logger = new Logger(AppointmentReminderService.name);

  constructor(
    @InjectQueue('calendar-reminders')
    private readonly reminderQueue: Queue,
  ) {}

  /**
   * Schedule 24h and 1h reminders for an appointment
   *
   * @param appointmentId - UUID of the appointment
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param startDatetimeUtc - Appointment start time in UTC
   * @param scheduledDate - Local scheduled date (YYYY-MM-DD)
   * @param startTime - Local start time (HH:mm)
   * @param leadId - Lead ID for SMS recipient
   * @param appointmentTypeName - Name of appointment type for message
   */
  async scheduleReminders(
    appointmentId: string,
    tenantId: string,
    startDatetimeUtc: Date,
    scheduledDate: string,
    startTime: string,
    leadId: string,
    appointmentTypeName: string,
  ): Promise<void> {
    this.logger.log(`Scheduling reminders for appointment ${appointmentId}`);

    const now = new Date();

    // Calculate reminder times
    const reminder24h = new Date(startDatetimeUtc.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
    const reminder1h = new Date(startDatetimeUtc.getTime() - 1 * 60 * 60 * 1000); // 1 hour before

    const jobData = {
      tenant_id: tenantId,
      appointment_id: appointmentId,
      scheduled_date: scheduledDate,
      start_time: startTime,
      lead_id: leadId,
      appointment_type_name: appointmentTypeName,
    };

    // Schedule 24h reminder (only if it's in the future)
    if (reminder24h > now) {
      const delay = reminder24h.getTime() - now.getTime();

      await this.reminderQueue.add(
        'send-reminder',
        {
          ...jobData,
          reminder_type: '24h',
        },
        {
          jobId: `${appointmentId}-24h`, // Unique job ID for easy cancellation
          delay,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(
        `✅ Scheduled 24h reminder for appointment ${appointmentId} at ${reminder24h.toISOString()} (delay: ${Math.round(delay / 1000 / 60)} minutes)`,
      );
    } else {
      this.logger.log(
        `⚠️  Skipped 24h reminder for appointment ${appointmentId} (time has passed)`,
      );
    }

    // Schedule 1h reminder (only if it's in the future)
    if (reminder1h > now) {
      const delay = reminder1h.getTime() - now.getTime();

      await this.reminderQueue.add(
        'send-reminder',
        {
          ...jobData,
          reminder_type: '1h',
        },
        {
          jobId: `${appointmentId}-1h`, // Unique job ID for easy cancellation
          delay,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(
        `✅ Scheduled 1h reminder for appointment ${appointmentId} at ${reminder1h.toISOString()} (delay: ${Math.round(delay / 1000 / 60)} minutes)`,
      );
    } else {
      this.logger.log(
        `⚠️  Skipped 1h reminder for appointment ${appointmentId} (time has passed)`,
      );
    }
  }

  /**
   * Cancel all reminders for an appointment
   *
   * Called when appointment is:
   * - Rescheduled (new appointment will get new reminders)
   * - Cancelled
   * - Completed
   * - Marked as no-show
   *
   * @param appointmentId - UUID of the appointment
   */
  async cancelReminders(appointmentId: string): Promise<void> {
    this.logger.log(`Cancelling reminders for appointment ${appointmentId}`);

    try {
      // Remove both 24h and 1h reminder jobs
      const job24h = await this.reminderQueue.getJob(`${appointmentId}-24h`);
      const job1h = await this.reminderQueue.getJob(`${appointmentId}-1h`);

      if (job24h) {
        await job24h.remove();
        this.logger.log(
          `✅ Cancelled 24h reminder for appointment ${appointmentId}`,
        );
      }

      if (job1h) {
        await job1h.remove();
        this.logger.log(
          `✅ Cancelled 1h reminder for appointment ${appointmentId}`,
        );
      }

      if (!job24h && !job1h) {
        this.logger.log(
          `ℹ️  No reminders found to cancel for appointment ${appointmentId}`,
        );
      }
    } catch (error) {
      // Log but don't throw - cancellation might fail if jobs already executed
      this.logger.warn(
        `⚠️  Error cancelling reminders for appointment ${appointmentId}: ${error.message}`,
      );
    }
  }
}
