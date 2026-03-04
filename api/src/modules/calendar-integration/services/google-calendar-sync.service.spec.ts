import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { CalendarProviderConnectionService } from './calendar-provider-connection.service';
import { CalendarSyncLogService } from './calendar-sync-log.service';

describe('GoogleCalendarSyncService', () => {
  let service: GoogleCalendarSyncService;
  let prisma: PrismaService;
  let googleCalendar: GoogleCalendarService;
  let connectionService: CalendarProviderConnectionService;
  let syncLog: CalendarSyncLogService;
  let mockQueue: any;

  const mockAppointment = {
    id: 'appt-1',
    tenant_id: 'tenant-1',
    appointment_type_id: 'type-1',
    lead_id: 'lead-1',
    service_request_id: 'sr-1',
    scheduled_date: '2026-03-10',
    start_time: '09:00',
    end_time: '10:30',
    start_datetime_utc: new Date('2026-03-10T14:00:00Z'),
    end_datetime_utc: new Date('2026-03-10T15:30:00Z'),
    status: 'scheduled',
    source: 'manual',
    external_calendar_event_id: null,
    tenant: {
      timezone: 'America/New_York',
    },
    appointment_type: {
      name: 'Quote Visit',
    },
    lead: {
      first_name: 'John',
      last_name: 'Smith',
      phone: '+1234567890',
      email: 'john@example.com',
    },
    service_request: {
      service_name: 'Exterior Painting',
      description: '2-story house',
      lead_address: {
        address_line1: '123 Main St',
        city: 'Boston',
        state: 'MA',
        zip_code: '02101',
      },
    },
    notes: 'Customer prefers morning appointments',
  };

  const getMockConnection = () => ({
    id: 'conn-1',
    tenantId: 'tenant-1',
    providerType: 'google_calendar',
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    connectedCalendarId: 'primary',
    connectedCalendarName: 'Primary',
    syncStatus: 'active',
    lastSyncToken: null,
  });

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleCalendarSyncService,
        {
          provide: getQueueToken('calendar-sync'),
          useValue: mockQueue,
        },
        {
          provide: PrismaService,
          useValue: {
            appointment: {
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            calendar_external_block: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
        {
          provide: GoogleCalendarService,
          useValue: {
            createEvent: jest.fn(),
            updateEvent: jest.fn(),
            deleteEvent: jest.fn(),
            refreshAccessToken: jest.fn(),
            listEventsIncremental: jest.fn(),
          },
        },
        {
          provide: CalendarProviderConnectionService,
          useValue: {
            getActiveConnection: jest.fn(),
            needsTokenRefresh: jest.fn(),
            updateAccessToken: jest.fn(),
            updateSyncStatus: jest.fn(),
            updateLastSync: jest.fn(),
          },
        },
        {
          provide: CalendarSyncLogService,
          useValue: {
            logSync: jest.fn().mockResolvedValue({ id: 'log-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<GoogleCalendarSyncService>(GoogleCalendarSyncService);
    prisma = module.get<PrismaService>(PrismaService);
    googleCalendar = module.get<GoogleCalendarService>(GoogleCalendarService);
    connectionService = module.get<CalendarProviderConnectionService>(
      CalendarProviderConnectionService,
    );
    syncLog = module.get<CalendarSyncLogService>(CalendarSyncLogService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queueCreateEvent', () => {
    it('should queue a create event job', async () => {
      await service.queueCreateEvent('appt-1');

      expect(mockQueue.add).toHaveBeenCalledWith('sync-create-event', {
        appointmentId: 'appt-1',
      });
    });
  });

  describe('queueUpdateEvent', () => {
    it('should queue an update event job', async () => {
      await service.queueUpdateEvent('appt-2');

      expect(mockQueue.add).toHaveBeenCalledWith('sync-update-event', {
        appointmentId: 'appt-2',
      });
    });
  });

  describe('queueDeleteEvent', () => {
    it('should queue a delete event job', async () => {
      await service.queueDeleteEvent('appt-3', 'gcal-event-123');

      expect(mockQueue.add).toHaveBeenCalledWith('sync-delete-event', {
        appointmentId: 'appt-3',
        externalEventId: 'gcal-event-123',
      });
    });
  });

  describe('processCreateEvent', () => {
    it('should create Google Calendar event successfully', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);
      (googleCalendar.createEvent as jest.Mock).mockResolvedValue({
        eventId: 'gcal-event-123',
        htmlLink: 'https://calendar.google.com/event?eid=abc',
      });
      (prisma.appointment.update as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        external_calendar_event_id: 'gcal-event-123',
      });

      const result = await service.processCreateEvent('appt-1');

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('gcal-event-123');

      // Verify event was created with correct mapping
      expect(googleCalendar.createEvent).toHaveBeenCalledWith(
        'access-token-123',
        'primary',
        expect.objectContaining({
          summary: 'Quote Visit — John Smith',
          location: '123 Main St, Boston, MA 02101',
          description: expect.stringContaining('Phone: +1234567890'),
        }),
      );

      // Verify external_calendar_event_id was stored
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { external_calendar_event_id: 'gcal-event-123' },
      });

      // Verify success was logged
      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'event_created',
          status: 'success',
          externalEventId: 'gcal-event-123',
        }),
      );
    });

    it('should refresh token if needed before creating event', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(true);
      (googleCalendar.refreshAccessToken as jest.Mock).mockResolvedValue({
        accessToken: 'new-access-token',
        expiryDate: new Date(Date.now() + 3600 * 1000),
      });
      (googleCalendar.createEvent as jest.Mock).mockResolvedValue({
        eventId: 'gcal-event-456',
        htmlLink: 'https://calendar.google.com/event?eid=def',
      });
      (prisma.appointment.update as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        external_calendar_event_id: 'gcal-event-456',
      });

      const result = await service.processCreateEvent('appt-1');

      expect(result.success).toBe(true);
      expect(googleCalendar.refreshAccessToken).toHaveBeenCalledWith(
        'refresh-token-123',
      );
      expect(connectionService.updateAccessToken).toHaveBeenCalledWith(
        'conn-1',
        'new-access-token',
        expect.any(Date),
      );
      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_refreshed',
          status: 'success',
        }),
      );
    });

    it('should skip sync if no active connection', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(null);

      const result = await service.processCreateEvent('appt-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active calendar connection');
      expect(googleCalendar.createEvent).not.toHaveBeenCalled();
      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'event_created',
          status: 'skipped',
          errorMessage: 'No active calendar connection',
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);
      (googleCalendar.createEvent as jest.Mock).mockRejectedValue(
        new Error('Network timeout'),
      );

      const result = await service.processCreateEvent('appt-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'event_created',
          status: 'failed',
          errorMessage: 'Network timeout',
        }),
      );
    });

    it('should map appointment without location if no address', async () => {
      const appointmentWithoutAddress = {
        ...mockAppointment,
        service_request: {
          service_name: 'Exterior Painting',
          description: '2-story house',
          lead_address: null,
        },
      };

      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        appointmentWithoutAddress,
      );
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);
      (googleCalendar.createEvent as jest.Mock).mockResolvedValue({
        eventId: 'gcal-event-789',
        htmlLink: 'https://calendar.google.com/event?eid=ghi',
      });
      (prisma.appointment.update as jest.Mock).mockResolvedValue({
        ...appointmentWithoutAddress,
        external_calendar_event_id: 'gcal-event-789',
      });

      const result = await service.processCreateEvent('appt-1');

      expect(result.success).toBe(true);
      expect(googleCalendar.createEvent).toHaveBeenCalledWith(
        'access-token-123',
        'primary',
        expect.objectContaining({
          summary: 'Quote Visit — John Smith',
          location: undefined,
        }),
      );
    });
  });

  describe('processUpdateEvent', () => {
    it('should update Google Calendar event successfully', async () => {
      const appointmentWithEvent = {
        ...mockAppointment,
        external_calendar_event_id: 'gcal-event-123',
      };

      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        appointmentWithEvent,
      );
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);
      (googleCalendar.updateEvent as jest.Mock).mockResolvedValue({
        eventId: 'gcal-event-123',
        htmlLink: 'https://calendar.google.com/event?eid=abc',
      });

      const result = await service.processUpdateEvent('appt-1');

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('gcal-event-123');

      expect(googleCalendar.updateEvent).toHaveBeenCalledWith(
        'access-token-123',
        'primary',
        'gcal-event-123',
        expect.objectContaining({
          summary: 'Quote Visit — John Smith',
        }),
      );

      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'event_updated',
          status: 'success',
        }),
      );
    });

    it('should throw error if appointment has no external_calendar_event_id', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        mockAppointment,
      );

      const result = await service.processUpdateEvent('appt-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('no external_calendar_event_id');
      expect(googleCalendar.updateEvent).not.toHaveBeenCalled();
    });
  });

  describe('processDeleteEvent', () => {
    it('should delete Google Calendar event successfully', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        tenant_id: 'tenant-1',
      });
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);
      (googleCalendar.deleteEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.processDeleteEvent('appt-1', 'gcal-event-123');

      expect(result.success).toBe(true);

      expect(googleCalendar.deleteEvent).toHaveBeenCalledWith(
        'access-token-123',
        'primary',
        'gcal-event-123',
      );

      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'event_deleted',
          status: 'success',
          externalEventId: 'gcal-event-123',
        }),
      );
    });

    it('should skip delete if no active connection', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        tenant_id: 'tenant-1',
      });
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(null);

      const result = await service.processDeleteEvent('appt-1', 'gcal-event-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active calendar connection');
      expect(googleCalendar.deleteEvent).not.toHaveBeenCalled();
    });
  });

  describe('processIncrementalSync (Sprint 13B)', () => {
    const mockGoogleEvents = [
      {
        id: 'external-event-1',
        status: 'confirmed',
        start: { dateTime: '2026-03-10T10:00:00-05:00' },
        end: { dateTime: '2026-03-10T11:00:00-05:00' },
      },
      {
        id: 'external-event-2',
        status: 'confirmed',
        start: { dateTime: '2026-03-11T14:00:00-05:00' },
        end: { dateTime: '2026-03-11T15:00:00-05:00' },
      },
    ];

    it('should process incremental sync and create external blocks', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);
      (googleCalendar.listEventsIncremental as jest.Mock).mockResolvedValue({
        events: mockGoogleEvents,
        nextSyncToken: 'sync-token-new-123',
      });

      // No Lead360 appointments
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);

      // No existing external blocks (all new)
      (prisma.calendar_external_block.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.calendar_external_block.create as jest.Mock).mockResolvedValue({
        id: 'block-1',
      });

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(2);
      expect(result.blocksCreated).toBe(2);
      expect(result.blocksUpdated).toBe(0);
      expect(result.blocksDeleted).toBe(0);

      // Verify Google Calendar API was called
      expect(googleCalendar.listEventsIncremental).toHaveBeenCalledWith(
        'access-token-123',
        'primary',
        undefined, // lastSyncToken is null, which becomes undefined
        expect.any(Date),
        expect.any(Date),
      );

      // Verify external blocks were created
      expect(prisma.calendar_external_block.create).toHaveBeenCalledTimes(2);
      expect(prisma.calendar_external_block.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: 'tenant-1',
            connection_id: 'conn-1',
            external_event_id: 'external-event-1',
            source: 'google_calendar',
            is_all_day: false,
          }),
        }),
      );

      // Verify last sync was updated
      expect(connectionService.updateLastSync).toHaveBeenCalledWith(
        'conn-1',
        'sync-token-new-123',
      );

      // Verify success was logged
      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'full_sync',
          status: 'success',
          metadata: expect.objectContaining({
            eventsProcessed: 2,
            blocksCreated: 2,
            blocksUpdated: 0,
            blocksDeleted: 0,
          }),
        }),
      );
    });

    it('should update existing external blocks when event times change', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);
      (googleCalendar.listEventsIncremental as jest.Mock).mockResolvedValue({
        events: [mockGoogleEvents[0]],
        nextSyncToken: 'sync-token-new-456',
      });
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);

      // Existing block found
      (prisma.calendar_external_block.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-block-1',
        external_event_id: 'external-event-1',
      });
      (prisma.calendar_external_block.update as jest.Mock).mockResolvedValue({
        id: 'existing-block-1',
      });

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(1);
      expect(result.blocksCreated).toBe(0);
      expect(result.blocksUpdated).toBe(1);
      expect(result.blocksDeleted).toBe(0);

      // Verify block was updated
      expect(prisma.calendar_external_block.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id_external_event_id: {
              tenant_id: 'tenant-1',
              external_event_id: 'external-event-1',
            },
          },
          data: expect.objectContaining({
            start_datetime_utc: expect.any(Date),
            end_datetime_utc: expect.any(Date),
            is_all_day: false,
          }),
        }),
      );
    });

    it('should delete external blocks for cancelled events', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);

      const cancelledEvent = {
        id: 'cancelled-event-1',
        status: 'cancelled',
        start: { dateTime: '2026-03-10T10:00:00-05:00' },
        end: { dateTime: '2026-03-10T11:00:00-05:00' },
      };

      (googleCalendar.listEventsIncremental as jest.Mock).mockResolvedValue({
        events: [cancelledEvent],
        nextSyncToken: 'sync-token-new-789',
      });
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.calendar_external_block.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(1);
      expect(result.blocksCreated).toBe(0);
      expect(result.blocksUpdated).toBe(0);
      expect(result.blocksDeleted).toBe(1);

      // Verify block was deleted
      expect(prisma.calendar_external_block.deleteMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          external_event_id: 'cancelled-event-1',
        },
      });
    });

    it('should exclude Lead360-created events from external blocks', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);

      const lead360Event = {
        id: 'lead360-event-123',
        status: 'confirmed',
        start: { dateTime: '2026-03-10T10:00:00-05:00' },
        end: { dateTime: '2026-03-10T11:00:00-05:00' },
      };

      (googleCalendar.listEventsIncremental as jest.Mock).mockResolvedValue({
        events: [lead360Event, mockGoogleEvents[0]],
        nextSyncToken: 'sync-token-new-999',
      });

      // Mock appointment with external_calendar_event_id matching lead360Event
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
        {
          external_calendar_event_id: 'lead360-event-123',
        },
      ]);

      (prisma.calendar_external_block.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.calendar_external_block.create as jest.Mock).mockResolvedValue({
        id: 'block-2',
      });

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(2);
      expect(result.blocksCreated).toBe(1); // Only external event, not Lead360 event
      expect(result.blocksUpdated).toBe(0);
      expect(result.blocksDeleted).toBe(0);

      // Verify only external event block was created
      expect(prisma.calendar_external_block.create).toHaveBeenCalledTimes(1);
      expect(prisma.calendar_external_block.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            external_event_id: 'external-event-1',
          }),
        }),
      );
    });

    it('should handle all-day events correctly', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);

      const allDayEvent = {
        id: 'all-day-event-1',
        status: 'confirmed',
        start: { date: '2026-03-10' },
        end: { date: '2026-03-11' },
      };

      (googleCalendar.listEventsIncremental as jest.Mock).mockResolvedValue({
        events: [allDayEvent],
        nextSyncToken: 'sync-token-all-day',
      });
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.calendar_external_block.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.calendar_external_block.create as jest.Mock).mockResolvedValue({
        id: 'block-all-day',
      });

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(true);
      expect(result.blocksCreated).toBe(1);

      // Verify all-day block was created with is_all_day = true
      expect(prisma.calendar_external_block.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            external_event_id: 'all-day-event-1',
            is_all_day: true,
          }),
        }),
      );
    });

    it('should refresh access token if needed before syncing', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(true);
      (googleCalendar.refreshAccessToken as jest.Mock).mockResolvedValue({
        accessToken: 'new-access-token-sync',
        expiryDate: new Date(Date.now() + 3600 * 1000),
      });
      (googleCalendar.listEventsIncremental as jest.Mock).mockResolvedValue({
        events: [],
        nextSyncToken: 'sync-token-refreshed',
      });
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(true);

      // Verify token was refreshed
      expect(googleCalendar.refreshAccessToken).toHaveBeenCalledWith(
        'refresh-token-123',
      );
      expect(connectionService.updateAccessToken).toHaveBeenCalledWith(
        'conn-1',
        'new-access-token-sync',
        expect.any(Date),
      );
      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_refreshed',
          status: 'success',
        }),
      );
    });

    it('should skip events without valid start/end time', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);

      const invalidEvent = {
        id: 'invalid-event-1',
        status: 'confirmed',
        // Missing start/end
      };

      (googleCalendar.listEventsIncremental as jest.Mock).mockResolvedValue({
        events: [invalidEvent, mockGoogleEvents[0]],
        nextSyncToken: 'sync-token-invalid',
      });
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.calendar_external_block.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (prisma.calendar_external_block.create as jest.Mock).mockResolvedValue({
        id: 'block-valid',
      });

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(true);
      expect(result.eventsProcessed).toBe(2);
      expect(result.blocksCreated).toBe(1); // Only valid event processed

      // Verify only one block was created (invalid event skipped)
      expect(prisma.calendar_external_block.create).toHaveBeenCalledTimes(1);
    });

    it('should handle no active connection error', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(null);

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active calendar connection');
      expect(result.eventsProcessed).toBe(0);
      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'full_sync',
          status: 'failed',
        }),
      );
    });

    it('should handle Google API errors gracefully', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);
      (googleCalendar.listEventsIncremental as jest.Mock).mockRejectedValue(
        new Error('Google API rate limit exceeded'),
      );

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Google API rate limit exceeded');
      expect(result.eventsProcessed).toBe(0);

      // Verify error was logged
      expect(syncLog.logSync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'full_sync',
          status: 'failed',
          errorMessage: 'Google API rate limit exceeded',
        }),
      );
    });

    it('should mark connection as disconnected on token refresh failure', async () => {
      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        getMockConnection(),
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(true);
      (googleCalendar.refreshAccessToken as jest.Mock).mockRejectedValue(
        new Error('Failed to refresh access token - user revoked access'),
      );

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('refresh');

      // Verify connection was marked as disconnected
      expect(connectionService.updateSyncStatus).toHaveBeenCalledWith(
        'conn-1',
        'disconnected',
        'Token refresh failed - user may have revoked access',
      );
    });

    it('should use existing sync token for incremental sync', async () => {
      const connectionWithSyncToken = {
        ...getMockConnection(),
        lastSyncToken: 'previous-sync-token-123',
      };

      (connectionService.getActiveConnection as jest.Mock).mockResolvedValue(
        connectionWithSyncToken,
      );
      (connectionService.needsTokenRefresh as jest.Mock).mockReturnValue(false);
      (googleCalendar.listEventsIncremental as jest.Mock).mockResolvedValue({
        events: [],
        nextSyncToken: 'new-sync-token-456',
      });
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.processIncrementalSync(
        'tenant-1',
        'conn-1',
      );

      expect(result.success).toBe(true);

      // Verify sync token was passed to Google API
      expect(googleCalendar.listEventsIncremental).toHaveBeenCalledWith(
        'access-token-123',
        'primary',
        'previous-sync-token-123', // Using existing sync token
        expect.any(Date),
        expect.any(Date),
      );

      // Verify new sync token was saved
      expect(connectionService.updateLastSync).toHaveBeenCalledWith(
        'conn-1',
        'new-sync-token-456',
      );
    });
  });
});
