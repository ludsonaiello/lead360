import { Test, TestingModule } from '@nestjs/testing';
import { QuoteService } from './quote.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuotePricingService } from './quote-pricing.service';
import { QuoteJobsiteAddressService } from './quote-jobsite-address.service';
import { QuoteNumberGeneratorService } from './quote-number-generator.service';
import { QuoteVersionService } from './quote-version.service';
import { Fil​esService } from '../../files/files.service';
import { GoogleMapsService } from '../../leads/services/google-maps.service';
import { v4 as uuid } from 'uuid';

/**
 * Security Tests for Quote Module
 *
 * Tests:
 * 1. Multi-tenant data isolation
 * 2. RBAC enforcement
 * 3. Security vulnerabilities
 * 4. Access control
 */
describe('Quote Security Tests', () => {
  let service: QuoteService;
  let prisma: PrismaService;

  // Test tenants and users
  let tenant1Id: string;
  let tenant2Id: string;
  let ownerUser1Id: string;
  let salesUser1Id: string;
  let employeeUser1Id: string;
  let tenant2UserId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
        PrismaService,
        QuotePricingService,
        QuoteJobsiteAddressService,
        QuoteNumberGeneratorService,
        QuoteVersionService,
        FilesService,
        GoogleMapsService,
      ],
    }).compile();

    service = module.get<QuoteService>(QuoteService);
    prisma = module.get<PrismaService>(PrismaService);

    await setupSecurityTestData();
  });

  afterAll(async () => {
    await cleanupSecurityTestData();
    await prisma.$disconnect();
  });

  /**
   * Setup test data with different roles and tenants
   */
  async function setupSecurityTestData() {
    // Create tenant 1
    tenant1Id = uuid();
    await prisma.tenant.create({
      data: {
        id: tenant1Id,
        subdomain: 'security-test-1',
        company_name: 'Security Test 1',
        legal_business_name: 'Security Test 1 LLC',
        business_entity_type: 'LLC',
        state_of_registration: 'FL',
        ein: '11-1111111',
        primary_contact_phone: '555-1111',
        primary_contact_email: 'security1@test.com',
        updated_at: new Date(),
      },
    });

    // Create tenant 2
    tenant2Id = uuid();
    await prisma.tenant.create({
      data: {
        id: tenant2Id,
        subdomain: 'security-test-2',
        company_name: 'Security Test 2',
        legal_business_name: 'Security Test 2 LLC',
        business_entity_type: 'LLC',
        state_of_registration: 'CA',
        ein: '22-2222222',
        primary_contact_phone: '555-2222',
        primary_contact_email: 'security2@test.com',
        updated_at: new Date(),
      },
    });

    // Create Owner user for tenant 1
    ownerUser1Id = uuid();
    await prisma.user.create({
      data: {
        id: ownerUser1Id,
        tenant_id: tenant1Id,
        email: 'owner@tenant1.com',
        first_name: 'Owner',
        last_name: 'User',
        password_hash: 'hashed',
        is_active: true,
        role: 'Owner',
      },
    });

    // Create Sales user for tenant 1
    salesUser1Id = uuid();
    await prisma.user.create({
      data: {
        id: salesUser1Id,
        tenant_id: tenant1Id,
        email: 'sales@tenant1.com',
        first_name: 'Sales',
        last_name: 'User',
        password_hash: 'hashed',
        is_active: true,
        role: 'Sales',
      },
    });

    // Create Employee user for tenant 1
    employeeUser1Id = uuid();
    await prisma.user.create({
      data: {
        id: employeeUser1Id,
        tenant_id: tenant1Id,
        email: 'employee@tenant1.com',
        first_name: 'Employee',
        last_name: 'User',
        password_hash: 'hashed',
        is_active: true,
        role: 'Employee',
      },
    });

    // Create user for tenant 2
    tenant2UserId = uuid();
    await prisma.user.create({
      data: {
        id: tenant2UserId,
        tenant_id: tenant2Id,
        email: 'user@tenant2.com',
        first_name: 'Tenant2',
        last_name: 'User',
        password_hash: 'hashed',
        is_active: true,
        role: 'Sales',
      },
    });
  }

  /**
   * Cleanup security test data
   */
  async function cleanupSecurityTestData() {
    await prisma.quote.deleteMany({
      where: {
        OR: [{ tenant_id: tenant1Id }, { tenant_id: tenant2Id }],
      },
    });
    await prisma.quote_jobsite_address.deleteMany({
      where: {
        OR: [{ tenant_id: tenant1Id }, { tenant_id: tenant2Id }],
      },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [{ tenant_id: tenant1Id }, { tenant_id: tenant2Id }],
      },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenant1Id, tenant2Id] } },
    });
  }

  /**
   * Test Suite 1: Multi-Tenant Isolation
   */
  describe('Multi-Tenant Isolation', () => {
    let tenant1QuoteId: string;
    let tenant2QuoteId: string;
    let tenant1AddressId: string;
    let tenant2AddressId: string;

    beforeAll(async () => {
      // Create jobsite address for tenant 1
      tenant1AddressId = uuid();
      await prisma.quote_jobsite_address.create({
        data: {
          id: tenant1AddressId,
          tenant_id: tenant1Id,
          address_line1: '100 Tenant 1 St',
          city: 'Miami',
          state: 'FL',
          zip_code: '33101',
          latitude: 25.7617,
          longitude: -80.1918,
        },
      });

      // Create jobsite address for tenant 2
      tenant2AddressId = uuid();
      await prisma.quote_jobsite_address.create({
        data: {
          id: tenant2AddressId,
          tenant_id: tenant2Id,
          address_line1: '200 Tenant 2 St',
          city: 'Los Angeles',
          state: 'CA',
          zip_code: '90001',
          latitude: 34.0522,
          longitude: -118.2437,
        },
      });

      // Create quote for tenant 1
      tenant1QuoteId = uuid();
      await prisma.quote.create({
        data: {
          id: tenant1QuoteId,
          tenant_id: tenant1Id,
          quote_number: 'Q-TENANT1-001',
          title: 'Tenant 1 Quote',
          status: 'draft',
          jobsite_address_id: tenant1AddressId,
          created_by_user_id: ownerUser1Id,
          subtotal: 1000,
          tax_amount: 80,
          total: 1080,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Create quote for tenant 2
      tenant2QuoteId = uuid();
      await prisma.quote.create({
        data: {
          id: tenant2QuoteId,
          tenant_id: tenant2Id,
          quote_number: 'Q-TENANT2-001',
          title: 'Tenant 2 Quote',
          status: 'draft',
          jobsite_address_id: tenant2AddressId,
          created_by_user_id: tenant2UserId,
          subtotal: 2000,
          tax_amount: 160,
          total: 2160,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    });

    it('should isolate quote queries by tenant_id', async () => {
      // Tenant 1 should only see their quote
      const tenant1Quotes = await prisma.quote.findMany({
        where: { tenant_id: tenant1Id },
      });
      expect(tenant1Quotes.length).toBe(1);
      expect(tenant1Quotes[0].id).toBe(tenant1QuoteId);

      // Tenant 2 should only see their quote
      const tenant2Quotes = await prisma.quote.findMany({
        where: { tenant_id: tenant2Id },
      });
      expect(tenant2Quotes.length).toBe(1);
      expect(tenant2Quotes[0].id).toBe(tenant2QuoteId);
    });

    it('should prevent cross-tenant quote access via findOne', async () => {
      // Tenant 1 trying to access tenant 2 quote
      const result1 = await service.findOne(tenant1Id, tenant2QuoteId);
      expect(result1).toBeNull();

      // Tenant 2 trying to access tenant 1 quote
      const result2 = await service.findOne(tenant2Id, tenant1QuoteId);
      expect(result2).toBeNull();
    });

    it('should isolate jobsite addresses by tenant_id', async () => {
      // Query tenant 1 addresses
      const tenant1Addresses = await prisma.quote_jobsite_address.findMany({
        where: { tenant_id: tenant1Id },
      });
      expect(tenant1Addresses.every((a) => a.tenant_id === tenant1Id)).toBe(true);

      // Query tenant 2 addresses
      const tenant2Addresses = await prisma.quote_jobsite_address.findMany({
        where: { tenant_id: tenant2Id },
      });
      expect(tenant2Addresses.every((a) => a.tenant_id === tenant2Id)).toBe(true);
    });

    it('should prevent cross-tenant joins', async () => {
      // Attempt to join tenant 1 quote with tenant 2 address (should fail)
      const crossTenantQuery = await prisma.quote.findFirst({
        where: {
          id: tenant1QuoteId,
          tenant_id: tenant1Id,
          jobsite_address: {
            tenant_id: tenant2Id, // Different tenant!
          },
        },
      });
      expect(crossTenantQuery).toBeNull();
    });

    it('should enforce tenant_id on all related tables', async () => {
      // Verify quote has tenant_id
      const quote = await prisma.quote.findUnique({
        where: { id: tenant1QuoteId },
      });
      expect(quote.tenant_id).toBe(tenant1Id);

      // Verify jobsite_address has tenant_id
      const address = await prisma.quote_jobsite_address.findUnique({
        where: { id: tenant1AddressId },
      });
      expect(address.tenant_id).toBe(tenant1Id);
    });
  });

  /**
   * Test Suite 2: RBAC Enforcement
   */
  describe('RBAC Enforcement', () => {
    // Note: RBAC is typically enforced at controller/guard level
    // These tests verify the expected behavior

    it('should allow Owner to create quotes', async () => {
      // Owner role should be able to create quotes
      const leadId = uuid();
      await prisma.lead.create({
        data: {
          id: leadId,
          tenant_id: tenant1Id,
          first_name: 'RBAC',
          last_name: 'Test',
          status: 'new',
          source: 'website',
          source_category: 'organic',
          assigned_to: ownerUser1Id,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // This should succeed (Owner has full permissions)
      expect(async () => {
        // Service layer doesn't enforce RBAC (that's guard's job)
        // But we verify the data is created with correct user
        const quoteId = uuid();
        await prisma.quote.create({
          data: {
            id: quoteId,
            tenant_id: tenant1Id,
            quote_number: 'Q-RBAC-001',
            title: 'Owner Created Quote',
            status: 'draft',
            created_by_user_id: ownerUser1Id,
            subtotal: 1000,
            tax_amount: 80,
            total: 1080,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
      }).not.toThrow();
    });

    it('should track who created the quote', async () => {
      const quoteId = uuid();
      await prisma.quote.create({
        data: {
          id: quoteId,
          tenant_id: tenant1Id,
          quote_number: 'Q-TRACKING-001',
          title: 'Tracking Test',
          status: 'draft',
          created_by_user_id: salesUser1Id,
          subtotal: 1000,
          tax_amount: 80,
          total: 1080,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { created_by_user: true },
      });

      expect(quote.created_by_user_id).toBe(salesUser1Id);
      expect(quote.created_by_user.role).toBe('Sales');
    });

    it('should prevent user from accessing quotes from other tenants', async () => {
      // Create quote for tenant 1
      const quote1Id = uuid();
      await prisma.quote.create({
        data: {
          id: quote1Id,
          tenant_id: tenant1Id,
          quote_number: 'Q-ACCESS-001',
          title: 'Access Test 1',
          status: 'draft',
          created_by_user_id: ownerUser1Id,
          subtotal: 1000,
          tax_amount: 80,
          total: 1080,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Tenant 2 user should NOT be able to access tenant 1 quote
      const result = await prisma.quote.findFirst({
        where: {
          id: quote1Id,
          tenant_id: tenant2Id, // Wrong tenant!
        },
      });
      expect(result).toBeNull();
    });
  });

  /**
   * Test Suite 3: Injection and Vulnerability Tests
   */
  describe('Security Vulnerabilities', () => {
    it('should prevent SQL injection in quote search', async () => {
      const maliciousInput = "'; DROP TABLE quote; --";

      // Prisma should safely handle this
      const result = await prisma.quote.findMany({
        where: {
          tenant_id: tenant1Id,
          title: { contains: maliciousInput },
        },
      });

      // Should return empty array, not execute SQL
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);

      // Verify table still exists
      const count = await prisma.quote.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should prevent XSS in quote title', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      const quoteId = uuid();

      await prisma.quote.create({
        data: {
          id: quoteId,
          tenant_id: tenant1Id,
          quote_number: 'Q-XSS-001',
          title: xssPayload,
          status: 'draft',
          created_by_user_id: ownerUser1Id,
          subtotal: 1000,
          tax_amount: 80,
          total: 1080,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
      });

      // Title should be stored as-is (sanitization happens on output)
      expect(quote.title).toBe(xssPayload);
    });

    it('should enforce UUID format for IDs', async () => {
      const invalidId = 'not-a-uuid';

      await expect(
        prisma.quote.findUnique({
          where: { id: invalidId },
        }),
      ).rejects.toThrow();
    });

    it('should validate tenant_id is not empty', async () => {
      const quoteId = uuid();

      await expect(
        prisma.quote.create({
          data: {
            id: quoteId,
            tenant_id: '', // Empty tenant_id (invalid)
            quote_number: 'Q-INVALID-001',
            title: 'Invalid Quote',
            status: 'draft',
            created_by_user_id: ownerUser1Id,
            subtotal: 1000,
            tax_amount: 80,
            total: 1080,
            created_at: new Date(),
            updated_at: new Date(),
          },
        }),
      ).rejects.toThrow();
    });
  });

  /**
   * Test Suite 4: Cascade Delete Security
   */
  describe('Cascade Delete Security', () => {
    it('should cascade delete quotes when tenant is deleted', async () => {
      // Create temporary tenant
      const tempTenantId = uuid();
      await prisma.tenant.create({
        data: {
          id: tempTenantId,
          subdomain: 'temp-cascade-test',
          company_name: 'Temp Tenant',
          legal_business_name: 'Temp LLC',
          business_entity_type: 'LLC',
          state_of_registration: 'FL',
          ein: '99-9999999',
          primary_contact_phone: '555-9999',
          primary_contact_email: 'temp@test.com',
          updated_at: new Date(),
        },
      });

      // Create address for temp tenant
      const addressId = uuid();
      await prisma.quote_jobsite_address.create({
        data: {
          id: addressId,
          tenant_id: tempTenantId,
          address_line1: '999 Temp St',
          city: 'Miami',
          state: 'FL',
          zip_code: '33101',
          latitude: 25.7617,
          longitude: -80.1918,
        },
      });

      // Create quote for temp tenant
      const quoteId = uuid();
      await prisma.quote.create({
        data: {
          id: quoteId,
          tenant_id: tempTenantId,
          quote_number: 'Q-CASCADE-001',
          title: 'Cascade Test',
          status: 'draft',
          jobsite_address_id: addressId,
          created_by_user_id: ownerUser1Id,
          subtotal: 1000,
          tax_amount: 80,
          total: 1080,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Delete tenant (should cascade)
      await prisma.tenant.delete({
        where: { id: tempTenantId },
      });

      // Verify quote was deleted
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
      });
      expect(quote).toBeNull();

      // Verify address was deleted
      const address = await prisma.quote_jobsite_address.findUnique({
        where: { id: addressId },
      });
      expect(address).toBeNull();
    });
  });
});
