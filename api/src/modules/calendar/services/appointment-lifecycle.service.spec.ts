import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppointmentLifecycleService } from './appointment-lifecycle.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { DateTimeConverterService } from './datetime-converter.service';
import { GoogleCalendarSyncService } from '../../calendar-integration/services/google-calendar-sync.service';
import { LeadActivitiesService } from '../../leads/services/lead-activities.service';
import { AppointmentReminderService } from './appointment-reminder.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import {
  AppointmentStatus,
  CancellationReason,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  CompleteAppointmentDto,
  NoShowAppointmentDto,
  ConfirmAppointmentDto,
} from '../dto';

describe('AppointmentLifecycleService - Sprint 06', () => {
  let service: AppointmentLifecycleService;
  let prisma: PrismaService;
  let auditLogger: AuditLoggerService;
  let dateTimeConverter: DateTimeConverterService;
  let googleCalendarSync: GoogleCalendarSyncService;
  let leadActivitiesService: LeadActivitiesService;
  let appointmentReminderService: AppointmentReminderService;
  let notificationsService: NotificationsService;

  const mockPrisma = {
    appointment: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    appointment_type: {
      findFirst: jest.fn(),
    },
    service_request: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAuditLogger = {
    log: jest.fn(),
    logTenantChange: jest.fn(),
  };

  const mockDateTimeConverter = {
    localToUtc: jest.fn(),
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

  const tenantId = 'tenant-123';
  const userId = 'user-123';
  const appointmentId = 'appt-123';

  const mockAppointment = {
    id: appointmentId,
    tenant_id: tenantId,
    appointment_type_id: 'type-123',
    lead_id: 'lead-123',
    service_request_id: 'sr-123',
    scheduled_date: '2026-03-15',
    start_time: '09:00',
    end_time: '10:00',
    start_datetime_utc: new Date('2026-03-15T14:00:00Z'),
    end_datetime_utc: new Date('2026-03-15T15:00:00Z'),
    status: AppointmentStatus.SCHEDULED,
    notes: 'Test appointment',
    source: 'manual',
    created_at: new Date(),
    updated_at: new Date(),
    appointment_type: {
      id: 'type-123',
      name: 'Quote Visit',
      slot_duration_minutes: 60,
    },
    lead: {
      first_name: 'John',
      last_name: 'Doe',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentLifecycleService,
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

    service = module.get<AppointmentLifecycleService>(
      AppointmentLifecycleService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    auditLogger = module.get<AuditLoggerService>(AuditLoggerService);
    dateTimeConverter = module.get<DateTimeConverterService>(
      DateTimeConverterService,
    );
    googleCalendarSync = module.get<GoogleCalendarSyncService>(GoogleCalendarSyncService);
    leadActivitiesService = module.get<LeadActivitiesService>(LeadActivitiesService);
    appointmentReminderService = module.get<AppointmentReminderService>(AppointmentReminderService);
    notificationsService = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // CONFIRM APPOINTMENT TESTS
  // ============================================

  describe('confirmAppointment', () => {
    const dto: ConfirmAppointmentDto = {
      notes: 'Confirmed via phone',
    };

    it('should confirm a scheduled appointment', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await service.confirmAppointment(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: appointmentId },
          data: expect.objectContaining({
            status: AppointmentStatus.CONFIRMED,
          }),
        }),
      );
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();
    });

    it('should throw NotFoundException if appointment not found', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmAppointment(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if appointment is already completed (terminal state)', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.COMPLETED,
      });

      await expect(
        service.confirmAppointment(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmAppointment(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(/terminal state/);
    });

    it('should throw BadRequestException for already confirmed appointment trying to confirm again', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
      });

      await expect(
        service.confirmAppointment(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // CANCEL APPOINTMENT TESTS
  // ============================================

  describe('cancelAppointment', () => {
    const dto: CancelAppointmentDto = {
      cancellation_reason: CancellationReason.CUSTOMER_CANCELLED,
      cancellation_notes: 'Customer changed plans',
    };

    it('should cancel a scheduled appointment', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      });
      mockPrisma.service_request.update.mockResolvedValue({});

      const result = await service.cancelAppointment(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: appointmentId },
          data: expect.objectContaining({
            status: AppointmentStatus.CANCELLED,
            cancellation_reason: dto.cancellation_reason,
            cancellation_notes: dto.cancellation_notes,
            cancelled_by_user_id: userId,
          }),
        }),
      );
      expect(mockPrisma.service_request.update).toHaveBeenCalledWith({
        where: { id: mockAppointment.service_request_id },
        data: { status: 'new' },
      });
    });

    it('should require cancellation_notes when reason is "other"', async () => {
      const dtoWithOther: CancelAppointmentDto = {
        cancellation_reason: CancellationReason.OTHER,
      };
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);

      await expect(
        service.cancelAppointment(tenantId, appointmentId, userId, dtoWithOther),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelAppointment(tenantId, appointmentId, userId, dtoWithOther),
      ).rejects.toThrow(/cancellation_notes is required/);
    });

    it('should allow cancellation_notes to be optional for non-"other" reasons', async () => {
      const dtoWithoutNotes: CancelAppointmentDto = {
        cancellation_reason: CancellationReason.CUSTOMER_CANCELLED,
      };
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      });
      mockPrisma.service_request.update.mockResolvedValue({});

      const result = await service.cancelAppointment(
        tenantId,
        appointmentId,
        userId,
        dtoWithoutNotes,
      );

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('should throw BadRequestException if appointment is in terminal state', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.RESCHEDULED,
      });

      await expect(
        service.cancelAppointment(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelAppointment(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(/terminal state/);
    });

    // Sprint 22: Notification Integration Tests
    it('should create notification when appointment is cancelled', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      const updatedAppointment = {
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
        appointment_type: mockAppointment.appointment_type,
        lead: mockAppointment.lead,
      };
      mockPrisma.appointment.update.mockResolvedValue(updatedAppointment);
      mockPrisma.service_request.update.mockResolvedValue({});

      await service.cancelAppointment(tenantId, appointmentId, userId, dto);

      // Verify notification was created
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith({
        tenant_id: tenantId,
        user_id: null, // Tenant-wide broadcast
        type: 'appointment_cancelled',
        title: 'Appointment Cancelled',
        message: `Appointment cancelled: ${mockAppointment.appointment_type.name} with ${mockAppointment.lead.first_name} ${mockAppointment.lead.last_name} on ${mockAppointment.scheduled_date} at ${mockAppointment.start_time}. Reason: ${dto.cancellation_reason}`,
        action_url: `/calendar/appointments/${appointmentId}`,
        related_entity_type: 'appointment',
        related_entity_id: appointmentId,
      });
    });

    it('should not fail cancellation if notification fails', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      const updatedAppointment = {
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      };
      mockPrisma.appointment.update.mockResolvedValue(updatedAppointment);
      mockPrisma.service_request.update.mockResolvedValue({});
      mockNotificationsService.createNotification.mockRejectedValue(
        new Error('Notification service unavailable'),
      );

      // Should not throw - notification failure is gracefully handled
      const result = await service.cancelAppointment(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });
  });

  // ============================================
  // RESCHEDULE APPOINTMENT TESTS
  // ============================================

  describe('rescheduleAppointment', () => {
    const dto: RescheduleAppointmentDto = {
      new_scheduled_date: '2026-03-20',
      new_start_time: '10:30',
      reason: 'Customer requested different time',
    };

    const mockTenant = {
      timezone: 'America/New_York',
    };

    const mockAppointmentType = {
      id: 'type-123',
      slot_duration_minutes: 60,
    };

    it('should reschedule appointment and create new one', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );
      mockDateTimeConverter.localToUtc
        .mockReturnValueOnce(new Date('2026-03-20T15:30:00Z')) // start
        .mockReturnValueOnce(new Date('2026-03-20T16:30:00Z')); // end

      const updatedOldAppointment = {
        ...mockAppointment,
        status: AppointmentStatus.RESCHEDULED,
      };
      const newAppointment = {
        id: 'appt-new-456',
        ...mockAppointment,
        scheduled_date: dto.new_scheduled_date,
        start_time: dto.new_start_time,
        end_time: '11:30',
        rescheduled_from_id: appointmentId,
        status: AppointmentStatus.SCHEDULED,
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          appointment: {
            update: jest.fn().mockResolvedValue(updatedOldAppointment),
            create: jest.fn().mockResolvedValue(newAppointment),
          },
        });
      });

      const result = await service.rescheduleAppointment(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.scheduled_date).toBe(dto.new_scheduled_date);
      expect(result.start_time).toBe(dto.new_start_time);
      expect(result.rescheduled_from_id).toBe(appointmentId);
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledTimes(2); // old + new
    });

    it('should throw BadRequestException if new date is in the past', async () => {
      const pastDto: RescheduleAppointmentDto = {
        new_scheduled_date: '2020-01-01',
        new_start_time: '10:00',
      };
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );

      await expect(
        service.rescheduleAppointment(tenantId, appointmentId, userId, pastDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.rescheduleAppointment(tenantId, appointmentId, userId, pastDto),
      ).rejects.toThrow(/past date/);
    });

    it('should calculate correct end_time based on slot_duration_minutes', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.appointment_type.findFirst.mockResolvedValue({
        ...mockAppointmentType,
        slot_duration_minutes: 90, // 1.5 hours
      });
      mockDateTimeConverter.localToUtc
        .mockReturnValueOnce(new Date('2026-03-20T15:30:00Z'))
        .mockReturnValueOnce(new Date('2026-03-20T17:00:00Z'));

      const newAppointment = {
        id: 'appt-new-456',
        ...mockAppointment,
        end_time: '12:00', // 10:30 + 90 minutes = 12:00
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          appointment: {
            update: jest.fn().mockResolvedValue(mockAppointment),
            create: jest.fn().mockResolvedValue(newAppointment),
          },
        });
      });

      const result = await service.rescheduleAppointment(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.end_time).toBe('12:00');
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.rescheduleAppointment(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if appointment type not found', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.appointment_type.findFirst.mockResolvedValue(null);

      await expect(
        service.rescheduleAppointment(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    // Sprint 22: Notification Integration Tests
    it('should create notification when appointment is rescheduled', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );
      mockDateTimeConverter.localToUtc
        .mockReturnValueOnce(new Date('2026-03-20T15:30:00Z'))
        .mockReturnValueOnce(new Date('2026-03-20T16:30:00Z'));

      const newAppointment = {
        id: 'appt-new-456',
        ...mockAppointment,
        scheduled_date: dto.new_scheduled_date,
        start_time: dto.new_start_time,
        end_time: '11:30',
        rescheduled_from_id: appointmentId,
        status: AppointmentStatus.SCHEDULED,
        appointment_type: mockAppointment.appointment_type,
        lead: mockAppointment.lead,
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          appointment: {
            update: jest.fn().mockResolvedValue({
              ...mockAppointment,
              status: AppointmentStatus.RESCHEDULED,
            }),
            create: jest.fn().mockResolvedValue(newAppointment),
          },
        });
      });

      const result = await service.rescheduleAppointment(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      // Verify notification was created
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith({
        tenant_id: tenantId,
        user_id: null, // Tenant-wide broadcast
        type: 'appointment_rescheduled',
        title: 'Appointment Rescheduled',
        message: `Appointment rescheduled: ${mockAppointment.appointment_type.name} with ${mockAppointment.lead.first_name} ${mockAppointment.lead.last_name} from ${mockAppointment.scheduled_date} ${mockAppointment.start_time} to ${dto.new_scheduled_date} ${dto.new_start_time}`,
        action_url: `/calendar/appointments/${result.id}`,
        related_entity_type: 'appointment',
        related_entity_id: result.id,
      });
    });

    it('should not fail reschedule if notification fails', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.appointment_type.findFirst.mockResolvedValue(
        mockAppointmentType,
      );
      mockDateTimeConverter.localToUtc
        .mockReturnValueOnce(new Date('2026-03-20T15:30:00Z'))
        .mockReturnValueOnce(new Date('2026-03-20T16:30:00Z'));

      const newAppointment = {
        id: 'appt-new-456',
        ...mockAppointment,
        scheduled_date: dto.new_scheduled_date,
        start_time: dto.new_start_time,
        end_time: '11:30',
        rescheduled_from_id: appointmentId,
        status: AppointmentStatus.SCHEDULED,
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          appointment: {
            update: jest.fn().mockResolvedValue({
              ...mockAppointment,
              status: AppointmentStatus.RESCHEDULED,
            }),
            create: jest.fn().mockResolvedValue(newAppointment),
          },
        });
      });

      mockNotificationsService.createNotification.mockRejectedValue(
        new Error('Notification service unavailable'),
      );

      // Should not throw - notification failure is gracefully handled
      const result = await service.rescheduleAppointment(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.scheduled_date).toBe(dto.new_scheduled_date);
      expect(mockNotificationsService.createNotification).toHaveBeenCalled();
    });
  });

  // ============================================
  // COMPLETE APPOINTMENT TESTS
  // ============================================

  describe('completeAppointment', () => {
    const dto: CompleteAppointmentDto = {
      completion_notes: 'Quote delivered successfully',
    };

    it('should mark appointment as completed', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.COMPLETED,
      });

      const result = await service.completeAppointment(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.status).toBe(AppointmentStatus.COMPLETED);
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: appointmentId },
          data: expect.objectContaining({
            status: AppointmentStatus.COMPLETED,
          }),
        }),
      );
    });

    it('should allow completing from confirmed status', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
      });
      mockPrisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.COMPLETED,
      });

      const result = await service.completeAppointment(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.status).toBe(AppointmentStatus.COMPLETED);
    });

    it('should throw BadRequestException if appointment is cancelled', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      });

      await expect(
        service.completeAppointment(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // MARK AS NO-SHOW TESTS
  // ============================================

  describe('markAsNoShow', () => {
    const dto: NoShowAppointmentDto = {
      notes: 'Lead did not arrive, called but no answer',
    };

    it('should mark appointment as no-show', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.NO_SHOW,
      });
      mockPrisma.service_request.update.mockResolvedValue({});

      const result = await service.markAsNoShow(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.status).toBe(AppointmentStatus.NO_SHOW);
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: appointmentId },
          data: expect.objectContaining({
            status: AppointmentStatus.NO_SHOW,
            cancellation_reason: CancellationReason.NO_SHOW,
          }),
        }),
      );
      expect(mockPrisma.service_request.update).toHaveBeenCalledWith({
        where: { id: mockAppointment.service_request_id },
        data: { status: 'new' },
      });
    });

    it('should allow marking as no-show from confirmed status', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
      });
      mockPrisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.NO_SHOW,
      });
      mockPrisma.service_request.update.mockResolvedValue({});

      const result = await service.markAsNoShow(
        tenantId,
        appointmentId,
        userId,
        dto,
      );

      expect(result.status).toBe(AppointmentStatus.NO_SHOW);
    });

    it('should throw BadRequestException if appointment is already no-show (terminal state)', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.NO_SHOW,
      });

      await expect(
        service.markAsNoShow(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.markAsNoShow(tenantId, appointmentId, userId, dto),
      ).rejects.toThrow(/terminal state/);
    });
  });

  // ============================================
  // TERMINAL STATE LOCK TESTS
  // ============================================

  describe('Terminal State Locks', () => {
    const confirmDto: ConfirmAppointmentDto = { notes: 'Test' };

    it('should prevent confirming a completed appointment', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.COMPLETED,
      });

      await expect(
        service.confirmAppointment(tenantId, appointmentId, userId, confirmDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmAppointment(tenantId, appointmentId, userId, confirmDto),
      ).rejects.toThrow(/terminal state/);
    });

    it('should prevent cancelling a rescheduled appointment', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.RESCHEDULED,
      });

      await expect(
        service.cancelAppointment(tenantId, appointmentId, userId, {
          cancellation_reason: CancellationReason.CUSTOMER_CANCELLED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent completing a cancelled appointment', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      });

      await expect(
        service.completeAppointment(tenantId, appointmentId, userId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent rescheduling a no-show appointment', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.NO_SHOW,
      });
      mockPrisma.tenant.findUnique.mockResolvedValue({
        timezone: 'America/New_York',
      });

      await expect(
        service.rescheduleAppointment(tenantId, appointmentId, userId, {
          new_scheduled_date: '2026-03-20',
          new_start_time: '10:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // Sprint 17: Integration tests for lead activity logging
  describe('Sprint 17: Lead Activity Logging', () => {
    beforeEach(() => {
      mockLeadActivitiesService.logActivity.mockResolvedValue({});
      mockGoogleCalendarSync.queueUpdateEvent.mockResolvedValue(undefined);
      mockGoogleCalendarSync.queueDeleteEvent.mockResolvedValue(undefined);
    });

    it('should log lead activity when appointment is confirmed', async () => {
      const appointmentWithType = {
        ...mockAppointment,
        appointment_type: { id: 'type-123', name: 'Quote Visit', slot_duration_minutes: 60 },
      };
      mockPrisma.appointment.findFirst.mockResolvedValue(appointmentWithType);
      mockPrisma.appointment.update.mockResolvedValue({
        ...appointmentWithType,
        status: AppointmentStatus.CONFIRMED,
      });

      const confirmDto: ConfirmAppointmentDto = {};
      await service.confirmAppointment(tenantId, appointmentId, userId, confirmDto);

      expect(mockLeadActivitiesService.logActivity).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          lead_id: mockAppointment.lead_id,
          activity_type: 'appointment_confirmed',
          description: expect.stringContaining('Appointment confirmed'),
          user_id: userId,
        }),
      );
    });

    it('should log lead activity when appointment is cancelled', async () => {
      const appointmentWithType = {
        ...mockAppointment,
        appointment_type: { id: 'type-123', name: 'Quote Visit', slot_duration_minutes: 60 },
      };
      mockPrisma.appointment.findFirst.mockResolvedValue(appointmentWithType);
      mockPrisma.appointment.update.mockResolvedValue({
        ...appointmentWithType,
        status: AppointmentStatus.CANCELLED,
      });
      mockPrisma.service_request.update.mockResolvedValue({});

      const cancelDto: CancelAppointmentDto = {
        cancellation_reason: CancellationReason.CUSTOMER_CANCELLED,
      };
      await service.cancelAppointment(tenantId, appointmentId, userId, cancelDto);

      expect(mockLeadActivitiesService.logActivity).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          lead_id: mockAppointment.lead_id,
          activity_type: 'appointment_cancelled',
          description: expect.stringContaining('Appointment cancelled'),
          user_id: userId,
        }),
      );
    });

    it('should log lead activity when appointment is rescheduled', async () => {
      const mockTenant = { id: tenantId, timezone: 'America/New_York' };
      const mockAppointmentType = {
        id: 'type-123',
        name: 'Quote Visit',
        slot_duration_minutes: 60,
        tenant_id: tenantId,
      };

      const appointmentWithType = {
        ...mockAppointment,
        appointment_type: mockAppointmentType,
      };

      mockPrisma.appointment.findFirst.mockResolvedValue(appointmentWithType);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.appointment_type.findFirst.mockResolvedValue(mockAppointmentType);
      mockDateTimeConverter.localToUtc.mockReturnValue(new Date('2026-03-20T15:00:00Z'));

      const newAppointment = {
        ...mockAppointment,
        id: 'new-appt-123',
        scheduled_date: '2026-03-20',
        start_time: '10:00',
        appointment_type: mockAppointmentType,
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          appointment: {
            update: jest.fn().mockResolvedValue({ ...mockAppointment, status: AppointmentStatus.RESCHEDULED }),
            create: jest.fn().mockResolvedValue(newAppointment),
          },
        });
      });

      const rescheduleDto: RescheduleAppointmentDto = {
        new_scheduled_date: '2026-03-20',
        new_start_time: '10:00',
      };

      await service.rescheduleAppointment(tenantId, appointmentId, userId, rescheduleDto);

      expect(mockLeadActivitiesService.logActivity).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          lead_id: mockAppointment.lead_id,
          activity_type: 'appointment_rescheduled',
          description: expect.stringContaining('Appointment rescheduled'),
          user_id: userId,
        }),
      );
    });

    it('should log lead activity when appointment is completed', async () => {
      const appointmentWithType = {
        ...mockAppointment,
        appointment_type: { id: 'type-123', name: 'Quote Visit', slot_duration_minutes: 60 },
      };
      mockPrisma.appointment.findFirst.mockResolvedValue(appointmentWithType);
      mockPrisma.appointment.update.mockResolvedValue({
        ...appointmentWithType,
        status: AppointmentStatus.COMPLETED,
      });

      const completeDto: CompleteAppointmentDto = {};
      await service.completeAppointment(tenantId, appointmentId, userId, completeDto);

      expect(mockLeadActivitiesService.logActivity).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          lead_id: mockAppointment.lead_id,
          activity_type: 'appointment_completed',
          description: expect.stringContaining('Appointment completed'),
          user_id: userId,
        }),
      );
    });

    it('should log lead activity when appointment is marked as no-show', async () => {
      const appointmentWithType = {
        ...mockAppointment,
        appointment_type: { id: 'type-123', name: 'Quote Visit', slot_duration_minutes: 60 },
      };
      mockPrisma.appointment.findFirst.mockResolvedValue(appointmentWithType);
      mockPrisma.appointment.update.mockResolvedValue({
        ...appointmentWithType,
        status: AppointmentStatus.NO_SHOW,
      });
      mockPrisma.service_request.update.mockResolvedValue({});

      const noShowDto: NoShowAppointmentDto = {};
      await service.markAsNoShow(tenantId, appointmentId, userId, noShowDto);

      expect(mockLeadActivitiesService.logActivity).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          lead_id: mockAppointment.lead_id,
          activity_type: 'appointment_no_show',
          description: expect.stringContaining('Appointment no-show'),
          user_id: userId,
        }),
      );
    });
  });
});
