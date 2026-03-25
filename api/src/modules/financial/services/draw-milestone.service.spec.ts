import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DrawMilestoneService } from './draw-milestone.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { InvoiceNumberGeneratorService } from './invoice-number-generator.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const QUOTE_ID = 'quote-uuid-001';
const MILESTONE_ID = 'milestone-uuid-001';
const INVOICE_ID = 'invoice-uuid-001';
const DRAW_ENTRY_ID = 'draw-entry-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockProject = (overrides: any = {}) => ({
  id: PROJECT_ID,
  tenant_id: TENANT_ID,
  contract_value: 10000,
  ...overrides,
});

const mockMilestone = (overrides: any = {}) => ({
  id: MILESTONE_ID,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID,
  quote_draw_entry_id: DRAW_ENTRY_ID,
  draw_number: 1,
  description: 'Deposit',
  calculation_type: 'percentage',
  value: 50,
  calculated_amount: 5000,
  status: 'pending',
  invoice_id: null,
  invoiced_at: null,
  paid_at: null,
  notes: null,
  created_by_user_id: USER_ID,
  created_at: new Date('2026-03-20T10:00:00.000Z'),
  updated_at: new Date('2026-03-20T10:00:00.000Z'),
  invoice: null,
  ...overrides,
});

const mockDrawScheduleEntry = (overrides: any = {}) => ({
  id: DRAW_ENTRY_ID,
  quote_id: QUOTE_ID,
  draw_number: 1,
  description: 'Deposit',
  calculation_type: 'percentage',
  value: 50,
  ...overrides,
});

