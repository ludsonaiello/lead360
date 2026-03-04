import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { CalendarProviderConnectionService } from './calendar-provider-connection.service';
import { CalendarSyncLogService } from './calendar-sync-log.service';
import { ConflictDetectionService } from './conflict-detection.service';

/**
 * Google Calendar Sync Service
 * Sprint 12: Outbound Sync - Appointment to Google Calendar Event
 * Sprint 13a: Inbound Sync - Google Calendar Webhook Handler
 * Sprint 15: Added conflict detection after sync
 *
 * Responsibilities:
 * - Map Lead360 appointments to Google Calendar events (per contract specification)
 * - Queue sync jobs for async processing (BullMQ)
 * - Process incremental sync from Google Calendar (webhook-triggered)
 * - Create/update/delete external blocks from Google Calendar events
 * - Detect conflicts after sync completes (Sprint 15)
 * - Handle token refresh when needed
 * - Log all sync operations
 *
 * Event Format (per contract):
 * - Title: "{appointment_type.name} — {lead.first_name} {lead.last_name}"
 * - Location: "{address.line1}, {address.city}, {address.state} {address.zip_code}"
 * - Description: Multi-line with phone, email, service, notes, source
 * - Start/End: UTC datetime with tenant timezone
 */
@Injectable()
export class GoogleCalendarSyncService {
  private readonly logger = new Logger(GoogleCalendarSyncService.name);

  constructor(
    @InjectQueue('calendar-sync') private readonly syncQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly googleCalendar: GoogleCalendarService,
    private readonly connectionService: CalendarProviderConnectionService,
    private readonly syncLog: CalendarSyncLogService,
    @Inject(forwardRef(() => ConflictDetectionService))
    private readonly conflictDetection: ConflictDetectionService,
  ) {}

  /**
   * Queue a job to create a Google Calendar event for a new appointment
   * @param appointmentId - Appointment ID
   */
  async queueCreateEvent(appointmentId: string): Promise<void> {
    await this.syncQueue.add('sync-create-event', { appointmentId });
    this.logger.log(`Queued create event job for appointment ${appointmentId}`);
  }

  /**
   * Queue a job to update a Google Calendar event (for reschedule)
   * @param appointmentId - New appointment ID (inherits external_calendar_event_id)
   */
  async queueUpdateEvent(appointmentId: string): Promise<void> {
    await this.syncQueue.add('sync-update-event', { appointmentId });
    this.logger.log(`Queued update event job for appointment ${appointmentId}`);
  }

  /**
   * Queue a job to delete a Google Calendar event (for cancellation)
   * @param appointmentId - Appointment ID
   * @param externalEventId - Google Calendar event ID
   */
  async queueDeleteEvent(
    appointmentId: string,
    externalEventId: string,
  ): Promise<void> {
    await this.syncQueue.add('sync-delete-event', {
      appointmentId,
      externalEventId,
    });
    this.logger.log(
      `Queued delete event job for appointment ${appointmentId}, event ${externalEventId}`,
    );
  }

