import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { SmsSendingService } from '../../communication/services/sms-sending.service';

/**
 * Sprint 20: Appointment Reminder Processor
 *
 * Processes scheduled appointment reminders and sends notifications via SMS.
 *
 * Queue: calendar-reminders
 * Job: send-reminder
 *
 * Job Data:
 * - tenant_id: string
 * - appointment_id: string
 * - reminder_type: '24h' | '1h'
 * - scheduled_date: string (YYYY-MM-DD)
 * - start_time: string (HH:mm)
 * - lead_id: string
 * - appointment_type_name: string
 *
 * Process:
 * 1. Verify appointment still exists and is in 'scheduled' or 'confirmed' status
 * 2. Skip if appointment was cancelled, completed, rescheduled, or is no-show
 * 3. Get lead contact information (phone)
 * 4. Send SMS reminder via SmsSendingService
 * 5. Log reminder sent
 *
 * Multi-Tenant Isolation:
 * - All queries filtered by tenant_id
 * - SMS sending uses tenant's Twilio configuration
 */
@Processor('calendar-reminders')
export class AppointmentReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(AppointmentReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsSendingService: SmsSendingService,
  ) {
    super();
    this.logger.log(
      '🚀 AppointmentReminderProcessor worker initialized and ready',
    );
  }

  async process(job: Job): Promise<any> {
    const {
      tenant_id,
      appointment_id,
      reminder_type,
      scheduled_date,
      start_time,
      lead_id,
      appointment_type_name,
    } = job.data;

    const jobId = job.id as string;

    this.logger.log(
      `🔄 PROCESSING: Reminder job ${jobId} for appointment ${appointment_id} (${reminder_type} reminder)`,
    );

    try {
      // 1. Verify appointment still exists and check status
      const appointment = await this.prisma.appointment.findFirst({
        where: {
          id: appointment_id,
          tenant_id: tenant_id,
        },
        select: {
          id: true,
          status: true,
          scheduled_date: true,
          start_time: true,
          start_datetime_utc: true,
        },
      });

      if (!appointment) {
        this.logger.warn(
          `⚠️  Appointment ${appointment_id} not found. Skipping reminder.`,
        );
        return {
          success: false,
          skipped: true,
          reason: 'appointment_not_found',
        };
      }

      // 2. Skip if appointment is in terminal status
      const terminalStatuses = [
        'cancelled',
        'completed',
        'no_show',
        'rescheduled',
      ];
      if (terminalStatuses.includes(appointment.status)) {
        this.logger.log(
          `ℹ️  Appointment ${appointment_id} is in status '${appointment.status}'. Skipping reminder.`,
        );
        return {
          success: false,
          skipped: true,
          reason: `appointment_status_${appointment.status}`,
        };
      }

      // 3. Skip if appointment time has already passed
      const now = new Date();
      if (appointment.start_datetime_utc < now) {
        this.logger.log(
          `ℹ️  Appointment ${appointment_id} time has passed. Skipping reminder.`,
        );
        return {
          success: false,
          skipped: true,
          reason: 'appointment_time_passed',
        };
      }

      // 4. Get lead contact information
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: lead_id,
          tenant_id: tenant_id,
        },
        include: {
          phones: {
            where: { is_primary: true },
            take: 1,
          },
        },
      });

      if (!lead || !lead.phones || lead.phones.length === 0) {
        this.logger.warn(
          `⚠️  Lead ${lead_id} has no phone number. Skipping SMS reminder.`,
        );
        return {
          success: false,
          skipped: true,
          reason: 'no_phone_number',
        };
      }

      const phoneNumber = lead.phones[0].phone;

      // 5. Build reminder message
      const leadName = lead.first_name
        ? `${lead.first_name} ${lead.last_name || ''}`.trim()
        : 'there';

      const reminderTimeText =
        reminder_type === '24h' ? 'tomorrow' : 'in 1 hour';

      const message = `Hi ${leadName}, this is a reminder that your ${appointment_type_name} appointment is ${reminderTimeText} on ${scheduled_date} at ${start_time}. See you then!`;

      // 6. Send SMS reminder
      try {
        await this.smsSendingService.sendSms(
          tenant_id,
          'system', // User ID for internal system sending
          {
            to_phone: phoneNumber,
            text_body: message,
            related_entity_type: 'appointment',
            related_entity_id: appointment_id,
            lead_id: lead_id,
          },
        );

        this.logger.log(
          `✅ Sent ${reminder_type} reminder for appointment ${appointment_id} to ${phoneNumber}`,
        );

        return {
          success: true,
          reminder_type,
          appointment_id,
          phone_number: phoneNumber,
          message_sent: true,
        };
      } catch (smsError) {
        this.logger.error(
          `❌ Failed to send SMS reminder for appointment ${appointment_id}: ${smsError.message}`,
          smsError.stack,
        );

        throw smsError; // BullMQ will retry
      }
    } catch (error) {
      this.logger.error(
        `❌ Reminder job ${jobId} failed: ${error.message}`,
        error.stack,
      );
      throw error; // BullMQ will retry
    }
  }
}
