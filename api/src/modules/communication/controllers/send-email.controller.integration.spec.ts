import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { CommunicationModule } from '../communication.module';

/**
 * Integration Tests: Send Email Flow
 *
 * Tests complete email sending workflow including:
 * - Template rendering
 * - Variable validation
 * - Job queuing
 * - Multi-tenant isolation
 * - Communication event creation
 */
describe('SendEmailController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailQueue: Queue;

  const mockTenantId = 'tenant-email-test';
  const mockUserId = 'user-email-test';
  const mockProviderId = 'provider-sendgrid-test';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CommunicationModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    emailQueue = moduleFixture.get<Queue>(getQueueToken('communication-email'));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.communication_event.deleteMany({
      where: { tenant_id: mockTenantId },
    });
    await prisma.email_template.deleteMany({
      where: { tenant_id: mockTenantId },
    });

    // Drain email queue
    await emailQueue.drain();

    // Seed test template
    await prisma.email_template.create({
      data: {
        id: 'template-test-quote',
        tenant_id: mockTenantId,
        template_key: 'quote-sent',
        category: 'transactional',
        subject: 'Quote {{quote_number}} from {{company_name}}',
        html_body: '<h1>Quote {{quote_number}}</h1><p>Total: {{quote_total}}</p>',
        text_body: 'Quote {{quote_number}} - Total: {{quote_total}}',
        variables: {},
        variable_schema: {
          type: 'object',
          properties: {
            company_name: { type: 'string' },
            quote_number: { type: 'string' },
            quote_total: { type: 'string' },
          },
          required: ['company_name', 'quote_number', 'quote_total'],
        },
        is_system: false,
        is_active: true,
      },
    });
  });

  describe('POST /communication/send-email/templated', () => {
    it('should queue templated email successfully', async () => {
      const dto = {
        to: 'customer@example.com',
        cc: ['manager@example.com'],
        template_key: 'quote-sent',
        variables: {
          company_name: 'Acme Corp',
          quote_number: 'Q-12345',
          quote_total: '$1,250.00',
        },
        related_entity_type: 'quote',
        related_entity_id: 'quote-12345',
      };

      const response = await request(app.getHttpServer())
        .post('/communication/send-email/templated')
        .set('X-Tenant-ID', mockTenantId)
        .set('X-User-ID', mockUserId)
        .send(dto)
        .expect(202);

      expect(response.body).toMatchObject({
        job_id: expect.any(String),
        message: expect.stringContaining('queued'),
      });

      // Verify communication event created
      const event = await prisma.communication_event.findFirst({
        where: {
          tenant_id: mockTenantId,
          to_email: 'customer@example.com',
        },
      });

      expect(event).toBeDefined();
      expect(event.status).toBe('pending');
      expect(event.template_key).toBe('quote-sent');
      expect(event.subject).toContain('Q-12345');
      expect(event.html_body).toContain('$1,250.00');
      expect(event.related_entity_type).toBe('quote');
      expect(event.related_entity_id).toBe('quote-12345');

      // Verify job queued
      const waitingJobs = await emailQueue.getWaiting();
      expect(waitingJobs.length).toBeGreaterThan(0);
      expect(waitingJobs[0].data.communicationEventId).toBe(event.id);
    });

    it('should reject templated email with missing variables', async () => {
      const dto = {
        to: 'customer@example.com',
        template_key: 'quote-sent',
        variables: {
          company_name: 'Acme Corp',
          // Missing quote_number and quote_total
        },
      };

      const response = await request(app.getHttpServer())
        .post('/communication/send-email/templated')
        .set('X-Tenant-ID', mockTenantId)
        .send(dto)
        .expect(400);

      expect(response.body.message).toContain('Variable validation failed');
    });

    it('should enforce multi-tenant isolation on templates', async () => {
      // Create template for different tenant
      await prisma.email_template.create({
        data: {
          id: 'template-other-tenant',
          tenant_id: 'tenant-other',
          template_key: 'private-template',
          category: 'transactional',
          subject: 'Private',
          html_body: 'Private',
          text_body: 'Private',
          variables: {},
          variable_schema: {},
          is_system: false,
          is_active: true,
        },
      });

      // Attempt to use other tenant's template
      const dto = {
        to: 'customer@example.com',
        template_key: 'private-template',
        variables: {},
      };

      await request(app.getHttpServer())
        .post('/communication/send-email/templated')
        .set('X-Tenant-ID', mockTenantId)
        .send(dto)
        .expect(404);
    });

    it('should handle invalid email addresses', async () => {
      const dto = {
        to: 'invalid-email',
        template_key: 'quote-sent',
        variables: {
          company_name: 'Test',
          quote_number: 'Q-1',
          quote_total: '$100',
        },
      };

      await request(app.getHttpServer())
        .post('/communication/send-email/templated')
        .set('X-Tenant-ID', mockTenantId)
        .send(dto)
        .expect(400);
    });
  });

  describe('POST /communication/send-email/raw', () => {
    it('should queue raw email successfully', async () => {
      const dto = {
        to: 'customer@example.com',
        subject: 'Test Email',
        html_body: '<p>Hello World</p>',
        text_body: 'Hello World',
        cc: ['manager@example.com'],
        bcc: ['archive@example.com'],
      };

      const response = await request(app.getHttpServer())
        .post('/communication/send-email/raw')
        .set('X-Tenant-ID', mockTenantId)
        .set('X-User-ID', mockUserId)
        .send(dto)
        .expect(202);

      expect(response.body.job_id).toBeDefined();

      // Verify communication event created
      const event = await prisma.communication_event.findFirst({
        where: {
          tenant_id: mockTenantId,
          to_email: 'customer@example.com',
        },
      });

      expect(event).toBeDefined();
      expect(event.subject).toBe('Test Email');
      expect(event.html_body).toBe('<p>Hello World</p>');
      expect(event.template_key).toBeNull();
    });

    it('should require either html_body or text_body', async () => {
      const dto = {
        to: 'customer@example.com',
        subject: 'Test',
        // No html_body or text_body
      };

      await request(app.getHttpServer())
        .post('/communication/send-email/raw')
        .set('X-Tenant-ID', mockTenantId)
        .send(dto)
        .expect(400);
    });
  });

  describe('Security: Tenant Isolation in Communication Events', () => {
    it('should prevent access to other tenants communication events', async () => {
      // Create event for tenant A
      const eventA = await prisma.communication_event.create({
        data: {
          id: 'event-tenant-a',
          tenant_id: 'tenant-a',
          channel: 'email',
          direction: 'outbound',
          provider_id: mockProviderId,
          status: 'sent',
          to_email: 'customer-a@example.com',
          from_email: 'a@example.com',
          from_name: 'Tenant A',
          subject: 'Secret message',
          html_body: 'Confidential',
          created_by_user_id: mockUserId,
        },
      });

      // Attempt to access as tenant B
      const response = await request(app.getHttpServer())
        .get(`/communication/history/${eventA.id}`)
        .set('X-Tenant-ID', 'tenant-b')
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should only list tenant-specific communication events', async () => {
      // Create events for multiple tenants
      await prisma.communication_event.createMany({
        data: [
          {
            id: 'event-1',
            tenant_id: mockTenantId,
            channel: 'email',
            direction: 'outbound',
            provider_id: mockProviderId,
            status: 'sent',
            to_email: 'customer1@example.com',
            from_email: 'test@example.com',
            from_name: 'Test',
            subject: 'Email 1',
            html_body: 'Body 1',
            created_by_user_id: mockUserId,
          },
          {
            id: 'event-2',
            tenant_id: 'other-tenant',
            channel: 'email',
            direction: 'outbound',
            provider_id: mockProviderId,
            status: 'sent',
            to_email: 'customer2@example.com',
            from_email: 'other@example.com',
            from_name: 'Other',
            subject: 'Email 2',
            html_body: 'Body 2',
            created_by_user_id: mockUserId,
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/communication/history')
        .set('X-Tenant-ID', mockTenantId)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('event-1');
    });
  });
});
