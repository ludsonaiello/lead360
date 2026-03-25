import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ProjectInvoiceService } from './project-invoice.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { InvoiceNumberGeneratorService } from './invoice-number-generator.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const INVOICE_ID = 'invoice-uuid-001';
const MILESTONE_ID = 'milestone-uuid-001';
const PAYMENT_ID = 'payment-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockInvoice = (overrides: any = {}) => ({
  id: INVOICE_ID,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID,
  invoice_number: 'INV-0001',
  milestone_id: null,
  description: 'Kitchen remodel — deposit',
  amount: 10000,
  tax_amount: null,
  amount_paid: 0,
  amount_due: 10000,
  status: 'draft',
  due_date: null,
  sent_at: null,
  paid_at: null,
  voided_at: null,
  voided_reason: null,
  notes: null,
  created_by_user_id: USER_ID,
  updated_by_user_id: null,
  created_at: new Date('2026-03-20T10:00:00.000Z'),
  updated_at: new Date('2026-03-20T10:00:00.000Z'),
  ...overrides,
});

const mockPayment = (overrides: any = {}) => ({
  id: PAYMENT_ID,
  tenant_id: TENANT_ID,
  invoice_id: INVOICE_ID,
  project_id: PROJECT_ID,
  amount: 5000,
  payment_date: new Date('2026-03-20'),
  payment_method: 'check',
  payment_method_registry_id: null,
  reference_number: null,
  notes: null,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-03-20T10:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  project_invoice: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  project_invoice_payment: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  project_draw_milestone: {
    update: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  tenant: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrismaService)),
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

const mockInvoiceNumberGeneratorService = {
  generate: jest.fn().mockResolvedValue('INV-0001'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectInvoiceService', () => {
  let service: ProjectInvoiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectInvoiceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        {
          provide: InvoiceNumberGeneratorService,
          useValue: mockInvoiceNumberGeneratorService,
        },
      ],
    }).compile();

    service = module.get<ProjectInvoiceService>(ProjectInvoiceService);

    jest.clearAllMocks();
  });

  // =========================================================================
  // recordPayment()
  // =========================================================================

  describe('recordPayment()', () => {
    it('should create payment and update invoice amounts atomically — partial payment', async () => {
      const invoice = mockInvoice({
        amount: 10000,
        amount_due: 10000,
        amount_paid: 0,
        status: 'sent',
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const createdPayment = mockPayment({ amount: 5000 });
      mockPrismaService.project_invoice_payment.create.mockResolvedValue(createdPayment);
      mockPrismaService.project_invoice.update.mockResolvedValue(undefined);

      const result = await service.recordPayment(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        {
          amount: 5000,
          payment_date: '2026-03-20',
          payment_method: 'check',
        },
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);

      // Verify payment record created
      expect(mockPrismaService.project_invoice_payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_ID,
          invoice_id: INVOICE_ID,
          project_id: PROJECT_ID,
          amount: 5000,
          payment_method: 'check',
        }),
      });

      // Verify invoice updated: amount_paid=5000, amount_due=5000, status=partial
      expect(mockPrismaService.project_invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          amount_paid: 5000,
          amount_due: 5000,
          status: 'partial',
        }),
      });

      expect(result.amount).toBe(5000);
    });

    it('should transition invoice to paid when amount_due reaches 0', async () => {
      const invoice = mockInvoice({
        amount: 10000,
        amount_due: 5000,
        amount_paid: 5000,
        status: 'partial',
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const createdPayment = mockPayment({ amount: 5000 });
      mockPrismaService.project_invoice_payment.create.mockResolvedValue(createdPayment);
      mockPrismaService.project_invoice.update.mockResolvedValue(undefined);

      await service.recordPayment(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        {
          amount: 5000,
          payment_date: '2026-03-20',
          payment_method: 'bank_transfer',
        },
      );

      // Verify invoice updated: amount_paid=10000, amount_due=0, status=paid, paid_at set
      expect(mockPrismaService.project_invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          amount_paid: 10000,
          amount_due: 0,
          status: 'paid',
          paid_at: expect.any(Date),
        }),
      });
    });

    it('should transition milestone to paid when invoice is fully paid', async () => {
      const invoice = mockInvoice({
        amount: 10000,
        amount_due: 10000,
        amount_paid: 0,
        status: 'sent',
        milestone_id: MILESTONE_ID,
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const createdPayment = mockPayment({ amount: 10000 });
      mockPrismaService.project_invoice_payment.create.mockResolvedValue(createdPayment);
      mockPrismaService.project_invoice.update.mockResolvedValue(undefined);
      mockPrismaService.project_draw_milestone.update.mockResolvedValue(undefined);

      await service.recordPayment(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        {
          amount: 10000,
          payment_date: '2026-03-20',
          payment_method: 'cash',
        },
      );

      // Verify milestone updated to paid
      expect(mockPrismaService.project_draw_milestone.update).toHaveBeenCalledWith({
        where: { id: MILESTONE_ID },
        data: {
          status: 'paid',
          paid_at: expect.any(Date),
        },
      });
    });

    it('should NOT update milestone when invoice paid but no milestone_id', async () => {
      const invoice = mockInvoice({
        amount: 5000,
        amount_due: 5000,
        amount_paid: 0,
        status: 'sent',
        milestone_id: null,
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const createdPayment = mockPayment({ amount: 5000 });
      mockPrismaService.project_invoice_payment.create.mockResolvedValue(createdPayment);
      mockPrismaService.project_invoice.update.mockResolvedValue(undefined);

      await service.recordPayment(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        {
          amount: 5000,
          payment_date: '2026-03-20',
          payment_method: 'zelle',
        },
      );

      // Invoice should be paid
      expect(mockPrismaService.project_invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({ status: 'paid' }),
      });

      // Milestone should NOT be touched
      expect(mockPrismaService.project_draw_milestone.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for overpayment', async () => {
      const invoice = mockInvoice({
        amount: 10000,
        amount_due: 5000,
        amount_paid: 5000,
        status: 'partial',
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        service.recordPayment(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID, {
          amount: 6000,
          payment_date: '2026-03-20',
          payment_method: 'check',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for voided invoice', async () => {
      const invoice = mockInvoice({ status: 'voided' });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        service.recordPayment(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID, {
          amount: 1000,
          payment_date: '2026-03-20',
          payment_method: 'cash',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent invoice', async () => {
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.recordPayment(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID, {
          amount: 1000,
          payment_date: '2026-03-20',
          payment_method: 'cash',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should correctly handle tax_amount in amount_due calculation', async () => {
      const invoice = mockInvoice({
        amount: 10000,
        tax_amount: 500,
        amount_due: 10500,
        amount_paid: 0,
        status: 'sent',
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const createdPayment = mockPayment({ amount: 10500 });
      mockPrismaService.project_invoice_payment.create.mockResolvedValue(createdPayment);
      mockPrismaService.project_invoice.update.mockResolvedValue(undefined);

      await service.recordPayment(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        {
          amount: 10500,
          payment_date: '2026-03-20',
          payment_method: 'bank_transfer',
        },
      );

      // amount + tax_amount - amount_paid = 10000 + 500 - 10500 = 0
      expect(mockPrismaService.project_invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          amount_paid: 10500,
          amount_due: 0,
          status: 'paid',
        }),
      });
    });
  });

  // =========================================================================
  // voidInvoice()
  // =========================================================================

  describe('voidInvoice()', () => {
    it('should void invoice and reset linked milestone to pending', async () => {
      const invoice = mockInvoice({
        status: 'sent',
        milestone_id: MILESTONE_ID,
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const voidedInvoice = mockInvoice({
        status: 'voided',
        voided_at: new Date(),
        voided_reason: 'Customer cancelled',
      });
      mockPrismaService.project_invoice.update.mockResolvedValue(voidedInvoice);
      mockPrismaService.project_draw_milestone.update.mockResolvedValue(undefined);

      const result = await service.voidInvoice(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        { voided_reason: 'Customer cancelled' },
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);

      // Verify invoice voided
      expect(mockPrismaService.project_invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          status: 'voided',
          voided_at: expect.any(Date),
          voided_reason: 'Customer cancelled',
        }),
      });

      // Verify milestone reset to pending
      expect(mockPrismaService.project_draw_milestone.update).toHaveBeenCalledWith({
        where: { id: MILESTONE_ID },
        data: {
          status: 'pending',
          invoice_id: null,
          invoiced_at: null,
        },
      });

      // Verify audit log includes milestone_reset metadata
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            milestone_reset: true,
            voided_reason: 'Customer cancelled',
          }),
        }),
      );
    });

    it('should throw BadRequestException for already voided invoice', async () => {
      const invoice = mockInvoice({ status: 'voided' });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        service.voidInvoice(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID, {
          voided_reason: 'Duplicate',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should void invoice without milestone (manual invoice)', async () => {
      const invoice = mockInvoice({
        status: 'draft',
        milestone_id: null,
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const voidedInvoice = mockInvoice({
        status: 'voided',
        voided_at: new Date(),
        voided_reason: 'Wrong amount',
      });
      mockPrismaService.project_invoice.update.mockResolvedValue(voidedInvoice);

      await service.voidInvoice(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        { voided_reason: 'Wrong amount' },
      );

      // Milestone should NOT be touched
      expect(mockPrismaService.project_draw_milestone.update).not.toHaveBeenCalled();

      // Audit metadata shows milestone_reset: false
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            milestone_reset: false,
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent invoice', async () => {
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.voidInvoice(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID, {
          voided_reason: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // markSent()
  // =========================================================================

  describe('markSent()', () => {
    it('should transition draft to sent with sent_at timestamp', async () => {
      const invoice = mockInvoice({ status: 'draft' });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const sentInvoice = mockInvoice({
        status: 'sent',
        sent_at: new Date(),
      });
      mockPrismaService.project_invoice.update.mockResolvedValue(sentInvoice);

      const result = await service.markSent(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
      );

      expect(mockPrismaService.project_invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: {
          status: 'sent',
          sent_at: expect.any(Date),
          updated_by_user_id: USER_ID,
        },
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for non-draft invoice', async () => {
      const invoice = mockInvoice({ status: 'sent' });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        service.markSent(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for paid invoice', async () => {
      const invoice = mockInvoice({ status: 'paid' });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        service.markSent(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent invoice', async () => {
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.markSent(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update()', () => {
    it('should recompute amount_due when amount changes', async () => {
      const invoice = mockInvoice({
        status: 'draft',
        amount: 10000,
        tax_amount: 500,
        amount_paid: 0,
        amount_due: 10500,
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const updatedInvoice = mockInvoice({
        status: 'draft',
        amount: 15000,
        tax_amount: 500,
        amount_due: 15500,
      });
      mockPrismaService.project_invoice.update.mockResolvedValue(updatedInvoice);

      const result = await service.update(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        { amount: 15000 },
      );

      // amount_due should be recomputed: 15000 + 500 - 0 = 15500
      expect(mockPrismaService.project_invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          amount: 15000,
          amount_due: 15500,
          updated_by_user_id: USER_ID,
        }),
      });
    });

    it('should recompute amount_due when tax_amount changes', async () => {
      const invoice = mockInvoice({
        status: 'draft',
        amount: 10000,
        tax_amount: 500,
        amount_paid: 0,
        amount_due: 10500,
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const updatedInvoice = mockInvoice({
        status: 'draft',
        amount: 10000,
        tax_amount: 1000,
        amount_due: 11000,
      });
      mockPrismaService.project_invoice.update.mockResolvedValue(updatedInvoice);

      await service.update(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        { tax_amount: 1000 },
      );

      // amount_due recomputed: 10000 + 1000 - 0 = 11000
      expect(mockPrismaService.project_invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          tax_amount: 1000,
          amount_due: 11000,
        }),
      });
    });

    it('should throw BadRequestException for non-draft invoice', async () => {
      const invoice = mockInvoice({ status: 'sent' });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID, {
          description: 'Updated',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent invoice', async () => {
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, INVOICE_ID, USER_ID, {
          description: 'Updated',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update description without recomputing amount_due', async () => {
      const invoice = mockInvoice({
        status: 'draft',
        amount: 10000,
        tax_amount: 500,
        amount_due: 10500,
      });
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(invoice);

      const updatedInvoice = mockInvoice({
        status: 'draft',
        description: 'New description',
      });
      mockPrismaService.project_invoice.update.mockResolvedValue(updatedInvoice);

      await service.update(
        TENANT_ID,
        PROJECT_ID,
        INVOICE_ID,
        USER_ID,
        { description: 'New description' },
      );

      // amount_due should NOT be in the update data (no amount/tax change)
      const updateCall = mockPrismaService.project_invoice.update.mock.calls[0][0];
      expect(updateCall.data.description).toBe('New description');
      expect(updateCall.data.amount_due).toBeUndefined();
    });
  });

  // =========================================================================
  // create()
  // =========================================================================

  describe('create()', () => {
    it('should create a manual invoice with auto-generated invoice number', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      });

      const createdInvoice = mockInvoice({
        amount: 5000,
        amount_due: 5000,
        invoice_number: 'INV-0001',
      });
      mockPrismaService.project_invoice.create.mockResolvedValue(createdInvoice);

      const result = await service.create(
        TENANT_ID,
        PROJECT_ID,
        USER_ID,
        {
          description: 'Manual invoice',
          amount: 5000,
        },
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockInvoiceNumberGeneratorService.generate).toHaveBeenCalledWith(
        TENANT_ID,
        mockPrismaService,
      );
      expect(result.invoice_number).toBe('INV-0001');
      expect(result.amount).toBe(5000);
      expect(result.amount_due).toBe(5000);
    });

    it('should throw NotFoundException for non-existent project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, PROJECT_ID, USER_ID, {
          description: 'Test',
          amount: 1000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include tax_amount in amount_due calculation', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      });

      const createdInvoice = mockInvoice({
        amount: 5000,
        tax_amount: 250,
        amount_due: 5250,
      });
      mockPrismaService.project_invoice.create.mockResolvedValue(createdInvoice);

      const result = await service.create(
        TENANT_ID,
        PROJECT_ID,
        USER_ID,
        {
          description: 'Invoice with tax',
          amount: 5000,
          tax_amount: 250,
        },
      );

      expect(mockPrismaService.project_invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 5000,
          tax_amount: 250,
          amount_due: 5250,
        }),
      });
      expect(result.tax_amount).toBe(250);
      expect(result.amount_due).toBe(5250);
    });
  });

  // =========================================================================
  // getPayments()
  // =========================================================================

  describe('getPayments()', () => {
    it('should return payments ordered by payment_date', async () => {
      mockPrismaService.project_invoice.findFirst.mockResolvedValue({
        id: INVOICE_ID,
      });

      const payments = [
        mockPayment({ amount: 3000, payment_date: new Date('2026-03-15') }),
        mockPayment({ id: 'p-2', amount: 2000, payment_date: new Date('2026-03-20') }),
      ];
      mockPrismaService.project_invoice_payment.findMany.mockResolvedValue(payments);

      const result = await service.getPayments(TENANT_ID, PROJECT_ID, INVOICE_ID);

      expect(mockPrismaService.project_invoice_payment.findMany).toHaveBeenCalledWith({
        where: { invoice_id: INVOICE_ID, tenant_id: TENANT_ID },
        orderBy: { payment_date: 'asc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(3000);
      expect(result[1].amount).toBe(2000);
    });

    it('should throw NotFoundException for non-existent invoice', async () => {
      mockPrismaService.project_invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.getPayments(TENANT_ID, PROJECT_ID, INVOICE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
