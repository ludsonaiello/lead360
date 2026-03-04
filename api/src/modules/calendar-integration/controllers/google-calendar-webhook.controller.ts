import {
  Controller,
  Post,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
  ApiHeader,
} from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import { CalendarSyncLogService } from '../services/calendar-sync-log.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Google Calendar Push Notification Webhook Controller
 * Sprint 13a: Inbound Sync - Webhook Handler
 *
 * Receives push notifications from Google Calendar when events change.
 * Google sends sync notifications to inform us that the calendar has changed,
 * and we need to fetch the latest changes.
 *
 * Security:
 * - Verifies webhook channel token (set during watch channel creation)
 * - Verifies resource ID matches stored connection
 * - PUBLIC endpoint (no JWT auth) but requires valid Google headers
 *
 * Google Push Notification Headers:
 * - X-Goog-Channel-ID: Channel ID we created
 * - X-Goog-Channel-Token: Verification token we provided
 * - X-Goog-Resource-ID: Resource ID Google assigned
 * - X-Goog-Resource-State: Notification type (sync, exists, not_exists)
 * - X-Goog-Resource-URI: URI to fetch changes
 * - X-Goog-Channel-Expiration: When the channel expires
 *
 * @see https://developers.google.com/calendar/api/guides/push
 */
@ApiTags('Google Calendar Webhooks (Public)')
@Controller('webhooks/google-calendar')
export class GoogleCalendarWebhookController {
  private readonly logger = new Logger(GoogleCalendarWebhookController.name);

  constructor(
    private readonly connectionService: CalendarProviderConnectionService,
    private readonly syncLogService: CalendarSyncLogService,
    @InjectQueue('calendar-sync') private readonly syncQueue: Queue,
  ) {}

