import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { DateTimeConverterService } from './datetime-converter.service';
import { GoogleCalendarSyncService } from '../../calendar-integration/services/google-calendar-sync.service';
import { LeadActivitiesService } from '../../leads/services/lead-activities.service';
import { AppointmentReminderService } from './appointment-reminder.service';
import { NotificationsService } from '../../communication/services/notifications.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;
  let auditLogger: AuditLoggerService;
  let dateTimeConverter: DateTimeConverterService;
  let googleCalendarSync: GoogleCalendarSyncService;
  let leadActivitiesService: LeadActivitiesService;
  let appointmentReminderService: AppointmentReminderService;
  let notificationsService: NotificationsService;

  const mockPrisma = {
    tenant: {
      findUnique: jest.fn(),
    },
    appointment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
    },
    appointment_type: {
      findFirst: jest.fn(),
    },
    service_request: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  const mockAuditLogger = {
    log: jest.fn(),
    logTenantChange: jest.fn(),
  };

  const mockDateTimeConverter = {
    localToUtc: jest.fn(),
    utcToLocal: jest.fn(),
    calculateEndTime: jest.fn(),
    calculateAppointmentUtcRange: jest.fn(),
    isValidTimezone: jest.fn(),
  };

  const mockGoogleCalendarSync = {
    queueCreateEvent: jest.fn(),
    queueUpdateEvent: jest.fn(),
    queueDeleteEvent: jest.fn(),
  };

  const mockLeadActivitiesService = {
    logActivity: jest.fn(),
    findAllByLead: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAppointmentReminderService = {
    scheduleReminders: jest.fn(),
    cancelReminders: jest.fn(),
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
    findAllForUser: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
        {
          provide: DateTimeConverterService,
          useValue: mockDateTimeConverter,
        },
        {
          provide: GoogleCalendarSyncService,
          useValue: mockGoogleCalendarSync,
        },
        {
          provide: LeadActivitiesService,
          useValue: mockLeadActivitiesService,
        },
        {
          provide: AppointmentReminderService,
          useValue: mockAppointmentReminderService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
    auditLogger = module.get<AuditLoggerService>(AuditLoggerService);
    dateTimeConverter = module.get<DateTimeConverterService>(
      DateTimeConverterService,
    );
    googleCalendarSync = module.get<GoogleCalendarSyncService>(
      GoogleCalendarSyncService,
    );
    leadActivitiesService = module.get<LeadActivitiesService>(
      LeadActivitiesService,
    );
    appointmentReminderService = module.get<AppointmentReminderService>(
      AppointmentReminderService,
    );
    notificationsService =
      module.get<NotificationsService>(NotificationsService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const createDto = {
      appointment_type_id: 'apt-type-123',
      lead_id: 'lead-123',
      scheduled_date: '2026-03-15',
      start_time: '09:00',
      end_time: '10:00',
      notes: 'Test appointment',
      assigned_user_id: 'user-456',
    };

    const mockTenant = { id: tenantId, timezone: 'America/New_York' };
    const mockLead = {
      id: 'lead-123',
      tenant_id: tenantId,
      first_name: 'John',
      last_name: 'Doe',
    };
    const mockAppointmentType = {
      id: 'apt-type-123',
      tenant_id: tenantId,
      name: 'Quote Visit',
    };
    const mockUser = {
      id: 'user-456',
      tenant_id: tenantId,
      first_name: 'Jane',
      last_name: 'Smith',
    };

    beforeEach(() => {
      // Set up default successful mocks
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      // Mock timezone conversion (2026-03-15 09:00 EST -> 14:00 UTC, 10:00 EST -> 15:00 UTC)
      mockDateTimeConverter.localToUtc.mockImplementation((date, time) => {
        if (time === '09:00') return new Date('2026-03-15T14:00:00.000Z');
        if (time === '10:00') return new Date('2026-03-15T15:00:00.000Z');
        return new Date(`${date}T${time}:00.000Z`);
      });
    });

    it('should create an appointment successfully', async () => {
      const expected = {
        id: 'appt-123',
        ...createDto,
        tenant_id: tenantId,
        status: 'scheduled',
        source: 'manual',
      };
      mockPrisma.appointment.create.mockResolvedValue(expected);

      const result = await service.create(tenantId, userId, createDto);

      expect(result).toEqual(expected);
      expect(mockPrisma.appointment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: tenantId,
          appointment_type_id: createDto.appointment_type_id,
          lead_id: createDto.lead_id,
          scheduled_date: createDto.scheduled_date,
          start_time: createDto.start_time,
          end_time: createDto.end_time,
          notes: createDto.notes,
          assigned_user_id: createDto.assigned_user_id,
          created_by_user_id: userId,
          status: 'scheduled',
          source: 'manual',
        }),
        include: expect.any(Object),
      });
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();
    });

    it('should throw NotFoundException if lead does not exist', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(
        'Lead with ID lead-123 not found or access denied',
      );
    });

    it('should throw NotFoundException if lead belongs to different tenant', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null); // findFirst with tenant_id filter returns null

      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if appointment type does not exist', async () => {
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(
        'Appointment type with ID apt-type-123 not found or access denied',
      );
    });

    it('should validate service_request belongs to lead', async () => {
      const createDtoWithServiceRequest = {
        ...createDto,
        service_request_id: 'sr-123',
      };

      // Service request doesn't belong to the lead
      mockPrisma.service_request.findFirst.mockResolvedValue(null);

      await expect(
        service.create(tenantId, userId, createDtoWithServiceRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(tenantId, userId, createDtoWithServiceRequest),
      ).rejects.toThrow(
        'Service request with ID sr-123 not found or does not belong to lead lead-123',
      );
    });

    it('should accept valid service_request', async () => {
      const createDtoWithServiceRequest = {
        ...createDto,
        service_request_id: 'sr-123',
      };

      const mockServiceRequest = {
        id: 'sr-123',
        tenant_id: tenantId,
        lead_id: 'lead-123',
      };
      mockPrisma.service_request.findFirst.mockResolvedValue(
        mockServiceRequest,
      );

      const expected = {
        id: 'appt-123',
        ...createDtoWithServiceRequest,
        tenant_id: tenantId,
      };
      mockPrisma.appointment.create.mockResolvedValue(expected);

      const result = await service.create(
        tenantId,
        userId,
        createDtoWithServiceRequest,
      );

      expect(result).toEqual(expected);
      expect(mockPrisma.service_request.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'sr-123',
          tenant_id: tenantId,
          lead_id: 'lead-123',
        },
      });
    });

    it('should throw NotFoundException if assigned user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(tenantId, userId, createDto)).rejects.toThrow(
        'User with ID user-456 not found or access denied',
      );
    });

    it('should throw BadRequestException if date is in the past', async () => {
      const pastDto = {
        ...createDto,
        scheduled_date: '2020-01-01', // Past date
      };

      await expect(service.create(tenantId, userId, pastDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(tenantId, userId, pastDto)).rejects.toThrow(
        'Cannot create appointment in the past',
      );
    });

    it('should throw BadRequestException if start_time >= end_time', async () => {
      const invalidTimeDto = {
        ...createDto,
        start_time: '10:00',
        end_time: '09:00',
      };

      await expect(
        service.create(tenantId, userId, invalidTimeDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(tenantId, userId, invalidTimeDto),
      ).rejects.toThrow('Start time must be before end time');
    });

    it('should allow appointment without assigned_user_id', async () => {
      const dtoWithoutAssignedUser = {
        appointment_type_id: 'apt-type-123',
        lead_id: 'lead-123',
        scheduled_date: '2026-03-15',
        start_time: '09:00',
        end_time: '10:00',
      };

      const expected = {
        id: 'appt-123',
        ...dtoWithoutAssignedUser,
        tenant_id: tenantId,
      };
      mockPrisma.appointment.create.mockResolvedValue(expected);

      const result = await service.create(
        tenantId,
        userId,
        dtoWithoutAssignedUser,
      );

      expect(result).toEqual(expected);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    // Sprint 22: Notification Integration Tests
    it('should create notification when appointment is created successfully', async () => {
      const expected = {
        id: 'appt-123',
        ...createDto,
        tenant_id: tenantId,
        status: 'scheduled',
        source: 'manual',
        start_datetime_utc: new Date('2026-03-15T14:00:00.000Z'),
      };
      mockPrisma.appointment.create.mockResolvedValue(expected);

      await service.create(tenantId, userId, createDto);

      // Verify notification was created
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith({
        tenant_id: tenantId,
        user_id: null, // Tenant-wide broadcast
        type: 'appointment_booked',
        title: 'New Appointment Booked',
        message: `New appointment: ${mockAppointmentType.name} with ${mockLead.first_name} ${mockLead.last_name} on ${createDto.scheduled_date} at ${createDto.start_time}`,
        action_url: `/calendar/appointments/${expected.id}`,
        related_entity_type: 'appointment',
        related_entity_id: expected.id,
      });
    });

    it('should not fail appointment creation if notification fails', async () => {
      const expected = {
        id: 'appt-123',
        ...createDto,
        tenant_id: tenantId,
        status: 'scheduled',
        source: 'manual',
      };
      mockPrisma.appointment.create.mockResolvedValue(expected);
      mockNotificationsService.createNotification.mockRejectedValue(
        new Error('Notification service unavailable'),
      );

      // Should not throw - notification failure is gracefully handled
      const result = await service.create(tenantId, userId, createDto);

      expect(result).toEqual(expected);
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const tenantId = 'tenant-123';

    it('should return paginated appointments', async () => {
      const mockItems = [
        { id: 'appt-1', tenant_id: tenantId, scheduled_date: '2026-03-15' },
        { id: 'appt-2', tenant_id: tenantId, scheduled_date: '2026-03-16' },
      ];

      mockPrisma.appointment.findMany.mockResolvedValue(mockItems);
      mockPrisma.appointment.count.mockResolvedValue(2);

      const result = await service.findAll(tenantId, { page: 1, limit: 50 });

      expect(result.items).toEqual(mockItems);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 50,
        total_pages: 1,
      });
    });

    it('should always filter by tenant_id', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.count.mockResolvedValue(0);

      await service.findAll(tenantId, {});

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: tenantId,
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.count.mockResolvedValue(0);

      await service.findAll(tenantId, { status: 'scheduled' });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: tenantId,
            status: 'scheduled',
          }),
        }),
      );
    });

    it('should filter by lead_id', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.count.mockResolvedValue(0);

      await service.findAll(tenantId, { lead_id: 'lead-123' });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: tenantId,
            lead_id: 'lead-123',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.count.mockResolvedValue(0);

      await service.findAll(tenantId, {
        date_from: '2026-03-01',
        date_to: '2026-03-31',
      });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: tenantId,
            scheduled_date: {
              gte: '2026-03-01',
              lte: '2026-03-31',
            },
          }),
        }),
      );
    });

    it('should sort by scheduled_date and start_time by default', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.count.mockResolvedValue(0);

      await service.findAll(tenantId, {});

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ scheduled_date: 'asc' }, { start_time: 'asc' }],
        }),
      );
    });

    it('should respect max limit of 100 per page', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.count.mockResolvedValue(0);

      await service.findAll(tenantId, { limit: 500 });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Max limit enforced
        }),
      );
    });
  });

  describe('findOne', () => {
    const tenantId = 'tenant-123';
    const id = 'appt-123';

    it('should return an appointment', async () => {
      const expected = {
        id,
        tenant_id: tenantId,
        scheduled_date: '2026-03-15',
      };
      mockPrisma.appointment.findFirst.mockResolvedValue(expected);

      const result = await service.findOne(tenantId, id);

      expect(result).toEqual(expected);
      expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { id, tenant_id: tenantId },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if appointment does not exist', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(service.findOne(tenantId, id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(tenantId, id)).rejects.toThrow(
        'Appointment with ID appt-123 not found or access denied',
      );
    });

    it('should enforce tenant_id isolation', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await service.findOne(tenantId, id).catch(() => {});

      expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { id, tenant_id: tenantId },
        include: expect.any(Object),
      });
    });
  });

  // Sprint 17: Integration tests for lead activity logging and service_request status updates
  describe('create - Sprint 17 Integrations', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const createDto = {
      appointment_type_id: 'apt-type-123',
      lead_id: 'lead-123',
      scheduled_date: '2026-03-15',
      start_time: '09:00',
      end_time: '10:00',
      notes: 'Test appointment',
    };

    const mockTenant = { id: tenantId, timezone: 'America/New_York' };
    const mockLead = {
      id: 'lead-123',
      tenant_id: tenantId,
      first_name: 'John',
      last_name: 'Doe',
    };
    const mockAppointmentType = {
      id: 'apt-type-123',
      tenant_id: tenantId,
      name: 'Quote Visit',
      slot_duration_minutes: 60,
    };

    beforeEach(() => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );
      mockDateTimeConverter.localToUtc.mockImplementation((date, time) => {
        return new Date(`${date}T${time}:00.000Z`);
      });
      mockPrisma.service_request.update.mockResolvedValue({});
      mockGoogleCalendarSync.queueCreateEvent.mockResolvedValue(undefined);
      mockLeadActivitiesService.logActivity.mockResolvedValue({});
    });

    it('should log lead activity when appointment is created', async () => {
      const expected = {
        id: 'appt-123',
        ...createDto,
        tenant_id: tenantId,
        status: 'scheduled',
        source: 'manual',
        lead_id: createDto.lead_id,
        appointment_type: mockAppointmentType,
      };
      mockPrisma.appointment.create.mockResolvedValue(expected);

      await service.create(tenantId, userId, createDto);

      expect(mockLeadActivitiesService.logActivity).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          lead_id: createDto.lead_id,
          activity_type: 'appointment_scheduled',
          description: expect.stringContaining('Appointment scheduled'),
          user_id: userId,
        }),
      );
    });

    it('should update service_request status when linked', async () => {
      const createDtoWithServiceRequest = {
        ...createDto,
        service_request_id: 'sr-123',
      };

      const mockServiceRequest = {
        id: 'sr-123',
        tenant_id: tenantId,
        lead_id: createDto.lead_id,
      };

      const expected = {
        id: 'appt-123',
        ...createDtoWithServiceRequest,
        tenant_id: tenantId,
        status: 'scheduled',
        source: 'manual',
        lead_id: createDto.lead_id,
        appointment_type: mockAppointmentType,
      };

      mockPrisma.service_request.findFirst.mockResolvedValue(
        mockServiceRequest,
      );
      mockPrisma.appointment.create.mockResolvedValue(expected);

      await service.create(tenantId, userId, createDtoWithServiceRequest);

      expect(mockPrisma.service_request.update).toHaveBeenCalledWith({
        where: { id: 'sr-123' },
        data: { status: 'scheduled_visit' },
      });
    });

    it('should not update service_request when not linked', async () => {
      const expected = {
        id: 'appt-123',
        ...createDto,
        tenant_id: tenantId,
        status: 'scheduled',
        source: 'manual',
        lead_id: createDto.lead_id,
        service_request_id: null,
        appointment_type: mockAppointmentType,
      };

      mockPrisma.appointment.create.mockResolvedValue(expected);

      await service.create(tenantId, userId, createDto);

      expect(mockPrisma.service_request.update).not.toHaveBeenCalled();
    });

    it('should queue Google Calendar sync', async () => {
      const expected = {
        id: 'appt-123',
        ...createDto,
        tenant_id: tenantId,
        status: 'scheduled',
        source: 'manual',
        lead_id: createDto.lead_id,
        appointment_type: mockAppointmentType,
      };

      mockPrisma.appointment.create.mockResolvedValue(expected);

      await service.create(tenantId, userId, createDto);

      expect(mockGoogleCalendarSync.queueCreateEvent).toHaveBeenCalledWith(
        'appt-123',
      );
    });
  });

  describe('update', () => {
    const tenantId = 'tenant-123';
    const appointmentId = 'appt-123';
    const userId = 'user-123';
    const updateDto = {
      notes: 'Updated notes',
      assigned_user_id: 'user-456',
    };

    const mockExistingAppointment = {
      id: appointmentId,
      tenant_id: tenantId,
      notes: 'Old notes',
      assigned_user_id: 'user-789',
    };

    beforeEach(() => {
      mockPrisma.appointment.findFirst.mockResolvedValue(
        mockExistingAppointment,
      );
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-456',
        tenant_id: tenantId,
      });
    });

    it('should update appointment successfully', async () => {
      const expected = {
        ...mockExistingAppointment,
        ...updateDto,
      };
      mockPrisma.appointment.update.mockResolvedValue(expected);

      const result = await service.update(
        tenantId,
        appointmentId,
        userId,
        updateDto,
      );

      expect(result).toEqual(expected);
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: appointmentId },
        data: {
          notes: updateDto.notes,
          assigned_user_id: updateDto.assigned_user_id,
        },
        include: expect.any(Object),
      });
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();
    });

    it('should throw NotFoundException if appointment does not exist', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.update(tenantId, appointmentId, userId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if assigned user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update(tenantId, appointmentId, userId, updateDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(tenantId, appointmentId, userId, updateDto),
      ).rejects.toThrow('User with ID user-456 not found or access denied');
    });

    it('should allow updating only notes', async () => {
      const notesOnlyDto = { notes: 'New notes only' };
      const expected = {
        ...mockExistingAppointment,
        notes: 'New notes only',
      };
      mockPrisma.appointment.update.mockResolvedValue(expected);

      const result = await service.update(
        tenantId,
        appointmentId,
        userId,
        notesOnlyDto,
      );

      expect(result).toEqual(expected);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('should enforce tenant_id isolation', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await service
        .update(tenantId, appointmentId, userId, updateDto)
        .catch(() => {});

      expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: appointmentId,
            tenant_id: tenantId,
          }),
        }),
      );
    });
  });
});
