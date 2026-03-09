import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';

/**
 * Conflict Detection Service
 * Sprint 15: Periodic Full Sync & Conflict Detection
 *
 * Responsibilities:
 * - Detect overlaps between external calendar blocks and Lead360 appointments
 * - Create notifications when conflicts are found
 * - Used by periodic sync to catch missed webhook events
 * - Helps identify when external events (personal calendar) conflict with scheduled appointments
 *
 * Conflict Definition:
 * An external block conflicts with an appointment if their time ranges overlap:
 * - External block: [eb.start_datetime_utc, eb.end_datetime_utc]
 * - Appointment: [a.start_datetime_utc, a.end_datetime_utc]
 * - Overlap condition: eb.start < a.end AND a.start < eb.end
 *
 * Notification Strategy:
 * - One notification per conflict
 * - Targeted to Owner and Admin roles (tenant-wide broadcast)
 * - Contains appointment details and conflict message
 * - Action URL links to calendar page for manual resolution
 * - Deduplication: only create notification if one doesn't already exist for this conflict
 *
 * Performance:
 * - Query limited to future appointments (status = scheduled or confirmed)
 * - Uses indexed columns for efficient overlap detection
 * - Batch processes conflicts to minimize database round-trips
 *
 * @class ConflictDetectionService
 * @since Sprint 15
 */
@Injectable()
export class ConflictDetectionService {
  private readonly logger = new Logger(ConflictDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Detect conflicts between external calendar blocks and appointments
   *
   * Finds all appointments that overlap with external calendar blocks and
   * creates notifications for staff to resolve manually.
   *
   * This method is called:
   * - After periodic full sync (every 6 hours)
   * - After incremental sync (webhook-triggered)
   * - Manually via admin endpoint (if implemented)
   *
   * @param tenantId - Tenant ID to check conflicts for
   * @returns Object with conflict statistics and details
   */
  async detectConflicts(tenantId: string): Promise<{
    conflictsFound: number;
    notificationsCreated: number;
    conflicts: Array<{
      appointmentId: string;
      externalBlockId: string;
    }>;
  }> {
    try {
      this.logger.log(`🔍 Detecting conflicts for tenant ${tenantId}...`);

      // 1. Find external blocks that overlap with appointments
      // SQL overlap condition: eb.start < a.end AND a.start < eb.end
      // Only check future appointments with status = scheduled or confirmed
      const conflicts = await this.prisma.$queryRaw<
        Array<{ appointment_id: string; block_id: string }>
      >`
        SELECT
          a.id as appointment_id,
          eb.id as block_id
        FROM appointment a
        INNER JOIN calendar_external_block eb
          ON a.tenant_id = eb.tenant_id
         AND a.start_datetime_utc < eb.end_datetime_utc
         AND a.end_datetime_utc > eb.start_datetime_utc
        WHERE a.tenant_id = ${tenantId}
          AND a.status IN ('scheduled', 'confirmed')
          AND a.start_datetime_utc >= NOW()
        ORDER BY a.start_datetime_utc ASC
      `;

      this.logger.log(
        `Found ${conflicts.length} conflict(s) for tenant ${tenantId}`,
      );

      if (conflicts.length === 0) {
        return {
          conflictsFound: 0,
          notificationsCreated: 0,
          conflicts: [],
        };
      }

      // 2. Create notifications for each conflict
      let notificationsCreated = 0;

      for (const conflict of conflicts) {
        try {
          // Load appointment details for notification message
          const appointment = await this.prisma.appointment.findUnique({
            where: { id: conflict.appointment_id },
            include: {
              lead: {
                select: {
                  first_name: true,
                  last_name: true,
                },
              },
              appointment_type: {
                select: {
                  name: true,
                },
              },
            },
          });

          if (!appointment) {
            this.logger.warn(
              `Appointment ${conflict.appointment_id} not found - skipping notification`,
            );
            continue;
          }

          // Check if notification already exists for this conflict
          // Prevents duplicate notifications on subsequent sync runs
          const existingNotification = await this.prisma.notification.findFirst(
            {
              where: {
                tenant_id: tenantId,
                type: 'calendar_conflict',
                related_entity_type: 'appointment',
                related_entity_id: conflict.appointment_id,
                is_read: false,
              },
            },
          );

          if (existingNotification) {
            this.logger.debug(
              `Notification already exists for appointment ${conflict.appointment_id} - skipping`,
            );
            continue;
          }

          // Create notification (tenant-wide broadcast to Owner/Admin)
          const leadName = `${appointment.lead.first_name} ${appointment.lead.last_name}`;
          const appointmentTypeName = appointment.appointment_type.name;
          const appointmentDate = appointment.scheduled_date;
          const appointmentTime = appointment.start_time;

          await this.notificationsService.createNotification({
            tenant_id: tenantId,
            user_id: null, // Tenant-wide broadcast
            type: 'calendar_conflict',
            title: 'Calendar Conflict Detected',
            message: `External calendar event overlaps with appointment: ${appointmentTypeName} with ${leadName} on ${appointmentDate} at ${appointmentTime}`,
            action_url: '/calendar',
            related_entity_type: 'appointment',
            related_entity_id: conflict.appointment_id,
          });

          notificationsCreated++;

          this.logger.log(
            `✅ Created conflict notification for appointment ${conflict.appointment_id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to create notification for conflict ${conflict.appointment_id}: ${error.message}`,
            error.stack,
          );
          // Continue processing other conflicts even if one fails
        }
      }

      this.logger.log(
        `✅ Conflict detection completed for tenant ${tenantId} - ${conflicts.length} conflicts found, ${notificationsCreated} notifications created`,
      );

      return {
        conflictsFound: conflicts.length,
        notificationsCreated,
        conflicts: conflicts.map((c) => ({
          appointmentId: c.appointment_id,
          externalBlockId: c.block_id,
        })),
      };
    } catch (error) {
      this.logger.error(
        `❌ Conflict detection failed for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );

      throw error;
    }
  }

  /**
   * Detect conflicts for a specific appointment
   *
   * Used when:
   * - Creating a new appointment (validate slot is truly available)
   * - Rescheduling an appointment (check new slot)
   * - After webhook sync adds new external blocks
   *
   * @param appointmentId - Appointment ID to check
   * @returns true if conflict exists, false otherwise
   */
  async detectConflictForAppointment(appointmentId: string): Promise<boolean> {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          tenant_id: true,
          start_datetime_utc: true,
          end_datetime_utc: true,
        },
      });

      if (!appointment) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }

      // Check for overlapping external blocks
      const conflictingBlocks = await this.prisma.calendar_external_block.count(
        {
          where: {
            tenant_id: appointment.tenant_id,
            AND: [
              { start_datetime_utc: { lt: appointment.end_datetime_utc } },
              { end_datetime_utc: { gt: appointment.start_datetime_utc } },
            ],
          },
        },
      );

      return conflictingBlocks > 0;
    } catch (error) {
      this.logger.error(
        `Failed to detect conflict for appointment ${appointmentId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