  /**
   * Google Calendar Push Notification Webhook
   *
   * Receives notifications from Google Calendar when the calendar changes.
   * Verifies the channel token and queues an incremental sync job.
   *
   * Google Notification Types (X-Goog-Resource-State):
   * - sync: Sync notification (new watch channel or manual sync)
   * - exists: Something changed in the calendar
   * - not_exists: Resource no longer exists (rare)
   *
   * @param channelId - Google Channel ID (X-Goog-Channel-ID header)
   * @param channelToken - Verification token (X-Goog-Channel-Token header)
   * @param resourceId - Google Resource ID (X-Goog-Resource-ID header)
   * @param resourceState - Notification type (X-Goog-Resource-State header)
   * @param resourceUri - URI to fetch changes (X-Goog-Resource-URI header)
   * @param messageNumber - Message sequence number (X-Goog-Message-Number header)
   * @returns Empty response (200 OK)
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive Google Calendar push notifications',
    description:
      'Webhook endpoint for Google Calendar push notifications (X-Goog headers required)',
  })
  @ApiHeader({
    name: 'X-Goog-Channel-ID',
    description: 'Google Channel ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-Goog-Channel-Token',
    description: 'Verification token',
    required: true,
  })
  @ApiHeader({
    name: 'X-Goog-Resource-ID',
    description: 'Google Resource ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-Goog-Resource-State',
    description: 'Notification type (sync, exists, not_exists)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook notification processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid channel token or resource ID',
  })
  @ApiExcludeEndpoint() // Exclude from public API docs (webhook only)
  async handleWebhook(
    @Headers('x-goog-channel-id') channelId: string,
    @Headers('x-goog-channel-token') channelToken: string,
    @Headers('x-goog-resource-id') resourceId: string,
    @Headers('x-goog-resource-state') resourceState: string,
    @Headers('x-goog-resource-uri') resourceUri: string,
    @Headers('x-goog-message-number') messageNumber: string,
  ) {
    this.logger.log(
      `📩 Google Calendar webhook received - Channel: ${channelId}, State: ${resourceState}, Message: ${messageNumber}`,
    );

    // Validate required headers
    if (!channelId || !channelToken || !resourceId || !resourceState) {
      this.logger.error(
        '❌ Missing required Google webhook headers (X-Goog-Channel-ID, X-Goog-Channel-Token, X-Goog-Resource-ID, or X-Goog-Resource-State)',
      );
      throw new BadRequestException('Missing required Google webhook headers');
    }

    // Find connection by webhook channel ID
    const connection = await this.findConnectionByChannelId(channelId);

    if (!connection) {
      this.logger.error(
        `❌ No calendar connection found for channel ID: ${channelId}`,
      );
      throw new UnauthorizedException(
        'Invalid channel ID - no matching calendar connection',
      );
    }

    // Verify channel token matches stored token
    if (connection.webhookChannelToken !== channelToken) {
      this.logger.error(
        `❌ Invalid channel token for channel ${channelId} (tenant: ${connection.tenantId})`,
      );

      // Log security event
      await this.syncLogService.logSync({
        tenantId: connection.tenantId,
        connectionId: connection.id,
        direction: 'inbound',
        action: 'webhook_received',
        status: 'failed',
        errorMessage: 'Invalid channel token - security verification failed',
        metadata: {
          channelId,
          resourceState,
          messageNumber,
        },
      });

      throw new UnauthorizedException('Invalid channel token');
    }

    // Verify resource ID matches stored resource ID
    if (connection.webhookResourceId !== resourceId) {
      this.logger.error(
        `❌ Invalid resource ID for channel ${channelId} (tenant: ${connection.tenantId}). Expected: ${connection.webhookResourceId}, Received: ${resourceId}`,
      );

      // Log security event
      await this.syncLogService.logSync({
        tenantId: connection.tenantId,
        connectionId: connection.id,
        direction: 'inbound',
        action: 'webhook_received',
        status: 'failed',
        errorMessage: 'Invalid resource ID - mismatch with stored value',
        metadata: {
          channelId,
          resourceId,
          expectedResourceId: connection.webhookResourceId,
          resourceState,
          messageNumber,
        },
      });

      throw new UnauthorizedException('Invalid resource ID');
    }

    this.logger.log(
      `✅ Webhook verified for tenant ${connection.tenantId} - Channel: ${channelId}, Resource: ${resourceId}`,
    );

    // Handle different resource states
    switch (resourceState) {
      case 'sync':
        // Initial sync notification (sent when watch channel is first created)
        this.logger.log(
          `🔄 Sync notification received for tenant ${connection.tenantId} - Initial webhook confirmation`,
        );

        await this.syncLogService.logSync({
          tenantId: connection.tenantId,
          connectionId: connection.id,
          direction: 'inbound',
          action: 'webhook_received',
          status: 'success',
          metadata: {
            resourceState: 'sync',
            channelId,
            resourceId,
            messageNumber,
            note: 'Initial sync notification - webhook channel confirmed active',
          },
        });
        break;

      case 'exists':
        // Calendar changed - queue incremental sync
        this.logger.log(
          `📅 Calendar change detected for tenant ${connection.tenantId} - Queuing incremental sync`,
        );

        // Queue incremental sync job
        await this.syncQueue.add(
          'incremental-sync',
          {
            tenantId: connection.tenantId,
            connectionId: connection.id,
            trigger: 'webhook',
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        );

        await this.syncLogService.logSync({
          tenantId: connection.tenantId,
          connectionId: connection.id,
          direction: 'inbound',
          action: 'webhook_received',
          status: 'success',
          metadata: {
            resourceState: 'exists',
            channelId,
            resourceId,
            resourceUri,
            messageNumber,
            note: 'Calendar change detected - incremental sync queued',
          },
        });

        this.logger.log(
          `✅ Incremental sync queued for tenant ${connection.tenantId}`,
        );
        break;

      case 'not_exists':
        // Resource no longer exists (calendar was deleted)
        this.logger.warn(
          `⚠️  Resource no longer exists for tenant ${connection.tenantId} - Calendar may have been deleted`,
        );

        await this.syncLogService.logSync({
          tenantId: connection.tenantId,
          connectionId: connection.id,
          direction: 'inbound',
          action: 'webhook_received',
          status: 'failed',
          errorMessage: 'Resource no longer exists - calendar may be deleted',
          metadata: {
            resourceState: 'not_exists',
            channelId,
            resourceId,
            messageNumber,
          },
        });

        // Mark connection as error state
        await this.connectionService.updateSyncStatus(
          connection.id,
          'error',
          'Calendar resource no longer exists - may have been deleted',
        );
        break;

      default:
        this.logger.warn(
          `⚠️  Unknown resource state: ${resourceState} for tenant ${connection.tenantId}`,
        );

        await this.syncLogService.logSync({
          tenantId: connection.tenantId,
          connectionId: connection.id,
          direction: 'inbound',
          action: 'webhook_received',
          status: 'success',
          metadata: {
            resourceState,
            channelId,
            resourceId,
            messageNumber,
            note: 'Unknown resource state - logged for investigation',
          },
        });
    }

    // Return empty response (Google expects 200 OK)
    return {};
  }

  /**
   * Helper: Find calendar connection by webhook channel ID
   *
   * @param channelId - Google Channel ID
   * @returns Connection record with decrypted tokens, or null if not found
   * @private
   */
  private async findConnectionByChannelId(channelId: string) {
    return this.connectionService.getConnectionByChannelId(channelId);
  }
}
