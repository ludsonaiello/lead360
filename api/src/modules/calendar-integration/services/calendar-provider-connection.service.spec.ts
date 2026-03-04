import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CalendarProviderConnectionService } from './calendar-provider-connection.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

describe('CalendarProviderConnectionService', () => {
  let service: CalendarProviderConnectionService;
  let prismaService: PrismaService;
  let encryptionService: EncryptionService;

  const mockConnection = {
    id: 'conn-123',
    tenant_id: 'tenant-123',
    provider_type: 'google_calendar',
    access_token: 'encrypted-access-token',
    refresh_token: 'encrypted-refresh-token',
    token_expires_at: new Date('2026-03-04T10:00:00Z'),
    connected_calendar_id: 'primary',
    connected_calendar_name: 'My Calendar',
    webhook_channel_id: 'channel-123',
    webhook_resource_id: 'resource-123',
    webhook_channel_token: 'token-123',
    webhook_expiration: new Date('2026-03-10T10:00:00Z'),
    sync_status: 'active',
    last_sync_at: new Date('2026-03-03T09:00:00Z'),
    last_sync_token: 'sync-token-123',
    error_message: null,
    is_active: true,
    created_at: new Date('2026-03-01T00:00:00Z'),
    updated_at: new Date('2026-03-03T09:00:00Z'),
    connected_by_user_id: 'user-123',
  };

  const mockPrismaService = {
    calendar_provider_connection: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    calendar_external_block: {
      deleteMany: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn((text: string) => `encrypted-${text}`),
    decrypt: jest.fn((text: string) => text.replace('encrypted-', '')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarProviderConnectionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<CalendarProviderConnectionService>(
      CalendarProviderConnectionService,
    );
    prismaService = module.get<PrismaService>(PrismaService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveConnection', () => {
    it('should return connection with decrypted tokens', async () => {
      mockPrismaService.calendar_provider_connection.findUnique.mockResolvedValue(
        mockConnection,
      );

      const result = await service.getActiveConnection('tenant-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('conn-123');
      expect(result?.accessToken).toBe('access-token');
      expect(result?.refreshToken).toBe('refresh-token');
      expect(encryptionService.decrypt).toHaveBeenCalledTimes(2);
    });

    it('should return null if connection not found', async () => {
      mockPrismaService.calendar_provider_connection.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.getActiveConnection('tenant-123');

      expect(result).toBeNull();
    });

    it('should return null if connection is not active', async () => {
      mockPrismaService.calendar_provider_connection.findUnique.mockResolvedValue({
        ...mockConnection,
        is_active: false,
      });

      const result = await service.getActiveConnection('tenant-123');

      expect(result).toBeNull();
    });
  });

  describe('createConnection', () => {
    it('should create connection with encrypted tokens', async () => {
      const createData = {
        tenantId: 'tenant-123',
        providerType: 'google_calendar',
        accessToken: 'plain-access-token',
        refreshToken: 'plain-refresh-token',
        tokenExpiresAt: new Date('2026-03-04T10:00:00Z'),
        connectedCalendarId: 'primary',
        connectedCalendarName: 'My Calendar',
        connectedByUserId: 'user-123',
      };

      mockPrismaService.calendar_provider_connection.create.mockResolvedValue(
        mockConnection,
      );

      const result = await service.createConnection(createData);

      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        'plain-access-token',
      );
      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        'plain-refresh-token',
      );
      expect(prismaService.calendar_provider_connection.create).toHaveBeenCalled();
      expect(result.id).toBe('conn-123');
      expect(result.tenantId).toBe('tenant-123');
    });

    it('should create connection without webhook data', async () => {
      const createData = {
        tenantId: 'tenant-123',
        providerType: 'google_calendar',
        accessToken: 'plain-access-token',
        refreshToken: 'plain-refresh-token',
        tokenExpiresAt: new Date('2026-03-04T10:00:00Z'),
        connectedCalendarId: 'primary',
        connectedCalendarName: 'My Calendar',
      };

      mockPrismaService.calendar_provider_connection.create.mockResolvedValue(
        mockConnection,
      );

      await service.createConnection(createData);

      const createCall =
        mockPrismaService.calendar_provider_connection.create.mock.calls[0][0];
      expect(createCall.data.webhook_channel_id).toBeNull();
      expect(createCall.data.webhook_resource_id).toBeNull();
    });
  });

  describe('updateAccessToken', () => {
    it('should update access token with encryption', async () => {
      mockPrismaService.calendar_provider_connection.update.mockResolvedValue(
        mockConnection,
      );

      await service.updateAccessToken(
        'conn-123',
        'new-access-token',
        new Date('2026-03-04T11:00:00Z'),
      );

      expect(encryptionService.encrypt).toHaveBeenCalledWith('new-access-token');
      expect(
        prismaService.calendar_provider_connection.update,
      ).toHaveBeenCalledWith({
        where: { id: 'conn-123' },
        data: expect.objectContaining({
          access_token: 'encrypted-new-access-token',
        }),
      });
    });
  });

  describe('updateWebhookChannel', () => {
    it('should update webhook channel information', async () => {
      mockPrismaService.calendar_provider_connection.update.mockResolvedValue(
        mockConnection,
      );

      const webhookData = {
        channelId: 'new-channel-123',
        resourceId: 'new-resource-123',
        channelToken: 'new-token-123',
        expiration: new Date('2026-03-10T12:00:00Z'),
      };

      await service.updateWebhookChannel('conn-123', webhookData);

      expect(
        prismaService.calendar_provider_connection.update,
      ).toHaveBeenCalledWith({
        where: { id: 'conn-123' },
        data: expect.objectContaining({
          webhook_channel_id: 'new-channel-123',
          webhook_resource_id: 'new-resource-123',
        }),
      });
    });
  });

  describe('updateSyncStatus', () => {
    it('should update sync status with error message', async () => {
      mockPrismaService.calendar_provider_connection.update.mockResolvedValue(
        mockConnection,
      );

      await service.updateSyncStatus('conn-123', 'error', 'Test error message');

      expect(
        prismaService.calendar_provider_connection.update,
      ).toHaveBeenCalledWith({
        where: { id: 'conn-123' },
        data: expect.objectContaining({
          sync_status: 'error',
          error_message: 'Test error message',
        }),
      });
    });

    it('should clear error message when status is active', async () => {
      mockPrismaService.calendar_provider_connection.update.mockResolvedValue(
        mockConnection,
      );

      await service.updateSyncStatus('conn-123', 'active');

      expect(
        prismaService.calendar_provider_connection.update,
      ).toHaveBeenCalledWith({
        where: { id: 'conn-123' },
        data: expect.objectContaining({
          sync_status: 'active',
          error_message: null,
        }),
      });
    });
  });

  describe('updateLastSync', () => {
    it('should update last sync timestamp with sync token', async () => {
      mockPrismaService.calendar_provider_connection.update.mockResolvedValue(
        mockConnection,
      );

      await service.updateLastSync('conn-123', 'new-sync-token');

      expect(
        prismaService.calendar_provider_connection.update,
      ).toHaveBeenCalledWith({
        where: { id: 'conn-123' },
        data: expect.objectContaining({
          last_sync_token: 'new-sync-token',
        }),
      });
    });

    it('should update last sync timestamp without sync token', async () => {
      mockPrismaService.calendar_provider_connection.update.mockResolvedValue(
        mockConnection,
      );

      await service.updateLastSync('conn-123');

      expect(
        prismaService.calendar_provider_connection.update,
      ).toHaveBeenCalledWith({
        where: { id: 'conn-123' },
        data: expect.objectContaining({
          last_sync_token: null,
        }),
      });
    });
  });

  describe('deactivateConnection', () => {
    it('should deactivate connection and purge external blocks', async () => {
      mockPrismaService.calendar_provider_connection.findUnique.mockResolvedValue(
        mockConnection,
      );
      mockPrismaService.calendar_provider_connection.update.mockResolvedValue({
        ...mockConnection,
        is_active: false,
      });
      mockPrismaService.calendar_external_block.deleteMany.mockResolvedValue({
        count: 5,
      });

      await service.deactivateConnection('tenant-123');

      expect(
        prismaService.calendar_provider_connection.update,
      ).toHaveBeenCalledWith({
        where: { id: 'conn-123' },
        data: expect.objectContaining({
          is_active: false,
          sync_status: 'disconnected',
        }),
      });

      expect(
        prismaService.calendar_external_block.deleteMany,
      ).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-123' },
      });
    });

    it('should throw NotFoundException if connection not found', async () => {
      mockPrismaService.calendar_provider_connection.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.deactivateConnection('tenant-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('needsTokenRefresh', () => {
    it('should return true if token expires within 5 minutes', () => {
      const expiresAt = new Date(Date.now() + 4 * 60 * 1000); // 4 minutes from now
      expect(service.needsTokenRefresh(expiresAt)).toBe(true);
    });

    it('should return false if token expires after 5 minutes', () => {
      const expiresAt = new Date(Date.now() + 6 * 60 * 1000); // 6 minutes from now
      expect(service.needsTokenRefresh(expiresAt)).toBe(false);
    });

    it('should return true if token already expired', () => {
      const expiresAt = new Date(Date.now() - 1000); // 1 second ago
      expect(service.needsTokenRefresh(expiresAt)).toBe(true);
    });
  });
});
