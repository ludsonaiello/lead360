import { Test, TestingModule } from '@nestjs/testing';
import { TranscriptionJobService } from './transcription-job.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';

describe('TranscriptionJobService', () => {
  let service: TranscriptionJobService;
  let prisma: PrismaService;
  let queue: any;

  const mockQueue = {
    add: jest.fn(),
  };

  const mockPrismaService = {
    call_record: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    call_transcription: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptionJobService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('communication-call-transcription'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<TranscriptionJobService>(TranscriptionJobService);
    prisma = module.get<PrismaService>(PrismaService);
    queue = mockQueue;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('queueTranscription', () => {
    it('should queue transcription successfully', async () => {
      const callRecord = {
        id: 'call-123',
        tenant_id: 'tenant-123',
        recording_url: 'https://twilio.com/recording.mp3',
        recording_status: 'available',
        transcription_id: null,
      };

      const transcription = {
        id: 'trans-123',
        tenant_id: 'tenant-123',
        call_record_id: 'call-123',
        status: 'queued',
      };

      mockPrismaService.call_record.findUnique.mockResolvedValue(callRecord);
      mockPrismaService.call_transcription.create.mockResolvedValue(
        transcription,
      );
      mockQueue.add.mockResolvedValue({ id: 'job-123' });
      mockPrismaService.call_record.update.mockResolvedValue({});

      const result = await service.queueTranscription('call-123');

      expect(result.success).toBe(true);
      expect(result.transcriptionId).toBe('trans-123');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-transcription',
        {
          callRecordId: 'call-123',
          transcriptionId: 'trans-123',
        },
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000,
          },
        }),
      );
    });

    it('should throw NotFoundException if call record not found', async () => {
      mockPrismaService.call_record.findUnique.mockResolvedValue(null);

      await expect(service.queueTranscription('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return failure if no recording URL', async () => {
      const callRecord = {
        id: 'call-123',
        recording_url: null,
      };

      mockPrismaService.call_record.findUnique.mockResolvedValue(callRecord);

      const result = await service.queueTranscription('call-123');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_recording');
    });

    it('should return failure if transcription already exists', async () => {
      const callRecord = {
        id: 'call-123',
        recording_url: 'https://twilio.com/recording.mp3',
        transcription_id: 'existing-trans',
      };

      const existingTranscription = {
        id: 'existing-trans',
        status: 'completed',
      };

      mockPrismaService.call_record.findUnique.mockResolvedValue(callRecord);
      mockPrismaService.call_transcription.findUnique.mockResolvedValue(
        existingTranscription,
      );

      const result = await service.queueTranscription('call-123');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('already_exists');
    });
  });

  describe('searchTranscriptions', () => {
    it('should search transcriptions with full-text search', async () => {
      const searchResults = [
        {
          id: 'trans-1',
          transcription_text: 'quote request for roofing',
          from_number: '+1234567890',
        },
        {
          id: 'trans-2',
          transcription_text: 'estimate for painting',
          from_number: '+0987654321',
        },
      ];

      const countResult = [{ count: BigInt(10) }];

      mockPrismaService.$queryRawUnsafe
        .mockResolvedValueOnce(searchResults)
        .mockResolvedValueOnce(countResult);

      const result = await service.searchTranscriptions(
        'tenant-123',
        'quote estimate',
        1,
        20,
      );

      expect(result.data).toEqual(searchResults);
      expect(result.meta.total).toBe(10);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should validate and enforce max limit of 100', async () => {
      mockPrismaService.$queryRawUnsafe
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: BigInt(0) }]);

      await service.searchTranscriptions('tenant-123', 'test', 1, 500);

      // Should clamp to 100
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.any(String),
        'tenant-123',
        'test',
        100, // Clamped limit
        0,
      );
    });
  });

  describe('getTranscriptionById', () => {
    it('should return transcription with call details', async () => {
      const transcription = {
        id: 'trans-123',
        transcription_text: 'test transcription',
        call_record: {
          id: 'call-123',
          from_number: '+1234567890',
        },
      };

      mockPrismaService.call_transcription.findFirst.mockResolvedValue(
        transcription,
      );

      const result = await service.getTranscriptionById(
        'trans-123',
        'tenant-123',
      );

      expect(result).toEqual(transcription);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.call_transcription.findFirst.mockResolvedValue(null);

      await expect(
        service.getTranscriptionById('invalid-id', 'tenant-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listTranscriptions', () => {
    it('should list transcriptions with pagination', async () => {
      const transcriptions = [{ id: 'trans-1' }, { id: 'trans-2' }];

      mockPrismaService.call_transcription.findMany.mockResolvedValue(
        transcriptions,
      );
      mockPrismaService.call_transcription.count.mockResolvedValue(25);

      const result = await service.listTranscriptions('tenant-123', 1, 20);

      expect(result.data).toEqual(transcriptions);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should filter by status if provided', async () => {
      mockPrismaService.call_transcription.findMany.mockResolvedValue([]);
      mockPrismaService.call_transcription.count.mockResolvedValue(0);

      await service.listTranscriptions('tenant-123', 1, 20, 'completed');

      expect(
        mockPrismaService.call_transcription.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: 'tenant-123',
            status: 'completed',
          },
        }),
      );
    });
  });

  describe('getStatistics', () => {
    it('should return transcription statistics', async () => {
      const groupByResults = [
        { status: 'completed', _count: { id: 10 } },
        { status: 'failed', _count: { id: 2 } },
      ];

      const aggregateResults = {
        _sum: { processing_duration_seconds: 1000 },
        _avg: {
          processing_duration_seconds: 100,
          confidence_score: 0.95,
        },
      };

      mockPrismaService.call_transcription.groupBy.mockResolvedValue(
        groupByResults,
      );
      mockPrismaService.call_transcription.aggregate.mockResolvedValue(
        aggregateResults,
      );

      const result = await service.getStatistics('tenant-123');

      expect(result.byStatus).toEqual({
        completed: 10,
        failed: 2,
      });
      expect(result.processing.totalSeconds).toBe(1000);
      expect(result.processing.averageSeconds).toBe(100);
      expect(result.processing.averageConfidence).toBe(0.95);
    });
  });

  describe('retryTranscription', () => {
    it('should re-queue failed transcription', async () => {
      const transcription = {
        id: 'trans-123',
        tenant_id: 'tenant-123',
        call_record_id: 'call-123',
        status: 'failed',
        call_record: {
          id: 'call-123',
        },
      };

      mockPrismaService.call_transcription.findFirst.mockResolvedValue(
        transcription,
      );
      mockPrismaService.call_transcription.update.mockResolvedValue({
        id: 'trans-123',
        status: 'queued',
      });
      mockQueue.add.mockResolvedValue({ id: 'job-456' });

      const result = await service.retryTranscription(
        'trans-123',
        'tenant-123',
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('queued');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-transcription',
        expect.objectContaining({
          transcriptionId: 'trans-123',
        }),
        expect.objectContaining({
          priority: 5, // Higher priority for retries
        }),
      );
    });

    it('should throw NotFoundException if transcription not found', async () => {
      mockPrismaService.call_transcription.findFirst.mockResolvedValue(null);

      await expect(
        service.retryTranscription('invalid-id', 'tenant-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
