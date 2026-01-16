import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceModeCheckJob } from './maintenance-mode-check.job';
import { MaintenanceModeService } from '../services/maintenance-mode.service';

describe('MaintenanceModeCheckJob', () => {
  let job: MaintenanceModeCheckJob;
  let maintenanceModeService: jest.Mocked<MaintenanceModeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceModeCheckJob,
        {
          provide: MaintenanceModeService,
          useValue: {
            disableMaintenanceMode: jest.fn(),
          },
        },
      ],
    }).compile();

    job = module.get<MaintenanceModeCheckJob>(MaintenanceModeCheckJob);
    maintenanceModeService = module.get(MaintenanceModeService);
  });

  it('should check and disable maintenance mode if needed', async () => {
    maintenanceModeService.disableMaintenanceMode.mockResolvedValue(undefined);

    await job.handleCron();

    expect(maintenanceModeService.disableMaintenanceMode).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    maintenanceModeService.disableMaintenanceMode.mockRejectedValue(new Error('DB error'));

    await expect(job.handleCron()).resolves.not.toThrow();
  });
});
