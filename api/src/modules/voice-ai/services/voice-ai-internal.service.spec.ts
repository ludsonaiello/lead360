import { Test, TestingModule } from '@nestjs/testing';
import { VoiceAiInternalService } from './voice-ai-internal.service';
import { VoiceAiContextBuilderService } from './voice-ai-context-builder.service';
import { VoiceCallLogService } from './voice-call-log.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadsService } from '../../leads/services/leads.service';
import { VoiceTransferNumbersService } from './voice-transfer-numbers.service';
import { SlotCalculationService } from '../../calendar/services/slot-calculation.service';
import { AppointmentsService } from '../../calendar/services/appointments.service';
import { AppointmentTypesService } from '../../calendar/services/appointment-types.service';
import { AppointmentLifecycleService } from '../../calendar/services/appointment-lifecycle.service';

/**
 * Sprint 19: voice_ai_reschedule_cancel - Unit Tests
 *
 * Tests for toolRescheduleAppointment() and toolCancelAppointment() methods
 * Coverage requirements: >80% for new methods
 */
describe('VoiceAiInternalService - Sprint 19 (Reschedule/Cancel Tools)', () => {
  let service: VoiceAiInternalService;
  let prisma: jest.Mocked<PrismaService>;
  let appointmentLifecycleService: jest.Mocked<AppointmentLifecycleService>;
  let slotCalculationService: jest.Mocked<SlotCalculationService>;

  const tenantId = 'tenant-123';
  const leadId = 'lead-123';
  const callLogId = 'call-log-123';
  const appointmentId = 'appointment-123';
  const callerPhone = '+15551234567';

  const mockPrisma = {
    voice_call_log: {
      findFirst: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
    },
  };

  const mockAppointmentLifecycleService = {
    rescheduleAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
  };

  const mockSlotCalculationService = {
    getAvailableSlots: jest.fn(),
  };

  const mockContextBuilder = {
    buildContext: jest.fn(),
  };

  const mockCallLogService = {
    startCall: jest.fn(),
    completeCall: jest.fn(),
    findByCallSid: jest.fn(),
  };

  const mockLeadsService = {
    create: jest.fn(),
  };

  const mockTransferNumbersService = {
    findAll: jest.fn(),
  };

  const mockAppointmentsService = {
    create: jest.fn(),
  };

  const mockAppointmentTypesService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceAiInternalService,
        { provide: VoiceAiContextBuilderService, useValue: mockContextBuilder },
        { provide: VoiceCallLogService, useValue: mockCallLogService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LeadsService, useValue: mockLeadsService },
        {
          provide: VoiceTransferNumbersService,
          useValue: mockTransferNumbersService,
        },
        {
          provide: SlotCalculationService,
          useValue: mockSlotCalculationService,
        },
        { provide: AppointmentsService, useValue: mockAppointmentsService },
        {
          provide: AppointmentTypesService,
          useValue: mockAppointmentTypesService,
        },
        {
          provide: AppointmentLifecycleService,
          useValue: mockAppointmentLifecycleService,
        },
      ],
    }).compile();

    service = module.get<VoiceAiInternalService>(VoiceAiInternalService);
    prisma = module.get(PrismaService);
    appointmentLifecycleService = module.get(AppointmentLifecycleService);
    slotCalculationService = module.get(SlotCalculationService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('toolRescheduleAppointment', () => {
    describe('Phase 1: Identity Verification and Initial Call', () => {
      it('should return error if call_log not found', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue(null);

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('error');
        expect(result.error).toBe('Call log not found');
      });

      it('should return error if lead not found', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue(null);

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('error');
        expect(result.error).toBe('Lead not found');
      });

      it('should return verification_failed if phone does not match', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: '+15559999999', // Different phone
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }], // Caller phone won't match
        });

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('verification_failed');
        expect(result.message).toBe('Phone number does not match our records.');
      });

      it('should return no_appointment_found if lead has no active appointments', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('no_appointment_found');
        expect(result.message).toContain('No active appointments');
      });

      it('should return multiple_appointments if lead has multiple active appointments', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: 'appt-1',
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: { name: 'Quote Visit' },
          },
          {
            id: 'appt-2',
            scheduled_date: '2026-03-15',
            start_time: '14:00',
            appointment_type: { name: 'Follow-up' },
          },
        ]);

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('multiple_appointments');
        expect(result.appointments).toHaveLength(2);
        expect(result.appointments![0].id).toBe('appt-1');
      });

      it('should return slots_available for single appointment with available slots', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: appointmentId,
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: {
              id: 'type-123',
              name: 'Quote Visit',
              max_lookahead_weeks: 8,
            },
          },
        ]);
        mockSlotCalculationService.getAvailableSlots.mockResolvedValue({
          total_available_slots: 3,
          available_dates: [
            {
              date: '2026-03-12',
              day_name: 'Thursday',
              slots: [
                { start_time: '09:00', end_time: '10:30' },
                { start_time: '10:30', end_time: '12:00' },
              ],
            },
          ],
        });

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('slots_available');
        expect(result.current_appointment).toBeDefined();
        expect(result.current_appointment!.id).toBe(appointmentId);
        expect(result.available_slots).toHaveLength(1);
        expect(result.available_slots![0].date).toBe('2026-03-12');
      });

      it('should expand search to max_lookahead_weeks if no slots in first 14 days', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: appointmentId,
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: {
              id: 'type-123',
              name: 'Quote Visit',
              max_lookahead_weeks: 8,
            },
          },
        ]);

        // First call returns 0 slots (14 days)
        // Second call returns slots (8 weeks)
        mockSlotCalculationService.getAvailableSlots
          .mockResolvedValueOnce({
            total_available_slots: 0,
            available_dates: [],
          })
          .mockResolvedValueOnce({
            total_available_slots: 2,
            available_dates: [
              {
                date: '2026-04-20',
                day_name: 'Monday',
                slots: [{ start_time: '14:00', end_time: '15:30' }],
              },
            ],
          });

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(
          mockSlotCalculationService.getAvailableSlots,
        ).toHaveBeenCalledTimes(2);
        expect(result.status).toBe('slots_available');
        expect(result.available_slots![0].date).toBe('2026-04-20');
      });

      it('should return error if no availability found after expanding search', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: appointmentId,
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: {
              id: 'type-123',
              name: 'Quote Visit',
              max_lookahead_weeks: 8,
            },
          },
        ]);
        mockSlotCalculationService.getAvailableSlots.mockResolvedValue({
          total_available_slots: 0,
          available_dates: [],
        });

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('error');
        expect(result.error).toContain('No available slots');
      });
    });

    describe('Phase 2: Confirm Reschedule', () => {
      it('should execute reschedule successfully', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: appointmentId,
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: {
              id: 'type-123',
              name: 'Quote Visit',
            },
          },
        ]);
        mockAppointmentLifecycleService.rescheduleAppointment.mockResolvedValue(
          {
            newAppointment: {
              id: 'new-appt-123',
              scheduled_date: '2026-03-12',
              start_time: '10:30',
            },
            oldAppointment: {
              id: appointmentId,
            },
          },
        );

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
          appointment_id: appointmentId,
          new_date: '2026-03-12',
          new_time: '10:30',
        });

        expect(result.status).toBe('rescheduled');
        expect(result.new_appointment_id).toBe('new-appt-123');
        expect(result.old_appointment_id).toBe(appointmentId);
        expect(
          mockAppointmentLifecycleService.rescheduleAppointment,
        ).toHaveBeenCalledWith(
          tenantId,
          appointmentId,
          null, // Voice AI is system actor
          {
            new_scheduled_date: '2026-03-12',
            new_start_time: '10:30',
          },
        );
      });

      it('should return error if appointment_id not in active appointments', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: 'different-appt-123',
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: { name: 'Quote Visit' },
          },
        ]);

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
          appointment_id: appointmentId, // Not in active appointments
          new_date: '2026-03-12',
          new_time: '10:30',
        });

        expect(result.status).toBe('error');
        expect(result.error).toContain('Appointment not found');
      });
    });

    describe('Error Handling', () => {
      it('should handle exceptions and return error status', async () => {
        mockPrisma.voice_call_log.findFirst.mockRejectedValue(
          new Error('Database error'),
        );

        const result = await service.toolRescheduleAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('error');
        expect(result.error).toContain('Database error');
      });
    });
  });

  describe('toolCancelAppointment', () => {
    describe('Phase 1: Identity Verification and Initial Call', () => {
      it('should return error if call_log not found', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue(null);

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('error');
        expect(result.error).toBe('Call log not found');
      });

      it('should return error if lead not found', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue(null);

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('error');
        expect(result.error).toBe('Lead not found');
      });

      it('should return verification_failed if phone does not match', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: '+15559999999',
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('verification_failed');
        expect(result.message).toBe('Phone number does not match our records.');
      });

      it('should return no_appointment_found if lead has no active appointments', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([]);

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('no_appointment_found');
        expect(result.message).toContain('No active appointments');
      });

      it('should return multiple_appointments if lead has multiple active appointments', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: 'appt-1',
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: { name: 'Quote Visit' },
          },
          {
            id: 'appt-2',
            scheduled_date: '2026-03-15',
            start_time: '14:00',
            appointment_type: { name: 'Follow-up' },
          },
        ]);

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('multiple_appointments');
        expect(result.appointments).toHaveLength(2);
      });

      it('should return single appointment for confirmation when only one exists', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: appointmentId,
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: { name: 'Quote Visit' },
          },
        ]);

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('multiple_appointments'); // Reuses status for confirmation
        expect(result.appointments).toHaveLength(1);
        expect(result.appointments![0].id).toBe(appointmentId);
      });
    });

    describe('Phase 2: Confirm Cancellation', () => {
      it('should execute cancellation successfully with default reason', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: appointmentId,
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: { name: 'Quote Visit' },
          },
        ]);
        mockAppointmentLifecycleService.cancelAppointment.mockResolvedValue({
          id: appointmentId,
          status: 'cancelled',
        });

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
          appointment_id: appointmentId,
        });

        expect(result.status).toBe('cancelled');
        expect(result.appointment_id).toBe(appointmentId);
        expect(result.cancellation_reason).toBe('customer_cancelled');
        expect(
          mockAppointmentLifecycleService.cancelAppointment,
        ).toHaveBeenCalledWith(
          tenantId,
          appointmentId,
          null, // Voice AI is system actor
          {
            cancellation_reason: 'customer_cancelled',
            cancellation_notes: undefined,
          },
        );
      });

      it('should execute cancellation with custom reason', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: appointmentId,
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: { name: 'Quote Visit' },
          },
        ]);
        mockAppointmentLifecycleService.cancelAppointment.mockResolvedValue({
          id: appointmentId,
          status: 'cancelled',
        });

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
          appointment_id: appointmentId,
          reason: 'scheduling_conflict',
        });

        expect(result.status).toBe('cancelled');
        expect(result.cancellation_reason).toBe('scheduling_conflict');
        expect(
          mockAppointmentLifecycleService.cancelAppointment,
        ).toHaveBeenCalledWith(tenantId, appointmentId, null, {
          cancellation_reason: 'scheduling_conflict',
          cancellation_notes: undefined,
        });
      });

      it('should return error if appointment_id not in active appointments', async () => {
        mockPrisma.voice_call_log.findFirst.mockResolvedValue({
          id: callLogId,
          from_number: callerPhone,
        });
        mockPrisma.lead.findFirst.mockResolvedValue({
          id: leadId,
          tenant_id: tenantId,
          phones: [{ phone: '5551234567' }],
        });
        mockPrisma.appointment.findMany.mockResolvedValue([
          {
            id: 'different-appt-123',
            scheduled_date: '2026-03-10',
            start_time: '09:00',
            appointment_type: { name: 'Quote Visit' },
          },
        ]);

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
          appointment_id: appointmentId, // Not in active appointments
        });

        expect(result.status).toBe('error');
        expect(result.error).toContain('Appointment not found');
      });
    });

    describe('Error Handling', () => {
      it('should handle exceptions and return error status', async () => {
        mockPrisma.voice_call_log.findFirst.mockRejectedValue(
          new Error('Database connection failed'),
        );

        const result = await service.toolCancelAppointment(tenantId, {
          call_log_id: callLogId,
          lead_id: leadId,
        });

        expect(result.status).toBe('error');
        expect(result.error).toContain('Database connection failed');
      });
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should enforce tenant_id filtering in reschedule queries', async () => {
      mockPrisma.voice_call_log.findFirst.mockResolvedValue({
        id: callLogId,
        from_number: callerPhone,
      });
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: leadId,
        tenant_id: tenantId,
        phones: [{ phone: '5551234567' }],
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await service.toolRescheduleAppointment(tenantId, {
        call_log_id: callLogId,
        lead_id: leadId,
      });

      expect(mockPrisma.voice_call_log.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: tenantId }),
        }),
      );
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: tenantId }),
        }),
      );
      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: tenantId }),
        }),
      );
    });

    it('should enforce tenant_id filtering in cancel queries', async () => {
      mockPrisma.voice_call_log.findFirst.mockResolvedValue({
        id: callLogId,
        from_number: callerPhone,
      });
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: leadId,
        tenant_id: tenantId,
        phones: [{ phone: '5551234567' }],
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await service.toolCancelAppointment(tenantId, {
        call_log_id: callLogId,
        lead_id: leadId,
      });

      expect(mockPrisma.voice_call_log.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: tenantId }),
        }),
      );
      expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: tenantId }),
        }),
      );
      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: tenantId }),
        }),
      );
    });
  });
});
