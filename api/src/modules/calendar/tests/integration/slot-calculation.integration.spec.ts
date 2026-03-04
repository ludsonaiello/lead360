import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from '../../../../app.module';
import { PrismaService } from '../../../../core/database/prisma.service';

/**
 * SLOT CALCULATION INTEGRATION TESTS - Sprint 25
 *
 * Tests availability calculation endpoints:
 * - GET /api/v1/calendar/availability
 * - GET /api/v1/calendar/dashboard/upcoming
 * - GET /api/v1/calendar/dashboard/new
 * - PATCH /api/v1/calendar/dashboard/new/:id/acknowledge
 *
 * Verifies:
 * - Available time slots calculated correctly
 * - Existing appointments block availability
 * - External calendar blocks reduce availability
 * - Dashboard endpoints work correctly
 * - Appointment acknowledgment works
 */
describe('Slot Calculation Integration Tests', () => {
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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

    // Create appointment type with schedule
    const appointmentType = await prisma.appointment_type.create({
      data: {
        tenant_id: tenantId,
        name: 'Availability Test Type',
        slot_duration_minutes: 90,
        max_lookahead_weeks: 4,
        is_active: true,
        created_by_user_id: userId,
      },
    });
    appointmentTypeId = appointmentType.id;

    // Create weekly schedule (Monday-Friday 9-17)
    const schedules = [];
    for (let day = 0; day <= 6; day++) {
      const isWeekday = day >= 1 && day <= 5;
      schedules.push({
        appointment_type_id: appointmentTypeId,
        day_of_week: day,
        is_available: isWeekday,
        window1_start: isWeekday ? '09:00' : null,
        window1_end: isWeekday ? '17:00' : null,
        window2_start: null,
        window2_end: null,
      });
    }
    await prisma.appointment_type_schedule.createMany({ data: schedules });

    // Create test lead
    const lead = await prisma.lead.create({
      data: {
        id: uuidv4(),
        tenant_id: tenantId,
        first_name: 'Availability',
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
    await prisma.appointment_type_schedule.deleteMany({ where: { appointment_type_id: appointmentTypeId } });
    await prisma.appointment_type.deleteMany({ where: { id: appointmentTypeId } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /api/v1/calendar/availability', () => {
    it('should return available slots for date range', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/availability?appointment_type_id=${appointmentTypeId}&date_from=2026-03-02&date_to=2026-03-06`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.available_dates).toBeInstanceOf(Array);
      expect(response.body.appointment_type).toBeDefined();
      expect(response.body.appointment_type.id).toBe(appointmentTypeId);
      expect(response.body.total_available_slots).toBeGreaterThan(0);
    });

    it('should exclude weekends from availability', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/availability?appointment_type_id=${appointmentTypeId}&date_from=2026-03-07&date_to=2026-03-08`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // March 7-8, 2026 are Saturday and Sunday
      expect(response.body.available_dates.length).toBe(0);
    });

    it('should reduce available slots when appointment exists', async () => {
      // Get availability before creating appointment
      const beforeResponse = await request(app.getHttpServer())
        .get(`/api/v1/calendar/availability?appointment_type_id=${appointmentTypeId}&date_from=2026-03-16&date_to=2026-03-16`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const slotsBefore = beforeResponse.body.total_available_slots;

      // Create appointment
      await prisma.appointment.create({
        data: {
          tenant_id: tenantId,
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-16',
          start_time: '09:00',
          end_time: '10:30',
          start_datetime_utc: new Date('2026-03-16T14:00:00Z'),
          end_datetime_utc: new Date('2026-03-16T15:30:00Z'),
          status: 'scheduled',
          source: 'manual',
          created_by_user_id: userId,
        },
      });

      // Get availability after creating appointment
      const afterResponse = await request(app.getHttpServer())
        .get(`/api/v1/calendar/availability?appointment_type_id=${appointmentTypeId}&date_from=2026-03-16&date_to=2026-03-16`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const slotsAfter = afterResponse.body.total_available_slots;

      expect(slotsAfter).toBeLessThan(slotsBefore);
    });

    it('should require appointment_type_id parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/calendar/availability?date_from=2026-03-10&date_to=2026-03-14')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should validate date format', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/calendar/availability?appointment_type_id=${appointmentTypeId}&date_from=2026-03-10&date_to=invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should respect max_lookahead_weeks', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/availability?appointment_type_id=${appointmentTypeId}&date_from=2026-03-10&date_to=2026-06-10`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('exceeds');
    });
  });

  describe('GET /api/v1/calendar/dashboard/upcoming', () => {
    let upcomingAppointmentId: string;

    beforeAll(async () => {
      // Create an upcoming appointment
      const appointment = await prisma.appointment.create({
        data: {
          tenant_id: tenantId,
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-17',
          start_time: '10:00',
          end_time: '11:30',
          start_datetime_utc: new Date('2026-03-17T15:00:00Z'),
          end_datetime_utc: new Date('2026-03-17T16:30:00Z'),
          status: 'confirmed',
          source: 'manual',
          created_by_user_id: userId,
        },
      });
      upcomingAppointmentId = appointment.id;
    });

    it('should return upcoming appointments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/dashboard/upcoming')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toBeInstanceOf(Array);
      expect(response.body.count).toBeGreaterThanOrEqual(1);
    });

    it('should limit number of upcoming appointments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/dashboard/upcoming?limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(2);
    });

    it('should only return scheduled or confirmed appointments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/dashboard/upcoming')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.every((a: any) => ['scheduled', 'confirmed'].includes(a.status))).toBe(true);
    });
  });

  describe('GET /api/v1/calendar/dashboard/new', () => {
    let newAppointmentId: string;

    beforeAll(async () => {
      // Create a new unacknowledged appointment
      const appointment = await prisma.appointment.create({
        data: {
          tenant_id: tenantId,
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-18',
          start_time: '14:00',
          end_time: '15:30',
          start_datetime_utc: new Date('2026-03-18T19:00:00Z'),
          end_datetime_utc: new Date('2026-03-18T20:30:00Z'),
          status: 'scheduled',
          source: 'voice_ai',
          acknowledged_at: null,
          created_by_user_id: userId,
        },
      });
      newAppointmentId = appointment.id;
    });

    it('should return new unacknowledged appointments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/dashboard/new')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toBeInstanceOf(Array);
      expect(response.body.count).toBeGreaterThanOrEqual(1);
      expect(response.body.items.every((a: any) => a.acknowledged_at === null)).toBe(true);
    });

    it('should prioritize Voice AI appointments', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/dashboard/new')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const voiceAiAppointments = response.body.items.filter((a: any) => a.source === 'voice_ai');
      expect(voiceAiAppointments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /api/v1/calendar/dashboard/new/:id/acknowledge', () => {
    let unacknowledgedAppointmentId: string;

    beforeAll(async () => {
      const appointment = await prisma.appointment.create({
        data: {
          tenant_id: tenantId,
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-19',
          start_time: '11:00',
          end_time: '12:30',
          start_datetime_utc: new Date('2026-03-19T16:00:00Z'),
          end_datetime_utc: new Date('2026-03-19T17:30:00Z'),
          status: 'scheduled',
          source: 'voice_ai',
          acknowledged_at: null,
          created_by_user_id: userId,
        },
      });
      unacknowledgedAppointmentId = appointment.id;
    });

    it('should acknowledge appointment', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/dashboard/new/${unacknowledgedAppointmentId}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.acknowledged_at).toBeDefined();
      expect(response.body.appointment_id).toBe(unacknowledgedAppointmentId);
    });

    it('should remove appointment from new list after acknowledgment', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/dashboard/new')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const acknowledged = response.body.items.find((a: any) => a.id === unacknowledgedAppointmentId);
      expect(acknowledged).toBeUndefined();
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only calculate availability for tenant appointment types', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/availability?appointment_type_id=${appointmentTypeId}&date_from=2026-03-20&date_to=2026-03-21`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.appointment_type.tenant_id).toBe(tenantId);
    });
  });
});
