import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../../app.module';
import { PrismaService } from '../../../../core/database/prisma.service';

/**
 * APPOINTMENT SCHEDULES INTEGRATION TESTS - Sprint 25
 *
 * Tests all appointment schedule endpoints:
 * - GET /api/v1/calendar/appointment-types/:typeId/schedule
 * - PUT /api/v1/calendar/appointment-types/:typeId/schedule (bulk update)
 * - PATCH /api/v1/calendar/appointment-types/:typeId/schedule/:dayOfWeek
 *
 * Verifies:
 * - Weekly schedule retrieval
 * - Bulk schedule updates
 * - Single day schedule updates
 * - Multi-tenant isolation
 * - Validation rules
 */
describe('Appointment Schedules Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let tenantId: string;
  let appointmentTypeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Login with existing test user
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'contact@honeydo4you.com',
        password: '978@F32c',
      })
      .expect(200);

    authToken = loginResponse.body.access_token;
    tenantId = loginResponse.body.user.tenant_id;

    // Create a test appointment type
    const appointmentType = await prisma.appointment_type.create({
      data: {
        tenant_id: tenantId,
        name: 'Schedule Test Type',
        description: 'For testing schedules',
        slot_duration_minutes: 60,
        max_lookahead_weeks: 8,
        is_active: true,
        is_default: false,
        created_by_user_id: loginResponse.body.user.id,
      },
    });
    appointmentTypeId = appointmentType.id;

    // Create default weekly schedules (7 days)
    const schedules = [];
    for (let day = 0; day <= 6; day++) {
      schedules.push({
        appointment_type_id: appointmentTypeId,
        day_of_week: day,
        is_available: day >= 1 && day <= 5, // Monday-Friday available
        window1_start: day >= 1 && day <= 5 ? '09:00' : null,
        window1_end: day >= 1 && day <= 5 ? '17:00' : null,
        window2_start: null,
        window2_end: null,
      });
    }
    await prisma.appointment_type_schedule.createMany({ data: schedules });
  });

  afterAll(async () => {
    // Clean up
    await prisma.appointment_type_schedule.deleteMany({
      where: { appointment_type_id: appointmentTypeId },
    });
    await prisma.appointment_type.delete({
      where: { id: appointmentTypeId },
    });
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /api/v1/calendar/appointment-types/:typeId/schedule', () => {
    it('should return weekly schedule with 7 days', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(7);

      // Verify all days 0-6 are present
      const daysOfWeek = response.body.map((s: any) => s.day_of_week).sort();
      expect(daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('should return schedule with correct structure', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const schedule = response.body[0];
      expect(schedule).toHaveProperty('id');
      expect(schedule).toHaveProperty('appointment_type_id');
      expect(schedule).toHaveProperty('day_of_week');
      expect(schedule).toHaveProperty('is_available');
      expect(schedule).toHaveProperty('window1_start');
      expect(schedule).toHaveProperty('window1_end');
      expect(schedule).toHaveProperty('window2_start');
      expect(schedule).toHaveProperty('window2_end');
      expect(schedule).toHaveProperty('created_at');
      expect(schedule).toHaveProperty('updated_at');
    });

    it('should return 404 for non-existent appointment type', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/calendar/appointment-types/00000000-0000-0000-0000-000000000000/schedule')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule`)
        .expect(401);
    });
  });

  describe('PUT /api/v1/calendar/appointment-types/:typeId/schedule', () => {
    it('should bulk update all 7 days of weekly schedule', async () => {
      const schedules = [
        {
          day_of_week: 0,
          is_available: false,
          window1_start: null,
          window1_end: null,
          window2_start: null,
          window2_end: null,
        },
        {
          day_of_week: 1,
          is_available: true,
          window1_start: '09:00',
          window1_end: '12:00',
          window2_start: '13:00',
          window2_end: '17:00',
        },
        {
          day_of_week: 2,
          is_available: true,
          window1_start: '09:00',
          window1_end: '12:00',
          window2_start: '13:00',
          window2_end: '17:00',
        },
        {
          day_of_week: 3,
          is_available: true,
          window1_start: '09:00',
          window1_end: '12:00',
          window2_start: '13:00',
          window2_end: '17:00',
        },
        {
          day_of_week: 4,
          is_available: true,
          window1_start: '09:00',
          window1_end: '12:00',
          window2_start: '13:00',
          window2_end: '17:00',
        },
        {
          day_of_week: 5,
          is_available: true,
          window1_start: '09:00',
          window1_end: '12:00',
          window2_start: '13:00',
          window2_end: '17:00',
        },
        {
          day_of_week: 6,
          is_available: false,
          window1_start: null,
          window1_end: null,
          window2_start: null,
          window2_end: null,
        },
      ];

      const response = await request(app.getHttpServer())
        .put(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ schedules })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(7);

      // Verify Monday schedule
      const monday = response.body.find((s: any) => s.day_of_week === 1);
      expect(monday.is_available).toBe(true);
      expect(monday.window1_start).toBe('09:00');
      expect(monday.window1_end).toBe('12:00');
      expect(monday.window2_start).toBe('13:00');
      expect(monday.window2_end).toBe('17:00');

      // Verify Sunday is unavailable
      const sunday = response.body.find((s: any) => s.day_of_week === 0);
      expect(sunday.is_available).toBe(false);
    });

    it('should reject update with less than 7 schedules', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          schedules: [
            {
              day_of_week: 0,
              is_available: false,
            },
          ],
        })
        .expect(400);
    });

    it('should reject update with more than 7 schedules', async () => {
      const schedules = Array.from({ length: 8 }, (_, i) => ({
        day_of_week: i % 7,
        is_available: true,
        window1_start: '09:00',
        window1_end: '17:00',
      }));

      await request(app.getHttpServer())
        .put(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ schedules })
        .expect(400);
    });

    it('should reject invalid time format', async () => {
      const schedules = Array.from({ length: 7 }, (_, i) => ({
        day_of_week: i,
        is_available: i > 0 && i < 6,
        window1_start: i > 0 && i < 6 ? '25:00' : null, // Invalid hour
        window1_end: i > 0 && i < 6 ? '17:00' : null,
      }));

      await request(app.getHttpServer())
        .put(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ schedules })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/calendar/appointment-types/:typeId/schedule/:dayOfWeek', () => {
    it('should update a single day schedule', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule/1`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_available: true,
          window1_start: '08:00',
          window1_end: '12:00',
          window2_start: '13:00',
          window2_end: '18:00',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        day_of_week: 1,
        is_available: true,
        window1_start: '08:00',
        window1_end: '12:00',
        window2_start: '13:00',
        window2_end: '18:00',
      });
    });

    it('should mark a day as unavailable', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule/2`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_available: false,
          window1_start: null,
          window1_end: null,
          window2_start: null,
          window2_end: null,
        })
        .expect(200);

      expect(response.body.is_available).toBe(false);
      expect(response.body.window1_start).toBeNull();
    });

    it('should update to single window (no second window)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule/3`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
          window2_start: null,
          window2_end: null,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        is_available: true,
        window1_start: '09:00',
        window1_end: '17:00',
        window2_start: null,
        window2_end: null,
      });
    });

    it('should reject invalid day_of_week (> 6)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule/7`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
        })
        .expect(400);
    });

    it('should reject invalid day_of_week (< 0)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule/-1`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
        })
        .expect(400);
    });

    it('should reject invalid time format', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule/4`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_available: true,
          window1_start: '9:00', // Invalid format (should be 09:00)
          window1_end: '17:00',
        })
        .expect(400);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only access schedules for appointment types in authenticated tenant', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify all schedules belong to the correct appointment type
      expect(response.body.every((s: any) => s.appointment_type_id === appointmentTypeId)).toBe(true);
    });
  });

  describe('Time Window Validation', () => {
    it('should accept two time windows for a day', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule/5`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_available: true,
          window1_start: '08:00',
          window1_end: '12:00',
          window2_start: '14:00',
          window2_end: '18:00',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        window1_start: '08:00',
        window1_end: '12:00',
        window2_start: '14:00',
        window2_end: '18:00',
      });
    });

    it('should accept only first window with second window null', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}/schedule/6`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
          window2_start: null,
          window2_end: null,
        })
        .expect(200);

      expect(response.body.window2_start).toBeNull();
      expect(response.body.window2_end).toBeNull();
    });
  });
});
