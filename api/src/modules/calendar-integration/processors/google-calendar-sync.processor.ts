import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GoogleCalendarSyncService } from '../services/google-calendar-sync.service';

/**
 * Google Calendar Sync Processor
 * Sprint 12: Outbound Sync - Lead360 → Google Calendar
 * Sprint 13a: Inbound Sync - Google Calendar → Lead360
 *
 * Processes queued calendar sync jobs asynchronously.
 *
 * Queue: calendar-sync
 * Jobs:
 * - sync-create-event: Create Google Calendar event for new appointment
 * - sync-update-event: Update Google Calendar event for rescheduled appointment
 * - sync-delete-event: Delete Google Calendar event for cancelled appointment
 * - incremental-sync: Fetch changed events from Google Calendar (webhook-triggered)
 *
 * Job Data:
 * - appointmentId: UUID of appointment record (for outbound sync)
 * - externalEventId: Google Calendar event ID (for delete operations)
 * - tenantId: Tenant ID (for incremental sync)
 * - connectionId: Connection ID (for incremental sync)
 * - trigger: Sync trigger source ('webhook', 'manual', 'scheduled')
 */
@Processor('calendar-sync')
export class GoogleCalendarSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(GoogleCalendarSyncProcessor.name);

  constructor(private readonly syncService: GoogleCalendarSyncService) {
    super();
    this.logger.log(
      '🚀 GoogleCalendarSyncProcessor worker initialized and ready',
    );
  }

  async process(job: Job): Promise<any> {
    const jobId = job.id as string;
    const jobName = job.name;

    this.logger.log(`🔄 PROCESSING: Calendar sync job ${jobId} (${jobName})`);

    try {
      switch (jobName) {
        case 'sync-create-event':
          return await this.processSyncCreateEvent(job);

        case 'sync-update-event':
          return await this.processSyncUpdateEvent(job);

        case 'sync-delete-event':
          return await this.processSyncDeleteEvent(job);

        case 'incremental-sync':
          return await this.processIncrementalSync(job);

        default:
          this.logger.error(`Unknown job name: ${jobName}`);
          return { success: false, reason: 'Unknown job name' };
      }
    } catch (error) {
      this.logger.error(
        `❌ Calendar sync job ${jobId} (${jobName}) failed: ${error.message}`,
        error.stack,
      );
      throw error; // BullMQ will retry based on job options
    }
  }

  /**
   * Process sync-create-event job
   * Creates a Google Calendar event for a newly created appointment
   */
  private async processSyncCreateEvent(job: Job): Promise<any> {
    const { appointmentId } = job.data;
    const jobId = job.id as string;

    if (!appointmentId) {
      throw new Error('Missing appointmentId in job data');
    }

    this.logger.log(
      `📅 Processing sync-create-event for appointment ${appointmentId}`,
    );

    const result = await this.syncService.processCreateEvent(appointmentId);

    if (result.success) {
      this.logger.log(
        `✅ Calendar sync job ${jobId} completed - Created event ${result.eventId}`,
      );
      return {
        success: true,
        eventId: result.eventId,
      };
    } else {
      this.logger.warn(
        `⚠️ Calendar sync job ${jobId} completed with status: ${result.error}`,
      );
      return {
        success: false,
        reason: result.error,
      };
    }
  }

  /**
   * Process sync-update-event job
   * Updates a Google Calendar event for a rescheduled appointment
   */
  private async processSyncUpdateEvent(job: Job): Promise<any> {
    const { appointmentId } = job.data;
    const jobId = job.id as string;

    if (!appointmentId) {
      throw new Error('Missing appointmentId in job data');
    }

    this.logger.log(
      `📅 Processing sync-update-event for appointment ${appointmentId}`,
    );

    const result = await this.syncService.processUpdateEvent(appointmentId);

    if (result.success) {
      this.logger.log(
        `✅ Calendar sync job ${jobId} completed - Updated event ${result.eventId}`,
      );
      return {
        success: true,
        eventId: result.eventId,
      };
    } else {
      this.logger.warn(
        `⚠️ Calendar sync job ${jobId} completed with status: ${result.error}`,
      );
      return {
        success: false,
        reason: result.error,
      };
    }
  }

  /**
   * Process sync-delete-event job
   * Deletes a Google Calendar event for a cancelled appointment
   */
  private async processSyncDeleteEvent(job: Job): Promise<any> {
    const { appointmentId, externalEventId } = job.data;
    const jobId = job.id as string;

    if (!appointmentId || !externalEventId) {
      throw new Error('Missing appointmentId or externalEventId in job data');
    }

    this.logger.log(
      `📅 Processing sync-delete-event for appointment ${appointmentId}, event ${externalEventId}`,
    );

    const result = await this.syncService.processDeleteEvent(
      appointmentId,
      externalEventId,
    );

    if (result.success) {
      this.logger.log(
        `✅ Calendar sync job ${jobId} completed - Deleted event ${externalEventId}`,
      );
      return {
        success: true,
        eventId: externalEventId,
      };
    } else {
      this.logger.warn(
        `⚠️ Calendar sync job ${jobId} completed with status: ${result.error}`,
      );
      return {
        success: false,
        reason: result.error,
      };
    }
  }

  /**
   * Process incremental-sync job
   * Sprint 13a: Fetches changed events from Google Calendar (webhook-triggered)
   *
   * This job is queued when Google sends a push notification (webhook) indicating
   * that the calendar has changed. We fetch only the events that changed since
   * the last sync (using sync token) to minimize API calls.
   */
  private async processIncrementalSync(job: Job): Promise<any> {
    const { tenantId, connectionId, trigger } = job.data;
    const jobId = job.id as string;

    if (!tenantId || !connectionId) {
      throw new Error('Missing tenantId or connectionId in job data');
    }

    this.logger.log(
      `📥 Processing incremental-sync for tenant ${tenantId} (trigger: ${trigger})`,
    );

    const result = await this.syncService.processIncrementalSync(
      tenantId,
      connectionId,
    );

    if (result.success) {
      this.logger.log(
        `✅ Incremental sync job ${jobId} completed - Processed ${result.eventsProcessed} events (${result.blocksCreated} created, ${result.blocksUpdated} updated, ${result.blocksDeleted} deleted)`,
      );
      return {
        success: true,
        eventsProcessed: result.eventsProcessed,
        blocksCreated: result.blocksCreated,
        blocksUpdated: result.blocksUpdated,
        blocksDeleted: result.blocksDeleted,
      };
    } else {
      this.logger.warn(
        `⚠️ Incremental sync job ${jobId} completed with status: ${result.error}`,
      );
      return {
        success: false,
        reason: result.error,
      };
    }
  }
}
