import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { FileCleanupScheduler } from './file-cleanup.scheduler';

describe('FileCleanupScheduler', () => {
  let scheduler: FileCleanupScheduler;
  let mockQueue: Partial<Queue>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileCleanupScheduler,
        {
          provide: getQueueToken('file-cleanup'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    scheduler = module.get<FileCleanupScheduler>(FileCleanupScheduler);

    // Mock Logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('scheduleDailyCleanup', () => {
    it('should add daily-cleanup job to queue', async () => {
      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-123' });

      await scheduler.scheduleDailyCleanup();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'daily-cleanup',
        {},
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Scheduling daily file cleanup job',
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Daily cleanup job added to queue successfully',
      );
    });

    it('should handle queue errors gracefully', async () => {
      const error = new Error('Queue connection failed');
      (mockQueue.add as jest.Mock).mockRejectedValue(error);

      await scheduler.scheduleDailyCleanup();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to schedule daily cleanup'),
        expect.any(String),
      );
    });

    it('should configure job with exponential backoff retry', async () => {
      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-123' });

      await scheduler.scheduleDailyCleanup();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'daily-cleanup',
        {},
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000,
          },
        }),
      );
    });

    it('should remove completed jobs to prevent queue bloat', async () => {
      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-123' });

      await scheduler.scheduleDailyCleanup();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'daily-cleanup',
        {},
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
        }),
      );
    });
  });

  describe('triggerManualCleanup', () => {
    it('should add manual-cleanup job to queue for specific tenant', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const mockJobId = 'job-456';

      (mockQueue.add as jest.Mock).mockResolvedValue({ id: mockJobId });

      const result = await scheduler.triggerManualCleanup(tenantId, userId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'manual-cleanup',
        {
          tenantId,
          userId,
        },
        {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 30000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      expect(result).toEqual({ jobId: mockJobId });

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        `Triggering manual cleanup for tenant ${tenantId}`,
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        `Manual cleanup job created with ID: ${mockJobId}`,
      );
    });

    it('should handle manual cleanup queue errors', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const error = new Error('Queue error');

      (mockQueue.add as jest.Mock).mockRejectedValue(error);

      await expect(scheduler.triggerManualCleanup(tenantId, userId)).rejects.toThrow(
        'Queue error',
      );

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to trigger manual cleanup for tenant ${tenantId}`),
        expect.any(String),
      );
    });

    it('should configure manual cleanup with fixed backoff', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';

      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-123' });

      await scheduler.triggerManualCleanup(tenantId, userId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'manual-cleanup',
        expect.any(Object),
        expect.objectContaining({
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 30000, // 30 seconds
          },
        }),
      );
    });

    it('should return job ID for tracking', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const expectedJobId = 'job-789';

      (mockQueue.add as jest.Mock).mockResolvedValue({ id: expectedJobId });

      const result = await scheduler.triggerManualCleanup(tenantId, userId);

      expect(result).toEqual({ jobId: expectedJobId });
    });
  });

  describe('Job Configuration', () => {
    it('should use different retry strategies for daily vs manual cleanup', async () => {
      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-123' });

      // Daily cleanup: 3 attempts, exponential backoff
      await scheduler.scheduleDailyCleanup();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'daily-cleanup',
        {},
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 60000 },
        }),
      );

      jest.clearAllMocks();

      // Manual cleanup: 2 attempts, fixed backoff
      await scheduler.triggerManualCleanup('tenant-123', 'user-123');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'manual-cleanup',
        expect.any(Object),
        expect.objectContaining({
          attempts: 2,
          backoff: { type: 'fixed', delay: 30000 },
        }),
      );
    });

    it('should keep failed jobs for debugging', async () => {
      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-123' });

      await scheduler.scheduleDailyCleanup();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'daily-cleanup',
        {},
        expect.objectContaining({
          removeOnFail: false, // Keep failed jobs for debugging
        }),
      );
    });
  });
});
