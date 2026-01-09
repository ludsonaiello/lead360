import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { JobsAdminController } from './jobs-admin.controller';
import { PrismaService } from '../../../core/database/prisma.service';

describe('JobsAdminController', () => {
  let controller: JobsAdminController;
  let prisma: PrismaService;
  let emailQueue: any;
  let scheduledQueue: any;

  const mockPrismaService = {
    job: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    job_log: {
      findMany: jest.fn(),
    },
    email_queue: {
      findMany: jest.fn(),
    },
  };

  const mockQueue = {
    add: jest.fn(),
    getJobCounts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsAdminController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('email'),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken('scheduled'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    controller = module.get<JobsAdminController>(JobsAdminController);
    prisma = module.get<PrismaService>(PrismaService);
    emailQueue = module.get(getQueueToken('email'));
    scheduledQueue = module.get(getQueueToken('scheduled'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listJobs', () => {
    it('should return paginated jobs list', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          job_type: 'send-email',
          status: 'completed',
          tenant_id: 'tenant-1',
          created_at: new Date(),
        },
        {
          id: 'job-2',
          job_type: 'send-email',
          status: 'pending',
          tenant_id: 'tenant-1',
          created_at: new Date(),
        },
      ];

      mockPrismaService.job.findMany.mockResolvedValue(mockJobs);
      mockPrismaService.job.count.mockResolvedValue(2);

      const result = await controller.listJobs({
        page: 1,
        limit: 50,
      });

      expect(result).toEqual({
        data: mockJobs,
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_count: 2,
          limit: 50,
        },
      });
      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 50,
        orderBy: { created_at: 'desc' },
      });
      expect(mockPrismaService.job.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should filter jobs by status', async () => {
      mockPrismaService.job.findMany.mockResolvedValue([]);
      mockPrismaService.job.count.mockResolvedValue(0);

      await controller.listJobs({
        page: 1,
        limit: 50,
        status: 'failed',
      });

      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        where: { status: 'failed' },
        skip: 0,
        take: 50,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should filter jobs by date range', async () => {
      mockPrismaService.job.findMany.mockResolvedValue([]);
      mockPrismaService.job.count.mockResolvedValue(0);

      const dateFrom = '2026-01-01T00:00:00Z';
      const dateTo = '2026-01-31T23:59:59Z';

      await controller.listJobs({
        page: 1,
        limit: 50,
        date_from: dateFrom,
        date_to: dateTo,
      });

      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        where: {
          created_at: {
            gte: new Date(dateFrom),
            lte: new Date(dateTo),
          },
        },
        skip: 0,
        take: 50,
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('getJob', () => {
    it('should return job details with logs and email queue', async () => {
      const mockJob = {
        id: 'job-1',
        job_type: 'send-email',
        status: 'completed',
        tenant_id: 'tenant-1',
        created_at: new Date(),
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      const result = await controller.getJob('job-1');

      expect(result).toEqual(mockJob);
      expect(mockPrismaService.job.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        include: {
          job_log: {
            orderBy: { timestamp: 'asc' },
          },
          email_queue: true,
        },
      });
    });

    it('should throw NotFoundException when job not found', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(controller.getJob('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('retryJob', () => {
    it('should retry a failed job', async () => {
      const mockJob = {
        id: 'job-1',
        job_type: 'send-email',
        status: 'failed',
        tenant_id: 'tenant-1',
        payload: { to: 'test@example.com' },
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.job.update.mockResolvedValue({
        ...mockJob,
        status: 'pending',
      });
      mockQueue.add.mockResolvedValue({ id: 'bullmq-job-1' });

      const result = await controller.retryJob('job-1');

      expect(result).toEqual({
        message: 'Job requeued successfully',
        job_id: 'job-1',
      });
      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'pending',
          started_at: null,
          failed_at: null,
          error_message: null,
        },
      });
    });

    it('should throw NotFoundException when job not found', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(controller.retryJob('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when job is not failed', async () => {
      const mockJob = {
        id: 'job-1',
        job_type: 'send-email',
        status: 'completed',
        tenant_id: 'tenant-1',
      };

      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      await expect(controller.retryJob('job-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteJob', () => {
    it('should delete a job', async () => {
      const mockJob = {
        id: 'job-1',
        job_type: 'send-email',
        status: 'completed',
      };

      mockPrismaService.job.delete.mockResolvedValue(mockJob);

      await controller.deleteJob('job-1');

      expect(mockPrismaService.job.delete).toHaveBeenCalledWith({
        where: { id: 'job-1' },
      });
    });
  });

  describe('listFailedJobs', () => {
    it('should return only failed jobs', async () => {
      const mockFailedJobs = [
        {
          id: 'job-1',
          job_type: 'send-email',
          status: 'failed',
          error_message: 'SMTP error',
        },
      ];

      mockPrismaService.job.findMany.mockResolvedValue(mockFailedJobs);
      mockPrismaService.job.count.mockResolvedValue(1);

      const result = await controller.listFailedJobs({
        page: 1,
        limit: 50,
      });

      expect(result.data).toEqual(mockFailedJobs);
      expect(mockPrismaService.job.findMany).toHaveBeenCalledWith({
        where: { status: 'failed' },
        skip: 0,
        take: 50,
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('retryAllFailedJobs', () => {
    it('should retry all failed jobs', async () => {
      const mockFailedJobs = [
        {
          id: 'job-1',
          job_type: 'send-email',
          status: 'failed',
          payload: {},
        },
        {
          id: 'job-2',
          job_type: 'send-email',
          status: 'failed',
          payload: {},
        },
      ];

      mockPrismaService.job.findMany.mockResolvedValue(mockFailedJobs);

      // Mock for retryJob internal calls
      mockPrismaService.job.findUnique
        .mockResolvedValueOnce(mockFailedJobs[0])
        .mockResolvedValueOnce(mockFailedJobs[1]);

      mockPrismaService.job.update
        .mockResolvedValueOnce({ ...mockFailedJobs[0], status: 'pending' })
        .mockResolvedValueOnce({ ...mockFailedJobs[1], status: 'pending' });

      mockQueue.add.mockResolvedValue({ id: 'bullmq-job-1' });

      const result = await controller.retryAllFailedJobs();

      expect(result).toEqual({
        message: '2 failed jobs requeued successfully',
        count: 2,
      });
      expect(mockPrismaService.job.update).toHaveBeenCalledTimes(2);
    });

    it('should return zero count when no failed jobs', async () => {
      mockPrismaService.job.findMany.mockResolvedValue([]);

      const result = await controller.retryAllFailedJobs();

      expect(result).toEqual({
        message: '0 failed jobs requeued successfully',
        count: 0,
      });
    });
  });

  describe('clearFailedJobs', () => {
    it('should delete all failed jobs', async () => {
      mockPrismaService.job.deleteMany.mockResolvedValue({ count: 5 });

      const result = await controller.clearFailedJobs();

      expect(result).toEqual({
        message: '5 failed jobs deleted',
        count: 5,
      });
      expect(mockPrismaService.job.deleteMany).toHaveBeenCalledWith({
        where: { status: 'failed' },
      });
    });
  });

  describe('getQueueHealth', () => {
    it('should return queue health metrics', async () => {
      const mockEmailQueueCounts = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
      };

      const mockScheduledQueueCounts = {
        waiting: 10,
        active: 1,
        completed: 50,
        failed: 2,
      };

      const mockJobStats = [
        { status: 'pending', _count: 10 },
        { status: 'processing', _count: 5 },
        { status: 'completed', _count: 200 },
        { status: 'failed', _count: 15 },
      ];

      mockQueue.getJobCounts.mockResolvedValueOnce(mockEmailQueueCounts);
      mockQueue.getJobCounts.mockResolvedValueOnce(mockScheduledQueueCounts);
      mockPrismaService.job.groupBy = jest.fn().mockResolvedValue(mockJobStats);

      const result = await controller.getQueueHealth();

      expect(result).toEqual({
        queues: {
          email: mockEmailQueueCounts,
          scheduled: mockScheduledQueueCounts,
        },
        database: {
          pending: 10,
          processing: 5,
          completed: 200,
          failed: 15,
        },
      });
    });
  });
});
