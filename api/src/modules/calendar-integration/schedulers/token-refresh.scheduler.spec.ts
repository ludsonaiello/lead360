import { Test, TestingModule } from '@nestjs/testing';
import { TokenRefreshScheduler } from './token-refresh.scheduler';
import { GoogleCalendarService } from '../services/google-calendar.service';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import { CalendarSyncLogService } from '../services/calendar-sync-log.service';

describe('TokenRefreshScheduler', () => {
  let scheduler: TokenRefreshScheduler;
  let googleCalendarService: jest.Mocked<GoogleCalendarService>;
  let connectionService: jest.Mocked<CalendarProviderConnectionService>;
  let syncLogService: jest.Mocked<CalendarSyncLogService>;

  beforeEach(async () => {
    // Create mock services
    const mockGoogleCalendarService = {
      refreshAccessToken: jest.fn(),
    };

    const mockConnectionService = {
      getConnectionsNeedingTokenRefresh: jest.fn(),
      updateAccessToken: jest.fn(),
      updateSyncStatus: jest.fn(),
    };

    const mockSyncLogService = {
      logSync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenRefreshScheduler,
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
      ],
    }).compile();

    scheduler = module.get<TokenRefreshScheduler>(TokenRefreshScheduler);
    googleCalendarService = module.get(GoogleCalendarService);
    connectionService = module.get(CalendarProviderConnectionService);
    syncLogService = module.get(CalendarSyncLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('handleTokenRefresh', () => {
    it('should do nothing when no connections need refresh', async () => {
      // Arrange
      connectionService.getConnectionsNeedingTokenRefresh.mockResolvedValue([]);

      // Act
      await scheduler.handleTokenRefresh();

      // Assert
      expect(
        connectionService.getConnectionsNeedingTokenRefresh,
      ).toHaveBeenCalledWith(30);
      expect(googleCalendarService.refreshAccessToken).not.toHaveBeenCalled();
      expect(connectionService.updateAccessToken).not.toHaveBeenCalled();
    });

    it('should successfully refresh token for a single connection', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        tenantId: 'tenant-123',
        providerType: 'google_calendar',
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date('2026-03-03T12:00:00Z'),
        connectedCalendarId: 'primary',
        syncStatus: 'active',
      };

      const mockRefreshedTokens = {
        accessToken: 'new-access-token',
        expiryDate: new Date('2026-03-03T13:00:00Z'),
      };

      connectionService.getConnectionsNeedingTokenRefresh.mockResolvedValue([
        mockConnection,
      ]);
      googleCalendarService.refreshAccessToken.mockResolvedValue(
        mockRefreshedTokens,
      );
      connectionService.updateAccessToken.mockResolvedValue(undefined);
      syncLogService.logSync.mockResolvedValue(undefined);

      // Act
      await scheduler.handleTokenRefresh();

      // Assert
      expect(
        connectionService.getConnectionsNeedingTokenRefresh,
      ).toHaveBeenCalledWith(30);
      expect(googleCalendarService.refreshAccessToken).toHaveBeenCalledWith(
        'refresh-token',
      );
      expect(connectionService.updateAccessToken).toHaveBeenCalledWith(
        'conn-123',
        'new-access-token',
        mockRefreshedTokens.expiryDate,
      );
      expect(syncLogService.logSync).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        connectionId: 'conn-123',
        direction: 'outbound',
        action: 'token_refreshed',
        status: 'success',
        metadata: expect.objectContaining({
          scheduledRefresh: true,
        }),
      });
    });

    it('should refresh tokens for multiple connections', async () => {
      // Arrange
      const mockConnections = [
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          providerType: 'google_calendar',
          accessToken: 'old-token-1',
          refreshToken: 'refresh-1',
          tokenExpiresAt: new Date('2026-03-03T12:00:00Z'),
          connectedCalendarId: 'primary',
          syncStatus: 'active',
        },
        {
          id: 'conn-2',
          tenantId: 'tenant-2',
          providerType: 'google_calendar',
          accessToken: 'old-token-2',
          refreshToken: 'refresh-2',
          tokenExpiresAt: new Date('2026-03-03T12:05:00Z'),
          connectedCalendarId: 'primary',
          syncStatus: 'active',
        },
      ];

      connectionService.getConnectionsNeedingTokenRefresh.mockResolvedValue(
        mockConnections,
      );
      googleCalendarService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        expiryDate: new Date('2026-03-03T13:00:00Z'),
      });
      connectionService.updateAccessToken.mockResolvedValue(undefined);
      syncLogService.logSync.mockResolvedValue(undefined);

      // Act
      await scheduler.handleTokenRefresh();

      // Assert
      expect(googleCalendarService.refreshAccessToken).toHaveBeenCalledTimes(2);
      expect(connectionService.updateAccessToken).toHaveBeenCalledTimes(2);
      expect(syncLogService.logSync).toHaveBeenCalledTimes(2);
    });

    it('should mark connection as disconnected when refresh fails', async () => {
      // Arrange
      const mockConnection = {
        id: 'conn-123',
        tenantId: 'tenant-123',
        providerType: 'google_calendar',
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date('2026-03-03T12:00:00Z'),
        connectedCalendarId: 'primary',
        syncStatus: 'active',
      };

      connectionService.getConnectionsNeedingTokenRefresh.mockResolvedValue([
        mockConnection,
      ]);
      googleCalendarService.refreshAccessToken.mockRejectedValue(
        new Error(
          'Failed to refresh access token. User may have revoked access.',
        ),
      );
      syncLogService.logSync.mockResolvedValue(undefined);
      connectionService.updateSyncStatus.mockResolvedValue(undefined);

      // Act
      await scheduler.handleTokenRefresh();

      // Assert
      expect(googleCalendarService.refreshAccessToken).toHaveBeenCalled();
      expect(connectionService.updateAccessToken).not.toHaveBeenCalled();
      expect(syncLogService.logSync).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        connectionId: 'conn-123',
        direction: 'outbound',
        action: 'token_refreshed',
        status: 'failed',
        errorMessage: expect.stringContaining('refresh'),
        metadata: expect.objectContaining({
          scheduledRefresh: true,
        }),
      });
      expect(connectionService.updateSyncStatus).toHaveBeenCalledWith(
        'conn-123',
        'disconnected',
        'Token refresh failed - user may have revoked access',
      );
    });

    it('should continue processing other connections when one fails', async () => {
      // Arrange
      const mockConnections = [
        {
          id: 'conn-1',
          tenantId: 'tenant-1',
          providerType: 'google_calendar',
          accessToken: 'old-token-1',
          refreshToken: 'refresh-1',
          tokenExpiresAt: new Date('2026-03-03T12:00:00Z'),
          connectedCalendarId: 'primary',
          syncStatus: 'active',
        },
        {
          id: 'conn-2',
          tenantId: 'tenant-2',
          providerType: 'google_calendar',
          accessToken: 'old-token-2',
          refreshToken: 'refresh-2',
          tokenExpiresAt: new Date('2026-03-03T12:05:00Z'),
          connectedCalendarId: 'primary',
          syncStatus: 'active',
        },
      ];

      connectionService.getConnectionsNeedingTokenRefresh.mockResolvedValue(
        mockConnections,
      );

      // First connection fails, second succeeds
      googleCalendarService.refreshAccessToken
        .mockRejectedValueOnce(new Error('Failed to refresh'))
        .mockResolvedValueOnce({
          accessToken: 'new-token-2',
          expiryDate: new Date('2026-03-03T13:00:00Z'),
        });

      connectionService.updateAccessToken.mockResolvedValue(undefined);
      connectionService.updateSyncStatus.mockResolvedValue(undefined);
      syncLogService.logSync.mockResolvedValue(undefined);

      // Act
      await scheduler.handleTokenRefresh();

      // Assert
      expect(googleCalendarService.refreshAccessToken).toHaveBeenCalledTimes(2);
      expect(connectionService.updateAccessToken).toHaveBeenCalledTimes(1);
      expect(connectionService.updateSyncStatus).toHaveBeenCalledTimes(1);
      expect(syncLogService.logSync).toHaveBeenCalledTimes(2); // Both logged (1 fail, 1 success)
    });

    it('should handle errors gracefully and not throw', async () => {
      // Arrange
      connectionService.getConnectionsNeedingTokenRefresh.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert - should not throw
      await expect(scheduler.handleTokenRefresh()).resolves.not.toThrow();
    });
  });

  describe('triggerManualRefresh', () => {
    it('should call handleTokenRefresh when manually triggered', async () => {
      // Arrange
      connectionService.getConnectionsNeedingTokenRefresh.mockResolvedValue([]);
      const handleSpy = jest.spyOn(scheduler, 'handleTokenRefresh');

      // Act
      await scheduler.triggerManualRefresh();

      // Assert
      expect(handleSpy).toHaveBeenCalled();
    });
  });
});
