import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AppointmentReminderService } from './appointment-reminder.service';

describe('AppointmentReminderService', () => {
  let service: AppointmentReminderService;
  let mockQueue: any;

  beforeEach(async () => {
    // Mock BullMQ Queue
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentReminderService,
        {
          provide: getQueueToken('calendar-reminders'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<AppointmentReminderService>(
      AppointmentReminderService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduleReminders', () => {
    const appointmentId = 'appt-123';
    const tenantId = 'tenant-123';
    const scheduledDate = '2026-12-31';
    const startTime = '14:00';
    const leadId = 'lead-123';
    const appointmentTypeName = 'Initial Consultation';

    it('should schedule both 24h and 1h reminders for future appointment', async () => {
      // Set appointment start time 48 hours in the future
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await service.scheduleReminders(
        appointmentId,
        tenantId,
        futureDate,
        scheduledDate,
        startTime,
        leadId,
        appointmentTypeName,
      );

      // Should queue 2 jobs (24h and 1h)
      expect(mockQueue.add).toHaveBeenCalledTimes(2);

      // Check 24h reminder job
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-reminder',
        expect.objectContaining({
          tenant_id: tenantId,
          appointment_id: appointmentId,
          scheduled_date: scheduledDate,
          start_time: startTime,
          lead_id: leadId,
          appointment_type_name: appointmentTypeName,
          reminder_type: '24h',
        }),
        expect.objectContaining({
          jobId: `${appointmentId}-24h`,
          delay: expect.any(Number),
          removeOnComplete: true,
          removeOnFail: false,
        }),
      );

      // Check 1h reminder job
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-reminder',
        expect.objectContaining({
          tenant_id: tenantId,
          appointment_id: appointmentId,
          reminder_type: '1h',
        }),
        expect.objectContaining({
          jobId: `${appointmentId}-1h`,
          delay: expect.any(Number),
        }),
      );
    });

    it('should skip 24h reminder if appointment is less than 24 hours away', async () => {
      // Set appointment start time 2 hours in the future
      const nearFutureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

      await service.scheduleReminders(
        appointmentId,
        tenantId,
        nearFutureDate,
        scheduledDate,
        startTime,
        leadId,
        appointmentTypeName,
      );

      // Should only queue 1h reminder
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-reminder',
        expect.objectContaining({
          reminder_type: '1h',
        }),
        expect.any(Object),
      );
    });

    it('should skip both reminders if appointment is in the past', async () => {
      // Set appointment start time 1 hour in the past
      const pastDate = new Date(Date.now() - 1 * 60 * 60 * 1000);

      await service.scheduleReminders(
        appointmentId,
        tenantId,
        pastDate,
        scheduledDate,
        startTime,
        leadId,
        appointmentTypeName,
      );

      // Should not queue any jobs
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should calculate correct delay for 24h reminder', async () => {
      // Set appointment start time exactly 48 hours in the future
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await service.scheduleReminders(
        appointmentId,
        tenantId,
        futureDate,
        scheduledDate,
        startTime,
        leadId,
        appointmentTypeName,
      );

      // Get the delay for the 24h reminder
      const call24h = mockQueue.add.mock.calls.find(
        (call) => call[1].reminder_type === '24h',
      );

      expect(call24h).toBeDefined();
      const delay24h = call24h[2].delay;

      // Delay should be approximately 24 hours (allow 1 minute tolerance)
      const expected24h = 24 * 60 * 60 * 1000;
      expect(delay24h).toBeGreaterThan(expected24h - 60000);
      expect(delay24h).toBeLessThan(expected24h + 60000);
    });
  });

  describe('cancelReminders', () => {
    const appointmentId = 'appt-123';

    it('should cancel both 24h and 1h reminder jobs', async () => {
      const mockJob24h = { remove: jest.fn() };
      const mockJob1h = { remove: jest.fn() };

      mockQueue.getJob
        .mockResolvedValueOnce(mockJob24h) // First call for 24h
        .mockResolvedValueOnce(mockJob1h); // Second call for 1h

      await service.cancelReminders(appointmentId);

      expect(mockQueue.getJob).toHaveBeenCalledTimes(2);
      expect(mockQueue.getJob).toHaveBeenCalledWith(`${appointmentId}-24h`);
      expect(mockQueue.getJob).toHaveBeenCalledWith(`${appointmentId}-1h`);

      expect(mockJob24h.remove).toHaveBeenCalled();
      expect(mockJob1h.remove).toHaveBeenCalled();
    });

    it('should handle case when no jobs exist', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      // Should not throw error
      await expect(
        service.cancelReminders(appointmentId),
      ).resolves.not.toThrow();

      expect(mockQueue.getJob).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      mockQueue.getJob.mockRejectedValue(new Error('Queue error'));

      // Should not throw error
      await expect(
        service.cancelReminders(appointmentId),
      ).resolves.not.toThrow();
    });

    it('should cancel only existing jobs', async () => {
      const mockJob24h = { remove: jest.fn() };

      mockQueue.getJob
        .mockResolvedValueOnce(mockJob24h) // 24h job exists
        .mockResolvedValueOnce(null); // 1h job does not exist

      await service.cancelReminders(appointmentId);

      expect(mockJob24h.remove).toHaveBeenCalled();
      expect(mockQueue.getJob).toHaveBeenCalledTimes(2);
    });
  });
});
