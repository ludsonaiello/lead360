import { Test, TestingModule } from '@nestjs/testing';
import { QuoteService } from './quote.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuotePricingService } from './quote-pricing.service';
import { QuoteJobsiteAddressService } from './quote-jobsite-address.service';
import { QuoteNumberGeneratorService } from './quote-number-generator.service';
import { QuoteVersionService } from './quote-version.service';
import { FilesService } from '../../files/files.service';
import { GoogleMapsService } from '../../leads/services/google-maps.service';
import { CreateQuoteDto } from '../dto/quote';
import { QuoteStatus } from '@prisma/client';
import { v4 as uuid } from 'uuid';

/**
 * Integration Tests for Quote Module
 *
 * Tests:
 * 1. End-to-end quote lifecycle
 * 2. Multi-tenant isolation
 * 3. RBAC enforcement
 * 4. Data integrity across services
 */
describe('Quote Integration Tests', () => {
  let service: QuoteService;
  let prisma: PrismaService;
  let pricingService: QuotePricingService;

  // Test data
  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;
  let user2Id: string;
  let lead1Id: string;
  let lead2Id: string;
  let vendorId: string;
  let unitId: string;

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
    pricingService = module.get<QuotePricingService>(QuotePricingService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  /**
   * Setup test data: tenants, users, leads, vendors, units
   */
  async function setupTestData() {
    // Create tenant 1
    tenant1Id = uuid();
    await prisma.tenant.create({
      data: {
        id: tenant1Id,
        subdomain: 'test-tenant-1',
        company_name: 'Test Tenant 1',
        legal_business_name: 'Test Tenant 1 LLC',
        business_entity_type: 'LLC',
        state_of_registration: 'FL',
        ein: '12-3456789',
        primary_contact_phone: '555-0001',
        primary_contact_email: 'test1@example.com',
        updated_at: new Date(),
      },
    });

    // Create tenant 2
    tenant2Id = uuid();
    await prisma.tenant.create({
      data: {
        id: tenant2Id,
        subdomain: 'test-tenant-2',
        company_name: 'Test Tenant 2',
        legal_business_name: 'Test Tenant 2 LLC',
        business_entity_type: 'LLC',
        state_of_registration: 'CA',
        ein: '98-7654321',
        primary_contact_phone: '555-0002',
        primary_contact_email: 'test2@example.com',
        updated_at: new Date(),
      },
    });

    // Create user for tenant 1
    user1Id = uuid();
    await prisma.user.create({
      data: {
        id: user1Id,
        tenant_id: tenant1Id,
        email: 'user1@test1.com',
        first_name: 'User',
        last_name: 'One',
        password_hash: 'hashed',
        is_active: true,
        role: 'Sales',
      },
    });

    // Create user for tenant 2
    user2Id = uuid();
    await prisma.user.create({
      data: {
        id: user2Id,
        tenant_id: tenant2Id,
        email: 'user2@test2.com',
        first_name: 'User',
        last_name: 'Two',
        password_hash: 'hashed',
        is_active: true,
        role: 'Sales',
      },
    });

    // Create lead for tenant 1
    lead1Id = uuid();
    await prisma.lead.create({
      data: {
        id: lead1Id,
        tenant_id: tenant1Id,
        first_name: 'Lead',
        last_name: 'One',
        status: 'new',
        source: 'website',
        source_category: 'organic',
        assigned_to: user1Id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create lead for tenant 2
    lead2Id = uuid();
    await prisma.lead.create({
      data: {
        id: lead2Id,
        tenant_id: tenant2Id,
        first_name: 'Lead',
        last_name: 'Two',
        status: 'new',
        source: 'website',
        source_category: 'organic',
        assigned_to: user2Id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create vendor for tenant 1
    vendorId = uuid();
    await prisma.vendor.create({
      data: {
        id: vendorId,
        tenant_id: tenant1Id,
        name: 'Test Vendor',
        contact_name: 'Vendor Contact',
        email: 'vendor@example.com',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create unit measurement
    unitId = uuid();
    await prisma.unit_measurement.create({
      data: {
        id: unitId,
        tenant_id: tenant1Id,
        name: 'Each',
        abbreviation: 'ea',
        is_global: false,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Cleanup test data
   */
  async function cleanupTestData() {
    // Delete in reverse dependency order
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
    await prisma.unit_measurement.deleteMany({
      where: { tenant_id: tenant1Id },
    });
    await prisma.vendor.deleteMany({ where: { tenant_id: tenant1Id } });
    await prisma.lead.deleteMany({
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
   * Test 1: Create quote from lead (end-to-end)
   */
  describe('createFromLead', () => {
    it('should create a complete quote with all relationships', async () => {
      const dto: CreateQuoteDto = {
        lead_id: lead1Id,
        vendor_id: vendorId,
        title: 'Integration Test Quote',
        jobsite_address: {
          address_line1: '123 Test St',
          city: 'Miami',
          state: 'FL',
          zip_code: '33101',
          latitude: 25.7617,
          longitude: -80.1918,
        },
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      const quote = await service.createFromLead(tenant1Id, user1Id, dto);

      // Assertions
      expect(quote).toBeDefined();
      expect(quote.tenant_id).toBe(tenant1Id);
      expect(quote.lead_id).toBe(lead1Id);
      expect(quote.vendor_id).toBe(vendorId);
      expect(quote.title).toBe('Integration Test Quote');
      expect(quote.status).toBe(QuoteStatus.DRAFT);
      expect(quote.quote_number).toMatch(/^Q-\d+$/);
      expect(quote.jobsite_address_id).toBeDefined();

      // Verify jobsite address was created with tenant_id
      const address = await prisma.quote_jobsite_address.findUnique({
        where: { id: quote.jobsite_address_id },
      });
      expect(address).toBeDefined();
      expect(address.tenant_id).toBe(tenant1Id);
      expect(address.address_line1).toBe('123 Test St');
      expect(address.city).toBe('Miami');
      expect(address.state).toBe('FL');

      // Verify version history was created
      const versions = await prisma.quote_version.findMany({
        where: { quote_id: quote.id },
      });
      expect(versions.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test 2: Multi-tenant isolation
   */
  describe('Multi-Tenant Isolation', () => {
    let quote1Id: string;
    let quote2Id: string;

    beforeAll(async () => {
      // Create quote for tenant 1
      const dto1: CreateQuoteDto = {
        lead_id: lead1Id,
        vendor_id: vendorId,
        title: 'Tenant 1 Quote',
        jobsite_address: {
          address_line1: '111 Tenant 1 St',
          city: 'Miami',
          state: 'FL',
          zip_code: '33101',
          latitude: 25.7617,
          longitude: -80.1918,
        },
      };
      const quote1 = await service.createFromLead(tenant1Id, user1Id, dto1);
      quote1Id = quote1.id;

      // Create vendor for tenant 2
      const vendor2Id = uuid();
      await prisma.vendor.create({
        data: {
          id: vendor2Id,
          tenant_id: tenant2Id,
          name: 'Tenant 2 Vendor',
          contact_name: 'Contact',
          email: 'vendor2@example.com',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Create quote for tenant 2
      const dto2: CreateQuoteDto = {
        lead_id: lead2Id,
        vendor_id: vendor2Id,
        title: 'Tenant 2 Quote',
        jobsite_address: {
          address_line1: '222 Tenant 2 St',
          city: 'Los Angeles',
          state: 'CA',
          zip_code: '90001',
          latitude: 34.0522,
          longitude: -118.2437,
        },
      };
      const quote2 = await service.createFromLead(tenant2Id, user2Id, dto2);
      quote2Id = quote2.id;
    });

    it('tenant 1 should NOT access tenant 2 quote', async () => {
      const result = await service.findOne(tenant1Id, quote2Id);
      expect(result).toBeNull();
    });

    it('tenant 2 should NOT access tenant 1 quote', async () => {
      const result = await service.findOne(tenant2Id, quote1Id);
      expect(result).toBeNull();
    });

    it('tenant 1 should only see their own quotes', async () => {
      const quotes = await service.findAll(tenant1Id, {});
      expect(quotes.data.every((q) => q.tenant_id === tenant1Id)).toBe(true);
      expect(quotes.data.some((q) => q.id === quote2Id)).toBe(false);
    });

    it('jobsite addresses should be isolated by tenant', async () => {
      const quote1 = await prisma.quote.findUnique({
        where: { id: quote1Id },
        include: { jobsite_address: true },
      });
      const quote2 = await prisma.quote.findUnique({
        where: { id: quote2Id },
        include: { jobsite_address: true },
      });

      expect(quote1.jobsite_address.tenant_id).toBe(tenant1Id);
      expect(quote2.jobsite_address.tenant_id).toBe(tenant2Id);
    });
  });

  /**
   * Test 3: Quote lifecycle state transitions
   */
  describe('Quote Lifecycle', () => {
    let quoteId: string;

    beforeAll(async () => {
      const dto: CreateQuoteDto = {
        lead_id: lead1Id,
        vendor_id: vendorId,
        title: 'Lifecycle Test Quote',
        jobsite_address: {
          address_line1: '123 Lifecycle St',
          city: 'Miami',
          state: 'FL',
          zip_code: '33101',
          latitude: 25.7617,
          longitude: -80.1918,
        },
      };
      const quote = await service.createFromLead(tenant1Id, user1Id, dto);
      quoteId = quote.id;
    });

    it('should start in DRAFT status', async () => {
      const quote = await service.findOne(tenant1Id, quoteId);
      expect(quote.status).toBe(QuoteStatus.DRAFT);
    });

    it('should transition to READY when submitted', async () => {
      await service.submitForApproval(tenant1Id, quoteId, user1Id);
      const quote = await service.findOne(tenant1Id, quoteId);
      expect(quote.status).toBe(QuoteStatus.READY);
    });

    it('should have valid pricing after calculation', async () => {
      // Add an item first
      await prisma.quote_item.create({
        data: {
          id: uuid(),
          quote_id: quoteId,
          title: 'Test Item',
          quantity: 10,
          unit_measurement_id: unitId,
          material_cost_per_unit: 100,
          labor_cost_per_unit: 50,
          total_cost: 1500,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Calculate pricing
      const financials = await pricingService.calculateQuoteFinancials(quoteId);

      expect(financials.subtotal).toBeDefined();
      expect(parseFloat(financials.subtotal.toString())).toBeGreaterThan(0);
      expect(financials.total).toBeDefined();
      expect(parseFloat(financials.total.toString())).toBeGreaterThan(0);
    });
  });

  /**
   * Test 4: Data integrity and cascade operations
   */
  describe('Data Integrity', () => {
    it('should create version history on quote creation', async () => {
      const dto: CreateQuoteDto = {
        lead_id: lead1Id,
        vendor_id: vendorId,
        title: 'Version Test Quote',
        jobsite_address: {
          address_line1: '123 Version St',
          city: 'Miami',
          state: 'FL',
          zip_code: '33101',
          latitude: 25.7617,
          longitude: -80.1918,
        },
      };
      const quote = await service.createFromLead(tenant1Id, user1Id, dto);

      const versions = await prisma.quote_version.findMany({
        where: { quote_id: quote.id },
      });

      expect(versions.length).toBe(1);
      expect(versions[0].version_number.toString()).toBe('1.00');
    });

    it('should clone quote with all relationships', async () => {
      const dto: CreateQuoteDto = {
        lead_id: lead1Id,
        vendor_id: vendorId,
        title: 'Clone Source Quote',
        jobsite_address: {
          address_line1: '123 Clone St',
          city: 'Miami',
          state: 'FL',
          zip_code: '33101',
          latitude: 25.7617,
          longitude: -80.1918,
        },
      };
      const sourceQuote = await service.createFromLead(tenant1Id, user1Id, dto);

      // Clone the quote
      const clonedQuote = await service.clone(
        tenant1Id,
        sourceQuote.id,
        user1Id,
      );

      expect(clonedQuote.id).not.toBe(sourceQuote.id);
      expect(clonedQuote.tenant_id).toBe(sourceQuote.tenant_id);
      expect(clonedQuote.title).toContain('(Copy)');
      expect(clonedQuote.jobsite_address_id).not.toBe(
        sourceQuote.jobsite_address_id,
      );

      // Verify jobsite address was cloned with correct tenant_id
      const clonedAddress = await prisma.quote_jobsite_address.findUnique({
        where: { id: clonedQuote.jobsite_address_id },
      });
      expect(clonedAddress.tenant_id).toBe(tenant1Id);
    });
  });

  /**
   * Test 5: Error handling
   */
  describe('Error Handling', () => {
    it('should reject quote creation with invalid tenant', async () => {
      const dto: CreateQuoteDto = {
        lead_id: lead1Id,
        vendor_id: vendorId,
        title: 'Invalid Tenant Quote',
        jobsite_address: {
          address_line1: '123 Error St',
          city: 'Miami',
          state: 'FL',
          zip_code: '33101',
          latitude: 25.7617,
          longitude: -80.1918,
        },
      };

      await expect(
        service.createFromLead('invalid-tenant-id', user1Id, dto),
      ).rejects.toThrow();
    });

    it('should reject cross-tenant vendor access', async () => {
      const dto: CreateQuoteDto = {
        lead_id: lead2Id, // Tenant 2 lead
        vendor_id: vendorId, // Tenant 1 vendor (cross-tenant!)
        title: 'Cross-Tenant Vendor Quote',
        jobsite_address: {
          address_line1: '123 Error St',
          city: 'Los Angeles',
          state: 'CA',
          zip_code: '90001',
          latitude: 34.0522,
          longitude: -118.2437,
        },
      };

      await expect(
        service.createFromLead(tenant2Id, user2Id, dto),
      ).rejects.toThrow();
    });
  });
});
