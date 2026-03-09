import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { randomUUID } from 'crypto';

/**
 * Service for managing calendar_provider_connection records
 * Handles encrypted token storage and connection lifecycle
 */
@Injectable()
export class CalendarProviderConnectionService {
  private readonly logger = new Logger(CalendarProviderConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Get active calendar connection for a tenant
   * @param tenantId - Tenant ID
   * @returns Connection record with decrypted tokens, or null if not found
   */
  async getActiveConnection(tenantId: string): Promise<{
    id: string;
    tenantId: string;
    providerType: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    connectedCalendarId: string;
    connectedCalendarName: string | null;
    webhookChannelId: string | null;
    webhookResourceId: string | null;
    webhookChannelToken: string | null;
    webhookExpiration: Date | null;
    syncStatus: string;
    lastSyncAt: Date | null;
    lastSyncToken: string | null;
    errorMessage: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const connection =
      await this.prisma.calendar_provider_connection.findUnique({
        where: {
          tenant_id: tenantId,
        },
      });

    if (!connection || !connection.is_active) {
      return null;
    }

    // Decrypt tokens
    const accessToken = this.encryptionService.decrypt(connection.access_token);
    const refreshToken = this.encryptionService.decrypt(
      connection.refresh_token,
    );

    return {
      id: connection.id,
      tenantId: connection.tenant_id,
      providerType: connection.provider_type,
      accessToken,
      refreshToken,
      tokenExpiresAt: connection.token_expires_at,
      connectedCalendarId: connection.connected_calendar_id,
      connectedCalendarName: connection.connected_calendar_name,
      webhookChannelId: connection.webhook_channel_id,
      webhookResourceId: connection.webhook_resource_id,
      webhookChannelToken: connection.webhook_channel_token,
      webhookExpiration: connection.webhook_expiration,
      syncStatus: connection.sync_status,
      lastSyncAt: connection.last_sync_at,
      lastSyncToken: connection.last_sync_token,
      errorMessage: connection.error_message,
      isActive: connection.is_active,
      createdAt: connection.created_at,
      updatedAt: connection.updated_at,
    };
  }

  /**
   * Get calendar provider connection (active OR inactive)
   * Use this when you need to check for ANY existing connection
   * @param tenantId - Tenant ID
   * @returns Connection record (raw, without decryption), or null if not found
   */
  async getConnection(tenantId: string): Promise<{
    id: string;
    tenant_id: string;
    provider_type: string;
    is_active: boolean;
    sync_status: string;
    webhook_channel_id: string | null;
    webhook_resource_id: string | null;
  } | null> {
    const connection =
      await this.prisma.calendar_provider_connection.findUnique({
        where: {
          tenant_id: tenantId,
        },
        select: {
          id: true,
          tenant_id: true,
          provider_type: true,
          is_active: true,
          sync_status: true,
          webhook_channel_id: true,
          webhook_resource_id: true,
        },
      });

    return connection;
  }

  /**
   * Delete calendar provider connection (hard delete)
   * Use this to clean up inactive connections before reconnecting
   * @param tenantId - Tenant ID
   */
  async deleteConnection(tenantId: string): Promise<void> {
    await this.prisma.calendar_provider_connection.delete({
      where: { tenant_id: tenantId },
    });
    this.logger.log(`Deleted calendar connection for tenant ${tenantId}`);
  }

  /**
   * Create a new calendar provider connection
   * @param data - Connection data with plain tokens
   * @returns Created connection record
   */
  async createConnection(data: {
    tenantId: string;
    providerType: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    connectedCalendarId: string;
    connectedCalendarName: string;
    webhookChannelId?: string;
    webhookResourceId?: string;
    webhookChannelToken?: string;
    webhookExpiration?: Date;
    connectedByUserId?: string;
  }): Promise<{
    id: string;
    tenantId: string;
    providerType: string;
    connectedCalendarId: string;
    connectedCalendarName: string;
    syncStatus: string;
  }> {
    // Encrypt tokens before storage
    const encryptedAccessToken = this.encryptionService.encrypt(
      data.accessToken,
    );
    const encryptedRefreshToken = this.encryptionService.encrypt(
      data.refreshToken,
    );

    const connection = await this.prisma.calendar_provider_connection.create({
      data: {
        id: randomUUID(),
        tenant_id: data.tenantId,
        provider_type: data.providerType,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: data.tokenExpiresAt,
        connected_calendar_id: data.connectedCalendarId,
        connected_calendar_name: data.connectedCalendarName,
        webhook_channel_id: data.webhookChannelId || null,
        webhook_resource_id: data.webhookResourceId || null,
        webhook_channel_token: data.webhookChannelToken || null,
        webhook_expiration: data.webhookExpiration || null,
        sync_status: 'active',
        is_active: true,
        connected_by_user_id: data.connectedByUserId || null,
      },
    });

    this.logger.log(
      `Created calendar connection for tenant ${data.tenantId}: ${connection.id}`,
    );

    return {
      id: connection.id,
      tenantId: connection.tenant_id,
      providerType: connection.provider_type,
      connectedCalendarId: connection.connected_calendar_id,
      connectedCalendarName: connection.connected_calendar_name || '',
      syncStatus: connection.sync_status,
    };
  }

  /**
   * Update access token (after refresh)
   * @param connectionId - Connection ID
   * @param accessToken - New access token (plain)
   * @param expiresAt - New expiry date
   */
  async updateAccessToken(
    connectionId: string,
    accessToken: string,
    expiresAt: Date,
  ): Promise<void> {
    const encryptedAccessToken = this.encryptionService.encrypt(accessToken);

    await this.prisma.calendar_provider_connection.update({
      where: { id: connectionId },
      data: {
        access_token: encryptedAccessToken,
        token_expires_at: expiresAt,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Updated access token for connection ${connectionId}`);
  }

  /**
   * Update webhook channel information
   * @param connectionId - Connection ID
   * @param webhookData - Webhook channel data
   */
  async updateWebhookChannel(
    connectionId: string,
    webhookData: {
      channelId: string;
      resourceId: string;
      channelToken: string;
      expiration: Date;
    },
  ): Promise<void> {
    await this.prisma.calendar_provider_connection.update({
      where: { id: connectionId },
      data: {
        webhook_channel_id: webhookData.channelId,
        webhook_resource_id: webhookData.resourceId,
        webhook_channel_token: webhookData.channelToken,
        webhook_expiration: webhookData.expiration,
        updated_at: new Date(),
      },
    });

    this.logger.log(
      `Updated webhook channel for connection ${connectionId}: ${webhookData.channelId}`,
    );
  }

  /**
   * Update sync status
   * @param connectionId - Connection ID
   * @param status - New sync status
   * @param errorMessage - Optional error message
   */
  async updateSyncStatus(
    connectionId: string,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.calendar_provider_connection.update({
      where: { id: connectionId },
      data: {
        sync_status: status,
        error_message: errorMessage || null,
        updated_at: new Date(),
      },
    });

    this.logger.log(
      `Updated sync status for connection ${connectionId}: ${status}`,
    );
  }

  /**
   * Update last sync timestamp
   * @param connectionId - Connection ID
   * @param syncToken - Optional sync token for incremental sync
   */
  async updateLastSync(
    connectionId: string,
    syncToken?: string,
  ): Promise<void> {
    await this.prisma.calendar_provider_connection.update({
      where: { id: connectionId },
      data: {
        last_sync_at: new Date(),
        last_sync_token: syncToken || null,
        updated_at: new Date(),
      },
    });

    this.logger.log(
      `Updated last sync timestamp for connection ${connectionId}`,
    );
  }

  /**
   * Deactivate (soft delete) a connection
   * @param tenantId - Tenant ID
   */
  async deactivateConnection(tenantId: string): Promise<void> {
    const connection =
      await this.prisma.calendar_provider_connection.findUnique({
        where: { tenant_id: tenantId },
      });

    if (!connection) {
      throw new NotFoundException('Calendar connection not found');
    }

    await this.prisma.calendar_provider_connection.update({
      where: { id: connection.id },
      data: {
        is_active: false,
        sync_status: 'disconnected',
        updated_at: new Date(),
      },
    });

    // Delete all external blocks for this tenant (calendar disconnected)
    await this.prisma.calendar_external_block.deleteMany({
      where: { tenant_id: tenantId },
    });

    this.logger.log(
      `Deactivated calendar connection for tenant ${tenantId} and purged external blocks`,
    );
  }

  /**
   * Get calendar connection by webhook channel ID
   * Sprint 13a: Used for webhook verification
   * @param channelId - Webhook channel ID
   * @returns Connection record with decrypted tokens, or null if not found
   */
  async getConnectionByChannelId(channelId: string): Promise<{
    id: string;
    tenantId: string;
    providerType: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    connectedCalendarId: string;
    connectedCalendarName: string | null;
    webhookChannelId: string | null;
    webhookResourceId: string | null;
    webhookChannelToken: string | null;
    webhookExpiration: Date | null;
    syncStatus: string;
    lastSyncAt: Date | null;
    lastSyncToken: string | null;
    errorMessage: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const connection = await this.prisma.calendar_provider_connection.findFirst(
      {
        where: {
          webhook_channel_id: channelId,
          is_active: true,
        },
      },
    );

    if (!connection) {
      return null;
    }

    // Decrypt tokens
    const accessToken = this.encryptionService.decrypt(connection.access_token);
    const refreshToken = this.encryptionService.decrypt(
      connection.refresh_token,
    );

    return {
      id: connection.id,
      tenantId: connection.tenant_id,
      providerType: connection.provider_type,
      accessToken,
      refreshToken,
      tokenExpiresAt: connection.token_expires_at,
      connectedCalendarId: connection.connected_calendar_id,
      connectedCalendarName: connection.connected_calendar_name,
      webhookChannelId: connection.webhook_channel_id,
      webhookResourceId: connection.webhook_resource_id,
      webhookChannelToken: connection.webhook_channel_token,
      webhookExpiration: connection.webhook_expiration,
      syncStatus: connection.sync_status,
      lastSyncAt: connection.last_sync_at,
      lastSyncToken: connection.last_sync_token,
      errorMessage: connection.error_message,
      isActive: connection.is_active,
      createdAt: connection.created_at,
      updatedAt: connection.updated_at,
    };
  }

  /**
   * Check if token needs refresh (expires within 5 minutes)
   * @param expiresAt - Token expiry date
   * @returns True if token needs refresh
   */
  needsTokenRefresh(expiresAt: Date): boolean {
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return expiresAt <= fiveMinutesFromNow;
  }

  /**
   * Get all active connections that need token refresh
   * Sprint 14: Token Refresh Scheduler
   * @param withinMinutes - Look for tokens expiring within this many minutes (default: 30)
   * @returns Array of connections needing refresh
   */
  async getConnectionsNeedingTokenRefresh(withinMinutes: number = 30): Promise<
    Array<{
      id: string;
      tenantId: string;
      providerType: string;
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: Date;
      connectedCalendarId: string;
      syncStatus: string;
    }>
  > {
    const thresholdDate = new Date(Date.now() + withinMinutes * 60 * 1000);

    const connections = await this.prisma.calendar_provider_connection.findMany(
      {
        where: {
          is_active: true,
          sync_status: {
            in: ['active', 'syncing'], // Only refresh healthy connections
          },
          token_expires_at: {
            lte: thresholdDate, // Expires within threshold
          },
        },
        orderBy: {
          token_expires_at: 'asc', // Refresh most urgent first
        },
      },
    );

    // Decrypt tokens for each connection
    return connections.map((conn) => ({
      id: conn.id,
      tenantId: conn.tenant_id,
      providerType: conn.provider_type,
      accessToken: this.encryptionService.decrypt(conn.access_token),
      refreshToken: this.encryptionService.decrypt(conn.refresh_token),
      tokenExpiresAt: conn.token_expires_at,
      connectedCalendarId: conn.connected_calendar_id,
      syncStatus: conn.sync_status,
    }));
  }

  /**
   * Get all active connections that need webhook renewal
   * Sprint 14: Webhook Renewal Scheduler
   * @param withinHours - Look for webhooks expiring within this many hours (default: 24)
   * @returns Array of connections needing webhook renewal
   */
  async getConnectionsNeedingWebhookRenewal(withinHours: number = 24): Promise<
    Array<{
      id: string;
      tenantId: string;
      providerType: string;
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: Date;
      connectedCalendarId: string;
      webhookChannelId: string | null;
      webhookResourceId: string | null;
      webhookChannelToken: string | null;
      webhookExpiration: Date | null;
      syncStatus: string;
    }>
  > {
    const thresholdDate = new Date(Date.now() + withinHours * 60 * 60 * 1000);

    const connections = await this.prisma.calendar_provider_connection.findMany(
      {
        where: {
          is_active: true,
          sync_status: {
            in: ['active', 'syncing'], // Only renew healthy connections
          },
          webhook_channel_id: {
            not: null, // Has a webhook channel
          },
          webhook_expiration: {
            not: null,
            lte: thresholdDate, // Expires within threshold
          },
        },
        orderBy: {
          webhook_expiration: 'asc', // Renew most urgent first
        },
      },
    );

    // Decrypt tokens for each connection
    return connections.map((conn) => ({
      id: conn.id,
      tenantId: conn.tenant_id,
      providerType: conn.provider_type,
      accessToken: this.encryptionService.decrypt(conn.access_token),
      refreshToken: this.encryptionService.decrypt(conn.refresh_token),
      tokenExpiresAt: conn.token_expires_at,
      connectedCalendarId: conn.connected_calendar_id,
      webhookChannelId: conn.webhook_channel_id,
      webhookResourceId: conn.webhook_resource_id,
      webhookChannelToken: conn.webhook_channel_token,
      webhookExpiration: conn.webhook_expiration,
      syncStatus: conn.sync_status,
    }));
  }
}
