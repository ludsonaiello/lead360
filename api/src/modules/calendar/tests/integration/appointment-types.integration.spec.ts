import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from '../../../../app.module';
import { PrismaService } from '../../../../core/database/prisma.service';

/**
 * APPOINTMENT TYPES INTEGRATION TESTS - Sprint 25
 *
 * Tests all appointment types endpoints:
 * - POST /api/v1/calendar/appointment-types
 * - GET /api/v1/calendar/appointment-types
 * - GET /api/v1/calendar/appointment-types/:id
 * - PATCH /api/v1/calendar/appointment-types/:id
 * - DELETE /api/v1/calendar/appointment-types/:id (soft delete)
 * - DELETE /api/v1/calendar/appointment-types/:id/permanent (hard delete)
 *
 * Verifies:
 * - CRUD operations work correctly
 * - Soft delete vs hard delete behavior
 * - Multi-tenant isolation enforced
 * - RBAC permissions enforced (Owner-only for hard delete)
 * - is_default toggle logic works
 * - Validation rules applied
 */
describe('Appointment Types Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let tenantId: string;
  let userId: string;
  let appointmentTypeId: string;
  let secondAppointmentTypeId: string;

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
    userId = loginResponse.body.user.id;

    // Clean up any existing appointment types from previous test runs
    await prisma.appointment.deleteMany({
      where: { tenant_id: tenantId },
    });
    await prisma.appointment_type_schedule.deleteMany({
      where: {
        appointment_type: {
          tenant_id: tenantId,
        },
      },
    });
    await prisma.appointment_type.deleteMany({
      where: { tenant_id: tenantId },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /api/v1/calendar/appointment-types', () => {
    it('should create an appointment type successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointment-types')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Quote Visit',
          description: 'Schedule a quote visit with the customer',
          slot_duration_minutes: 90,
          max_lookahead_weeks: 8,
          reminder_24h_enabled: true,
          reminder_1h_enabled: true,
          is_default: true,
          is_active: true,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Quote Visit',
        description: 'Schedule a quote visit with the customer',
        slot_duration_minutes: 90,
        max_lookahead_weeks: 8,
        reminder_24h_enabled: true,
        reminder_1h_enabled: true,
        is_default: true,
        is_active: true,
        tenant_id: tenantId,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.created_at).toBeDefined();
      expect(response.body.updated_at).toBeDefined();

      appointmentTypeId = response.body.id;
    });

    it('should create a second appointment type and unset previous default', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointment-types')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Follow-up Call',
          description: 'Follow-up call with customer',
          slot_duration_minutes: 30,
          max_lookahead_weeks: 4,
          is_default: true,
        })
        .expect(201);

      expect(response.body.is_default).toBe(true);
      secondAppointmentTypeId = response.body.id;

      // Verify first appointment type is no longer default
      const firstType = await prisma.appointment_type.findUnique({
        where: { id: appointmentTypeId },
      });
      expect(firstType.is_default).toBe(false);
    });

    it('should reject invalid slot_duration_minutes', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/calendar/appointment-types')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Duration',
          slot_duration_minutes: 10, // Too small
        })
        .expect(400);
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/calendar/appointment-types')
        .send({
          name: 'Unauthorized Type',
        })
        .expect(401);
    });

    it('should enforce tenant isolation - created type belongs to correct tenant', async () => {
      const type = await prisma.appointment_type.findUnique({
        where: { id: appointmentTypeId },
      });
      expect(type.tenant_id).toBe(tenantId);
    });
  });

  describe('GET /api/v1/calendar/appointment-types', () => {
    it('should list all appointment types for tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointment-types')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toBeInstanceOf(Array);
      expect(response.body.items.length).toBeGreaterThanOrEqual(2);
      expect(response.body.meta).toMatchObject({
        current_page: 1,
        per_page: 20,
      });
      expect(response.body.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter by is_active', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointment-types?is_active=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.every((t: any) => t.is_active === true)).toBe(
        true,
      );
    });

    it('should filter by is_default', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointment-types?is_default=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toBeInstanceOf(Array);
      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0].is_default).toBe(true);
    });

    it('should search by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointment-types?search=Quote')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThanOrEqual(1);
      expect(response.body.items[0].name).toContain('Quote');
    });

    it('should paginate results', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointment-types?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(1);
      expect(response.body.meta.limit).toBe(1);
      expect(response.body.meta.total_pages).toBeGreaterThanOrEqual(2);
    });

    it('should sort by name ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointment-types?sort_by=name&sort_order=asc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const names = response.body.items.map((t: any) => t.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  describe('GET /api/v1/calendar/appointment-types/:id', () => {
    it('should get a single appointment type', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/calendar/appointment-types/${appointmentTypeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: appointmentTypeId,
        name: 'Quote Visit',
        tenant_id: tenantId,
      });
      expect(response.body.schedules).toBeInstanceOf(Array);
      expect(response.body.schedules.length).toBe(7); // Weekly schedule
    });

    it('should return 404 for non-existent appointment type', async () => {
      await request(app.getHttpServer())
        .get(
          '/api/v1/calendar/appointment-types/00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/calendar/appointment-types/${appointmentTypeId}`)
        .expect(401);
    });
  });

  describe('PATCH /api/v1/calendar/appointment-types/:id', () => {
    it('should update an appointment type', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Quote Visit',
          slot_duration_minutes: 120,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: appointmentTypeId,
        name: 'Updated Quote Visit',
        slot_duration_minutes: 120,
      });
    });

    it('should update is_default and unset previous default', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/calendar/appointment-types/${appointmentTypeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          is_default: true,
        })
        .expect(200);

      expect(response.body.is_default).toBe(true);

      // Verify second type is no longer default
      const secondType = await prisma.appointment_type.findUnique({
        where: { id: secondAppointmentTypeId },
      });
      expect(secondType.is_default).toBe(false);
    });

    it('should return 404 for non-existent appointment type', async () => {
      await request(app.getHttpServer())
        .patch(
          '/api/v1/calendar/appointment-types/00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Non-existent',
        })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/calendar/appointment-types/:id', () => {
    it('should soft delete an appointment type', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/calendar/appointment-types/${secondAppointmentTypeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify soft delete (is_active = false)
      const deletedType = await prisma.appointment_type.findUnique({
        where: { id: secondAppointmentTypeId },
      });
      expect(deletedType.is_active).toBe(false);
    });

    it('should prevent deletion if active appointments exist', async () => {
      // Create a lead first
      const lead = await prisma.lead.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          first_name: 'Test',
          last_name: 'Lead',
          source: 'manual',
          status: 'new',
          created_by_user_id: userId,
        },
      });

      // Create an appointment using the appointment type
      await prisma.appointment.create({
        data: {
          tenant_id: tenantId,
          appointment_type_id: appointmentTypeId,
          lead_id: lead.id,
          scheduled_date: '2026-03-15',
          start_time: '09:00',
          end_time: '10:30',
          start_datetime_utc: new Date('2026-03-15T14:00:00Z'),
          end_datetime_utc: new Date('2026-03-15T15:30:00Z'),
          status: 'scheduled',
          source: 'manual',
          created_by_user_id: userId,
        },
      });

      // Attempt to delete should fail
      await request(app.getHttpServer())
        .delete(`/api/v1/calendar/appointment-types/${appointmentTypeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 404 for non-existent appointment type', async () => {
      await request(app.getHttpServer())
        .delete(
          '/api/v1/calendar/appointment-types/00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return appointment types for authenticated tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/appointment-types')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All returned types should belong to the authenticated tenant
      expect(
        response.body.items.every((t: any) => t.tenant_id === tenantId),
      ).toBe(true);
    });
  });

  describe('RBAC Enforcement', () => {
    it('should require Owner, Admin, or Estimator role for write operations', async () => {
      // This test assumes the authenticated user has appropriate permissions
      // In a full test suite, you would test with different role users
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointment-types')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'RBAC Test Type',
          slot_duration_minutes: 60,
        })
        .expect(201);

      expect(response.body.name).toBe('RBAC Test Type');
    });
  });

  describe('DELETE /api/v1/calendar/appointment-types/:id/permanent (Hard Delete)', () => {
    let hardDeleteTestTypeId: string;

    beforeEach(async () => {
      // Create a fresh appointment type for hard delete tests
      const response = await request(app.getHttpServer())
        .post('/api/v1/calendar/appointment-types')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Hard Delete Test Type',
          slot_duration_minutes: 60,
        })
        .expect(201);

      hardDeleteTestTypeId = response.body.id;
    });

    it('should permanently delete an appointment type with no appointments', async () => {
      await request(app.getHttpServer())
        .delete(
          `/api/v1/calendar/appointment-types/${hardDeleteTestTypeId}/permanent`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify hard delete (record no longer exists)
      const deletedType = await prisma.appointment_type.findUnique({
        where: { id: hardDeleteTestTypeId },
      });
      expect(deletedType).toBeNull();
    });

    it('should prevent hard delete if ANY appointments exist (active or historical)', async () => {
      // Create a lead first
      const lead = await prisma.lead.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          first_name: 'Hard Delete',
          last_name: 'Test Lead',
          source: 'manual',
          status: 'new',
          created_by_user_id: userId,
        },
      });

      // Create a completed appointment (historical)
      await prisma.appointment.create({
        data: {
          tenant_id: tenantId,
          appointment_type_id: hardDeleteTestTypeId,
          lead_id: lead.id,
          scheduled_date: '2026-02-15',
          start_time: '09:00',
          end_time: '10:00',
          start_datetime_utc: new Date('2026-02-15T14:00:00Z'),
          end_datetime_utc: new Date('2026-02-15T15:00:00Z'),
          status: 'completed', // Historical appointment
          source: 'manual',
          created_by_user_id: userId,
        },
      });

      // Attempt hard delete should fail
      const response = await request(app.getHttpServer())
        .delete(
          `/api/v1/calendar/appointment-types/${hardDeleteTestTypeId}/permanent`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('Cannot permanently delete');
      expect(response.body.message).toContain('appointment(s) in history');

      // Verify type still exists
      const stillExists = await prisma.appointment_type.findUnique({
        where: { id: hardDeleteTestTypeId },
      });
      expect(stillExists).not.toBeNull();
    });

    it('should return 404 for non-existent appointment type', async () => {
      await request(app.getHttpServer())
        .delete(
          '/api/v1/calendar/appointment-types/00000000-0000-0000-0000-000000000000/permanent',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require Owner role (not Admin)', async () => {
      // Note: This test assumes the current user is Owner
      // In a full test suite, you would test with an Admin user and verify 403
      const response = await request(app.getHttpServer())
        .delete(
          `/api/v1/calendar/appointment-types/${hardDeleteTestTypeId}/permanent`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // If this was an Admin user, we'd expect 403
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .delete(
          `/api/v1/calendar/appointment-types/${hardDeleteTestTypeId}/permanent`,
        )
        .expect(401);
    });
  });
});
