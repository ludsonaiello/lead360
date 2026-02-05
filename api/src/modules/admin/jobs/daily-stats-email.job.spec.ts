import { Test, TestingModule } from '@nestjs/testing';
import { DailyStatsEmailJob } from './daily-stats-email.job';
import { AlertService } from '../services/alert.service';

describe('DailyStatsEmailJob', () => {
  let job: DailyStatsEmailJob;
  let alertService: jest.Mocked<AlertService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyStatsEmailJob,
        {
          provide: AlertService,
          useValue: {
            sendDailyStatsEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get<DailyStatsEmailJob>(DailyStatsEmailJob);
    alertService = module.get(AlertService);
  });

  it('should send daily stats email', async () => {
    alertService.sendDailyStatsEmail.mockResolvedValue({
      sent_to: 5,
    });

    await job.handleCron();

    expect(alertService.sendDailyStatsEmail).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    alertService.sendDailyStatsEmail.mockRejectedValue(new Error('Email service down'));

    await expect(job.handleCron()).resolves.not.toThrow();
  });
});
