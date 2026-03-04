import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { GoogleCalendarService } from '../services/google-calendar.service';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import { CalendarSyncLogService } from '../services/calendar-sync-log.service';

/**
 * Webhook Renewal Scheduler
 * Sprint 14: Automatic Google Calendar Webhook Channel Renewal
 *
 * Responsibilities:
 * - Runs every 6 hours to check for expiring webhook channels
 * - Proactively renews channels before they expire (24-hour threshold)
 * - Stops old webhook channels (best practice)
 * - Creates new webhook channels with fresh 7-day expiration
 * - Updates webhook details in database
 * - Logs all renewal operations
 * - Marks connections as error if renewal fails
 *
 * Schedule: Every 6 hours
 * Cron Pattern: At minute 0 of every 6th hour
 *
 * Why Every 6 Hours:
 * - Google webhook channels expire after 7 days (168 hours)
 * - 24-hour renewal threshold provides buffer for multiple retry attempts
 * - Running every 6 hours ensures at least 4 attempts before expiry
 * - Low overhead - only queries connections with expiring webhooks
 * - Webhook renewal is a quick operation (~1-2 seconds per connection)
 *
 * Webhook Expiry Strategy:
 * - Google issues webhook channels with 7-day (168-hour) expiry
 * - We renew when channel expires within 24 hours
 * - Scheduler runs every 6 hours (4+ chances to renew)
 * - If renewal fails, connection marked as "error" (sync continues, but no real-time updates)
 * - Owner/Admin can manually trigger full sync or reconnect
 *
 * Performance:
 * - Queries database for connections expiring within 24 hours
 * - Typically 0-10 connections per run in production
 * - Each renewal takes ~1-2s (2 Google API calls: stop + create)
 * - Total execution time: <30 seconds for typical load
 * - Database query optimized with index on (is_active, webhook_expiration)
 *
 * Database Query:
 * ```sql
 * SELECT * FROM calendar_provider_connection
 * WHERE is_active = true
 *   AND sync_status IN ('active', 'syncing')
 *   AND webhook_channel_id IS NOT NULL
 *   AND webhook_expiration IS NOT NULL
 *   AND webhook_expiration <= NOW() + INTERVAL 24 HOUR
 * ORDER BY webhook_expiration ASC
 * ```
 *
 * Renewal Process:
 * 1. Query connections with expiring webhooks
 * 2. For each connection:
 *    a. Refresh OAuth token if needed (prevent auth failures)
 *    b. Stop old webhook channel (cleanup, prevents duplicate notifications)
 *    c. Create new webhook channel (7-day expiry)
 *    d. Update connection record with new channel details
 *    e. Log renewal operation
 * 3. Continue with remaining connections even if one fails
 *
 * Error Handling:
 * - Token refresh failure: Skip this connection, retry next run
 * - Stop channel failure (404): Acceptable (channel already expired), continue
 * - Create channel failure: Mark sync_status = 'error', log error
 * - Individual failures don't block other connections
 * - Scheduler continues running even if all renewals fail
 *
 * Integration:
 * - Works with GoogleCalendarService.stopWatchChannel()
 * - Works with GoogleCalendarService.createWatchChannel()
 * - Works with CalendarProviderConnectionService.updateWebhookChannel()
 * - Logs all operations to calendar_sync_log
 *
 * @class WebhookRenewalScheduler
 * @since Sprint 14
 */
@Injectable()
export class WebhookRenewalScheduler {
  private readonly logger = new Logger(WebhookRenewalScheduler.name);
  private readonly webhookUrl: string;

  constructor(
    private readonly googleCalendar: GoogleCalendarService,
    private readonly connectionService: CalendarProviderConnectionService,
    private readonly syncLog: CalendarSyncLogService,
    private readonly configService: ConfigService,
  ) {
    // Construct webhook URL from environment variable
    const apiUrl =
      this.configService.get<string>('LEAD360_API_URL') ||
      'https://api.lead360.app';
    this.webhookUrl = `${apiUrl}/api/v1/webhooks/google-calendar`;

    this.logger.log(`Webhook URL configured: ${this.webhookUrl}`);
  }

