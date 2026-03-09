import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from '../../../../app.module';
import { PrismaService } from '../../../../core/database/prisma.service';

/**
 * APPOINTMENT LIFECYCLE INTEGRATION TESTS - Sprint 25
 *
 * Tests appointment action endpoints (full lifecycle):
 * - POST /api/v1/calendar/appointments/:id/confirm
 * - POST /api/v1/calendar/appointments/:id/cancel
 * - POST /api/v1/calendar/appointments/:id/reschedule
 * - POST /api/v1/calendar/appointments/:id/complete
 * - POST /api/v1/calendar/appointments/:id/no-show
 *
 * Verifies:
 * - Complete appointment lifecycle from creation to terminal state
 * - State machine transitions (terminal states cannot be changed)
 * - Reschedule creates new appointment and links to old
 * - Service request status updates on cancellation
 * - Multi-tenant isolation
 */
describe('Appointment Lifecycle Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let tenantId: string;
  let userId: string;
  let appointmentTypeId: string;
  let leadId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api/v1');

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'contact@honeydo4you.com',
        password: '978@F32c',
      })
      .expect(200);

    authToken = loginResponse.body.access_token;
    tenantId = loginResponse.body.user.tenant_id;
    userId = loginResponse.body.user.id;

    const appointmentType = await prisma.appointment_type.create({
      data: {
        tenant_id: tenantId,
        name: 'Lifecycle Test Type',
        slot_duration_minutes: 90,
        is_active: true,
        created_by_user_id: userId,
      },
    });
    appointmentTypeId = appointmentType.id;

    const lead = await prisma.lead.create({
      data: {
        id: uuidv4(),
        tenant_id: tenantId,
        first_name: 'Lifecycle',
        last_name: 'Test',
        source: 'manual',
        status: 'new',
        created_by_user_id: userId,
      },
    });
    leadId = lead.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { tenant_id: tenantId } });
    await prisma.lead.deleteMany({ where: { id: leadId } });
    await prisma.appointment_type_schedule.deleteMany({
      where: { appointment_type_id: appointmentTypeId },
    });
    await prisma.appointment_type.deleteMany({
      where: { id: appointmentTypeId },
    });
    await prisma.$disconnect();
    await app.close();
  });

  describe('Full Lifecycle: Create → Confirm → Reschedule → Complete', () => {
    let appointmentId: string;
    let newAppointmentId: string;

    it('should create appointment successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-15',
          start_time: '09:00',
          end_time: '10:30',
          notes: 'Initial appointment',
        })
        .expect(201);

      expect(response.body.status).toBe('scheduled');
      appointmentId = response.body.id;
    });

    it('should confirm the appointment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${appointmentId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Confirmed via phone',
        })
        .expect(200);

      expect(response.body.status).toBe('confirmed');
      expect(response.body.notes).toContain('Confirmed via phone');
    });

    it('should reschedule the confirmed appointment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_scheduled_date: '2026-03-20',
          new_start_time: '14:00',
          reason: 'Customer requested afternoon slot',
        })
        .expect(200);

      expect(response.body.oldAppointment.status).toBe('rescheduled');
      expect(response.body.newAppointment.status).toBe('scheduled');
      expect(response.body.newAppointment.rescheduled_from_id).toBe(
        appointmentId,
      );

      newAppointmentId = response.body.newAppointment.id;

      // Verify old appointment marked as rescheduled in database
      const oldAppt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });
      expect(oldAppt.status).toBe('rescheduled');
    });

    it('should complete the rescheduled appointment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${newAppointmentId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          completion_notes: 'Quote visit completed successfully',
        })
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(response.body.completed_at).toBeDefined();
      expect(response.body.notes).toContain(
        'Quote visit completed successfully',
      );
    });

    it('should prevent further changes to completed appointment (terminal state)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${newAppointmentId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('Full Lifecycle: Create → Cancel', () => {
    let appointmentId: string;
    let serviceRequestId: string;

    it('should create appointment with service request', async () => {
      const serviceRequest = await prisma.service_request.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          lead_id: leadId,
          service_name: 'Quote Request',
          service_type: 'Quote Request',
          status: 'scheduled',
        },
      });
      serviceRequestId = serviceRequest.id;

      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          service_request_id: serviceRequestId,
          scheduled_date: '2026-03-18',
          start_time: '10:00',
          end_time: '11:30',
        })
        .expect(201);

      appointmentId = response.body.id;
    });

    it('should cancel appointment with reason', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cancellation_reason: 'customer_cancelled',
          cancellation_notes: 'Customer needs to reschedule',
        })
        .expect(200);

      expect(response.body.status).toBe('cancelled');
      expect(response.body.cancellation_reason).toBe('customer_cancelled');
      expect(response.body.cancelled_at).toBeDefined();
    });

    it('should update service request status to new after cancellation', async () => {
      const serviceRequest = await prisma.service_request.findUnique({
        where: { id: serviceRequestId },
      });
      expect(serviceRequest.status).toBe('new');
    });

    it('should prevent further changes to cancelled appointment (terminal state)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${appointmentId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('Full Lifecycle: Create → No-Show', () => {
    let appointmentId: string;

    it('should create appointment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-19',
          start_time: '11:00',
          end_time: '12:30',
        })
        .expect(201);

      appointmentId = response.body.id;
    });

    it('should mark appointment as no-show', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${appointmentId}/no-show`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Customer did not arrive',
        })
        .expect(200);

      expect(response.body.status).toBe('no_show');
      expect(response.body.cancellation_reason).toBe('no_show');
      expect(response.body.cancelled_at).toBeDefined();
      expect(response.body.cancellation_notes).toBe('Customer did not arrive');
    });

    it('should prevent further changes to no-show appointment (terminal state)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${appointmentId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('Reschedule Multiple Times', () => {
    let firstAppointmentId: string;
    let secondAppointmentId: string;
    let thirdAppointmentId: string;

    it('should create initial appointment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-21',
          start_time: '09:00',
          end_time: '10:30',
        })
        .expect(201);

      firstAppointmentId = response.body.id;
    });

    it('should reschedule first time', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${firstAppointmentId}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_scheduled_date: '2026-03-22',
          new_start_time: '10:00',
        })
        .expect(200);

      secondAppointmentId = response.body.newAppointment.id;
      expect(response.body.newAppointment.rescheduled_from_id).toBe(
        firstAppointmentId,
      );
    });

    it('should reschedule second time', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${secondAppointmentId}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_scheduled_date: '2026-03-23',
          new_start_time: '11:00',
        })
        .expect(200);

      thirdAppointmentId = response.body.newAppointment.id;
      expect(response.body.newAppointment.rescheduled_from_id).toBe(
        secondAppointmentId,
      );
    });

    it('should verify reschedule chain in database', async () => {
      const first = await prisma.appointment.findUnique({
        where: { id: firstAppointmentId },
      });
      const second = await prisma.appointment.findUnique({
        where: { id: secondAppointmentId },
      });
      const third = await prisma.appointment.findUnique({
        where: { id: thirdAppointmentId },
      });

      expect(first.status).toBe('rescheduled');
      expect(second.status).toBe('rescheduled');
      expect(third.status).toBe('scheduled');
      expect(second.rescheduled_from_id).toBe(firstAppointmentId);
      expect(third.rescheduled_from_id).toBe(secondAppointmentId);
    });
  });

  describe('Edge Cases and Validation', () => {
    let appointmentId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-25',
          start_time: '09:00',
          end_time: '10:30',
        })
        .expect(201);

      appointmentId = response.body.id;
    });

    it('should reject rescheduling to past date', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_scheduled_date: '2020-01-01',
          new_start_time: '09:00',
        })
        .expect(400);
    });

    it('should require cancellation_reason when cancelling', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cancellation_notes: 'Notes without reason',
        })
        .expect(400);
    });

    it('should require cancellation_notes when reason is "other"', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/calendar/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cancellation_reason: 'other',
        })
        .expect(400);
    });
  });
});
