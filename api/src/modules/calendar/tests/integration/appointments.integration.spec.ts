import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from '../../../../app.module';
import { PrismaService } from '../../../../core/database/prisma.service';

/**
 * APPOINTMENTS INTEGRATION TESTS - Sprint 25
 *
 * Tests core appointment endpoints:
 * - POST /api/v1/calendar/appointments
 * - GET /api/v1/calendar/appointments
 * - GET /api/v1/calendar/appointments/:id
 * - PATCH /api/v1/calendar/appointments/:id
 *
 * Verifies:
 * - Appointment CRUD operations
 * - Multi-tenant isolation
 * - Lead and service request associations
 * - UTC datetime calculations
 * - Filtering and pagination
 */
describe('Appointments Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let tenantId: string;
  let userId: string;
  let appointmentTypeId: string;
  let leadId: string;
  let serviceRequestId: string;
  let appointmentId: string;

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

    // Create test data
    const appointmentType = await prisma.appointment_type.create({
      data: {
        tenant_id: tenantId,
        name: 'Appointments Test Type',
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
        first_name: 'John',
        last_name: 'Doe',
        source: 'manual',
        status: 'new',
        created_by_user_id: userId,
      },
    });
    leadId = lead.id;

    const serviceRequest = await prisma.service_request.create({
      data: {
        id: uuidv4(),
        tenant_id: tenantId,
        lead_id: leadId,
        service_name: 'Quote Request',
        service_type: 'Quote Request',
        status: 'new',
      },
    });
    serviceRequestId = serviceRequest.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { tenant_id: tenantId } });
    await prisma.service_request.deleteMany({
      where: { id: serviceRequestId },
    });
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

  describe('POST /api/v1/calendar/appointments', () => {
    it('should create an appointment successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          service_request_id: serviceRequestId,
          scheduled_date: '2026-03-15',
          start_time: '09:00',
          end_time: '10:30',
          notes: 'Test appointment',
          source: 'manual',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        appointment_type_id: appointmentTypeId,
        lead_id: leadId,
        service_request_id: serviceRequestId,
        scheduled_date: '2026-03-15',
        start_time: '09:00',
        end_time: '10:30',
        status: 'scheduled',
        notes: 'Test appointment',
        source: 'manual',
        tenant_id: tenantId,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.start_datetime_utc).toBeDefined();
      expect(response.body.end_datetime_utc).toBeDefined();

      appointmentId = response.body.id;
    });

    it('should create appointment from Voice AI source', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-16',
          start_time: '14:00',
          end_time: '15:30',
          source: 'voice_ai',
        })
        .expect(201);

      expect(response.body.source).toBe('voice_ai');
      expect(response.body.acknowledged_at).toBeNull();
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .send({
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '2026-03-15',
          start_time: '09:00',
          end_time: '10:30',
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
          appointment_type_id: appointmentTypeId,
        })
        .expect(400);
    });

    it('should validate date format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          appointment_type_id: appointmentTypeId,
          lead_id: leadId,
          scheduled_date: '15-03-2026', // Wrong format
          start_time: '09:00',
          end_time: '10:30',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/calendar/appointments', () => {
    it('should list all appointments for tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toBeInstanceOf(Array);
      expect(response.body.items.length).toBeGreaterThanOrEqual(1);
      expect(response.body.meta).toBeDefined();
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointments?status=scheduled')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(
        response.body.items.every((a: any) => a.status === 'scheduled'),
      ).toBe(true);
    });

    it('should filter by lead_id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/appointments?lead_id=${leadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.every((a: any) => a.lead.id === leadId)).toBe(
        true,
      );
    });

    it('should filter by date range', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/api/v1/calendar/appointments?date_from=2026-03-15&date_to=2026-03-16',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should paginate results', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointments?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(1);
      expect(response.body.meta.limit).toBe(1);
    });

    it('should sort by scheduled_date', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/api/v1/calendar/appointments?sort_by=scheduled_date&sort_order=asc',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const dates = response.body.items.map((a: any) => a.scheduled_date);
      const sortedDates = [...dates].sort();
      expect(dates).toEqual(sortedDates);
    });
  });

  describe('GET /api/v1/calendar/appointments/:id', () => {
    it('should get a single appointment with full details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: appointmentId,
        tenant_id: tenantId,
      });
      expect(response.body.appointment_type).toBeDefined();
      expect(response.body.lead).toBeDefined();
      expect(response.body.service_request).toBeDefined();
    });

    it('should return 404 for non-existent appointment', async () => {
      await request(app.getHttpServer())
        .get(
          '/api/v1/calendar/appointments/00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/calendar/appointments/:id', () => {
    it('should update appointment notes', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Updated appointment notes',
        })
        .expect(200);

      expect(response.body.notes).toBe('Updated appointment notes');
    });

    it('should update assigned user', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assigned_user_id: userId,
        })
        .expect(200);

      expect(response.body.assigned_user_id).toBe(userId);
    });

    it('should return 404 for non-existent appointment', async () => {
      await request(app.getHttpServer())
        .patch(
          '/api/v1/calendar/appointments/00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Test',
        })
        .expect(404);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return appointments for authenticated tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(
        response.body.items.every((a: any) => a.tenant_id === tenantId),
      ).toBe(true);
    });
  });
});
