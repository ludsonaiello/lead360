import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  UpcomingAppointmentsResponseDto,
  NewAppointmentsResponseDto,
  AcknowledgeAppointmentResponseDto,
  UpcomingAppointmentDto,
  NewAppointmentDto,
} from '../dto';

/**
 * CalendarDashboardService
 *
 * Service for calendar dashboard widgets
 * Sprint 10: Dashboard helper endpoints
 *
 * Provides:
 * - Get upcoming appointments (next N appointments chronologically)
 * - Get new appointments (unacknowledged appointments)
 * - Acknowledge appointment (mark as seen)
 */
@Injectable()
export class CalendarDashboardService {
  private readonly logger = new Logger(CalendarDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get upcoming appointments for dashboard banner
   * Returns next N appointments in chronological order (scheduled or confirmed status only)
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param limit - Number of appointments to return (default: 5, max: 50)
   * @returns List of upcoming appointments
   */
  async getUpcomingAppointments(
    tenantId: string,
    limit: number = 5,
  ): Promise<UpcomingAppointmentsResponseDto> {
    this.logger.log(
      `Getting ${limit} upcoming appointments for tenant: ${tenantId}`,
    );

    // Get current date/time in UTC
    const now = new Date();

    // Query upcoming appointments
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenant_id: tenantId,
        status: {
          in: ['scheduled', 'confirmed'],
        },
        start_datetime_utc: {
          gte: now,
        },
      },
      orderBy: [
        { start_datetime_utc: 'asc' },
      ],
      take: limit,
      include: {
        appointment_type: {
          select: {
            name: true,
          },
        },
        lead: {
          select: {
            first_name: true,
            last_name: true,
            addresses: {
              where: { is_primary: true },
              take: 1,
              select: {
                address_line1: true,
              },
            },
          },
        },
      },
    });

    // Map to DTO
    const items: UpcomingAppointmentDto[] = appointments.map((apt) => ({
      id: apt.id,
      appointment_type_name: apt.appointment_type.name,
      lead_first_name: apt.lead.first_name || '',
      lead_last_name: apt.lead.last_name || '',
      scheduled_date: apt.scheduled_date,
      start_time: apt.start_time,
      end_time: apt.end_time,
      address: apt.lead.addresses[0]?.address_line1 || undefined,
      status: apt.status,
    }));

    this.logger.log(`Found ${items.length} upcoming appointments`);

    return {
      items,
      count: items.length,
    };
  }

  /**
   * Get newly booked appointments (not yet acknowledged)
   * Returns appointments where acknowledged_at IS NULL, ordered by creation date DESC
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param limit - Number of appointments to return (default: 10, max: 50)
   * @returns List of new unacknowledged appointments
   */
  async getNewAppointments(
    tenantId: string,
    limit: number = 10,
  ): Promise<NewAppointmentsResponseDto> {
    this.logger.log(
      `Getting ${limit} new appointments for tenant: ${tenantId}`,
    );

    // Query new (unacknowledged) appointments
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenant_id: tenantId,
        acknowledged_at: null,
        status: {
          in: ['scheduled', 'confirmed'],
        },
      },
      orderBy: [
        { created_at: 'desc' },
      ],
      take: limit,
      include: {
        appointment_type: {
          select: {
            name: true,
          },
        },
        lead: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    // Map to DTO
    const items: NewAppointmentDto[] = appointments.map((apt) => ({
      id: apt.id,
      appointment_type_name: apt.appointment_type.name,
      lead_first_name: apt.lead.first_name || '',
      lead_last_name: apt.lead.last_name || '',
      scheduled_date: apt.scheduled_date,
      start_time: apt.start_time,
      end_time: apt.end_time,
      source: apt.source,
      created_at: apt.created_at,
      status: apt.status,
    }));

    this.logger.log(`Found ${items.length} new appointments`);

    return {
      items,
      count: items.length,
    };
  }

  /**
   * Mark a new appointment as acknowledged
   * Sets acknowledged_at to current timestamp
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param appointmentId - Appointment ID to acknowledge
   * @returns Acknowledgment confirmation
   */
  async acknowledgeAppointment(
    tenantId: string,
    appointmentId: string,
  ): Promise<AcknowledgeAppointmentResponseDto> {
    this.logger.log(
      `Acknowledging appointment: ${appointmentId} for tenant: ${tenantId}`,
    );

    // Verify appointment exists and belongs to tenant
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenant_id: tenantId,
      },
    });

    if (!appointment) {
      throw new NotFoundException(
        `Appointment with ID ${appointmentId} not found or access denied`,
      );
    }

    // Update acknowledged_at timestamp
    const now = new Date();
    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        acknowledged_at: now,
      },
    });

    this.logger.log(`Acknowledged appointment: ${appointmentId}`);

    return {
      message: 'Appointment acknowledged successfully',
      appointment_id: updated.id,
      acknowledged_at: updated.acknowledged_at!,
    };
  }
}