const mockInvoice = (overrides: any = {}) => ({
  id: INVOICE_ID,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID,
  invoice_number: 'INV-0001',
  milestone_id: MILESTONE_ID,
  description: 'Deposit',
  amount: 5000,
  tax_amount: null,
  amount_paid: 0,
  amount_due: 5000,
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

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  project_draw_milestone: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project_invoice: {
    create: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  draw_schedule_entry: {
    findMany: jest.fn(),
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

describe('DrawMilestoneService', () => {
  let service: DrawMilestoneService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrawMilestoneService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        {
          provide: InvoiceNumberGeneratorService,
          useValue: mockInvoiceNumberGeneratorService,
        },
      ],
    }).compile();

    service = module.get<DrawMilestoneService>(DrawMilestoneService);

    jest.clearAllMocks();
  });

  // =========================================================================
  // seedFromQuote()
  // =========================================================================

  describe('seedFromQuote()', () => {
    it('should create milestones from draw schedule entries with percentage calculation', async () => {
      const entries = [
        mockDrawScheduleEntry({ draw_number: 1, calculation_type: 'percentage', value: 50, description: 'Deposit' }),
        mockDrawScheduleEntry({ id: 'entry-2', draw_number: 2, calculation_type: 'percentage', value: 50, description: 'Final' }),
      ];

      // Use a mock transaction client
      const txMock = {
        draw_schedule_entry: { findMany: jest.fn().mockResolvedValue(entries) },
        project: { findFirst: jest.fn().mockResolvedValue(mockProject({ contract_value: 10000 })) },
        project_draw_milestone: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      };

      await service.seedFromQuote(TENANT_ID, PROJECT_ID, QUOTE_ID, USER_ID, txMock);

      expect(txMock.draw_schedule_entry.findMany).toHaveBeenCalledWith({
        where: { quote_id: QUOTE_ID },
        orderBy: { draw_number: 'asc' },
      });

      expect(txMock.project_draw_milestone.createMany).toHaveBeenCalledTimes(1);

      const createManyArg = txMock.project_draw_milestone.createMany.mock.calls[0][0];
      expect(createManyArg.data).toHaveLength(2);

      // percentage of 10000: 50% = 5000
      expect(createManyArg.data[0].calculated_amount).toBe(5000);
      expect(createManyArg.data[0].draw_number).toBe(1);
      expect(createManyArg.data[0].tenant_id).toBe(TENANT_ID);
      expect(createManyArg.data[0].project_id).toBe(PROJECT_ID);
      expect(createManyArg.data[0].quote_draw_entry_id).toBe(DRAW_ENTRY_ID);
      expect(createManyArg.data[0].status).toBe('pending');
      expect(createManyArg.data[0].notes).toBeNull();

      expect(createManyArg.data[1].calculated_amount).toBe(5000);
      expect(createManyArg.data[1].draw_number).toBe(2);
    });

    it('should handle fixed_amount calculation type', async () => {
      const entries = [
        mockDrawScheduleEntry({ calculation_type: 'fixed_amount', value: 3500 }),
      ];

      const txMock = {
        draw_schedule_entry: { findMany: jest.fn().mockResolvedValue(entries) },
        project: { findFirst: jest.fn().mockResolvedValue(mockProject({ contract_value: 10000 })) },
        project_draw_milestone: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };

      await service.seedFromQuote(TENANT_ID, PROJECT_ID, QUOTE_ID, USER_ID, txMock);

      const createManyArg = txMock.project_draw_milestone.createMany.mock.calls[0][0];
      // fixed_amount: calculated_amount = raw value
      expect(createManyArg.data[0].calculated_amount).toBe(3500);
      expect(createManyArg.data[0].notes).toBeNull();
    });

    it('should handle null contract_value gracefully', async () => {
      const entries = [
        mockDrawScheduleEntry({ calculation_type: 'percentage', value: 50 }),
      ];

      const txMock = {
        draw_schedule_entry: { findMany: jest.fn().mockResolvedValue(entries) },
        project: { findFirst: jest.fn().mockResolvedValue(mockProject({ contract_value: null })) },
        project_draw_milestone: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };

      await service.seedFromQuote(TENANT_ID, PROJECT_ID, QUOTE_ID, USER_ID, txMock);

      const createManyArg = txMock.project_draw_milestone.createMany.mock.calls[0][0];
      // When contract_value is null, calculated_amount falls back to raw value
      expect(createManyArg.data[0].calculated_amount).toBe(50);
      // Warning note should be set
      expect(createManyArg.data[0].notes).toContain('contract_value was null');
    });

    it('should return silently when quote has no draw schedule entries', async () => {
      const txMock = {
        draw_schedule_entry: { findMany: jest.fn().mockResolvedValue([]) },
        project: { findFirst: jest.fn() },
        project_draw_milestone: { createMany: jest.fn() },
      };

      await service.seedFromQuote(TENANT_ID, PROJECT_ID, QUOTE_ID, USER_ID, txMock);

      expect(txMock.project.findFirst).not.toHaveBeenCalled();
      expect(txMock.project_draw_milestone.createMany).not.toHaveBeenCalled();
    });

    it('should set quote_draw_entry_id on seeded milestones', async () => {
      const entryId1 = 'entry-id-aaa';
      const entryId2 = 'entry-id-bbb';
      const entries = [
        mockDrawScheduleEntry({ id: entryId1, draw_number: 1, calculation_type: 'fixed_amount', value: 2000 }),
        mockDrawScheduleEntry({ id: entryId2, draw_number: 2, calculation_type: 'fixed_amount', value: 3000 }),
      ];

      const txMock = {
        draw_schedule_entry: { findMany: jest.fn().mockResolvedValue(entries) },
        project: { findFirst: jest.fn().mockResolvedValue(mockProject()) },
        project_draw_milestone: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      };

      await service.seedFromQuote(TENANT_ID, PROJECT_ID, QUOTE_ID, USER_ID, txMock);

      const createManyArg = txMock.project_draw_milestone.createMany.mock.calls[0][0];
      expect(createManyArg.data[0].quote_draw_entry_id).toBe(entryId1);
      expect(createManyArg.data[1].quote_draw_entry_id).toBe(entryId2);
    });
  });

  // =========================================================================
  // create()
  // =========================================================================

  describe('create()', () => {
    it('should create a milestone with computed calculated_amount from percentage', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 10000 }),
      );
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(null);

      const createdMilestone = mockMilestone({
        value: 25,
        calculated_amount: 2500,
      });
      mockPrismaService.project_draw_milestone.create.mockResolvedValue(createdMilestone);

      const result = await service.create(TENANT_ID, PROJECT_ID, USER_ID, {
        draw_number: 1,
        description: 'Deposit',
        calculation_type: 'percentage',
        value: 25,
      });

      expect(mockPrismaService.project_draw_milestone.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_ID,
          project_id: PROJECT_ID,
          draw_number: 1,
          calculation_type: 'percentage',
          value: 25,
          calculated_amount: 2500,
          status: 'pending',
          created_by_user_id: USER_ID,
        }),
      });

      expect(result.value).toBe(25);
      expect(result.calculated_amount).toBe(2500);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
    });

    it('should use raw value as calculated_amount for fixed_amount type', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 10000 }),
      );
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(null);

      const createdMilestone = mockMilestone({
        calculation_type: 'fixed_amount',
        value: 7500,
        calculated_amount: 7500,
      });
      mockPrismaService.project_draw_milestone.create.mockResolvedValue(createdMilestone);

      const result = await service.create(TENANT_ID, PROJECT_ID, USER_ID, {
        draw_number: 1,
        description: 'Fixed deposit',
        calculation_type: 'fixed_amount',
        value: 7500,
      });

      expect(mockPrismaService.project_draw_milestone.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          calculated_amount: 7500,
        }),
      });
      expect(result.calculated_amount).toBe(7500);
    });

    it('should throw ConflictException for duplicate draw_number', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(
        mockMilestone({ draw_number: 1 }),
      );

      await expect(
        service.create(TENANT_ID, PROJECT_ID, USER_ID, {
          draw_number: 1,
          description: 'Duplicate',
          calculation_type: 'percentage',
          value: 50,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for percentage > 100', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, PROJECT_ID, USER_ID, {
          draw_number: 1,
          description: 'Over 100%',
          calculation_type: 'percentage',
          value: 150,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, PROJECT_ID, USER_ID, {
          draw_number: 1,
          description: 'Test',
          calculation_type: 'fixed_amount',
          value: 1000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use provided calculated_amount when explicitly given', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 10000 }),
      );
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(null);

      const createdMilestone = mockMilestone({
        value: 50,
        calculated_amount: 4999.99,
      });
      mockPrismaService.project_draw_milestone.create.mockResolvedValue(createdMilestone);

      await service.create(TENANT_ID, PROJECT_ID, USER_ID, {
        draw_number: 1,
        description: 'Custom amount',
        calculation_type: 'percentage',
        value: 50,
        calculated_amount: 4999.99,
      });

      expect(mockPrismaService.project_draw_milestone.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          calculated_amount: 4999.99,
        }),
      });
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update()', () => {
    it('should block calculated_amount change on invoiced milestone', async () => {
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(
        mockMilestone({ status: 'invoiced' }),
      );

      await expect(
        service.update(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID, {
          calculated_amount: 9999,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block calculated_amount change on paid milestone', async () => {
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(
        mockMilestone({ status: 'paid' }),
      );

      await expect(
        service.update(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID, {
          calculated_amount: 9999,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow description update on invoiced milestone', async () => {
      const existing = mockMilestone({ status: 'invoiced' });
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(existing);

      const updated = mockMilestone({
        status: 'invoiced',
        description: 'Updated description',
      });
      mockPrismaService.project_draw_milestone.update.mockResolvedValue(updated);

      const result = await service.update(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID, {
        description: 'Updated description',
      });

      expect(mockPrismaService.project_draw_milestone.update).toHaveBeenCalledWith({
        where: { id: MILESTONE_ID },
        data: { description: 'Updated description' },
      });
      expect(result.calculated_amount).toBe(5000);
    });

    it('should allow calculated_amount change on pending milestone', async () => {
      const existing = mockMilestone({ status: 'pending' });
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(existing);

      const updated = mockMilestone({ status: 'pending', calculated_amount: 7000 });
      mockPrismaService.project_draw_milestone.update.mockResolvedValue(updated);

      const result = await service.update(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID, {
        calculated_amount: 7000,
      });

      expect(result.calculated_amount).toBe(7000);
    });

    it('should throw NotFoundException when milestone does not exist', async () => {
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID, {
          description: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // delete()
  // =========================================================================

  describe('delete()', () => {
    it('should delete pending milestone', async () => {
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(
        mockMilestone({ status: 'pending' }),
      );
      mockPrismaService.project_draw_milestone.delete.mockResolvedValue(undefined);

      const result = await service.delete(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID);

      expect(mockPrismaService.project_draw_milestone.delete).toHaveBeenCalledWith({
        where: { id: MILESTONE_ID },
      });
      expect(result.message).toContain('deleted');
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
    });

    it('should block deletion of invoiced milestone', async () => {
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(
        mockMilestone({ status: 'invoiced' }),
      );

      await expect(
        service.delete(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.project_draw_milestone.delete).not.toHaveBeenCalled();
    });

    it('should block deletion of paid milestone', async () => {
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(
        mockMilestone({ status: 'paid' }),
      );

      await expect(
        service.delete(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when milestone does not exist', async () => {
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // generateInvoice()
  // =========================================================================

  describe('generateInvoice()', () => {
    it('should create invoice and transition milestone to invoiced atomically', async () => {
      const pendingMilestone = mockMilestone({ status: 'pending', calculated_amount: 5000 });
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(pendingMilestone);

      const createdInvoice = mockInvoice({
        amount: 5000,
        amount_due: 5000,
      });

      // The $transaction mock calls the fn with mockPrismaService as tx
      mockPrismaService.project_invoice.create.mockResolvedValue(createdInvoice);
      mockPrismaService.project_draw_milestone.update.mockResolvedValue(undefined);
      mockInvoiceNumberGeneratorService.generate.mockResolvedValue('INV-0001');

      const result = await service.generateInvoice(
        TENANT_ID,
        PROJECT_ID,
        MILESTONE_ID,
        USER_ID,
        {},
      );

      // Verify transaction was used
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);

      // Verify invoice was created
      expect(mockPrismaService.project_invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_ID,
          project_id: PROJECT_ID,
          invoice_number: 'INV-0001',
          milestone_id: MILESTONE_ID,
          amount: 5000,
          amount_paid: 0,
          amount_due: 5000,
          status: 'draft',
        }),
      });

      // Verify milestone was updated to invoiced
      expect(mockPrismaService.project_draw_milestone.update).toHaveBeenCalledWith({
        where: { id: MILESTONE_ID },
        data: expect.objectContaining({
          status: 'invoiced',
          invoice_id: INVOICE_ID,
        }),
      });

      // Verify audit log
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project_invoice',
          entityId: INVOICE_ID,
        }),
      );

      expect(result.amount).toBe(5000);
      expect(result.amount_due).toBe(5000);
      expect(result.invoice_number).toBe('INV-0001');
    });

    it('should include tax_amount in amount_due when provided', async () => {
      const pendingMilestone = mockMilestone({ status: 'pending', calculated_amount: 5000 });
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(pendingMilestone);

      const createdInvoice = mockInvoice({
        amount: 5000,
        tax_amount: 375,
        amount_due: 5375,
      });
      mockPrismaService.project_invoice.create.mockResolvedValue(createdInvoice);
      mockPrismaService.project_draw_milestone.update.mockResolvedValue(undefined);

      const result = await service.generateInvoice(
        TENANT_ID,
        PROJECT_ID,
        MILESTONE_ID,
        USER_ID,
        { tax_amount: 375 },
      );

      expect(mockPrismaService.project_invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tax_amount: 375,
          amount_due: 5375,
        }),
      });
      expect(result.tax_amount).toBe(375);
      expect(result.amount_due).toBe(5375);
    });

    it('should throw BadRequestException for non-pending milestone', async () => {
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(
        mockMilestone({ status: 'invoiced' }),
      );

      await expect(
        service.generateInvoice(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID, {}),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent milestone', async () => {
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(null);

      await expect(
        service.generateInvoice(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use milestone description as default when no dto.description provided', async () => {
      const pendingMilestone = mockMilestone({
        status: 'pending',
        calculated_amount: 2000,
        description: 'Milestone Default Description',
      });
      mockPrismaService.project_draw_milestone.findFirst.mockResolvedValue(pendingMilestone);

      const createdInvoice = mockInvoice({
        amount: 2000,
        description: 'Milestone Default Description',
      });
      mockPrismaService.project_invoice.create.mockResolvedValue(createdInvoice);
      mockPrismaService.project_draw_milestone.update.mockResolvedValue(undefined);

      await service.generateInvoice(TENANT_ID, PROJECT_ID, MILESTONE_ID, USER_ID, {});

      expect(mockPrismaService.project_invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Milestone Default Description',
        }),
      });
    });
  });

  // =========================================================================
  // findByProject()
  // =========================================================================

  describe('findByProject()', () => {
    it('should return milestones ordered by draw_number with Decimal conversions', async () => {
      const milestones = [
        mockMilestone({
          draw_number: 1,
          value: 50,
          calculated_amount: 5000,
          invoice: { id: INVOICE_ID, invoice_number: 'INV-0001', status: 'draft' },
          invoice_id: INVOICE_ID,
        }),
        mockMilestone({
          id: 'milestone-uuid-002',
          draw_number: 2,
          value: 50,
          calculated_amount: 5000,
          invoice: null,
        }),
      ];

      mockPrismaService.project_draw_milestone.findMany.mockResolvedValue(milestones);

      const result = await service.findByProject(TENANT_ID, PROJECT_ID);

      expect(mockPrismaService.project_draw_milestone.findMany).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, project_id: PROJECT_ID },
        include: {
          invoice: { select: { id: true, invoice_number: true, status: true } },
        },
        orderBy: { draw_number: 'asc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(50);
      expect(result[0].calculated_amount).toBe(5000);
      expect(result[0].invoice_number).toBe('INV-0001');
      expect(result[1].invoice_number).toBeNull();
    });
  });
});
