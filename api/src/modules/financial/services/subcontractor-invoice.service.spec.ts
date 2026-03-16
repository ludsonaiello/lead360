import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SubcontractorInvoiceService } from './subcontractor-invoice.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const SUB_ID = 'sub-uuid-001';
const TASK_ID = 'task-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const INVOICE_ID = 'invoice-uuid-001';

const mockInvoiceRecord = (overrides: any = {}) => ({
  id: INVOICE_ID,
  tenant_id: TENANT_ID,
  subcontractor_id: SUB_ID,
  task_id: TASK_ID,
  project_id: PROJECT_ID,
  invoice_number: 'SUB-INV-0045',
  invoice_date: new Date('2026-03-10'),
  amount: 3500.0,
  status: 'pending',
  notes: 'Electrical rough-in',
  file_id: null,
  file_url: null,
  file_name: null,
  created_by_user_id: USER_ID,
  created_at: new Date(),
  updated_at: new Date(),
  subcontractor: { id: SUB_ID, business_name: 'Acme Electric', trade_specialty: 'Electrical' },
  task: { id: TASK_ID, title: 'Electrical Rough-In' },
  project: { id: PROJECT_ID, name: 'Test Project', project_number: 'P-001' },
  ...overrides,
});

const mockPrismaService = {
  subcontractor_task_invoice: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  subcontractor: {
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  project_task: {
    findFirst: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

const mockFilesService = {
  uploadFile: jest.fn(),
};

describe('SubcontractorInvoiceService', () => {
  let service: SubcontractorInvoiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubcontractorInvoiceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();

    service = module.get<SubcontractorInvoiceService>(SubcontractorInvoiceService);
    jest.clearAllMocks();
  });

  describe('createInvoice()', () => {
    const dto = {
      subcontractor_id: SUB_ID,
      task_id: TASK_ID,
      project_id: PROJECT_ID,
      amount: 3500.0,
      invoice_number: 'SUB-INV-0045',
      invoice_date: '2026-03-10',
      notes: 'Electrical rough-in',
    };

    it('should create an invoice with pending status and call audit log', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue({ id: SUB_ID });
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
      mockPrismaService.project_task.findFirst.mockResolvedValue({ id: TASK_ID });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(null);
      mockPrismaService.subcontractor_task_invoice.create.mockResolvedValue(mockInvoiceRecord());

      const result = await service.createInvoice(TENANT_ID, USER_ID, dto as any);

      expect(mockPrismaService.subcontractor_task_invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            status: 'pending',
            amount: 3500.0,
          }),
        }),
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'subcontractor_task_invoice',
        }),
      );

      expect(result.id).toBe(INVOICE_ID);
      expect(result.status).toBe('pending');
    });

    it('should throw ConflictException when invoice_number already exists', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue({ id: SUB_ID });
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
      mockPrismaService.project_task.findFirst.mockResolvedValue({ id: TASK_ID });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(
        mockInvoiceRecord(),
      );

      await expect(
        service.createInvoice(TENANT_ID, USER_ID, dto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when subcontractor does not belong to tenant', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(null);

      await expect(
        service.createInvoice(TENANT_ID, USER_ID, dto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when project does not belong to tenant', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue({ id: SUB_ID });
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.createInvoice(TENANT_ID, USER_ID, dto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when task does not belong to project', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue({ id: SUB_ID });
      mockPrismaService.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.createInvoice(TENANT_ID, USER_ID, dto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateInvoice() — status transitions', () => {
    it('should allow pending → approved', async () => {
      const existing = mockInvoiceRecord({ status: 'pending' });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(existing);
      mockPrismaService.subcontractor_task_invoice.update.mockResolvedValue(
        mockInvoiceRecord({ status: 'approved' }),
      );

      const result = await service.updateInvoice(TENANT_ID, INVOICE_ID, USER_ID, {
        status: 'approved',
      });

      expect(result.status).toBe('approved');
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalled();
    });

    it('should allow approved → paid', async () => {
      const existing = mockInvoiceRecord({ status: 'approved' });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(existing);
      mockPrismaService.subcontractor_task_invoice.update.mockResolvedValue(
        mockInvoiceRecord({ status: 'paid' }),
      );

      const result = await service.updateInvoice(TENANT_ID, INVOICE_ID, USER_ID, {
        status: 'paid',
      });

      expect(result.status).toBe('paid');
    });

    it('should reject backward transition (approved → pending)', async () => {
      const existing = mockInvoiceRecord({ status: 'approved' });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateInvoice(TENANT_ID, INVOICE_ID, USER_ID, {
          status: 'pending',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.subcontractor_task_invoice.update).not.toHaveBeenCalled();
    });

    it('should reject skipping statuses (pending → paid)', async () => {
      const existing = mockInvoiceRecord({ status: 'pending' });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateInvoice(TENANT_ID, INVOICE_ID, USER_ID, {
          status: 'paid',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject same status transition (pending → pending)', async () => {
      const existing = mockInvoiceRecord({ status: 'pending' });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateInvoice(TENANT_ID, INVOICE_ID, USER_ID, {
          status: 'pending',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateInvoice() — amount updates', () => {
    it('should allow amount update when status is pending', async () => {
      const existing = mockInvoiceRecord({ status: 'pending' });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(existing);
      mockPrismaService.subcontractor_task_invoice.update.mockResolvedValue(
        mockInvoiceRecord({ amount: 4000 }),
      );

      const result = await service.updateInvoice(TENANT_ID, INVOICE_ID, USER_ID, {
        amount: 4000,
      });

      expect(result.amount).toBe(4000);
    });

    it('should reject amount update when status is approved', async () => {
      const existing = mockInvoiceRecord({ status: 'approved' });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateInvoice(TENANT_ID, INVOICE_ID, USER_ID, {
          amount: 4000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject amount update when status is paid', async () => {
      const existing = mockInvoiceRecord({ status: 'paid' });
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateInvoice(TENANT_ID, INVOICE_ID, USER_ID, {
          amount: 4000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTaskInvoices()', () => {
    it('should return invoices filtered by tenant_id and task_id', async () => {
      mockPrismaService.subcontractor_task_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord(),
      ]);

      const result = await service.getTaskInvoices(TENANT_ID, TASK_ID);

      expect(mockPrismaService.subcontractor_task_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_ID, task_id: TASK_ID },
        }),
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('getSubcontractorInvoices()', () => {
    it('should return invoices filtered by tenant_id and subcontractor_id', async () => {
      mockPrismaService.subcontractor_task_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord(),
      ]);

      const result = await service.getSubcontractorInvoices(TENANT_ID, SUB_ID);

      expect(mockPrismaService.subcontractor_task_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_ID, subcontractor_id: SUB_ID },
        }),
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('listInvoices()', () => {
    it('should return paginated results with tenant_id filter', async () => {
      mockPrismaService.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      mockPrismaService.subcontractor_task_invoice.count.mockResolvedValue(0);

      const result = await service.listInvoices(TENANT_ID, { page: 1, limit: 20 });

      expect(mockPrismaService.subcontractor_task_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );

      expect(result.meta.page).toBe(1);
    });

    it('should apply status filter when provided', async () => {
      mockPrismaService.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      mockPrismaService.subcontractor_task_invoice.count.mockResolvedValue(0);

      await service.listInvoices(TENANT_ID, { status: 'pending' });

      expect(mockPrismaService.subcontractor_task_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });
  });

  describe('Tenant isolation', () => {
    it('should throw NotFoundException when invoice belongs to different tenant', async () => {
      mockPrismaService.subcontractor_task_invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInvoice('other-tenant', INVOICE_ID, USER_ID, { status: 'approved' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.subcontractor_task_invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: INVOICE_ID,
            tenant_id: 'other-tenant',
          }),
        }),
      );
    });
  });

  describe('getInvoiceAggregation()', () => {
    it('should return aggregated totals by status', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue({ id: SUB_ID });
      mockPrismaService.subcontractor_task_invoice.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 15000 }, _count: 5 })   // total
        .mockResolvedValueOnce({ _sum: { amount: 3000 } })               // pending
        .mockResolvedValueOnce({ _sum: { amount: 2000 } })               // approved
        .mockResolvedValueOnce({ _sum: { amount: 10000 } });             // paid

      const result = await service.getInvoiceAggregation(TENANT_ID, SUB_ID);

      expect(result).toEqual({
        subcontractor_id: SUB_ID,
        total_invoiced: 15000,
        total_pending: 3000,
        total_approved: 2000,
        total_paid_invoices: 10000,
        invoices_count: 5,
      });

      expect(mockPrismaService.subcontractor.findFirst).toHaveBeenCalledWith({
        where: { id: SUB_ID, tenant_id: TENANT_ID },
      });
    });

    it('should return zeros when no invoices exist', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue({ id: SUB_ID });
      mockPrismaService.subcontractor_task_invoice.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const result = await service.getInvoiceAggregation(TENANT_ID, SUB_ID);

      expect(result.total_invoiced).toBe(0);
      expect(result.total_pending).toBe(0);
      expect(result.total_approved).toBe(0);
      expect(result.total_paid_invoices).toBe(0);
      expect(result.invoices_count).toBe(0);
    });

    it('should throw NotFoundException when subcontractor does not belong to tenant', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(null);

      await expect(
        service.getInvoiceAggregation(TENANT_ID, SUB_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.subcontractor_task_invoice.aggregate).not.toHaveBeenCalled();
    });

    it('should always filter by tenant_id in all aggregate queries', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue({ id: SUB_ID });
      mockPrismaService.subcontractor_task_invoice.aggregate
        .mockResolvedValue({ _sum: { amount: null }, _count: 0 });

      await service.getInvoiceAggregation(TENANT_ID, SUB_ID);

      const calls = mockPrismaService.subcontractor_task_invoice.aggregate.mock.calls;
      expect(calls).toHaveLength(4);

      // Every aggregate call must include tenant_id and subcontractor_id
      for (const call of calls) {
        expect(call[0].where).toEqual(
          expect.objectContaining({
            tenant_id: TENANT_ID,
            subcontractor_id: SUB_ID,
          }),
        );
      }
    });
  });
});
