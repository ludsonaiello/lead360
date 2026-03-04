import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { GoogleCalendarWebhookController } from './google-calendar-webhook.controller';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import { CalendarSyncLogService } from '../services/calendar-sync-log.service';

describe('GoogleCalendarWebhookController', () => {
  let controller: GoogleCalendarWebhookController;
  let connectionService: jest.Mocked<CalendarProviderConnectionService>;
  let syncLogService: jest.Mocked<CalendarSyncLogService>;
  let syncQueue: jest.Mocked<Queue>;

  const mockConnection = {
    id: 'conn-123',
    tenantId: 'tenant-123',
    providerType: 'google_calendar',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
    connectedCalendarId: 'primary',
    connectedCalendarName: 'My Calendar',
    webhookChannelId: 'channel-123',
    webhookResourceId: 'resource-123',
    webhookChannelToken: 'token-123',
    webhookExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    syncStatus: 'active',
    lastSyncAt: new Date(),
    lastSyncToken: null,
    errorMessage: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockSyncQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleCalendarWebhookController],
      providers: [
        {
          provide: CalendarProviderConnectionService,
          useValue: {
            prisma: {
              calendar_provider_connection: {
                findFirst: jest.fn(),
              },
            },
            encryptionService: {
              decrypt: jest.fn((value) => value),
            },
            updateSyncStatus: jest.fn(),
          },
        },
        {
          provide: CalendarSyncLogService,
          useValue: {
            logSync: jest.fn().mockResolvedValue({
              id: 'log-123',
              tenantId: 'tenant-123',
              connectionId: 'conn-123',
              direction: 'inbound',
              action: 'webhook_received',
              status: 'success',
              createdAt: new Date(),
            }),
          },
        },
        {
          provide: 'BullQueue_calendar-sync',
          useValue: mockSyncQueue,
        },
      ],
    }).compile();

    controller = module.get<GoogleCalendarWebhookController>(
      GoogleCalendarWebhookController,
    );
    connectionService = module.get(CalendarProviderConnectionService) as any;
    syncLogService = module.get(CalendarSyncLogService) as any;
    syncQueue = module.get('BullQueue_calendar-sync') as any;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should reject webhook with missing headers', async () => {
      await expect(
        controller.handleWebhook(null as any, null as any, null as any, null as any, null as any, null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject webhook with invalid channel ID', async () => {
      (connectionService.prisma.calendar_provider_connection.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        controller.handleWebhook(
          'invalid-channel',
          'token-123',
          'resource-123',
          'exists',
          'https://www.googleapis.com/calendar/v3/calendars/primary',
          '1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject webhook with invalid channel token', async () => {
      (connectionService.prisma.calendar_provider_connection.findFirst as jest.Mock).mockResolvedValue({
        ...mockConnection,
        webhook_channel_id: 'channel-123',
        webhook_channel_token: 'token-123',
        webhook_resource_id: 'resource-123',
        tenant_id: 'tenant-123',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        is_active: true,
      });

      await expect(
        controller.handleWebhook(
          'channel-123',
          'invalid-token',
          'resource-123',
          'exists',
          'https://www.googleapis.com/calendar/v3/calendars/primary',
          '1',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(syncLogService.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Invalid channel token - security verification failed',
        }),
      );
    });

    it('should reject webhook with invalid resource ID', async () => {
      (connectionService.prisma.calendar_provider_connection.findFirst as jest.Mock).mockResolvedValue({
        ...mockConnection,
        webhook_channel_id: 'channel-123',
        webhook_channel_token: 'token-123',
        webhook_resource_id: 'resource-123',
        tenant_id: 'tenant-123',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        is_active: true,
      });

      await expect(
        controller.handleWebhook(
          'channel-123',
          'token-123',
          'invalid-resource',
          'exists',
          'https://www.googleapis.com/calendar/v3/calendars/primary',
          '1',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(syncLogService.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Invalid resource ID - mismatch with stored value',
        }),
      );
    });

    it('should handle sync notification successfully', async () => {
      (connectionService.prisma.calendar_provider_connection.findFirst as jest.Mock).mockResolvedValue({
        ...mockConnection,
        webhook_channel_id: 'channel-123',
        webhook_channel_token: 'token-123',
        webhook_resource_id: 'resource-123',
        tenant_id: 'tenant-123',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        is_active: true,
      });

      const result = await controller.handleWebhook(
        'channel-123',
        'token-123',
        'resource-123',
        'sync',
        'https://www.googleapis.com/calendar/v3/calendars/primary',
        '1',
      );

      expect(result).toEqual({});
      expect(syncLogService.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'inbound',
          action: 'webhook_received',
          status: 'success',
          metadata: expect.objectContaining({
            resourceState: 'sync',
          }),
        }),
      );
      expect(syncQueue.add).not.toHaveBeenCalled();
    });

    it('should queue incremental sync on exists notification', async () => {
      (connectionService.prisma.calendar_provider_connection.findFirst as jest.Mock).mockResolvedValue({
        ...mockConnection,
        id: 'conn-123',
        webhook_channel_id: 'channel-123',
        webhook_channel_token: 'token-123',
        webhook_resource_id: 'resource-123',
        tenant_id: 'tenant-123',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        is_active: true,
      });

      const result = await controller.handleWebhook(
        'channel-123',
        'token-123',
        'resource-123',
        'exists',
        'https://www.googleapis.com/calendar/v3/calendars/primary',
        '2',
      );

      expect(result).toEqual({});
      expect(syncQueue.add).toHaveBeenCalledWith(
        'incremental-sync',
        {
          tenantId: 'tenant-123',
          connectionId: 'conn-123',
          trigger: 'webhook',
        },
        expect.objectContaining({
          attempts: 3,
        }),
      );
      expect(syncLogService.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'inbound',
          action: 'webhook_received',
          status: 'success',
          metadata: expect.objectContaining({
            resourceState: 'exists',
            note: 'Calendar change detected - incremental sync queued',
          }),
        }),
      );
    });

    it('should handle not_exists notification by marking connection as error', async () => {
      (connectionService.prisma.calendar_provider_connection.findFirst as jest.Mock).mockResolvedValue({
        ...mockConnection,
        id: 'conn-123',
        webhook_channel_id: 'channel-123',
        webhook_channel_token: 'token-123',
        webhook_resource_id: 'resource-123',
        tenant_id: 'tenant-123',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        is_active: true,
      });

      const result = await controller.handleWebhook(
        'channel-123',
        'token-123',
        'resource-123',
        'not_exists',
        'https://www.googleapis.com/calendar/v3/calendars/primary',
        '3',
      );

      expect(result).toEqual({});
      expect(connectionService.updateSyncStatus).toHaveBeenCalledWith(
        'conn-123',
        'error',
        'Calendar resource no longer exists - may have been deleted',
      );
      expect(syncLogService.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'inbound',
          action: 'webhook_received',
          status: 'failed',
          errorMessage: 'Resource no longer exists - calendar may be deleted',
        }),
      );
    });
  });
});
