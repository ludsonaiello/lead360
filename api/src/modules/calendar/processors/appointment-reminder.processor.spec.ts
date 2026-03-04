import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentReminderProcessor } from './appointment-reminder.processor';
import { PrismaService } from '../../../core/database/prisma.service';
import { SmsSendingService } from '../../communication/services/sms-sending.service';

describe('AppointmentReminderProcessor', () => {
  let processor: AppointmentReminderProcessor;
  let prismaService: PrismaService;
  let smsSendingService: SmsSendingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentReminderProcessor,
        {
          provide: PrismaService,
          useValue: {
            appointment: {
              findFirst: jest.fn(),
            },
            lead: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: SmsSendingService,
          useValue: {
            sendSms: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<AppointmentReminderProcessor>(
      AppointmentReminderProcessor,
    );
    prismaService = module.get<PrismaService>(PrismaService);
    smsSendingService = module.get<SmsSendingService>(SmsSendingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    const mockJob = {
      id: 'job-123',
      data: {
        tenant_id: 'tenant-123',
        appointment_id: 'appt-123',
        reminder_type: '24h',
        scheduled_date: '2026-12-31',
        start_time: '14:00',
        lead_id: 'lead-123',
        appointment_type_name: 'Initial Consultation',
      },
    } as any;

    const mockAppointment = {
      id: 'appt-123',
      status: 'scheduled',
      scheduled_date: '2026-12-31',
      start_time: '14:00',
      start_datetime_utc: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours in future
    };

    const mockLead = {
      id: 'lead-123',
      first_name: 'John',
      last_name: 'Doe',
      phones: [
        {
          phone: '+15551234567', // Correct field name from lead_phone table
        },
      ],
    };

    it('should send SMS reminder successfully', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (smsSendingService.sendSms as jest.Mock).mockResolvedValue(undefined);

      const result = await processor.process(mockJob);

      expect(result.success).toBe(true);
      expect(result.reminder_type).toBe('24h');
      expect(result.message_sent).toBe(true);

      expect(smsSendingService.sendSms).toHaveBeenCalledWith(
        'tenant-123',
        'system', // User ID for system operations
        expect.objectContaining({
          to_phone: '+15551234567',
          text_body: expect.stringContaining('John Doe'),
          related_entity_type: 'appointment',
          related_entity_id: 'appt-123',
          lead_id: 'lead-123',
        }),
      );
    });

    it('should skip reminder if appointment not found', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await processor.process(mockJob);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('appointment_not_found');
      expect(smsSendingService.sendSms).not.toHaveBeenCalled();
    });

    it('should skip reminder if appointment is cancelled', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        status: 'cancelled',
      });

      const result = await processor.process(mockJob);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('appointment_status_cancelled');
      expect(smsSendingService.sendSms).not.toHaveBeenCalled();
    });

    it('should skip reminder if appointment is completed', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        status: 'completed',
      });

      const result = await processor.process(mockJob);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('appointment_status_completed');
    });

    it('should skip reminder if appointment is no-show', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        status: 'no_show',
      });

      const result = await processor.process(mockJob);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('appointment_status_no_show');
    });

    it('should skip reminder if appointment is rescheduled', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        status: 'rescheduled',
      });

      const result = await processor.process(mockJob);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('appointment_status_rescheduled');
    });

    it('should skip reminder if appointment time has passed', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        start_datetime_utc: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour in past
      });

      const result = await processor.process(mockJob);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('appointment_time_passed');
      expect(smsSendingService.sendSms).not.toHaveBeenCalled();
    });

    it('should skip reminder if lead has no phone number', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue({
        ...mockLead,
        phones: [],
      });

      const result = await processor.process(mockJob);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_phone_number');
      expect(smsSendingService.sendSms).not.toHaveBeenCalled();
    });

    it('should send correct message for 24h reminder', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (smsSendingService.sendSms as jest.Mock).mockResolvedValue(undefined);

      await processor.process(mockJob);

      expect(smsSendingService.sendSms).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          text_body: expect.stringContaining('tomorrow'),
        }),
      );
    });

    it('should send correct message for 1h reminder', async () => {
      const job1h = {
        ...mockJob,
        data: {
          ...mockJob.data,
          reminder_type: '1h',
        },
      };

      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (smsSendingService.sendSms as jest.Mock).mockResolvedValue(undefined);

      await processor.process(job1h);

      expect(smsSendingService.sendSms).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          text_body: expect.stringContaining('in 1 hour'),
        }),
      );
    });

    it('should handle lead with no first name', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue({
        ...mockLead,
        first_name: null,
      });
      (smsSendingService.sendSms as jest.Mock).mockResolvedValue(undefined);

      await processor.process(mockJob);

      expect(smsSendingService.sendSms).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          text_body: expect.stringContaining('Hi there'),
        }),
      );
    });

    it('should throw error if SMS sending fails', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue(
        mockAppointment,
      );
      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (smsSendingService.sendSms as jest.Mock).mockRejectedValue(
        new Error('Twilio error'),
      );

      await expect(processor.process(mockJob)).rejects.toThrow('Twilio error');
    });

    it('should enforce multi-tenant isolation', async () => {
      (prismaService.appointment.findFirst as jest.Mock).mockResolvedValue(
        mockAppointment,
      );

      await processor.process(mockJob);

      expect(prismaService.appointment.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'appt-123',
          tenant_id: 'tenant-123', // Must include tenant_id filter
        },
        select: expect.any(Object),
      });
    });
  });
});
