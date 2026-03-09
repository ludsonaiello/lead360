import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleCalendarService } from '../services/google-calendar.service';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import { CalendarSyncLogService } from '../services/calendar-sync-log.service';

/**
 * Token Refresh Scheduler
 * Sprint 14: Automatic OAuth Token Refresh
 *
 * Responsibilities:
 * - Runs every 10 minutes to check for expiring OAuth tokens
 * - Proactively refreshes tokens before they expire (30-minute threshold)
 * - Updates access tokens in database
 * - Logs all refresh operations
 * - Marks connections as disconnected if refresh fails (user revoked access)
 *
 * Schedule: Every 10 minutes
 * Cron Pattern: Every 10 minutes
 *
 * Why Every 10 Minutes:
 * - Google OAuth tokens typically expire in 1 hour
 * - 30-minute refresh threshold provides buffer for multiple retry attempts
 * - Running every 10 minutes ensures at least 3 attempts before expiry
 * - Low overhead - only queries connections with expiring tokens
 * - Token refresh is a quick API call (<500ms typical)
 *
 * Token Expiry Strategy:
 * - Google issues tokens with 1-hour expiry
 * - We refresh when token expires within 30 minutes
 * - Scheduler runs every 10 minutes (3+ chances to refresh)
 * - If refresh fails, connection marked as "disconnected"
 * - Owner/Admin notified via sync_status change
 *
 * Performance:
 * - Queries database for connections expiring within 30 min
 * - Typically 0-5 connections per run in production
 * - Each refresh takes ~300-500ms (Google API call)
 * - Total execution time: <5 seconds for typical load
 * - Database query optimized with index on (is_active, token_expires_at)
 *
 * Database Query:
 * ```sql
 * SELECT * FROM calendar_provider_connection
 * WHERE is_active = true
 *   AND sync_status IN ('active', 'syncing')
 *   AND token_expires_at <= NOW() + INTERVAL 30 MINUTE
 * ORDER BY token_expires_at ASC
 * ```
 *
 * Error Handling:
 * - Refresh failure (user revoked access): Mark sync_status = 'disconnected'
 * - Network error: Log error, retry on next run
 * - Individual failures don't block other connections
 * - Scheduler continues running even if all refreshes fail
 *
 * Integration:
 * - Works with GoogleCalendarService.refreshAccessToken()
 * - Works with CalendarProviderConnectionService.updateAccessToken()
 * - Logs all operations to calendar_sync_log
 *
 * @class TokenRefreshScheduler
 * @since Sprint 14
 */
@Injectable()
export class TokenRefreshScheduler {
  private readonly logger = new Logger(TokenRefreshScheduler.name);

  constructor(
    private readonly googleCalendar: GoogleCalendarService,
    private readonly connectionService: CalendarProviderConnectionService,
    private readonly syncLog: CalendarSyncLogService,
  ) {}

  /**
   * Periodic Token Refresh Job
   *
   * Runs every 10 minutes to proactively refresh expiring OAuth tokens.
   *
   * This prevents sync failures caused by expired tokens and ensures
   * seamless calendar integration for all tenants.
   *
   * Cron schedule: Every 10 minutes
   *
   * @returns Promise<void>
   */
  @Cron('*/10 * * * *')
  async handleTokenRefresh(): Promise<void> {
    this.logger.debug('🔄 Running token refresh scheduler...');

    const startTime = Date.now();

    try {
      // 1. Query connections needing token refresh (expires within 30 minutes)
      const connections =
        await this.connectionService.getConnectionsNeedingTokenRefresh(30);

      if (connections.length === 0) {
        this.logger.debug('✅ No tokens need refresh at this time');
        return;
      }

      this.logger.log(
        `🔑 Found ${connections.length} connection(s) needing token refresh`,
      );

      // 2. Process each connection
      let successCount = 0;
      let failureCount = 0;

      for (const connection of connections) {
        try {
          this.logger.log(
            `Refreshing token for connection ${connection.id} (tenant: ${connection.tenantId}, expires: ${connection.tokenExpiresAt.toISOString()})`,
          );

          // 3. Refresh access token using refresh token
          const refreshed = await this.googleCalendar.refreshAccessToken(
            connection.refreshToken,
          );

          // 4. Update access token in database
          await this.connectionService.updateAccessToken(
            connection.id,
            refreshed.accessToken,
            refreshed.expiryDate,
          );

          // 5. Log success
          await this.syncLog.logSync({
            tenantId: connection.tenantId,
            connectionId: connection.id,
            direction: 'outbound',
            action: 'token_refreshed',
            status: 'success',
            metadata: {
              oldExpiry: connection.tokenExpiresAt.toISOString(),
              newExpiry: refreshed.expiryDate.toISOString(),
              scheduledRefresh: true,
            },
          });

          successCount++;

          this.logger.log(
            `✅ Token refreshed successfully for connection ${connection.id} (new expiry: ${refreshed.expiryDate.toISOString()})`,
          );
        } catch (error) {
          failureCount++;

          this.logger.error(
            `❌ Failed to refresh token for connection ${connection.id}: ${error.message}`,
            error.stack,
          );

          // Log failure
          await this.syncLog.logSync({
            tenantId: connection.tenantId,
            connectionId: connection.id,
            direction: 'outbound',
            action: 'token_refreshed',
            status: 'failed',
            errorMessage: error.message,
            metadata: {
              scheduledRefresh: true,
              tokenExpiry: connection.tokenExpiresAt.toISOString(),
            },
          });

          // If refresh failed, likely user revoked access
          if (
            error.message.includes('refresh') ||
            error.message.includes('revoked')
          ) {
            this.logger.warn(
              `Marking connection ${connection.id} as disconnected - user may have revoked access`,
            );

            await this.connectionService.updateSyncStatus(
              connection.id,
              'disconnected',
              'Token refresh failed - user may have revoked access',
            );
          }
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.log(
        `✅ Token refresh scheduler completed in ${duration}s - Success: ${successCount}, Failed: ${failureCount}`,
      );
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.error(
        `❌ Token refresh scheduler failed after ${duration}s: ${error.message}`,
        error.stack,
      );

      // Don't throw - scheduler should continue running
      // Next run in 10 minutes will retry
    }
  }

  /**
   * Manual trigger for testing or admin operations
   *
   * This method can be called manually for immediate token refresh.
   * In production, the cron job handles automatic execution.
   *
   * @returns Promise<void>
   *
   * @example
   * ```typescript
   * // In your test or admin endpoint:
   * await tokenRefreshScheduler.triggerManualRefresh();
   * ```
   */
  async triggerManualRefresh(): Promise<void> {
    this.logger.log('🔧 Manual token refresh triggered');
    await this.handleTokenRefresh();
  }
}
