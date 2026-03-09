import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Periodic Sync Scheduler
 *
 * Sprint 15: Periodic Full Sync and Conflict Detection
 *
 * This scheduler runs every 6 hours to trigger full calendar sync for all
 * active connections. It serves as a fallback mechanism for missed webhook events
 * due to network issues or webhook delivery failures.
 *
 * The scheduler queries the database for active connections and queues sync jobs
 * to BullMQ for asynchronous processing. Each job is processed by the
 * GoogleCalendarSyncProcessor which calls GoogleCalendarSyncService to fetch
 * changed events from Google Calendar and create/update/delete external blocks.
 *
 * After sync completes, conflict detection runs automatically to identify
 * any overlaps between external calendar blocks and Lead360 appointments.
 *
 * @class PeriodicSyncScheduler
 * @since Sprint 15
 */
@Injectable()
export class PeriodicSyncScheduler {
  private readonly logger = new Logger(PeriodicSyncScheduler.name);

  constructor(
    @InjectQueue('calendar-sync') private readonly syncQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Periodic Full Sync Job
   *
   * Runs every 6 hours to trigger calendar sync for all active connections.
   * This is a fallback mechanism to catch events missed by webhooks.
   *
   * Runs at 00:00, 06:00, 12:00, and 18:00 UTC every day.
   *
   * @returns Promise<void>
   */
  @Cron('0 */6 * * *')
  async handlePeriodicSync(): Promise<void> {
    this.logger.log(' Running periodic full sync scheduler...');

    const startTime = Date.now();

    try {
      // 1. Query all active calendar connections
      // Priority: connections that haven't synced recently (NULLS FIRST)
      const connections =
        await this.prisma.calendar_provider_connection.findMany({
          where: {
            is_active: true,
            sync_status: 'active',
          },
          orderBy: [
            {
              last_sync_at: {
                sort: 'asc',
                nulls: 'first',
              },
            },
          ],
          select: {
            id: true,
            tenant_id: true,
            provider_type: true,
            last_sync_at: true,
          },
        });

      if (connections.length === 0) {
        this.logger.log('No active calendar connections found - skipping sync');
        return;
      }

      this.logger.log(
        `Found ${connections.length} active calendar connection(s) to sync`,
      );

      // 2. Queue sync job for each connection
      let queuedCount = 0;

      for (const connection of connections) {
        try {
          const lastSyncAge = connection.last_sync_at
            ? Math.floor(
                (Date.now() - connection.last_sync_at.getTime()) / 1000 / 60,
              )
            : null;

          this.logger.log(
            `Queuing sync for connection ${connection.id} (tenant: ${connection.tenant_id}, provider: ${connection.provider_type}, last sync: ${lastSyncAge ? `${lastSyncAge} minutes ago` : 'never'})`,
          );

          // Queue incremental sync job
          // The processor will call GoogleCalendarSyncService.processIncrementalSync()
          // which fetches changed events and creates/updates/deletes external blocks
          await this.syncQueue.add('incremental-sync', {
            tenantId: connection.tenant_id,
            connectionId: connection.id,
            trigger: 'scheduled', // Indicates this is from periodic scheduler
          });

          queuedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to queue sync for connection ${connection.id}: ${error.message}`,
            error.stack,
          );
          // Continue queuing other connections even if one fails
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.log(
        `Periodic sync scheduler completed in ${duration}s - Queued ${queuedCount} sync job(s)`,
      );
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.error(
        `Periodic sync scheduler failed after ${duration}s: ${error.message}`,
        error.stack,
      );

      // Don't throw - scheduler should continue running
      // Next run in 6 hours will retry
    }
  }

  /**
   * Manual trigger for testing or admin operations
   *
   * This method can be called manually for immediate full sync.
   * In production, the cron job handles automatic execution.
   *
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * // In your test or admin endpoint:
   * await periodicSyncScheduler.triggerManualSync();
   * ```
   */
  async triggerManualSync(): Promise<void> {
    this.logger.log('Manual periodic sync triggered');
    await this.handlePeriodicSync();
  }
}