  /**
   * Process create event job (executed by BullMQ processor)
   * @param appointmentId - Appointment ID
   * @returns Sync result
   */
  async processCreateEvent(appointmentId: string): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
  }> {
    let connection: any = null;
    let tenantId: string = '';

    try {
      // 1. Load appointment with all relations
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          tenant: true,
          appointment_type: true,
          lead: true,
          service_request: {
            include: {
              lead_address: true,
            },
          },
        },
      });

      if (!appointment) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }

      tenantId = appointment.tenant_id;

      // 2. Get active calendar connection
      connection = await this.connectionService.getActiveConnection(tenantId);

      if (!connection) {
        this.logger.warn(
          `No active calendar connection for tenant ${tenantId} - skipping sync`,
        );
        await this.syncLog.logSync({
          tenantId,
          connectionId: 'N/A',
          direction: 'outbound',
          action: 'event_created',
          appointmentId,
          status: 'skipped',
          errorMessage: 'No active calendar connection',
        });
        return { success: false, error: 'No active calendar connection' };
      }

      // 3. Refresh token if needed
      if (this.connectionService.needsTokenRefresh(connection.tokenExpiresAt)) {
        this.logger.log(`Refreshing access token for connection ${connection.id}`);
        const refreshed = await this.googleCalendar.refreshAccessToken(
          connection.refreshToken,
        );
        await this.connectionService.updateAccessToken(
          connection.id,
          refreshed.accessToken,
          refreshed.expiryDate,
        );
        connection.accessToken = refreshed.accessToken;

        await this.syncLog.logSync({
          tenantId,
          connectionId: connection.id,
          direction: 'outbound',
          action: 'token_refreshed',
          status: 'success',
        });
      }

      // 4. Map appointment to Google Calendar event format (per contract)
      const eventData = this.mapAppointmentToEvent(appointment);

      // 5. Create event in Google Calendar
      const createdEvent = await this.googleCalendar.createEvent(
        connection.accessToken,
        connection.connectedCalendarId,
        eventData,
      );

      // 6. Store external_calendar_event_id in appointment record
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          external_calendar_event_id: createdEvent.eventId,
        },
      });

      // 7. Log success
      await this.syncLog.logSync({
        tenantId,
        connectionId: connection.id,
        direction: 'outbound',
        action: 'event_created',
        appointmentId,
        externalEventId: createdEvent.eventId,
        status: 'success',
        metadata: { htmlLink: createdEvent.htmlLink },
      });

      this.logger.log(
        `✅ Created Google Calendar event ${createdEvent.eventId} for appointment ${appointmentId}`,
      );

      return { success: true, eventId: createdEvent.eventId };
    } catch (error) {
      this.logger.error(
        `❌ Failed to create Google Calendar event for appointment ${appointmentId}: ${error.message}`,
        error.stack,
      );

      // Log failure
      if (connection && tenantId) {
        await this.syncLog.logSync({
          tenantId,
          connectionId: connection.id,
          direction: 'outbound',
          action: 'event_created',
          appointmentId,
          status: 'failed',
          errorMessage: error.message,
        });
      }

      // Check if token refresh failed (user revoked access)
      if (error.message.includes('refresh') && connection) {
        await this.connectionService.updateSyncStatus(
          connection.id,
          'disconnected',
          'Token refresh failed - user may have revoked access',
        );
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Process update event job (executed by BullMQ processor)
   * @param appointmentId - New appointment ID (after reschedule)
   * @returns Sync result
   */
  async processUpdateEvent(appointmentId: string): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
  }> {
    let connection: any = null;
    let tenantId: string = '';

    try {
      // 1. Load appointment with all relations
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          tenant: true,
          appointment_type: true,
          lead: true,
          service_request: {
            include: {
              lead_address: true,
            },
          },
        },
      });

      if (!appointment) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }

      tenantId = appointment.tenant_id;

      if (!appointment.external_calendar_event_id) {
        throw new Error(
          `Appointment ${appointmentId} has no external_calendar_event_id`,
        );
      }

      // 2. Get active calendar connection
      connection = await this.connectionService.getActiveConnection(tenantId);

      if (!connection) {
        this.logger.warn(
          `No active calendar connection for tenant ${tenantId} - skipping sync`,
        );
        await this.syncLog.logSync({
          tenantId,
          connectionId: 'N/A',
          direction: 'outbound',
          action: 'event_updated',
          appointmentId,
          status: 'skipped',
          errorMessage: 'No active calendar connection',
        });
        return { success: false, error: 'No active calendar connection' };
      }

      // 3. Refresh token if needed
      if (this.connectionService.needsTokenRefresh(connection.tokenExpiresAt)) {
        this.logger.log(`Refreshing access token for connection ${connection.id}`);
        const refreshed = await this.googleCalendar.refreshAccessToken(
          connection.refreshToken,
        );
        await this.connectionService.updateAccessToken(
          connection.id,
          refreshed.accessToken,
          refreshed.expiryDate,
        );
        connection.accessToken = refreshed.accessToken;
      }

      // 4. Map appointment to Google Calendar event format
      const eventData = this.mapAppointmentToEvent(appointment);

      // 5. Update event in Google Calendar
      const updatedEvent = await this.googleCalendar.updateEvent(
        connection.accessToken,
        connection.connectedCalendarId,
        appointment.external_calendar_event_id,
        eventData,
      );

      // 6. Log success
      await this.syncLog.logSync({
        tenantId,
        connectionId: connection.id,
        direction: 'outbound',
        action: 'event_updated',
        appointmentId,
        externalEventId: updatedEvent.eventId,
        status: 'success',
        metadata: { htmlLink: updatedEvent.htmlLink },
      });

      this.logger.log(
        `✅ Updated Google Calendar event ${updatedEvent.eventId} for appointment ${appointmentId}`,
      );

      return { success: true, eventId: updatedEvent.eventId };
    } catch (error) {
      this.logger.error(
        `❌ Failed to update Google Calendar event for appointment ${appointmentId}: ${error.message}`,
        error.stack,
      );

      // Log failure
      if (connection && tenantId) {
        await this.syncLog.logSync({
          tenantId,
          connectionId: connection.id,
          direction: 'outbound',
          action: 'event_updated',
          appointmentId,
          status: 'failed',
          errorMessage: error.message,
        });
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Process delete event job (executed by BullMQ processor)
   * @param appointmentId - Appointment ID
   * @param externalEventId - Google Calendar event ID
   * @returns Sync result
   */
  async processDeleteEvent(
    appointmentId: string,
    externalEventId: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    let connection: any = null;
    let tenantId: string = '';

    try {
      // 1. Load appointment to get tenant_id
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { tenant_id: true },
      });

      if (!appointment) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }

      tenantId = appointment.tenant_id;

      // 2. Get active calendar connection
      connection = await this.connectionService.getActiveConnection(tenantId);

      if (!connection) {
        this.logger.warn(
          `No active calendar connection for tenant ${tenantId} - skipping sync`,
        );
        await this.syncLog.logSync({
          tenantId,
          connectionId: 'N/A',
          direction: 'outbound',
          action: 'event_deleted',
          appointmentId,
          externalEventId,
          status: 'skipped',
          errorMessage: 'No active calendar connection',
        });
        return { success: false, error: 'No active calendar connection' };
      }

      // 3. Refresh token if needed
      if (this.connectionService.needsTokenRefresh(connection.tokenExpiresAt)) {
        this.logger.log(`Refreshing access token for connection ${connection.id}`);
        const refreshed = await this.googleCalendar.refreshAccessToken(
          connection.refreshToken,
        );
        await this.connectionService.updateAccessToken(
          connection.id,
          refreshed.accessToken,
          refreshed.expiryDate,
        );
        connection.accessToken = refreshed.accessToken;
      }

      // 4. Delete event from Google Calendar (404 is acceptable - already deleted)
      await this.googleCalendar.deleteEvent(
        connection.accessToken,
        connection.connectedCalendarId,
        externalEventId,
      );

      // 5. Log success
      await this.syncLog.logSync({
        tenantId,
        connectionId: connection.id,
        direction: 'outbound',
        action: 'event_deleted',
        appointmentId,
        externalEventId,
        status: 'success',
      });

      this.logger.log(
        `✅ Deleted Google Calendar event ${externalEventId} for appointment ${appointmentId}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `❌ Failed to delete Google Calendar event ${externalEventId}: ${error.message}`,
        error.stack,
      );

      // Log failure
      if (connection && tenantId) {
        await this.syncLog.logSync({
          tenantId,
          connectionId: connection.id,
          direction: 'outbound',
          action: 'event_deleted',
          appointmentId,
          externalEventId,
          status: 'failed',
          errorMessage: error.message,
        });
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Map Lead360 appointment to Google Calendar event format
   * Per contract specification (Sprint 12)
   *
   * @param appointment - Appointment with relations
   * @returns Google Calendar event data
   */
  private mapAppointmentToEvent(appointment: any): {
    summary: string;
    location?: string;
    description?: string;
    start: {
      dateTime: string;
      timeZone: string;
    };
    end: {
      dateTime: string;
      timeZone: string;
    };
  } {
    // Title: "{appointment_type.name} — {lead.first_name} {lead.last_name}"
    const summary = `${appointment.appointment_type.name} — ${appointment.lead.first_name} ${appointment.lead.last_name}`;

    // Location: "{address.line1}, {address.city}, {address.state} {address.zip_code}"
    // Only included if service_request has lead_address
    let location: string | undefined;
    if (appointment.service_request?.lead_address) {
      const addr = appointment.service_request.lead_address;
      location = `${addr.address_line1}, ${addr.city}, ${addr.state} ${addr.zip_code}`;
    }

    // Description: Multi-line format (omit lines if field not available)
    const descriptionLines: string[] = [];

    if (appointment.lead.phone) {
      descriptionLines.push(`Phone: ${appointment.lead.phone}`);
    }

    if (appointment.lead.email) {
      descriptionLines.push(`Email: ${appointment.lead.email}`);
    }

    if (appointment.service_request?.service_name) {
      descriptionLines.push(`Service: ${appointment.service_request.service_name}`);
    }

    if (appointment.service_request?.description) {
      descriptionLines.push(
        `Description: ${appointment.service_request.description}`,
      );
    }

    if (appointment.notes) {
      descriptionLines.push(`Notes: ${appointment.notes}`);
    }

    descriptionLines.push(`Booked via: ${appointment.source}`);

    const description =
      descriptionLines.length > 0 ? descriptionLines.join('\n') : undefined;

    // Start/End: UTC datetime with tenant timezone
    return {
      summary,
      location,
      description,
      start: {
        dateTime: appointment.start_datetime_utc.toISOString(),
        timeZone: appointment.tenant.timezone,
      },
      end: {
        dateTime: appointment.end_datetime_utc.toISOString(),
        timeZone: appointment.tenant.timezone,
      },
    };
  }

  /**
   * Process incremental sync (executed by BullMQ processor)
   * Sprint 13a: Inbound Sync - Webhook Handler
   *
   * Fetches changed events from Google Calendar and creates/updates/deletes
   * external blocks. Only stores time blocks - no personal event details.
   *
   * @param tenantId - Tenant ID
   * @param connectionId - Connection ID
   * @returns Sync result with statistics
   */
  async processIncrementalSync(
    tenantId: string,
    connectionId: string,
  ): Promise<{
    success: boolean;
    eventsProcessed: number;
    blocksCreated: number;
    blocksUpdated: number;
    blocksDeleted: number;
    error?: string;
  }> {
    try {
      this.logger.log(
        `Starting incremental sync for tenant ${tenantId}, connection ${connectionId}`,
      );

      // 1. Get calendar connection
      const connection = await this.connectionService.getActiveConnection(tenantId);

      if (!connection) {
        throw new Error(
          `No active calendar connection found for tenant ${tenantId}`,
        );
      }

      // 2. Refresh token if needed
      if (this.connectionService.needsTokenRefresh(connection.tokenExpiresAt)) {
        this.logger.log(`Refreshing access token for connection ${connection.id}`);
        const refreshed = await this.googleCalendar.refreshAccessToken(
          connection.refreshToken,
        );
        await this.connectionService.updateAccessToken(
          connection.id,
          refreshed.accessToken,
          refreshed.expiryDate,
        );
        connection.accessToken = refreshed.accessToken;

        await this.syncLog.logSync({
          tenantId,
          connectionId: connection.id,
          direction: 'inbound',
          action: 'token_refreshed',
          status: 'success',
        });
      }

      // 3. Fetch events from Google Calendar
      const now = new Date();
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(now.getFullYear() + 1);

      const { events, nextSyncToken } =
        await this.googleCalendar.listEventsIncremental(
          connection.accessToken,
          connection.connectedCalendarId,
          connection.lastSyncToken || undefined,
          now, // Only future events
          oneYearFromNow, // Up to 1 year ahead
        );

      this.logger.log(
        `Fetched ${events.length} events from Google Calendar for tenant ${tenantId}`,
      );

      // 4. Get all Lead360 appointment event IDs (to exclude from external blocks)
      const lead360EventIds = await this.getLeadEventIds(tenantId);

      this.logger.log(
        `Found ${lead360EventIds.size} Lead360 appointments to exclude from external blocks`,
      );

      // 5. Process events and create/update/delete external blocks
      let blocksCreated = 0;
      let blocksUpdated = 0;
      let blocksDeleted = 0;

      for (const event of events) {
        // Skip events created by Lead360
        if (lead360EventIds.has(event.id)) {
          this.logger.debug(
            `Skipping event ${event.id} - created by Lead360`,
          );
          continue;
        }

        // Handle deleted events
        if (event.status === 'cancelled') {
          const deleted = await this.deleteExternalBlock(tenantId, event.id);
          if (deleted) {
            blocksDeleted++;
          }
          continue;
        }

        // Parse event time
        const eventTime = this.parseEventTime(event);

        if (!eventTime) {
          this.logger.warn(
            `Skipping event ${event.id} - no valid start/end time`,
          );
          continue;
        }

        // Create or update external block
        const isNew = await this.createOrUpdateExternalBlock(
          tenantId,
          connection.id,
          event.id,
          eventTime,
        );

        if (isNew) {
          blocksCreated++;
        } else {
          blocksUpdated++;
        }
      }

      // 6. Update last sync timestamp and sync token
      await this.connectionService.updateLastSync(connection.id, nextSyncToken);

      // 7. Run conflict detection (Sprint 15)
      // After syncing external blocks, check if any overlap with existing appointments
      let conflictsFound = 0;
      let notificationsCreated = 0;

      try {
        this.logger.log(`Running conflict detection for tenant ${tenantId}...`);
        const conflictResult =
          await this.conflictDetection.detectConflicts(tenantId);

        conflictsFound = conflictResult.conflictsFound;
        notificationsCreated = conflictResult.notificationsCreated;

        if (conflictsFound > 0) {
          this.logger.warn(
            `⚠️ Found ${conflictsFound} conflict(s) for tenant ${tenantId} - ${notificationsCreated} notification(s) created`,
          );
        } else {
          this.logger.log(
            `✅ No conflicts found for tenant ${tenantId}`,
          );
        }
      } catch (error) {
        // Don't fail the entire sync if conflict detection fails
        // Log error and continue
        this.logger.error(
          `Conflict detection failed for tenant ${tenantId}: ${error.message}`,
          error.stack,
        );
      }

      // 8. Log success
      await this.syncLog.logSync({
        tenantId,
        connectionId: connection.id,
        direction: 'inbound',
        action: 'full_sync',
        status: 'success',
        metadata: {
          eventsProcessed: events.length,
          blocksCreated,
          blocksUpdated,
          blocksDeleted,
          syncTokenUpdated: !!nextSyncToken,
          conflictsFound,
          notificationsCreated,
        },
      });

      this.logger.log(
        `✅ Incremental sync completed for tenant ${tenantId} - Processed ${events.length} events (${blocksCreated} created, ${blocksUpdated} updated, ${blocksDeleted} deleted, ${conflictsFound} conflicts)`,
      );

      return {
        success: true,
        eventsProcessed: events.length,
        blocksCreated,
        blocksUpdated,
        blocksDeleted,
      };
    } catch (error) {
      this.logger.error(
        `❌ Incremental sync failed for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );

      // Log failure
      await this.syncLog.logSync({
        tenantId,
        connectionId,
        direction: 'inbound',
        action: 'full_sync',
        status: 'failed',
        errorMessage: error.message,
      });

      // Check if token refresh failed
      if (error.message.includes('refresh')) {
        await this.connectionService.updateSyncStatus(
          connectionId,
          'disconnected',
          'Token refresh failed - user may have revoked access',
        );
      }

      return {
        success: false,
        eventsProcessed: 0,
        blocksCreated: 0,
        blocksUpdated: 0,
        blocksDeleted: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get all event IDs from Lead360 appointments for this tenant
   * These events should be excluded from external blocks
   * @private
   */
  private async getLeadEventIds(tenantId: string): Promise<Set<string>> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenant_id: tenantId,
        external_calendar_event_id: {
          not: null,
        },
      },
      select: {
        external_calendar_event_id: true,
      },
    });

    return new Set(
      appointments
        .map((a) => a.external_calendar_event_id)
        .filter((id): id is string => id !== null),
    );
  }

  /**
   * Parse event start/end time from Google Calendar event
   * @private
   */
  private parseEventTime(event: {
    id: string;
    status: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }): {
    startDatetimeUtc: Date;
    endDatetimeUtc: Date;
    isAllDay: boolean;
  } | null {
    if (!event.start || !event.end) {
      return null;
    }

    // All-day event (date field instead of dateTime)
    if (event.start.date && event.end.date) {
      return {
        startDatetimeUtc: new Date(event.start.date),
        endDatetimeUtc: new Date(event.end.date),
        isAllDay: true,
      };
    }

    // Timed event (dateTime field)
    if (event.start.dateTime && event.end.dateTime) {
      return {
        startDatetimeUtc: new Date(event.start.dateTime),
        endDatetimeUtc: new Date(event.end.dateTime),
        isAllDay: false,
      };
    }

    return null;
  }

  /**
   * Create or update external block
   * @returns true if created new, false if updated existing
   * @private
   */
  private async createOrUpdateExternalBlock(
    tenantId: string,
    connectionId: string,
    externalEventId: string,
    eventTime: {
      startDatetimeUtc: Date;
      endDatetimeUtc: Date;
      isAllDay: boolean;
    },
  ): Promise<boolean> {
    // Check if block already exists
    const existingBlock = await this.prisma.calendar_external_block.findUnique({
      where: {
        tenant_id_external_event_id: {
          tenant_id: tenantId,
          external_event_id: externalEventId,
        },
      },
    });

    if (existingBlock) {
      // Update existing block
      await this.prisma.calendar_external_block.update({
        where: {
          tenant_id_external_event_id: {
            tenant_id: tenantId,
            external_event_id: externalEventId,
          },
        },
        data: {
          start_datetime_utc: eventTime.startDatetimeUtc,
          end_datetime_utc: eventTime.endDatetimeUtc,
          is_all_day: eventTime.isAllDay,
          updated_at: new Date(),
        },
      });

      this.logger.debug(`Updated external block for event ${externalEventId}`);
      return false;
    } else {
      // Create new block
      await this.prisma.calendar_external_block.create({
        data: {
          tenant_id: tenantId,
          connection_id: connectionId,
          external_event_id: externalEventId,
          start_datetime_utc: eventTime.startDatetimeUtc,
          end_datetime_utc: eventTime.endDatetimeUtc,
          is_all_day: eventTime.isAllDay,
          source: 'google_calendar',
        },
      });

      this.logger.debug(`Created external block for event ${externalEventId}`);
      return true;
    }
  }

  /**
   * Delete external block for cancelled event
   * @returns true if deleted, false if not found
   * @private
   */
  private async deleteExternalBlock(
    tenantId: string,
    externalEventId: string,
  ): Promise<boolean> {
    const result = await this.prisma.calendar_external_block.deleteMany({
      where: {
        tenant_id: tenantId,
        external_event_id: externalEventId,
      },
    });

    if (result.count > 0) {
      this.logger.debug(
        `Deleted external block for cancelled event ${externalEventId}`,
      );
      return true;
    }

    return false;
  }
}
