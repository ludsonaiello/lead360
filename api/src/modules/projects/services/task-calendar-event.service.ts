import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { GoogleCalendarService } from '../../calendar-integration/services/google-calendar.service';
import { CalendarProviderConnectionService } from '../../calendar-integration/services/calendar-provider-connection.service';
import { CreateTaskCalendarEventDto } from '../dto/create-task-calendar-event.dto';
import { UpdateTaskCalendarEventDto } from '../dto/update-task-calendar-event.dto';

@Injectable()
export class TaskCalendarEventService {
  private readonly logger = new Logger(TaskCalendarEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly calendarProviderConnectionService: CalendarProviderConnectionService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. createEvent
  // ---------------------------------------------------------------------------

  async createEvent(
    tenantId: string,
    projectId: string,
    taskId: string,
    userId: string,
    dto: CreateTaskCalendarEventDto,
  ) {
    // Validate start < end
    const startDt = new Date(dto.start_datetime);
    const endDt = new Date(dto.end_datetime);

    if (endDt <= startDt) {
      throw new BadRequestException(
        'end_datetime must be after start_datetime',
      );
    }

    // Verify task exists, belongs to project + tenant, and is not deleted
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        project_id: projectId,
        tenant_id: tenantId,
        deleted_at: null,
      },
      select: { id: true, title: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Attempt Google Calendar sync
    let googleEventId: string | null = null;
    let syncStatus: 'pending' | 'synced' | 'failed' | 'local_only' =
      'local_only';

    const connection =
      await this.calendarProviderConnectionService.getActiveConnection(
        tenantId,
      );

    if (connection) {
      try {
        const result = await this.googleCalendarService.createEvent(
          connection.accessToken,
          connection.connectedCalendarId,
          {
            summary: dto.title,
            description: dto.description || '',
            start: { dateTime: startDt.toISOString(), timeZone: 'UTC' },
            end: { dateTime: endDt.toISOString(), timeZone: 'UTC' },
          },
        );

        googleEventId = result.eventId;
        syncStatus = 'synced';
        this.logger.log(
          `Google Calendar event created: ${result.eventId} for task ${taskId}`,
        );
      } catch (error) {
        syncStatus = 'failed';
        this.logger.error(
          `Failed to sync calendar event to Google Calendar for task ${taskId}`,
          error.stack,
        );
        // DO NOT block creation — event is created locally with failed status
      }
    }

    // Create the event record
    const event = await this.prisma.task_calendar_event.create({
      data: {
        tenant_id: tenantId,
        task_id: taskId,
        project_id: projectId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        start_datetime: startDt,
        end_datetime: endDt,
        google_event_id: googleEventId,
        internal_calendar_id: null, // Phase 1: reserved for future
        sync_status: syncStatus,
        created_by_user_id: userId,
      },
    });

    // Audit log
    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'task_calendar_event',
      entityId: event.id,
      tenantId,
      actorUserId: userId,
      description: `Created calendar event "${event.title}" for task ${taskId}`,
      after: {
        title: event.title,
        task_id: taskId,
        project_id: projectId,
        sync_status: syncStatus,
      },
    });

