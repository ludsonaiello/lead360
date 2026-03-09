import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { GoogleCalendarSyncProcessor } from './google-calendar-sync.processor';
import { GoogleCalendarSyncService } from '../services/google-calendar-sync.service';

describe('GoogleCalendarSyncProcessor', () => {
  let processor: GoogleCalendarSyncProcessor;
  let syncService: GoogleCalendarSyncService;

  const mockSyncService = {
    processCreateEvent: jest.fn(),
    processUpdateEvent: jest.fn(),
    processDeleteEvent: jest.fn(),
    processIncrementalSync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleCalendarSyncProcessor,
        {
          provide: GoogleCalendarSyncService,
          useValue: mockSyncService,
        },
      ],
    }).compile();

    processor = module.get<GoogleCalendarSyncProcessor>(
      GoogleCalendarSyncProcessor,
    );
    syncService = module.get<GoogleCalendarSyncService>(
      GoogleCalendarSyncService,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process - sync-create-event', () => {
    it('should process sync-create-event job successfully', async () => {
      const job = {
        id: 'job-1',
        name: 'sync-create-event',
        data: { appointmentId: 'appt-1' },
      } as Job;

      mockSyncService.processCreateEvent.mockResolvedValue({
        success: true,
        eventId: 'gcal-event-123',
      });

      const result = await processor.process(job);

      expect(syncService.processCreateEvent).toHaveBeenCalledWith('appt-1');
      expect(result.success).toBe(true);
      expect(result.eventId).toBe('gcal-event-123');
    });

    it('should handle create event failure gracefully', async () => {
      const job = {
        id: 'job-2',
        name: 'sync-create-event',
        data: { appointmentId: 'appt-2' },
      } as Job;

      mockSyncService.processCreateEvent.mockResolvedValue({
        success: false,
        error: 'No active calendar connection',
      });

      const result = await processor.process(job);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('No active calendar connection');
    });

    it('should throw error if appointmentId is missing', async () => {
      const job = {
        id: 'job-3',
        name: 'sync-create-event',
        data: {},
      } as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Missing appointmentId in job data',
      );
    });
  });

  describe('process - sync-update-event', () => {
    it('should process sync-update-event job successfully', async () => {
      const job = {
        id: 'job-4',
        name: 'sync-update-event',
        data: { appointmentId: 'appt-3' },
      } as Job;

      mockSyncService.processUpdateEvent.mockResolvedValue({
        success: true,
        eventId: 'gcal-event-456',
      });

      const result = await processor.process(job);

      expect(syncService.processUpdateEvent).toHaveBeenCalledWith('appt-3');
      expect(result.success).toBe(true);
      expect(result.eventId).toBe('gcal-event-456');
    });

    it('should handle update event failure gracefully', async () => {
      const job = {
        id: 'job-5',
        name: 'sync-update-event',
        data: { appointmentId: 'appt-4' },
      } as Job;

      mockSyncService.processUpdateEvent.mockResolvedValue({
        success: false,
        error: 'Appointment has no external_calendar_event_id',
      });

      const result = await processor.process(job);

      expect(result.success).toBe(false);
      expect(result.reason).toBe(
        'Appointment has no external_calendar_event_id',
      );
    });
  });

  describe('process - sync-delete-event', () => {
    it('should process sync-delete-event job successfully', async () => {
      const job = {
        id: 'job-6',
        name: 'sync-delete-event',
        data: {
          appointmentId: 'appt-5',
          externalEventId: 'gcal-event-789',
        },
      } as Job;

      mockSyncService.processDeleteEvent.mockResolvedValue({
        success: true,
      });

      const result = await processor.process(job);

      expect(syncService.processDeleteEvent).toHaveBeenCalledWith(
        'appt-5',
        'gcal-event-789',
      );
      expect(result.success).toBe(true);
      expect(result.eventId).toBe('gcal-event-789');
    });

    it('should handle delete event failure gracefully', async () => {
      const job = {
        id: 'job-7',
        name: 'sync-delete-event',
        data: {
          appointmentId: 'appt-6',
          externalEventId: 'gcal-event-999',
        },
      } as Job;

      mockSyncService.processDeleteEvent.mockResolvedValue({
        success: false,
        error: 'Network timeout',
      });

      const result = await processor.process(job);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Network timeout');
    });

    it('should throw error if appointmentId or externalEventId is missing', async () => {
      const job1 = {
        id: 'job-8',
        name: 'sync-delete-event',
        data: { appointmentId: 'appt-7' }, // missing externalEventId
      } as Job;

      await expect(processor.process(job1)).rejects.toThrow(
        'Missing appointmentId or externalEventId in job data',
      );

      const job2 = {
        id: 'job-9',
        name: 'sync-delete-event',
        data: { externalEventId: 'gcal-event-111' }, // missing appointmentId
      } as Job;

      await expect(processor.process(job2)).rejects.toThrow(
        'Missing appointmentId or externalEventId in job data',
      );
    });
  });

  describe('process - incremental-sync (Sprint 13B)', () => {
    it('should process incremental-sync job successfully', async () => {
      const job = {
        id: 'job-sync-1',
        name: 'incremental-sync',
        data: {
          tenantId: 'tenant-1',
          connectionId: 'conn-1',
          trigger: 'webhook',
        },
      } as Job;

      mockSyncService.processIncrementalSync.mockResolvedValue({
        success: true,
        eventsProcessed: 5,
        blocksCreated: 3,
        blocksUpdated: 1,
        blocksDeleted: 1,
      });

      const result = await processor.process(job);

      expect(syncService.processIncrementalSync).toHaveBeenCalledWith(
        'tenant-1',
        'conn-1',
      );
      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(5);
      expect(result.blocksCreated).toBe(3);
      expect(result.blocksUpdated).toBe(1);
      expect(result.blocksDeleted).toBe(1);
    });

    it('should handle incremental sync triggered by webhook', async () => {
      const job = {
        id: 'job-sync-2',
        name: 'incremental-sync',
        data: {
          tenantId: 'tenant-2',
          connectionId: 'conn-2',
          trigger: 'webhook',
        },
      } as Job;

      mockSyncService.processIncrementalSync.mockResolvedValue({
        success: true,
        eventsProcessed: 2,
        blocksCreated: 2,
        blocksUpdated: 0,
        blocksDeleted: 0,
      });

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(2);
    });

    it('should handle incremental sync triggered manually', async () => {
      const job = {
        id: 'job-sync-3',
        name: 'incremental-sync',
        data: {
          tenantId: 'tenant-3',
          connectionId: 'conn-3',
          trigger: 'manual',
        },
      } as Job;

      mockSyncService.processIncrementalSync.mockResolvedValue({
        success: true,
        eventsProcessed: 0,
        blocksCreated: 0,
        blocksUpdated: 0,
        blocksDeleted: 0,
      });

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(0);
    });

    it('should handle incremental sync failure gracefully', async () => {
      const job = {
        id: 'job-sync-4',
        name: 'incremental-sync',
        data: {
          tenantId: 'tenant-4',
          connectionId: 'conn-4',
          trigger: 'webhook',
        },
      } as Job;

      mockSyncService.processIncrementalSync.mockResolvedValue({
        success: false,
        eventsProcessed: 0,
        blocksCreated: 0,
        blocksUpdated: 0,
        blocksDeleted: 0,
        error: 'No active calendar connection',
      });

      const result = await processor.process(job);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('No active calendar connection');
    });

    it('should handle Google API errors during incremental sync', async () => {
      const job = {
        id: 'job-sync-5',
        name: 'incremental-sync',
        data: {
          tenantId: 'tenant-5',
          connectionId: 'conn-5',
          trigger: 'webhook',
        },
      } as Job;

      mockSyncService.processIncrementalSync.mockResolvedValue({
        success: false,
        eventsProcessed: 0,
        blocksCreated: 0,
        blocksUpdated: 0,
        blocksDeleted: 0,
        error: 'Google API rate limit exceeded',
      });

      const result = await processor.process(job);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Google API rate limit exceeded');
    });

    it('should throw error if tenantId is missing', async () => {
      const job = {
        id: 'job-sync-6',
        name: 'incremental-sync',
        data: {
          connectionId: 'conn-6',
          trigger: 'webhook',
        }, // missing tenantId
      } as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Missing tenantId or connectionId in job data',
      );
    });

    it('should throw error if connectionId is missing', async () => {
      const job = {
        id: 'job-sync-7',
        name: 'incremental-sync',
        data: {
          tenantId: 'tenant-7',
          trigger: 'webhook',
        }, // missing connectionId
      } as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Missing tenantId or connectionId in job data',
      );
    });

    it('should throw error if sync service throws', async () => {
      const job = {
        id: 'job-sync-8',
        name: 'incremental-sync',
        data: {
          tenantId: 'tenant-8',
          connectionId: 'conn-8',
          trigger: 'webhook',
        },
      } as Job;

      mockSyncService.processIncrementalSync.mockRejectedValue(
        new Error('Database connection lost'),
      );

      await expect(processor.process(job)).rejects.toThrow(
        'Database connection lost',
      );
    });

    it('should process incremental sync with all block operations', async () => {
      const job = {
        id: 'job-sync-9',
        name: 'incremental-sync',
        data: {
          tenantId: 'tenant-9',
          connectionId: 'conn-9',
          trigger: 'webhook',
        },
      } as Job;

      // Simulate a sync with creates, updates, and deletes
      mockSyncService.processIncrementalSync.mockResolvedValue({
        success: true,
        eventsProcessed: 10,
        blocksCreated: 5,
        blocksUpdated: 3,
        blocksDeleted: 2,
      });

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(10);
      expect(result.blocksCreated).toBe(5);
      expect(result.blocksUpdated).toBe(3);
      expect(result.blocksDeleted).toBe(2);
    });
  });

  describe('process - unknown job name', () => {
    it('should return error for unknown job name', async () => {
      const job = {
        id: 'job-10',
        name: 'unknown-job',
        data: {},
      } as Job;

      const result = await processor.process(job);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Unknown job name');
    });
  });

  describe('process - error handling', () => {
    it('should throw error if sync service throws', async () => {
      const job = {
        id: 'job-11',
        name: 'sync-create-event',
        data: { appointmentId: 'appt-8' },
      } as Job;

      mockSyncService.processCreateEvent.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(processor.process(job)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