  /**
   * Periodic Webhook Renewal Job
   *
   * Runs every 6 hours to proactively renew expiring webhook channels.
   *
   * This prevents loss of real-time calendar sync caused by expired webhooks
   * and ensures continuous inbound sync for all tenants.
   *
   * Cron schedule: Every 6 hours (at minute 0)
   *
   * @returns Promise<void>
   */
  @Cron('0 */6 * * *')
  async handleWebhookRenewal(): Promise<void> {
    this.logger.debug('🔄 Running webhook renewal scheduler...');

    const startTime = Date.now();

    try {
      // 1. Query connections needing webhook renewal (expires within 24 hours)
      const connections =
        await this.connectionService.getConnectionsNeedingWebhookRenewal(24);

      if (connections.length === 0) {
        this.logger.debug('✅ No webhook channels need renewal at this time');
        return;
      }

      this.logger.log(
        `🔔 Found ${connections.length} webhook channel(s) needing renewal`,
      );

      // 2. Process each connection
      let successCount = 0;
      let failureCount = 0;

      for (const connection of connections) {
        try {
          this.logger.log(
            `Renewing webhook for connection ${connection.id} (tenant: ${connection.tenantId}, expires: ${connection.webhookExpiration?.toISOString()})`,
          );

          // 3. Refresh OAuth token if needed (prevent auth failures during renewal)
          let accessToken = connection.accessToken;

          if (
            this.connectionService.needsTokenRefresh(connection.tokenExpiresAt)
          ) {
            this.logger.log(
              `Token expired or expiring soon - refreshing before webhook renewal for connection ${connection.id}`,
            );

            const refreshed = await this.googleCalendar.refreshAccessToken(
              connection.refreshToken,
            );

            await this.connectionService.updateAccessToken(
              connection.id,
              refreshed.accessToken,
              refreshed.expiryDate,
            );

            accessToken = refreshed.accessToken;

            this.logger.log(
              `Token refreshed successfully for connection ${connection.id}`,
            );
          }

          // 4. Stop old webhook channel (cleanup, prevents duplicate notifications)
          if (connection.webhookChannelId && connection.webhookResourceId) {
            try {
              await this.googleCalendar.stopWatchChannel(
                accessToken,
                connection.webhookChannelId,
                connection.webhookResourceId,
              );

              this.logger.log(
                `Old webhook channel ${connection.webhookChannelId} stopped successfully`,
              );
            } catch (error) {
              // 404 is acceptable - channel already expired
              if (error.code === 404) {
                this.logger.warn(
                  `Old webhook channel ${connection.webhookChannelId} not found (already expired) - continuing with renewal`,
                );
              } else {
                // Log but don't fail - we can still create a new channel
                this.logger.warn(
                  `Failed to stop old webhook channel ${connection.webhookChannelId}: ${error.message} - continuing with renewal`,
                );
              }
            }
          }

          // 5. Create new webhook channel (7-day expiry)
          const channelToken = randomUUID();

          const newChannel = await this.googleCalendar.createWatchChannel(
            accessToken,
            connection.connectedCalendarId,
            this.webhookUrl,
            channelToken,
          );

          // 6. Update connection record with new webhook details
          await this.connectionService.updateWebhookChannel(connection.id, {
            channelId: newChannel.channelId,
            resourceId: newChannel.resourceId,
            channelToken: channelToken,
            expiration: newChannel.expiration,
          });

          // 7. Log success
          await this.syncLog.logSync({
            tenantId: connection.tenantId,
            connectionId: connection.id,
            direction: 'inbound',
            action: 'webhook_renewed',
            status: 'success',
            metadata: {
              oldChannelId: connection.webhookChannelId,
              oldExpiry: connection.webhookExpiration?.toISOString(),
              newChannelId: newChannel.channelId,
              newExpiry: newChannel.expiration.toISOString(),
              scheduledRenewal: true,
            },
          });

          successCount++;

          this.logger.log(
            `✅ Webhook renewed successfully for connection ${connection.id} (new channel: ${newChannel.channelId}, expires: ${newChannel.expiration.toISOString()})`,
          );
        } catch (error) {
          failureCount++;

          this.logger.error(
            `❌ Failed to renew webhook for connection ${connection.id}: ${error.message}`,
            error.stack,
          );

          // Log failure
          await this.syncLog.logSync({
            tenantId: connection.tenantId,
            connectionId: connection.id,
            direction: 'inbound',
            action: 'webhook_renewed',
            status: 'failed',
            errorMessage: error.message,
            metadata: {
              scheduledRenewal: true,
              channelExpiry: connection.webhookExpiration?.toISOString(),
            },
          });

          // Mark connection as error (sync continues via periodic full sync, but no real-time updates)
          this.logger.warn(
            `Marking connection ${connection.id} as error - webhook renewal failed`,
          );

          await this.connectionService.updateSyncStatus(
            connection.id,
            'error',
            `Webhook renewal failed: ${error.message}`,
          );
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.log(
        `✅ Webhook renewal scheduler completed in ${duration}s - Success: ${successCount}, Failed: ${failureCount}`,
      );
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.error(
        `❌ Webhook renewal scheduler failed after ${duration}s: ${error.message}`,
        error.stack,
      );

      // Don't throw - scheduler should continue running
      // Next run in 6 hours will retry
    }
  }

  /**
   * Manual trigger for testing or admin operations
   *
   * This method can be called manually for immediate webhook renewal.
   * In production, the cron job handles automatic execution.
   *
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * // In your test or admin endpoint:
   * await webhookRenewalScheduler.triggerManualRenewal();
   * ```
   */
  async triggerManualRenewal(): Promise<void> {
    this.logger.log('🔧 Manual webhook renewal triggered');
    await this.handleWebhookRenewal();
  }
}