    return this.formatEventResponse(event);
  }

  // ---------------------------------------------------------------------------
  // 2. listTaskEvents
  // ---------------------------------------------------------------------------

  async listTaskEvents(tenantId: string, projectId: string, taskId: string) {
    // Verify task exists and belongs to tenant/project
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        project_id: projectId,
        tenant_id: tenantId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const events = await this.prisma.task_calendar_event.findMany({
      where: {
        tenant_id: tenantId,
        task_id: taskId,
      },
      orderBy: { start_datetime: 'asc' },
    });

    return {
      data: events.map((e) => this.formatEventResponse(e)),
    };
  }

  // ---------------------------------------------------------------------------
  // 3. updateEvent
  // ---------------------------------------------------------------------------

  async updateEvent(
    tenantId: string,
    projectId: string,
    taskId: string,
    eventId: string,
    userId: string,
    dto: UpdateTaskCalendarEventDto,
  ) {
    // Verify event exists and belongs to tenant/task/project
    const existing = await this.prisma.task_calendar_event.findFirst({
      where: {
        id: eventId,
        tenant_id: tenantId,
        task_id: taskId,
        project_id: projectId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Calendar event not found');
    }

    // Build update data — only include fields that were provided
    const updateData: any = {};

    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.description !== undefined)
      updateData.description = dto.description?.trim() || null;
    if (dto.start_datetime !== undefined)
      updateData.start_datetime = new Date(dto.start_datetime);
    if (dto.end_datetime !== undefined)
      updateData.end_datetime = new Date(dto.end_datetime);

    // Validate start < end after applying updates
    const finalStart = updateData.start_datetime || existing.start_datetime;
    const finalEnd = updateData.end_datetime || existing.end_datetime;

    if (finalEnd <= finalStart) {
      throw new BadRequestException(
        'end_datetime must be after start_datetime',
      );
    }

    // Update local record first
    const updated = await this.prisma.task_calendar_event.update({
      where: { id: eventId },
      data: updateData,
    });

    // If Google Calendar event exists, attempt to update it
    if (existing.google_event_id) {
      const connection =
        await this.calendarProviderConnectionService.getActiveConnection(
          tenantId,
        );

      if (connection) {
        try {
          await this.googleCalendarService.updateEvent(
            connection.accessToken,
            connection.connectedCalendarId,
            existing.google_event_id,
            {
              summary: updated.title,
              description: updated.description || '',
              start: {
                dateTime: updated.start_datetime.toISOString(),
                timeZone: 'UTC',
              },
              end: {
                dateTime: updated.end_datetime.toISOString(),
                timeZone: 'UTC',
              },
            },
          );
          this.logger.log(
            `Google Calendar event updated: ${existing.google_event_id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update Google Calendar event ${existing.google_event_id}`,
            error.stack,
          );
          // Local update succeeds regardless of Google sync failure
        }
      }
    }

    // Audit log
    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'task_calendar_event',
      entityId: eventId,
      tenantId,
      actorUserId: userId,
      description: `Updated calendar event "${updated.title}" for task ${taskId}`,
      before: {
        title: existing.title,
        description: existing.description,
        start_datetime: existing.start_datetime,
        end_datetime: existing.end_datetime,
      },
      after: {
        title: updated.title,
        description: updated.description,
        start_datetime: updated.start_datetime,
        end_datetime: updated.end_datetime,
      },
    });

    return this.formatEventResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // 4. deleteEvent
  // ---------------------------------------------------------------------------

  async deleteEvent(
    tenantId: string,
    projectId: string,
    taskId: string,
    eventId: string,
    userId: string,
  ) {
    // Verify event exists and belongs to tenant/task/project
    const existing = await this.prisma.task_calendar_event.findFirst({
      where: {
        id: eventId,
        tenant_id: tenantId,
        task_id: taskId,
        project_id: projectId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Calendar event not found');
    }

    // If Google Calendar event exists, attempt to delete it
    if (existing.google_event_id) {
      const connection =
        await this.calendarProviderConnectionService.getActiveConnection(
          tenantId,
        );

      if (connection) {
        try {
          await this.googleCalendarService.deleteEvent(
            connection.accessToken,
            connection.connectedCalendarId,
            existing.google_event_id,
          );
          this.logger.log(
            `Google Calendar event deleted: ${existing.google_event_id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to delete Google Calendar event ${existing.google_event_id}`,
            error.stack,
          );
          // Proceed with local deletion regardless
        }
      }
    }

    // Delete local record
    await this.prisma.task_calendar_event.delete({
      where: { id: eventId },
    });

    // Audit log
    await this.auditLoggerService.logTenantChange({
      action: 'deleted',
      entityType: 'task_calendar_event',
      entityId: eventId,
      tenantId,
      actorUserId: userId,
      description: `Deleted calendar event "${existing.title}" for task ${taskId}`,
      before: {
        title: existing.title,
        task_id: existing.task_id,
        project_id: existing.project_id,
        google_event_id: existing.google_event_id,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatEventResponse(event: any) {
    return {
      id: event.id,
      task_id: event.task_id,
      project_id: event.project_id,
      title: event.title,
      description: event.description,
      start_datetime: event.start_datetime,
      end_datetime: event.end_datetime,
      google_event_id: event.google_event_id,
      sync_status: event.sync_status,
      created_by_user_id: event.created_by_user_id,
      created_at: event.created_at,
    };
  }
}
