import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhookRenewalScheduler } from './webhook-renewal.scheduler';
import { GoogleCalendarService } from '../services/google-calendar.service';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import { CalendarSyncLogService } from '../services/calendar-sync-log.service';

describe('WebhookRenewalScheduler', () => {
  let scheduler: WebhookRenewalScheduler;
  let googleCalendarService: jest.Mocked<GoogleCalendarService>;
  let connectionService: jest.Mocked<CalendarProviderConnectionService>;
  let syncLogService: jest.Mocked<CalendarSyncLogService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Create mock services
    const mockGoogleCalendarService = {
      stopWatchChannel: jest.fn(),
      createWatchChannel: jest.fn(),
      refreshAccessToken: jest.fn(),
    };

    const mockConnectionService = {
      getConnectionsNeedingWebhookRenewal: jest.fn(),
      needsTokenRefresh: jest.fn(),
      updateAccessToken: jest.fn(),
      updateWebhookChannel: jest.fn(),
      updateSyncStatus: jest.fn(),
    };

    const mockSyncLogService = {
      logSync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('https://api.lead360.app'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookRenewalScheduler,
        {
          provide: GoogleCalendarService,
          useValue: mockGoogleCalendarService,
        },
        {
          provide: CalendarProviderConnectionService,
          useValue: mockConnectionService,
        },
        {
          provide: CalendarSyncLogService,
          useValue: mockSyncLogService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    scheduler = module.get<WebhookRenewalScheduler>(WebhookRenewalScheduler);
    googleCalendarService = module.get(GoogleCalendarService);
    connectionService = module.get(CalendarProviderConnectionService);
    syncLogService = module.get(CalendarSyncLogService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  it('should construct webhook URL from config', () => {
    expect(configService.get).toHaveBeenCalledWith('LEAD360_API_URL');
  });

  describe('handleWebhookRenewal', () => {
    it('should do nothing when no webhooks need renewal', async () => {
      // Arrange
      connectionService.getConnectionsNeedingWebhookRenewal.mockResolvedValue(
        [],
      );

      // Act
      await scheduler.handleWebhookRenewal();

      // Assert
      expect(
        connectionService.getConnectionsNeedingWebhookRenewal,
      ).toHaveBeenCalledWith(24);
      expect(googleCalendarService.stopWatchChannel).not.toHaveBeenCalled();
      expect(googleCalendarService.createWatchChannel).not.toHaveBeenCalled();
    });

    it('should successfully renew webhook for a single connection', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        tenantId: 'tenant-123',
        providerType: 'google_calendar',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date('2026-03-03T14:00:00Z'),
        connectedCalendarId: 'primary',
        webhookChannelId: 'old-channel-123',
        webhookResourceId: 'old-resource-123',
        webhookChannelToken: 'old-token',
        webhookExpiration: new Date('2026-03-03T12:00:00Z'),
        syncStatus: 'active',
      };

      const mockNewChannel = {
        channelId: 'new-channel-456',
        resourceId: 'new-resource-456',
        expiration: new Date('2026-03-10T12:00:00Z'),
      };

      connectionService.getConnectionsNeedingWebhookRenewal.mockResolvedValue([
        mockConnection,
      ]);
      connectionService.needsTokenRefresh.mockReturnValue(false);
      googleCalendarService.stopWatchChannel.mockResolvedValue(undefined);
      googleCalendarService.createWatchChannel.mockResolvedValue(
        mockNewChannel,
      );
      connectionService.updateWebhookChannel.mockResolvedValue(undefined);
      syncLogService.logSync.mockResolvedValue(undefined);

      // Act
      await scheduler.handleWebhookRenewal();

      // Assert
      expect(
        connectionService.getConnectionsNeedingWebhookRenewal,
      ).toHaveBeenCalledWith(24);
      expect(googleCalendarService.stopWatchChannel).toHaveBeenCalledWith(
        'access-token',
        'old-channel-123',
        'old-resource-123',
      );
      expect(googleCalendarService.createWatchChannel).toHaveBeenCalledWith(
        'access-token',
        'primary',
        'https://api.lead360.app/api/webhooks/google-calendar',
        expect.any(String), // UUID channel token
      );
      expect(connectionService.updateWebhookChannel).toHaveBeenCalledWith(
        'conn-123',
        expect.objectContaining({
          channelId: 'new-channel-456',
          resourceId: 'new-resource-456',
          expiration: mockNewChannel.expiration,
        }),
      );
      expect(syncLogService.logSync).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        connectionId: 'conn-123',
        direction: 'inbound',
        action: 'webhook_renewed',
        status: 'success',
        metadata: expect.objectContaining({
          oldChannelId: 'old-channel-123',
          newChannelId: 'new-channel-456',
          scheduledRenewal: true,
        }),
      });
    });

    it('should refresh token before renewal if needed', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        tenantId: 'tenant-123',
        providerType: 'google_calendar',
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date('2026-03-03T11:55:00Z'), // Expires soon
        connectedCalendarId: 'primary',
        webhookChannelId: 'old-channel-123',
        webhookResourceId: 'old-resource-123',
        webhookChannelToken: 'old-token',
        webhookExpiration: new Date('2026-03-03T12:00:00Z'),
        syncStatus: 'active',
      };

      const mockRefreshedTokens = {
        accessToken: 'new-access-token',
        expiryDate: new Date('2026-03-03T13:00:00Z'),
      };

      const mockNewChannel = {
        channelId: 'new-channel-456',
        resourceId: 'new-resource-456',
        expiration: new Date('2026-03-10T12:00:00Z'),
      };

      connectionService.getConnectionsNeedingWebhookRenewal.mockResolvedValue([
        mockConnection,
      ]);
      connectionService.needsTokenRefresh.mockReturnValue(true);
      googleCalendarService.refreshAccessToken.mockResolvedValue(
        mockRefreshedTokens,
      );
      connectionService.updateAccessToken.mockResolvedValue(undefined);
      googleCalendarService.stopWatchChannel.mockResolvedValue(undefined);
      googleCalendarService.createWatchChannel.mockResolvedValue(
        mockNewChannel,
      );
      connectionService.updateWebhookChannel.mockResolvedValue(undefined);
      syncLogService.logSync.mockResolvedValue(undefined);

      // Act
      await scheduler.handleWebhookRenewal();

      // Assert
      expect(connectionService.needsTokenRefresh).toHaveBeenCalledWith(
        mockConnection.tokenExpiresAt,
      );
      expect(googleCalendarService.refreshAccessToken).toHaveBeenCalledWith(
        'refresh-token',
      );
      expect(connectionService.updateAccessToken).toHaveBeenCalledWith(
        'conn-123',
        'new-access-token',
        mockRefreshedTokens.expiryDate,
      );
      // Should use new access token for webhook operations
      expect(googleCalendarService.createWatchChannel).toHaveBeenCalledWith(
        'new-access-token',
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should continue renewal even if stopping old channel fails with 404', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        tenantId: 'tenant-123',
        providerType: 'google_calendar',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date('2026-03-03T14:00:00Z'),
        connectedCalendarId: 'primary',
        webhookChannelId: 'old-channel-123',
        webhookResourceId: 'old-resource-123',
        webhookChannelToken: 'old-token',
        webhookExpiration: new Date('2026-03-03T12:00:00Z'),
        syncStatus: 'active',
      };

      const mockNewChannel = {
        channelId: 'new-channel-456',
        resourceId: 'new-resource-456',
        expiration: new Date('2026-03-10T12:00:00Z'),
      };

      const error404 = new Error('Not found');
      (error404 as any).code = 404;

      connectionService.getConnectionsNeedingWebhookRenewal.mockResolvedValue([
        mockConnection,
      ]);
      connectionService.needsTokenRefresh.mockReturnValue(false);
      googleCalendarService.stopWatchChannel.mockRejectedValue(error404);
      googleCalendarService.createWatchChannel.mockResolvedValue(
        mockNewChannel,
      );
      connectionService.updateWebhookChannel.mockResolvedValue(undefined);
      syncLogService.logSync.mockResolvedValue(undefined);

      // Act
      await scheduler.handleWebhookRenewal();

      // Assert
      expect(googleCalendarService.stopWatchChannel).toHaveBeenCalled();
      expect(googleCalendarService.createWatchChannel).toHaveBeenCalled();
      expect(connectionService.updateWebhookChannel).toHaveBeenCalled();
      expect(syncLogService.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
        }),
      );
    });

    it('should mark connection as error when webhook creation fails', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        tenantId: 'tenant-123',
        providerType: 'google_calendar',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date('2026-03-03T14:00:00Z'),
        connectedCalendarId: 'primary',
        webhookChannelId: 'old-channel-123',
        webhookResourceId: 'old-resource-123',
        webhookChannelToken: 'old-token',
        webhookExpiration: new Date('2026-03-03T12:00:00Z'),
        syncStatus: 'active',
      };

      connectionService.getConnectionsNeedingWebhookRenewal.mockResolvedValue([
        mockConnection,
      ]);
      connectionService.needsTokenRefresh.mockReturnValue(false);
      googleCalendarService.stopWatchChannel.mockResolvedValue(undefined);
      googleCalendarService.createWatchChannel.mockRejectedValue(
        new Error('Failed to create webhook channel'),
      );
      syncLogService.logSync.mockResolvedValue(undefined);
      connectionService.updateSyncStatus.mockResolvedValue(undefined);

      // Act
      await scheduler.handleWebhookRenewal();

      // Assert
      expect(googleCalendarService.createWatchChannel).toHaveBeenCalled();
      expect(connectionService.updateWebhookChannel).not.toHaveBeenCalled();
      expect(syncLogService.logSync).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        connectionId: 'conn-123',
        direction: 'inbound',
        action: 'webhook_renewed',
        status: 'failed',
        errorMessage: expect.stringContaining(
          'Failed to create webhook channel',
        ),
        metadata: expect.objectContaining({
          scheduledRenewal: true,
        }),
      });
      expect(connectionService.updateSyncStatus).toHaveBeenCalledWith(
        'conn-123',
        'error',
        expect.stringContaining('Webhook renewal failed'),
      );
    });

    it('should renew webhooks for multiple connections', async () => {
      // Arrange
      const mockConnections = [
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          providerType: 'google_calendar',
          accessToken: 'token-1',
          refreshToken: 'refresh-1',
          tokenExpiresAt: new Date('2026-03-03T14:00:00Z'),
          connectedCalendarId: 'primary',
          webhookChannelId: 'channel-1',
          webhookResourceId: 'resource-1',
          webhookChannelToken: 'token-1',
          webhookExpiration: new Date('2026-03-03T12:00:00Z'),
          syncStatus: 'active',
        },
        {
          id: 'conn-2',
          tenantId: 'tenant-2',
          providerType: 'google_calendar',
          accessToken: 'token-2',
          refreshToken: 'refresh-2',
          tokenExpiresAt: new Date('2026-03-03T14:00:00Z'),
          connectedCalendarId: 'primary',
          webhookChannelId: 'channel-2',
          webhookResourceId: 'resource-2',
          webhookChannelToken: 'token-2',
          webhookExpiration: new Date('2026-03-03T12:05:00Z'),
          syncStatus: 'active',
        },
      ];

      connectionService.getConnectionsNeedingWebhookRenewal.mockResolvedValue(
        mockConnections,
      );
      connectionService.needsTokenRefresh.mockReturnValue(false);
      googleCalendarService.stopWatchChannel.mockResolvedValue(undefined);
      googleCalendarService.createWatchChannel.mockResolvedValue({
        channelId: 'new-channel',
        resourceId: 'new-resource',
        expiration: new Date('2026-03-10T12:00:00Z'),
      });
      connectionService.updateWebhookChannel.mockResolvedValue(undefined);
      syncLogService.logSync.mockResolvedValue(undefined);

      // Act
      await scheduler.handleWebhookRenewal();

      // Assert
      expect(googleCalendarService.stopWatchChannel).toHaveBeenCalledTimes(2);
      expect(googleCalendarService.createWatchChannel).toHaveBeenCalledTimes(2);
      expect(connectionService.updateWebhookChannel).toHaveBeenCalledTimes(2);
      expect(syncLogService.logSync).toHaveBeenCalledTimes(2);
    });

    it('should continue processing other connections when one fails', async () => {
      // Arrange
      const mockConnections = [
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          providerType: 'google_calendar',
          accessToken: 'token-1',
          refreshToken: 'refresh-1',
          tokenExpiresAt: new Date('2026-03-03T14:00:00Z'),
          connectedCalendarId: 'primary',
          webhookChannelId: 'channel-1',
          webhookResourceId: 'resource-1',
          webhookChannelToken: 'token-1',
          webhookExpiration: new Date('2026-03-03T12:00:00Z'),
          syncStatus: 'active',
        },
        {
          id: 'conn-2',
          tenantId: 'tenant-2',
          providerType: 'google_calendar',
          accessToken: 'token-2',
          refreshToken: 'refresh-2',
          tokenExpiresAt: new Date('2026-03-03T14:00:00Z'),
          connectedCalendarId: 'primary',
          webhookChannelId: 'channel-2',
          webhookResourceId: 'resource-2',
          webhookChannelToken: 'token-2',
          webhookExpiration: new Date('2026-03-03T12:05:00Z'),
          syncStatus: 'active',
        },
      ];

      connectionService.getConnectionsNeedingWebhookRenewal.mockResolvedValue(
        mockConnections,
      );
      connectionService.needsTokenRefresh.mockReturnValue(false);
      googleCalendarService.stopWatchChannel.mockResolvedValue(undefined);

      // First connection fails, second succeeds
      googleCalendarService.createWatchChannel
        .mockRejectedValueOnce(new Error('Failed to create'))
        .mockResolvedValueOnce({
          channelId: 'new-channel',
          resourceId: 'new-resource',
          expiration: new Date('2026-03-10T12:00:00Z'),
        });

      connectionService.updateWebhookChannel.mockResolvedValue(undefined);
      connectionService.updateSyncStatus.mockResolvedValue(undefined);
      syncLogService.logSync.mockResolvedValue(undefined);

      // Act
      await scheduler.handleWebhookRenewal();

      // Assert
      expect(googleCalendarService.createWatchChannel).toHaveBeenCalledTimes(2);
      expect(connectionService.updateWebhookChannel).toHaveBeenCalledTimes(1);
      expect(connectionService.updateSyncStatus).toHaveBeenCalledTimes(1);
      expect(syncLogService.logSync).toHaveBeenCalledTimes(2); // Both logged
    });

    it('should handle errors gracefully and not throw', async () => {
      // Arrange
      connectionService.getConnectionsNeedingWebhookRenewal.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert - should not throw
      await expect(scheduler.handleWebhookRenewal()).resolves.not.toThrow();
    });
  });

  describe('triggerManualRenewal', () => {
    it('should call handleWebhookRenewal when manually triggered', async () => {
      // Arrange
      connectionService.getConnectionsNeedingWebhookRenewal.mockResolvedValue(
        [],
      );
      const handleSpy = jest.spyOn(scheduler, 'handleWebhookRenewal');

      // Act
      await scheduler.triggerManualRenewal();

      // Assert
      expect(handleSpy).toHaveBeenCalled();
    });
  });
});
