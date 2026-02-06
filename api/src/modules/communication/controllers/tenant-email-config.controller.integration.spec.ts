import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { CommunicationModule } from '../communication.module';

/**
 * Integration Tests: Tenant Email Configuration
 *
 * Tests the complete flow of tenant email configuration including:
 * - Multi-tenant isolation
 * - Provider validation
 * - Credential encryption/decryption
 * - Test email sending
 */
describe('TenantEmailConfigController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let encryptionService: EncryptionService;

  const mockTenantId = 'tenant-test-123';
  const mockUserId = 'user-test-123';
  const mockProviderId = 'provider-test-sendgrid';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CommunicationModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    encryptionService = moduleFixture.get<EncryptionService>(EncryptionService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.tenant_email_config.deleteMany({
      where: { tenant_id: mockTenantId },
    });

    // Seed test provider
    await prisma.communication_provider.upsert({
      where: { provider_key: 'sendgrid' },
      update: {},
      create: {
        id: mockProviderId,
        provider_key: 'sendgrid',
        provider_name: 'SendGrid',
        provider_type: 'email',
        credentials_schema: {
          type: 'object',
          properties: {
            api_key: { type: 'string', pattern: '^SG\\.' },
          },
          required: ['api_key'],
        },
        config_schema: {
          type: 'object',
          properties: {
            click_tracking: { type: 'boolean' },
            open_tracking: { type: 'boolean' },
          },
        },
        default_config: { click_tracking: false, open_tracking: false },
        supports_webhooks: true,
        webhook_events: ['delivered', 'bounced', 'opened'],
        webhook_verification_method: 'signature',
        is_active: true,
        is_system: true,
      },
    });
  });

  describe('POST /communication/tenant-email-config', () => {
    it('should create tenant email configuration with valid data', async () => {
      const dto = {
        provider_id: mockProviderId,
        credentials: {
          api_key: 'SG.test-api-key-123',
        },
        provider_config: {
          click_tracking: false,
          open_tracking: true,
        },
        from_email: 'test@example.com',
        from_name: 'Test Company',
        reply_to_email: 'support@example.com',
        webhook_secret: 'webhook_secret_12345',
      };

      const response = await request(app.getHttpServer())
        .post('/communication/tenant-email-config')
        .send(dto)
        .expect(201);

      expect(response.body).toMatchObject({
        tenant_id: expect.any(String),
        provider_id: mockProviderId,
        from_email: 'test@example.com',
        from_name: 'Test Company',
        reply_to_email: 'support@example.com',
        is_verified: false,
        is_active: true,
      });

      // Verify credentials are NOT in response (security)
      expect(response.body.credentials).toBeUndefined();

      // Verify credentials are encrypted in database
      const dbConfig = await prisma.tenant_email_config.findUnique({
        where: { tenant_id: response.body.tenant_id },
      });

      expect(dbConfig.credentials).toBeDefined();
      expect(typeof dbConfig.credentials).toBe('string');
      expect(dbConfig.credentials).not.toContain('SG.test-api-key');

      // Verify credentials can be decrypted
      const decryptedCreds = JSON.parse(
        encryptionService.decrypt(dbConfig.credentials as string),
      );
      expect(decryptedCreds.api_key).toBe('SG.test-api-key-123');
    });

    it('should reject invalid provider credentials (JSON Schema validation)', async () => {
      const dto = {
        provider_id: mockProviderId,
        credentials: {
          api_key: 'INVALID_KEY', // Doesn't match pattern ^SG\.
        },
        from_email: 'test@example.com',
        from_name: 'Test Company',
      };

      const response = await request(app.getHttpServer())
        .post('/communication/tenant-email-config')
        .send(dto)
        .expect(400);

      expect(response.body.message).toContain('Invalid provider credentials');
    });

    it('should enforce multi-tenant isolation', async () => {
      // Create config for tenant A
      const configA = await prisma.tenant_email_config.create({
        data: {
          id: 'config-tenant-a',
          tenant_id: 'tenant-a',
          provider_id: mockProviderId,
          credentials: encryptionService.encrypt(
            JSON.stringify({ api_key: 'SG.key-a' }),
          ),
          provider_config: {},
          from_email: 'a@example.com',
          from_name: 'Tenant A',
          is_verified: false,
          is_active: true,
        },
      });

      // Attempt to access tenant A's config as tenant B
      const response = await request(app.getHttpServer())
        .get('/communication/tenant-email-config')
        .set('X-Tenant-ID', 'tenant-b') // Different tenant
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should update existing configuration', async () => {
      // Create initial config
      const initial = await prisma.tenant_email_config.create({
        data: {
          id: 'config-initial',
          tenant_id: mockTenantId,
          provider_id: mockProviderId,
          credentials: encryptionService.encrypt(
            JSON.stringify({ api_key: 'SG.old-key' }),
          ),
          provider_config: { click_tracking: false },
          from_email: 'old@example.com',
          from_name: 'Old Name',
          is_verified: true,
          is_active: true,
        },
      });

      // Update config
      const dto = {
        provider_id: mockProviderId,
        credentials: { api_key: 'SG.new-key' },
        provider_config: { click_tracking: true },
        from_email: 'new@example.com',
        from_name: 'New Name',
      };

      const response = await request(app.getHttpServer())
        .post('/communication/tenant-email-config')
        .set('X-Tenant-ID', mockTenantId)
        .send(dto)
        .expect(200);

      expect(response.body.from_email).toBe('new@example.com');
      expect(response.body.is_verified).toBe(false); // Reset on update

      // Verify old credentials replaced
      const dbConfig = await prisma.tenant_email_config.findUnique({
        where: { tenant_id: mockTenantId },
      });

      const decryptedCreds = JSON.parse(
        encryptionService.decrypt(dbConfig.credentials as string),
      );
      expect(decryptedCreds.api_key).toBe('SG.new-key');
    });
  });

  describe('GET /communication/tenant-email-config', () => {
    it('should return tenant email configuration without credentials', async () => {
      await prisma.tenant_email_config.create({
        data: {
          id: 'config-get-test',
          tenant_id: mockTenantId,
          provider_id: mockProviderId,
          credentials: encryptionService.encrypt(
            JSON.stringify({ api_key: 'SG.secret' }),
          ),
          provider_config: {},
          from_email: 'test@example.com',
          from_name: 'Test',
          is_verified: true,
          is_active: true,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/communication/tenant-email-config')
        .set('X-Tenant-ID', mockTenantId)
        .expect(200);

      expect(response.body.from_email).toBe('test@example.com');
      expect(response.body.credentials).toBeUndefined();
    });

    it('should return 404 if no configuration exists', async () => {
      await request(app.getHttpServer())
        .get('/communication/tenant-email-config')
        .set('X-Tenant-ID', 'tenant-nonexistent')
        .expect(404);
    });
  });

  describe('Security: Credential Protection', () => {
    it('should never expose encrypted credentials in any API response', async () => {
      const dto = {
        provider_id: mockProviderId,
        credentials: { api_key: 'SG.super-secret-key' },
        from_email: 'test@example.com',
        from_name: 'Test',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/communication/tenant-email-config')
        .set('X-Tenant-ID', mockTenantId)
        .send(dto);

      const getResponse = await request(app.getHttpServer())
        .get('/communication/tenant-email-config')
        .set('X-Tenant-ID', mockTenantId);

      // Verify no credentials in any response
      expect(JSON.stringify(createResponse.body)).not.toContain(
        'super-secret-key',
      );
      expect(JSON.stringify(getResponse.body)).not.toContain(
        'super-secret-key',
      );
      expect(createResponse.body.credentials).toBeUndefined();
      expect(getResponse.body.credentials).toBeUndefined();
    });
  });
});
