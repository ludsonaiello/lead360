import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ScheduledJobsController } from './scheduled-jobs.controller';
import { PrismaService } from '../../../core/database/prisma.service';
import { ScheduledJobService } from '../services/scheduled-job.service';
import { JobQueueService } from '../services/job-queue.service';

describe('ScheduledJobsController', () => {
  let controller: ScheduledJobsController;
  let prisma: PrismaService;
  let scheduledJobService: ScheduledJobService;
  let jobQueueService: JobQueueService;

  const mockPrismaService = {
    scheduled_job: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockScheduledJobService = {
    registerScheduledJob: jest.fn(),
    updateSchedule: jest.fn(),
    getScheduleHistory: jest.fn(),
  };

  const mockJobQueueService = {
    queueScheduledJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduledJobsController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ScheduledJobService,
          useValue: mockScheduledJobService,
        },
        {
          provide: JobQueueService,
          useValue: mockJobQueueService,
        },
      ],
    }).compile();

    controller = module.get<ScheduledJobsController>(ScheduledJobsController);
    prisma = module.get<PrismaService>(PrismaService);
    scheduledJobService = module.get<ScheduledJobService>(ScheduledJobService);
    jobQueueService = module.get<JobQueueService>(JobQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listScheduledJobs', () => {
    it('should return paginated scheduled jobs list', async () => {
      const mockSchedules = [
        {
          id: 'schedule-1',
          job_type: 'expiry-check',
          name: 'Daily Expiry Check',
          schedule: '0 8 * * *',
          timezone: 'America/New_York',
          is_enabled: true,
          created_at: new Date(),
        },
        {
          id: 'schedule-2',
          job_type: 'job-retention',
          name: 'Weekly Job Cleanup',
          schedule: '0 0 * * 0',
          timezone: 'America/New_York',
          is_enabled: true,
          created_at: new Date(),
        },
      ];

      mockPrismaService.scheduled_job.findMany.mockResolvedValue(mockSchedules);
      mockPrismaService.scheduled_job.count.mockResolvedValue(2);

      const result = await controller.listScheduledJobs({
        page: 1,
        limit: 50,
      });

      expect(result).toEqual({
        data: mockSchedules,
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_count: 2,
          limit: 50,
        },
      });
      expect(mockPrismaService.scheduled_job.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 50,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.scheduled_job.findMany.mockResolvedValue([]);
      mockPrismaService.scheduled_job.count.mockResolvedValue(150);

      const result = await controller.listScheduledJobs({
        page: 2,
        limit: 50,
      });

      expect(result.pagination).toEqual({
        current_page: 2,
        total_pages: 3,
        total_count: 150,
        limit: 50,
      });
      expect(mockPrismaService.scheduled_job.findMany).toHaveBeenCalledWith({
        skip: 50,
        take: 50,
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('getScheduledJob', () => {
    it('should return scheduled job details', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        job_type: 'expiry-check',
        name: 'Daily Expiry Check',
        schedule: '0 8 * * *',
        timezone: 'America/New_York',
        is_enabled: true,
        next_run_at: new Date(),
      };

      mockPrismaService.scheduled_job.findUnique.mockResolvedValue(
        mockSchedule,
      );

      const result = await controller.getScheduledJob('schedule-1');

      expect(result).toEqual(mockSchedule);
      expect(mockPrismaService.scheduled_job.findUnique).toHaveBeenCalledWith({
        where: { id: 'schedule-1' },
      });
    });

    it('should throw NotFoundException when schedule not found', async () => {
      mockPrismaService.scheduled_job.findUnique.mockResolvedValue(null);

      await expect(controller.getScheduledJob('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createScheduledJob', () => {
    it('should create a new scheduled job', async () => {
      const createDto = {
        job_type: 'custom-job',
        name: 'Custom Daily Job',
        description: 'A custom job for testing',
        schedule: '0 9 * * *',
        timezone: 'America/New_York',
        max_retries: 3,
        timeout_seconds: 300,
      };

      const mockCreatedSchedule = {
        id: 'schedule-1',
        ...createDto,
        is_enabled: true,
        next_run_at: new Date(),
        created_at: new Date(),
      };

      mockScheduledJobService.registerScheduledJob.mockResolvedValue(
        mockCreatedSchedule,
      );

      const result = await controller.createScheduledJob(createDto);

      expect(result).toEqual(mockCreatedSchedule);
      expect(mockScheduledJobService.registerScheduledJob).toHaveBeenCalledWith(
        createDto,
      );
    });

    it('should use default values for optional fields', async () => {
      const createDto = {
        job_type: 'custom-job',
        name: 'Custom Job',
        schedule: '0 9 * * *',
      };

      const mockCreatedSchedule = {
        id: 'schedule-1',
        ...createDto,
        timezone: 'America/New_York',
        max_retries: 3,
        timeout_seconds: 300,
        is_enabled: true,
        next_run_at: new Date(),
      };

      mockScheduledJobService.registerScheduledJob.mockResolvedValue(
        mockCreatedSchedule,
      );

      await controller.createScheduledJob(createDto);

      expect(mockScheduledJobService.registerScheduledJob).toHaveBeenCalledWith(
        createDto,
      );
    });
  });

  describe('updateScheduledJob', () => {
    it('should update a scheduled job', async () => {
      const updateDto = {
        name: 'Updated Job Name',
        schedule: '0 10 * * *',
        is_enabled: false,
      };

      const mockUpdatedSchedule = {
        id: 'schedule-1',
        job_type: 'custom-job',
        ...updateDto,
        timezone: 'America/New_York',
        next_run_at: new Date(),
      };

      mockScheduledJobService.updateSchedule.mockResolvedValue(
        mockUpdatedSchedule,
      );

      const result = await controller.updateScheduledJob(
        'schedule-1',
        updateDto,
      );

      expect(result).toEqual(mockUpdatedSchedule);
      expect(mockScheduledJobService.updateSchedule).toHaveBeenCalledWith(
        'schedule-1',
        updateDto,
      );
    });

    it('should handle partial updates', async () => {
      const updateDto = {
        is_enabled: false,
      };

      const mockUpdatedSchedule = {
        id: 'schedule-1',
        job_type: 'custom-job',
        name: 'Original Name',
        schedule: '0 9 * * *',
        timezone: 'America/New_York',
        is_enabled: false,
      };

      mockScheduledJobService.updateSchedule.mockResolvedValue(
        mockUpdatedSchedule,
      );

      await controller.updateScheduledJob('schedule-1', updateDto);

      expect(mockScheduledJobService.updateSchedule).toHaveBeenCalledWith(
        'schedule-1',
        updateDto,
      );
    });
  });

  describe('deleteScheduledJob', () => {
    it('should delete a scheduled job', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        job_type: 'custom-job',
        name: 'Job to Delete',
      };

      mockPrismaService.scheduled_job.delete.mockResolvedValue(mockSchedule);

      await controller.deleteScheduledJob('schedule-1');

      expect(mockPrismaService.scheduled_job.delete).toHaveBeenCalledWith({
        where: { id: 'schedule-1' },
      });
    });
  });

  describe('triggerScheduledJob', () => {
    it('should manually trigger a scheduled job', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        job_type: 'expiry-check',
        name: 'Daily Expiry Check',
        schedule: '0 8 * * *',
        is_enabled: true,
      };

      mockPrismaService.scheduled_job.findUnique.mockResolvedValue(
        mockSchedule,
      );
      mockJobQueueService.queueScheduledJob.mockResolvedValue({
        jobId: 'job-1',
      });

      const result = await controller.triggerScheduledJob('schedule-1');

      expect(result).toEqual({
        message: 'Job triggered successfully',
        job_id: 'job-1',
      });
      expect(mockJobQueueService.queueScheduledJob).toHaveBeenCalledWith(
        mockSchedule.job_type,
        {
          scheduleId: mockSchedule.id,
          scheduleName: mockSchedule.name,
          manualTrigger: true,
        },
      );
    });

    it('should throw NotFoundException when schedule not found', async () => {
      mockPrismaService.scheduled_job.findUnique.mockResolvedValue(null);

      await expect(
        controller.triggerScheduledJob('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getScheduleHistory', () => {
    it('should return execution history for a schedule', async () => {
      const mockHistory = [
        {
          id: 'job-1',
          job_type: 'expiry-check',
          status: 'completed',
          created_at: new Date('2026-01-07T08:00:00Z'),
          completed_at: new Date('2026-01-07T08:05:00Z'),
        },
        {
          id: 'job-2',
          job_type: 'expiry-check',
          status: 'completed',
          created_at: new Date('2026-01-06T08:00:00Z'),
          completed_at: new Date('2026-01-06T08:04:30Z'),
        },
      ];

      mockScheduledJobService.getScheduleHistory.mockResolvedValue(mockHistory);

      const result = await controller.getScheduleHistory('schedule-1', 100);

      expect(result).toEqual(mockHistory);
      expect(mockScheduledJobService.getScheduleHistory).toHaveBeenCalledWith(
        'schedule-1',
        100,
      );
    });

    it('should use default limit of 100', async () => {
      mockScheduledJobService.getScheduleHistory.mockResolvedValue([]);

      await controller.getScheduleHistory('schedule-1', 100);

      expect(mockScheduledJobService.getScheduleHistory).toHaveBeenCalledWith(
        'schedule-1',
        100,
      );
    });

    it('should respect custom limit', async () => {
      mockScheduledJobService.getScheduleHistory.mockResolvedValue([]);

      await controller.getScheduleHistory('schedule-1', 50);

      expect(mockScheduledJobService.getScheduleHistory).toHaveBeenCalledWith(
        'schedule-1',
        50,
      );
    });
  });
});
