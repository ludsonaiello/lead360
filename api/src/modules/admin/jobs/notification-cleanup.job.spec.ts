import { Test, TestingModule } from '@nestjs/testing';
import { NotificationCleanupJob } from './notification-cleanup.job';
import { AlertService } from '../services/alert.service';

describe('NotificationCleanupJob', () => {
  let job: NotificationCleanupJob;
  let alertService: jest.Mocked<AlertService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCleanupJob,
        {
          provide: AlertService,
          useValue: {
            cleanupExpiredNotifications: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get<NotificationCleanupJob>(NotificationCleanupJob);
    alertService = module.get(AlertService);
  });

  it('should cleanup expired notifications', async () => {
    alertService.cleanupExpiredNotifications.mockResolvedValue({
      old_deleted: 10,
      expired_deleted: 5,
      total_cleaned: 15,
    });

    await job.handleCron();

    expect(alertService.cleanupExpiredNotifications).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    alertService.cleanupExpiredNotifications.mockRejectedValue(
      new Error('DB error'),
    );

    await expect(job.handleCron()).resolves.not.toThrow();
  });
});
