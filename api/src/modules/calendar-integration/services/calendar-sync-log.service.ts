import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { randomUUID } from 'crypto';

/**
 * Service for logging calendar sync operations
 * Creates immutable audit records for all sync activities between Lead360 and Google Calendar
 *
 * Sprint 12: Outbound Sync
 * Sprint 13a: Inbound Sync - Webhook Handler
 */
@Injectable()
export class CalendarSyncLogService {
  private readonly logger = new Logger(CalendarSyncLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a sync operation (create, update, or delete)
   * @param data - Sync log data
   * @returns Created log entry
   */
  async logSync(data: {
    tenantId: string;
    connectionId: string;
    direction: 'outbound' | 'inbound';
    action:
      | 'event_created'
      | 'event_updated'
      | 'event_deleted'
      | 'block_created'
      | 'block_updated'
      | 'block_deleted'
      | 'full_sync'
      | 'token_refreshed'
      | 'webhook_renewed'
      | 'webhook_received';
    appointmentId?: string;
    externalEventId?: string;
    status: 'success' | 'failed' | 'skipped';
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    id: string;
    tenantId: string;
    connectionId: string;
    direction: string;
    action: string;
    status: string;
    createdAt: Date;
  }> {
    const logEntry = await this.prisma.calendar_sync_log.create({
      data: {
        id: randomUUID(),
        tenant_id: data.tenantId,
        connection_id: data.connectionId,
        direction: data.direction,
        action: data.action,
        appointment_id: data.appointmentId || null,
        external_event_id: data.externalEventId || null,
        status: data.status,
        error_message: data.errorMessage || null,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    if (data.status === 'success') {
      this.logger.log(
        `✅ Sync logged: ${data.direction} ${data.action} - ${data.status}`,
      );
    } else if (data.status === 'failed') {
      this.logger.error(
        `❌ Sync logged: ${data.direction} ${data.action} - ${data.status}: ${data.errorMessage}`,
      );
    } else {
      this.logger.warn(
        `⚠️ Sync logged: ${data.direction} ${data.action} - ${data.status}`,
      );
    }

    return {
      id: logEntry.id,
      tenantId: logEntry.tenant_id,
      connectionId: logEntry.connection_id,
      direction: logEntry.direction,
      action: logEntry.action,
      status: logEntry.status,
      createdAt: logEntry.created_at,
    };
  }

  /**
   * Get recent sync logs for a tenant
   * @param tenantId - Tenant ID
   * @param limit - Maximum number of logs to return
   * @returns List of sync logs
   */
  async getRecentLogs(
    tenantId: string,
    limit: number = 50,
  ): Promise<
    Array<{
      id: string;
      direction: string;
      action: string;
      appointmentId: string | null;
      externalEventId: string | null;
      status: string;
      errorMessage: string | null;
      createdAt: Date;
    }>
  > {
    const logs = await this.prisma.calendar_sync_log.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      direction: log.direction,
      action: log.action,
      appointmentId: log.appointment_id,
      externalEventId: log.external_event_id,
      status: log.status,
      errorMessage: log.error_message,
      createdAt: log.created_at,
    }));
  }

  /**
   * Get failed sync operations for a tenant (for troubleshooting)
   * @param tenantId - Tenant ID
   * @param limit - Maximum number of logs to return
   * @returns List of failed sync logs
   */
  async getFailedLogs(
    tenantId: string,
    limit: number = 20,
  ): Promise<
    Array<{
      id: string;
      direction: string;
      action: string;
      appointmentId: string | null;
      externalEventId: string | null;
      errorMessage: string | null;
      metadata: any;
      createdAt: Date;
    }>
  > {
    const logs = await this.prisma.calendar_sync_log.findMany({
      where: {
        tenant_id: tenantId,
        status: 'failed',
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      direction: log.direction,
      action: log.action,
      appointmentId: log.appointment_id,
      externalEventId: log.external_event_id,
      errorMessage: log.error_message,
      metadata: log.metadata,
      createdAt: log.created_at,
    }));
  }

  /**
   * Get sync logs for a specific appointment
   * @param appointmentId - Appointment ID
   * @returns List of sync logs for this appointment
   */
  async getLogsForAppointment(
    appointmentId: string,
  ): Promise<
    Array<{
      id: string;
      direction: string;
      action: string;
      externalEventId: string | null;
      status: string;
      errorMessage: string | null;
      createdAt: Date;
    }>
  > {
    const logs = await this.prisma.calendar_sync_log.findMany({
      where: { appointment_id: appointmentId },
      orderBy: { created_at: 'desc' },
    });

    return logs.map((log) => ({
      id: log.id,
      direction: log.direction,
      action: log.action,
      externalEventId: log.external_event_id,
      status: log.status,
      errorMessage: log.error_message,
      createdAt: log.created_at,
    }));
  }

  /**
   * Count failed syncs in the last 24 hours (for health monitoring)
   * @param tenantId - Tenant ID
   * @returns Number of failed syncs
   */
  async countRecentFailures(tenantId: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.prisma.calendar_sync_log.count({
      where: {
        tenant_id: tenantId,
        status: 'failed',
        created_at: {
          gte: twentyFourHoursAgo,
        },
      },
    });
  }

  /**
   * Count successful syncs in the last 24 hours (for health monitoring)
   * Sprint 16: Health Check Endpoint
   * @param tenantId - Tenant ID
   * @returns Number of successful syncs
   */
  async countRecentSuccesses(tenantId: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.prisma.calendar_sync_log.count({
      where: {
        tenant_id: tenantId,
        status: 'success',
        created_at: {
          gte: twentyFourHoursAgo,
        },
      },
    });
  }

  /**
   * Get timestamp of the last successful sync operation
   * Sprint 16: Health Check Endpoint
   * @param tenantId - Tenant ID
   * @returns Last sync timestamp, or null if no syncs found
   */
  async getLastSyncTimestamp(tenantId: string): Promise<Date | null> {
    const lastSync = await this.prisma.calendar_sync_log.findFirst({
      where: {
        tenant_id: tenantId,
        status: 'success',
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        created_at: true,
      },
    });

    return lastSync?.created_at || null;
  }

  /**
   * Get paginated sync logs with filtering
   * Sprint 16: Sync Logs Endpoint
   *
   * @param tenantId - Tenant ID
   * @param filters - Filtering and pagination options
   * @returns Paginated sync logs with metadata
   */
  async getPaginatedLogs(
    tenantId: string,
    filters: {
      page: number;
      limit: number;
      status?: 'success' | 'failed' | 'skipped';
      direction?: 'outbound' | 'inbound';
      action?: string;
    },
  ): Promise<{
    data: Array<{
      id: string;
      connectionId: string;
      direction: string;
      action: string;
      appointmentId: string | null;
      externalEventId: string | null;
      status: string;
      errorMessage: string | null;
      metadata: any;
      createdAt: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, limit, status, direction, action } = filters;

    // Build where clause with filters
    const where: any = {
      tenant_id: tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (direction) {
      where.direction = direction;
    }

    if (action) {
      where.action = action;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [logs, total] = await Promise.all([
      this.prisma.calendar_sync_log.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.calendar_sync_log.count({ where }),
    ]);

    // Map to response format
    const data = logs.map((log) => ({
      id: log.id,
      connectionId: log.connection_id,
      direction: log.direction,
      action: log.action,
      appointmentId: log.appointment_id,
      externalEventId: log.external_event_id,
      status: log.status,
      errorMessage: log.error_message,
      metadata: log.metadata,
      createdAt: log.created_at,
    }));

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
