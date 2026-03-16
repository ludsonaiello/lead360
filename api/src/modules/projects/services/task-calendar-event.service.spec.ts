import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskCalendarEventService } from './task-calendar-event.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { GoogleCalendarService } from '../../calendar-integration/services/google-calendar.service';
import { CalendarProviderConnectionService } from '../../calendar-integration/services/calendar-provider-connection.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-uuid-aaa';
const TENANT_B = 'tenant-uuid-bbb';
const PROJECT_ID = 'project-uuid-001';
const TASK_ID = 'task-uuid-001';
const USER_ID = 'user-uuid-001';
const EVENT_ID = 'event-uuid-001';
const GOOGLE_EVENT_ID = 'google-cal-evt-123';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const mockTask = (overrides: any = {}) => ({
  id: TASK_ID,
  tenant_id: TENANT_A,
  project_id: PROJECT_ID,
  title: 'Install Drywall',
  deleted_at: null,
  ...overrides,
});

const mockCalendarEvent = (overrides: any = {}) => ({
  id: EVENT_ID,
  tenant_id: TENANT_A,
  task_id: TASK_ID,
  project_id: PROJECT_ID,
  title: 'Roof Installation - Day 1',
  description: 'Start roof tear-off',
  start_datetime: new Date('2026-04-05T08:00:00.000Z'),
  end_datetime: new Date('2026-04-05T17:00:00.000Z'),
  google_event_id: null,
  internal_calendar_id: null,
  sync_status: 'local_only',
  created_by_user_id: USER_ID,
  created_at: new Date('2026-03-15T10:00:00.000Z'),
  updated_at: new Date('2026-03-15T10:00:00.000Z'),
  ...overrides,
});

const mockSyncedEvent = (overrides: any = {}) =>
  mockCalendarEvent({
    google_event_id: GOOGLE_EVENT_ID,
    sync_status: 'synced',
    ...overrides,
  });

const mockActiveConnection = (overrides: any = {}) => ({
  id: 'connection-uuid-001',
  tenantId: TENANT_A,
  providerType: 'google',
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
  connectedCalendarId: 'primary',
  connectedCalendarName: 'Primary Calendar',
  syncStatus: 'active',
  isActive: true,
  ...overrides,
});

const validCreateDto = {
  title: 'Roof Installation - Day 1',
  description: 'Start roof tear-off',
  start_datetime: '2026-04-05T08:00:00.000Z',
  end_datetime: '2026-04-05T17:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Mock Services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  project_task: {
    findFirst: jest.fn(),
  },
  task_calendar_event: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn().mockResolvedValue(undefined),
};

const mockGoogleCalendarService = {
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
};

