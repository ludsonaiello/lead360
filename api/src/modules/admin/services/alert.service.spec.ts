import { Test, TestingModule } from '@nestjs/testing';
import { AlertService } from './alert.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { DashboardService } from './dashboard.service';

describe('AlertService', () => {
  let service: AlertService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: PrismaService,
          useValue: {
            admin_notification: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            user: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: DashboardService,
          useValue: {
            getMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    prismaService = module.get(PrismaService);
  });

  describe('createNotification', () => {
    it('should create notification', async () => {
      const notification = {
        type: 'new_tenant',
        title: 'New Tenant',
        message: 'A new tenant signed up',
      };

      prismaService.admin_notification.create.mockResolvedValue({
        id: 'notif-123',
        ...notification,
        is_read: false,
        created_at: new Date(),
      });

      const result = await service.createNotification(notification);
      expect(result).toHaveProperty('id');
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      prismaService.admin_notification.findMany.mockResolvedValue([
        {
          id: 'notif-1',
          title: 'Test',
          message: 'Test message',
          is_read: false,
        },
      ]);

      const result = await service.getNotifications({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      prismaService.admin_notification.update.mockResolvedValue({
        id: 'notif-1',
        is_read: true,
      });

      const result = await service.markAsRead('notif-1');
      expect(result.is_read).toBe(true);
    });
  });

  describe('cleanupExpiredNotifications', () => {
    it('should delete old notifications', async () => {
      prismaService.admin_notification.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredNotifications();
      expect(result.deleted_count).toBe(5);
    });
  });
});