const mockCalendarProviderConnectionService = {
  getActiveConnection: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaskCalendarEventService', () => {
  let service: TaskCalendarEventService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskCalendarEventService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        {
          provide: GoogleCalendarService,
          useValue: mockGoogleCalendarService,
        },
        {
          provide: CalendarProviderConnectionService,
          useValue: mockCalendarProviderConnectionService,
        },
      ],
    }).compile();

    service = module.get<TaskCalendarEventService>(TaskCalendarEventService);
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // createEvent()
  // -----------------------------------------------------------------------

  describe('createEvent()', () => {
    it('should create an event with local_only status when no Google connection', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        null,
      );
      const created = mockCalendarEvent();
      mockPrismaService.task_calendar_event.create.mockResolvedValue(created);

      const result = await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        validCreateDto,
      );

      expect(result.id).toBe(EVENT_ID);
      expect(result.title).toBe('Roof Installation - Day 1');
      expect(result.sync_status).toBe('local_only');
      expect(result.google_event_id).toBeNull();
      expect(result.task_id).toBe(TASK_ID);
      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.created_by_user_id).toBe(USER_ID);

      // Verify correct sync_status and google_event_id passed to prisma.create
      expect(mockPrismaService.task_calendar_event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sync_status: 'local_only',
          google_event_id: null,
        }),
      });
    });

    it('should create event with synced status when Google connection exists', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        mockActiveConnection(),
      );
      mockGoogleCalendarService.createEvent.mockResolvedValue({
        eventId: GOOGLE_EVENT_ID,
        htmlLink: '',
      });
      const created = mockSyncedEvent();
      mockPrismaService.task_calendar_event.create.mockResolvedValue(created);

      const result = await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        validCreateDto,
      );

      expect(result.sync_status).toBe('synced');
      expect(result.google_event_id).toBe(GOOGLE_EVENT_ID);
      expect(mockGoogleCalendarService.createEvent).toHaveBeenCalledWith(
        'mock-access-token',
        'primary',
        expect.objectContaining({
          summary: 'Roof Installation - Day 1',
          description: 'Start roof tear-off',
        }),
      );

      // Verify correct sync_status and google_event_id passed to prisma.create
      expect(mockPrismaService.task_calendar_event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sync_status: 'synced',
          google_event_id: GOOGLE_EVENT_ID,
        }),
      });
    });

    it('should create event with failed status when Google sync fails', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        mockActiveConnection(),
      );
      mockGoogleCalendarService.createEvent.mockRejectedValue(
        new Error('Google API error'),
      );
      const created = mockCalendarEvent({ sync_status: 'failed' });
      mockPrismaService.task_calendar_event.create.mockResolvedValue(created);

      const result = await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        validCreateDto,
      );

      // Event is still created — sync failure does NOT block creation
      expect(result.id).toBe(EVENT_ID);
      expect(result.sync_status).toBe('failed');

      // Verify correct sync_status and null google_event_id passed to prisma.create
      expect(mockPrismaService.task_calendar_event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sync_status: 'failed',
          google_event_id: null,
        }),
      });
    });

    it('should throw BadRequestException when end_datetime <= start_datetime', async () => {
      await expect(
        service.createEvent(TENANT_A, PROJECT_ID, TASK_ID, USER_ID, {
          title: 'Test',
          start_datetime: '2026-04-05T17:00:00.000Z',
          end_datetime: '2026-04-05T08:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when end_datetime equals start_datetime', async () => {
      await expect(
        service.createEvent(TENANT_A, PROJECT_ID, TASK_ID, USER_ID, {
          title: 'Test',
          start_datetime: '2026-04-05T08:00:00.000Z',
          end_datetime: '2026-04-05T08:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.createEvent(
          TENANT_A,
          PROJECT_ID,
          TASK_ID,
          USER_ID,
          validCreateDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should trim title and description before storing', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        null,
      );
      mockPrismaService.task_calendar_event.create.mockResolvedValue(
        mockCalendarEvent(),
      );

      await service.createEvent(TENANT_A, PROJECT_ID, TASK_ID, USER_ID, {
        title: '  Roof Installation  ',
        description: '  Start tear-off  ',
        start_datetime: '2026-04-05T08:00:00.000Z',
        end_datetime: '2026-04-05T17:00:00.000Z',
      });

      expect(mockPrismaService.task_calendar_event.create).toHaveBeenCalledWith(
        {
          data: expect.objectContaining({
            title: 'Roof Installation',
            description: 'Start tear-off',
          }),
        },
      );
    });

    it('should store tenant_id, task_id, and project_id in event record', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        null,
      );
      mockPrismaService.task_calendar_event.create.mockResolvedValue(
        mockCalendarEvent(),
      );

      await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        validCreateDto,
      );

      expect(mockPrismaService.task_calendar_event.create).toHaveBeenCalledWith(
        {
          data: expect.objectContaining({
            tenant_id: TENANT_A,
            task_id: TASK_ID,
            project_id: PROJECT_ID,
            created_by_user_id: USER_ID,
          }),
        },
      );
    });

    it('should set internal_calendar_id to null (Phase 1)', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        null,
      );
      mockPrismaService.task_calendar_event.create.mockResolvedValue(
        mockCalendarEvent(),
      );

      await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        validCreateDto,
      );

      expect(mockPrismaService.task_calendar_event.create).toHaveBeenCalledWith(
        {
          data: expect.objectContaining({
            internal_calendar_id: null,
          }),
        },
      );
    });

    it('should create audit log on creation', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        null,
      );
      mockPrismaService.task_calendar_event.create.mockResolvedValue(
        mockCalendarEvent(),
      );

      await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        validCreateDto,
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'task_calendar_event',
          entityId: EVENT_ID,
          tenantId: TENANT_A,
          actorUserId: USER_ID,
          description: expect.stringContaining('Created calendar event'),
        }),
      );
    });

    it('should handle null description gracefully', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        null,
      );
      mockPrismaService.task_calendar_event.create.mockResolvedValue(
        mockCalendarEvent({ description: null }),
      );

      const result = await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        {
          title: 'No description event',
          start_datetime: '2026-04-05T08:00:00.000Z',
          end_datetime: '2026-04-05T17:00:00.000Z',
        },
      );

      expect(result.description).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // listTaskEvents()
  // -----------------------------------------------------------------------

  describe('listTaskEvents()', () => {
    it('should return all events for a task ordered by start_datetime', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      const events = [
        mockCalendarEvent({
          id: 'evt-1',
          start_datetime: new Date('2026-04-05T08:00:00Z'),
        }),
        mockCalendarEvent({
          id: 'evt-2',
          start_datetime: new Date('2026-04-06T08:00:00Z'),
        }),
      ];
      mockPrismaService.task_calendar_event.findMany.mockResolvedValue(events);

      const result = await service.listTaskEvents(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('evt-1');
      expect(result.data[1].id).toBe('evt-2');
    });

    it('should return empty data array when task has no events', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrismaService.task_calendar_event.findMany.mockResolvedValue([]);

      const result = await service.listTaskEvents(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
      );

      expect(result.data).toEqual([]);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.listTaskEvents(TENANT_A, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter by tenant_id in the query', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrismaService.task_calendar_event.findMany.mockResolvedValue([]);

      await service.listTaskEvents(TENANT_A, PROJECT_ID, TASK_ID);

      expect(
        mockPrismaService.task_calendar_event.findMany,
      ).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          task_id: TASK_ID,
        },
        orderBy: { start_datetime: 'asc' },
      });
    });

    it('should return correct response shape for each event', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrismaService.task_calendar_event.findMany.mockResolvedValue([
        mockCalendarEvent(),
      ]);

      const result = await service.listTaskEvents(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
      );

      const event = result.data[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('task_id');
      expect(event).toHaveProperty('project_id');
      expect(event).toHaveProperty('title');
      expect(event).toHaveProperty('description');
      expect(event).toHaveProperty('start_datetime');
      expect(event).toHaveProperty('end_datetime');
      expect(event).toHaveProperty('google_event_id');
      expect(event).toHaveProperty('sync_status');
      expect(event).toHaveProperty('created_by_user_id');
      expect(event).toHaveProperty('created_at');
      // Should NOT expose internal_calendar_id or updated_at
      expect(event).not.toHaveProperty('internal_calendar_id');
      expect(event).not.toHaveProperty('updated_at');
      expect(event).not.toHaveProperty('tenant_id');
    });
  });

  // -----------------------------------------------------------------------
  // updateEvent()
  // -----------------------------------------------------------------------

  describe('updateEvent()', () => {
    it('should update event title locally', async () => {
      const existing = mockCalendarEvent();
      const updated = mockCalendarEvent({ title: 'Updated Title' });
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.task_calendar_event.update.mockResolvedValue(updated);

      const result = await service.updateEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
        { title: 'Updated Title' },
      );

      expect(result.title).toBe('Updated Title');
      expect(mockPrismaService.task_calendar_event.update).toHaveBeenCalledWith(
        {
          where: { id: EVENT_ID },
          data: { title: 'Updated Title' },
        },
      );
    });

    it('should attempt Google Calendar update when google_event_id exists', async () => {
      const existing = mockSyncedEvent();
      const updated = mockSyncedEvent({ title: 'Updated' });
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.task_calendar_event.update.mockResolvedValue(updated);
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        mockActiveConnection(),
      );
      mockGoogleCalendarService.updateEvent.mockResolvedValue({
        eventId: GOOGLE_EVENT_ID,
        htmlLink: '',
      });

      await service.updateEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
        { title: 'Updated' },
      );

      expect(mockGoogleCalendarService.updateEvent).toHaveBeenCalledWith(
        'mock-access-token',
        'primary',
        GOOGLE_EVENT_ID,
        expect.objectContaining({ summary: 'Updated' }),
      );
    });

    it('should NOT call Google Calendar update when google_event_id is null', async () => {
      const existing = mockCalendarEvent(); // no google_event_id
      const updated = mockCalendarEvent({ title: 'Updated' });
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.task_calendar_event.update.mockResolvedValue(updated);

      await service.updateEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
        { title: 'Updated' },
      );

      expect(mockGoogleCalendarService.updateEvent).not.toHaveBeenCalled();
    });

    it('should succeed locally even when Google update fails', async () => {
      const existing = mockSyncedEvent();
      const updated = mockSyncedEvent({ title: 'Updated' });
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.task_calendar_event.update.mockResolvedValue(updated);
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        mockActiveConnection(),
      );
      mockGoogleCalendarService.updateEvent.mockRejectedValue(
        new Error('Google API error'),
      );

      // Should NOT throw — local update succeeds regardless
      const result = await service.updateEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
        { title: 'Updated' },
      );

      expect(result.title).toBe('Updated');
    });

    it('should throw NotFoundException when event does not exist', async () => {
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEvent(
          TENANT_A,
          PROJECT_ID,
          TASK_ID,
          EVENT_ID,
          USER_ID,
          { title: 'Updated' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updated dates are invalid', async () => {
      const existing = mockCalendarEvent();
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        existing,
      );

      await expect(
        service.updateEvent(
          TENANT_A,
          PROJECT_ID,
          TASK_ID,
          EVENT_ID,
          USER_ID,
          {
            start_datetime: '2026-04-05T17:00:00.000Z',
            end_datetime: '2026-04-05T08:00:00.000Z',
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate combined dates when only one date is updated', async () => {
      // existing: 08:00 - 17:00. Updating start to 18:00 → 18:00 > 17:00 = invalid
      const existing = mockCalendarEvent({
        start_datetime: new Date('2026-04-05T08:00:00Z'),
        end_datetime: new Date('2026-04-05T17:00:00Z'),
      });
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        existing,
      );

      await expect(
        service.updateEvent(
          TENANT_A,
          PROJECT_ID,
          TASK_ID,
          EVENT_ID,
          USER_ID,
          { start_datetime: '2026-04-05T18:00:00.000Z' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create audit log on update', async () => {
      const existing = mockCalendarEvent();
      const updated = mockCalendarEvent({ title: 'New Title' });
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.task_calendar_event.update.mockResolvedValue(updated);

      await service.updateEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
        { title: 'New Title' },
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'task_calendar_event',
          entityId: EVENT_ID,
          tenantId: TENANT_A,
          actorUserId: USER_ID,
          description: expect.stringContaining('Updated calendar event'),
        }),
      );
    });

    it('should trim title on update', async () => {
      const existing = mockCalendarEvent();
      const updated = mockCalendarEvent({ title: 'Trimmed Title' });
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.task_calendar_event.update.mockResolvedValue(updated);

      await service.updateEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
        { title: '  Trimmed Title  ' },
      );

      expect(mockPrismaService.task_calendar_event.update).toHaveBeenCalledWith(
        {
          where: { id: EVENT_ID },
          data: expect.objectContaining({ title: 'Trimmed Title' }),
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // deleteEvent()
  // -----------------------------------------------------------------------

  describe('deleteEvent()', () => {
    it('should delete event record', async () => {
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        mockCalendarEvent(),
      );
      mockPrismaService.task_calendar_event.delete.mockResolvedValue(
        mockCalendarEvent(),
      );

      await service.deleteEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
      );

      expect(mockPrismaService.task_calendar_event.delete).toHaveBeenCalledWith(
        {
          where: { id: EVENT_ID },
        },
      );
    });

    it('should attempt Google Calendar delete when google_event_id exists', async () => {
      const synced = mockSyncedEvent();
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(synced);
      mockPrismaService.task_calendar_event.delete.mockResolvedValue(synced);
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        mockActiveConnection(),
      );
      mockGoogleCalendarService.deleteEvent.mockResolvedValue(undefined);

      await service.deleteEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
      );

      expect(mockGoogleCalendarService.deleteEvent).toHaveBeenCalledWith(
        'mock-access-token',
        'primary',
        GOOGLE_EVENT_ID,
      );
    });

    it('should NOT attempt Google Calendar delete when google_event_id is null', async () => {
      const local = mockCalendarEvent(); // no google_event_id
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(local);
      mockPrismaService.task_calendar_event.delete.mockResolvedValue(local);

      await service.deleteEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
      );

      expect(mockGoogleCalendarService.deleteEvent).not.toHaveBeenCalled();
    });

    it('should proceed with local deletion even when Google delete fails', async () => {
      const synced = mockSyncedEvent();
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(synced);
      mockPrismaService.task_calendar_event.delete.mockResolvedValue(synced);
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        mockActiveConnection(),
      );
      mockGoogleCalendarService.deleteEvent.mockRejectedValue(
        new Error('Google API error'),
      );

      // Should NOT throw — local deletion proceeds
      await service.deleteEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
      );

      expect(mockPrismaService.task_calendar_event.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when event does not exist', async () => {
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteEvent(
          TENANT_A,
          PROJECT_ID,
          TASK_ID,
          EVENT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log on deletion', async () => {
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(
        mockCalendarEvent(),
      );
      mockPrismaService.task_calendar_event.delete.mockResolvedValue(
        mockCalendarEvent(),
      );

      await service.deleteEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        EVENT_ID,
        USER_ID,
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'task_calendar_event',
          entityId: EVENT_ID,
          tenantId: TENANT_A,
          actorUserId: USER_ID,
          description: expect.stringContaining('Deleted calendar event'),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Tenant Isolation
  // -----------------------------------------------------------------------

  describe('Tenant Isolation', () => {
    it('createEvent: verifies task belongs to tenant', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.createEvent(
          TENANT_B,
          PROJECT_ID,
          TASK_ID,
          USER_ID,
          validCreateDto,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project_task.findFirst).toHaveBeenCalledWith({
        where: {
          id: TASK_ID,
          project_id: PROJECT_ID,
          tenant_id: TENANT_B,
          deleted_at: null,
        },
        select: { id: true, title: true },
      });
    });

    it('listTaskEvents: filters by tenant_id', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(
        mockTask({ tenant_id: TENANT_B }),
      );
      mockPrismaService.task_calendar_event.findMany.mockResolvedValue([]);

      await service.listTaskEvents(TENANT_B, PROJECT_ID, TASK_ID);

      expect(
        mockPrismaService.task_calendar_event.findMany,
      ).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_B,
          task_id: TASK_ID,
        },
        orderBy: { start_datetime: 'asc' },
      });
    });

    it('updateEvent: verifies event belongs to tenant', async () => {
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEvent(
          TENANT_B,
          PROJECT_ID,
          TASK_ID,
          EVENT_ID,
          USER_ID,
          { title: 'Updated' },
        ),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.task_calendar_event.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: EVENT_ID,
          tenant_id: TENANT_B,
          task_id: TASK_ID,
          project_id: PROJECT_ID,
        },
      });
    });

    it('deleteEvent: verifies event belongs to tenant', async () => {
      mockPrismaService.task_calendar_event.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteEvent(
          TENANT_B,
          PROJECT_ID,
          TASK_ID,
          EVENT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.task_calendar_event.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: EVENT_ID,
          tenant_id: TENANT_B,
          task_id: TASK_ID,
          project_id: PROJECT_ID,
        },
      });
    });

    it('createEvent: tenant B cannot create events on tenant A tasks', async () => {
      // Task belongs to TENANT_A, but we pass TENANT_B
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.createEvent(
          TENANT_B,
          PROJECT_ID,
          TASK_ID,
          USER_ID,
          validCreateDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // Business Rules
  // -----------------------------------------------------------------------

  describe('Business Rules', () => {
    it('should allow multiple events per task', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        null,
      );

      // Create first event
      mockPrismaService.task_calendar_event.create.mockResolvedValue(
        mockCalendarEvent({ id: 'evt-1' }),
      );
      const result1 = await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        validCreateDto,
      );

      // Create second event
      mockPrismaService.task_calendar_event.create.mockResolvedValue(
        mockCalendarEvent({
          id: 'evt-2',
          title: 'Day 2',
          start_datetime: new Date('2026-04-06T08:00:00Z'),
        }),
      );
      const result2 = await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        {
          title: 'Day 2',
          start_datetime: '2026-04-06T08:00:00.000Z',
          end_datetime: '2026-04-06T17:00:00.000Z',
        },
      );

      expect(result1.id).toBe('evt-1');
      expect(result2.id).toBe('evt-2');
      expect(mockPrismaService.task_calendar_event.create).toHaveBeenCalledTimes(
        2,
      );
    });

    it('Google Calendar sync is best-effort — creation never blocked', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockCalendarProviderConnectionService.getActiveConnection.mockResolvedValue(
        mockActiveConnection(),
      );
      mockGoogleCalendarService.createEvent.mockRejectedValue(
        new Error('Network timeout'),
      );
      mockPrismaService.task_calendar_event.create.mockResolvedValue(
        mockCalendarEvent({ sync_status: 'failed' }),
      );

      // Should NOT throw
      const result = await service.createEvent(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        validCreateDto,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(EVENT_ID);
    });
  });
});
