import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';

// ─────────────────────────────────────────────────────────────────────────────
// Mock factories
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-1111';
const USER_ID = 'user-uuid-aaaa';
const RECEIPT_ID = 'receipt-uuid-0001';
const ENTRY_ID = 'entry-uuid-bbbb';
const PROJECT_ID = 'project-uuid-cccc';
const TASK_ID = 'task-uuid-dddd';
const FILE_ID = 'file-uuid-eeee';
const FILE_URL = '/public/tenant-uuid-1111/files/file-uuid-eeee.jpg';

function mockReceiptRecord(overrides: Partial<any> = {}) {
  return {
    id: RECEIPT_ID,
    tenant_id: TENANT_ID,
    financial_entry_id: null,
    project_id: PROJECT_ID,
    task_id: null,
    file_id: FILE_ID,
    file_url: FILE_URL,
    file_name: 'receipt.jpg',
    file_type: 'photo',
    file_size_bytes: 245000,
    vendor_name: 'Home Depot',
    amount: '125.50',
    receipt_date: new Date('2026-03-10'),
    ocr_raw: null,
    ocr_status: 'not_processed',
    ocr_vendor: null,
    ocr_amount: null,
    ocr_date: null,
    is_categorized: false,
    uploaded_by_user_id: USER_ID,
    created_at: new Date('2026-03-10T14:00:00.000Z'),
    updated_at: new Date('2026-03-10T14:00:00.000Z'),
    ...overrides,
  };
}

function mockFinancialEntry(overrides: Partial<any> = {}) {
  return {
    id: ENTRY_ID,
    tenant_id: TENANT_ID,
    has_receipt: false,
    ...overrides,
  };
}

function mockMulterFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'receipt.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 245000,
    buffer: Buffer.from('fake-image-data'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock service factories
// ─────────────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  receipt: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  financial_entry: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  project_task: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditLogger = {
  logTenantChange: jest.fn().mockResolvedValue(undefined),
};

const mockFilesService = {
  uploadFile: jest.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('ReceiptService', () => {
  let service: ReceiptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();

    service = module.get<ReceiptService>(ReceiptService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // uploadReceipt()
  // ─────────────────────────────────────────────────────────────────────────────

  describe('uploadReceipt()', () => {
    it('should upload a JPEG receipt and return formatted response', async () => {
      const file = mockMulterFile();
      const dto = { project_id: PROJECT_ID, vendor_name: 'Home Depot', amount: 125.5 };

      mockFilesService.uploadFile.mockResolvedValue({
        file: {
          file_id: FILE_ID,
          url: FILE_URL,
          size_bytes: 245000,
        },
      });
      mockPrismaService.receipt.create.mockResolvedValue(mockReceiptRecord());

      const result = await service.uploadReceipt(TENANT_ID, USER_ID, file, dto);

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        file,
        expect.objectContaining({ category: 'receipt', entity_type: 'receipt' }),
      );
      expect(mockPrismaService.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            file_type: 'photo',
            ocr_status: 'not_processed',
            is_categorized: false,
          }),
        }),
      );
      expect(result.id).toBe(RECEIPT_ID);
      expect(result.file_type).toBe('photo');
      expect(result.amount).toBe(125.5); // Decimal → number conversion
      // OCR fields hidden in Phase 1
      expect(result.ocr_vendor).toBeNull();
      expect(result.ocr_amount).toBeNull();
      expect(result.ocr_date).toBeNull();
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledTimes(1);
    });

    it('should resolve file_type = "pdf" for application/pdf', async () => {
      const file = mockMulterFile({ mimetype: 'application/pdf', originalname: 'receipt.pdf' });
      const dto = { project_id: PROJECT_ID };

      mockFilesService.uploadFile.mockResolvedValue({
        file: { file_id: FILE_ID, url: FILE_URL, size_bytes: 100000 },
      });
      mockPrismaService.receipt.create.mockResolvedValue(
        mockReceiptRecord({ file_type: 'pdf', file_name: 'receipt.pdf' }),
      );

      const result = await service.uploadReceipt(TENANT_ID, USER_ID, file, dto);

      expect(result.file_type).toBe('pdf');
    });

    it('should reject unsupported MIME types', async () => {
      const file = mockMulterFile({ mimetype: 'image/gif' });

      await expect(
        service.uploadReceipt(TENANT_ID, USER_ID, file, {}),
      ).rejects.toThrow(BadRequestException);
      expect(mockFilesService.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject files exceeding 25 MB', async () => {
      const file = mockMulterFile({ size: 26 * 1024 * 1024 });

      await expect(
        service.uploadReceipt(TENANT_ID, USER_ID, file, {}),
      ).rejects.toThrow(BadRequestException);
      expect(mockFilesService.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject when no file provided', async () => {
      await expect(
        service.uploadReceipt(TENANT_ID, USER_ID, null as any, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate task belongs to project when both provided', async () => {
      const file = mockMulterFile();
      const dto = { project_id: PROJECT_ID, task_id: TASK_ID };

      // Task belongs to different project
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadReceipt(TENANT_ID, USER_ID, file, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should auto-resolve project_id from task when only task_id provided', async () => {
      const file = mockMulterFile();
      const dto = { task_id: TASK_ID };

      mockPrismaService.project_task.findFirst.mockResolvedValue({
        project_id: PROJECT_ID,
      });
      mockFilesService.uploadFile.mockResolvedValue({
        file: { file_id: FILE_ID, url: FILE_URL, size_bytes: 245000 },
      });
      mockPrismaService.receipt.create.mockResolvedValue(
        mockReceiptRecord({ project_id: PROJECT_ID, task_id: TASK_ID }),
      );

      const result = await service.uploadReceipt(TENANT_ID, USER_ID, file, dto);

      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.task_id).toBe(TASK_ID);
    });

    it('should throw NotFoundException when task_id does not exist', async () => {
      const file = mockMulterFile();
      const dto = { task_id: TASK_ID };

      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadReceipt(TENANT_ID, USER_ID, file, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // linkReceiptToEntry()
  // ─────────────────────────────────────────────────────────────────────────────

  describe('linkReceiptToEntry()', () => {
    it('should link receipt to a financial entry and set flags', async () => {
      const unlinkedReceipt = mockReceiptRecord({ financial_entry_id: null });
      const entry = mockFinancialEntry({ has_receipt: false });
      const linkedReceipt = mockReceiptRecord({
        financial_entry_id: ENTRY_ID,
        is_categorized: true,
      });

      mockPrismaService.receipt.findFirst.mockResolvedValue(unlinkedReceipt);
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(entry);
      mockPrismaService.$transaction.mockImplementation(async (ops) => {
        // Simulate transaction execution
        return [linkedReceipt, { ...entry, has_receipt: true }];
      });

      const result = await service.linkReceiptToEntry(TENANT_ID, RECEIPT_ID, USER_ID, {
        financial_entry_id: ENTRY_ID,
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(result.financial_entry_id).toBe(ENTRY_ID);
      expect(result.is_categorized).toBe(true);
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'receipt',
          actorUserId: USER_ID, // must be the requesting user, not the uploader
        }),
      );
    });

    it('should reject linking if receipt is already linked', async () => {
      mockPrismaService.receipt.findFirst.mockResolvedValue(
        mockReceiptRecord({ financial_entry_id: 'another-entry-id' }),
      );

      await expect(
        service.linkReceiptToEntry(TENANT_ID, RECEIPT_ID, USER_ID, {
          financial_entry_id: ENTRY_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if financial entry not found', async () => {
      mockPrismaService.receipt.findFirst.mockResolvedValue(mockReceiptRecord());
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.linkReceiptToEntry(TENANT_ID, RECEIPT_ID, USER_ID, {
          financial_entry_id: ENTRY_ID,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if entry already has a receipt (enforce 1:1)', async () => {
      mockPrismaService.receipt.findFirst
        .mockResolvedValueOnce(mockReceiptRecord()) // find the receipt to link
        .mockResolvedValueOnce({ id: 'other-receipt-id' }); // existing receipt on entry
      mockPrismaService.financial_entry.findFirst.mockResolvedValue(
        mockFinancialEntry({ has_receipt: true }),
      );

      await expect(
        service.linkReceiptToEntry(TENANT_ID, RECEIPT_ID, USER_ID, {
          financial_entry_id: ENTRY_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject receipt not found (tenant isolation)', async () => {
      mockPrismaService.receipt.findFirst.mockResolvedValue(null);

      await expect(
        service.linkReceiptToEntry(TENANT_ID, RECEIPT_ID, USER_ID, {
          financial_entry_id: ENTRY_ID,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // updateReceipt()
  // ─────────────────────────────────────────────────────────────────────────────

  describe('updateReceipt()', () => {
    it('should update vendor_name, amount, receipt_date', async () => {
      const existing = mockReceiptRecord();
      const updated = mockReceiptRecord({
        vendor_name: 'Lowes',
        amount: '200.00',
        receipt_date: new Date('2026-03-12'),
      });

      mockPrismaService.receipt.findFirst.mockResolvedValue(existing);
      mockPrismaService.receipt.update.mockResolvedValue(updated);

      const result = await service.updateReceipt(TENANT_ID, RECEIPT_ID, USER_ID, {
        vendor_name: 'Lowes',
        amount: 200,
        receipt_date: '2026-03-12',
      });

      expect(mockPrismaService.receipt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RECEIPT_ID },
          data: expect.objectContaining({ vendor_name: 'Lowes' }),
        }),
      );
      expect(result.vendor_name).toBe('Lowes');
      expect(result.amount).toBe(200);
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledTimes(1);
    });

    it('should return current receipt without DB write when nothing changes', async () => {
      const existing = mockReceiptRecord();
      mockPrismaService.receipt.findFirst.mockResolvedValue(existing);

      const result = await service.updateReceipt(
        TENANT_ID,
        RECEIPT_ID,
        USER_ID,
        {}, // No fields provided
      );

      expect(mockPrismaService.receipt.update).not.toHaveBeenCalled();
      expect(result.id).toBe(RECEIPT_ID);
    });

    it('should throw NotFoundException for unknown receipt ID', async () => {
      mockPrismaService.receipt.findFirst.mockResolvedValue(null);

      await expect(
        service.updateReceipt(TENANT_ID, 'nonexistent-id', USER_ID, {
          vendor_name: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should support nullifying optional fields', async () => {
      mockPrismaService.receipt.findFirst.mockResolvedValue(mockReceiptRecord());
      mockPrismaService.receipt.update.mockResolvedValue(
        mockReceiptRecord({ vendor_name: null, amount: null }),
      );

      const result = await service.updateReceipt(
        TENANT_ID,
        RECEIPT_ID,
        USER_ID,
        { vendor_name: null, amount: null },
      );

      expect(result.vendor_name).toBeNull();
      expect(result.amount).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getProjectReceipts()
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getProjectReceipts()', () => {
    it('should return paginated receipts for a project', async () => {
      const receipts = [mockReceiptRecord(), mockReceiptRecord({ id: 'receipt-2' })];
      mockPrismaService.receipt.findMany.mockResolvedValue(receipts);
      mockPrismaService.receipt.count.mockResolvedValue(2);

      const result = await service.getProjectReceipts(TENANT_ID, {
        project_id: PROJECT_ID,
      });

      expect(mockPrismaService.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            project_id: PROJECT_ID,
          }),
        }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter by is_categorized = false', async () => {
      mockPrismaService.receipt.findMany.mockResolvedValue([mockReceiptRecord()]);
      mockPrismaService.receipt.count.mockResolvedValue(1);

      await service.getProjectReceipts(TENANT_ID, {
        project_id: PROJECT_ID,
        is_categorized: false,
      });

      expect(mockPrismaService.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            is_categorized: false,
          }),
        }),
      );
    });

    it('should throw BadRequestException when neither project_id nor task_id provided', async () => {
      await expect(
        service.getProjectReceipts(TENANT_ID, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce max page limit of 100', async () => {
      mockPrismaService.receipt.findMany.mockResolvedValue([]);
      mockPrismaService.receipt.count.mockResolvedValue(0);

      await service.getProjectReceipts(TENANT_ID, {
        project_id: PROJECT_ID,
        limit: 500, // exceeds max
      });

      expect(mockPrismaService.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should always include tenant_id in where clause (tenant isolation)', async () => {
      mockPrismaService.receipt.findMany.mockResolvedValue([]);
      mockPrismaService.receipt.count.mockResolvedValue(0);

      await service.getProjectReceipts(TENANT_ID, { project_id: PROJECT_ID });

      const findManyCall = mockPrismaService.receipt.findMany.mock.calls[0][0];
      expect(findManyCall.where.tenant_id).toBe(TENANT_ID);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getTaskReceipts()
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getTaskReceipts()', () => {
    it('should return all receipts for a task', async () => {
      const task = { id: TASK_ID };
      const receipts = [mockReceiptRecord({ task_id: TASK_ID })];

      mockPrismaService.project_task.findFirst.mockResolvedValue(task);
      mockPrismaService.receipt.findMany.mockResolvedValue(receipts);

      const result = await service.getTaskReceipts(TENANT_ID, TASK_ID);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            task_id: TASK_ID,
          }),
        }),
      );
    });

    it('should throw NotFoundException for unknown task (tenant isolation)', async () => {
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskReceipts(TENANT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getReceiptById()
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getReceiptById()', () => {
    it('should return a receipt belonging to the tenant', async () => {
      mockPrismaService.receipt.findFirst.mockResolvedValue(mockReceiptRecord());

      const result = await service.getReceiptById(TENANT_ID, RECEIPT_ID);

      expect(result.id).toBe(RECEIPT_ID);
      expect(mockPrismaService.receipt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RECEIPT_ID, tenant_id: TENANT_ID },
        }),
      );
    });

    it('should throw NotFoundException for receipt belonging to another tenant', async () => {
      mockPrismaService.receipt.findFirst.mockResolvedValue(null);

      await expect(
        service.getReceiptById('different-tenant', RECEIPT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // formatReceiptResponse — OCR fields hidden in Phase 1
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Response formatting (Phase 1 OCR suppression)', () => {
    it('should always return null for ocr_vendor, ocr_amount, ocr_date', async () => {
      const receiptWithOcrData = mockReceiptRecord({
        ocr_vendor: 'OCR Vendor Name',
        ocr_amount: '99.99',
        ocr_date: new Date('2026-03-10'),
        ocr_status: 'complete',
      });
      mockPrismaService.receipt.findFirst.mockResolvedValue(receiptWithOcrData);

      const result = await service.getReceiptById(TENANT_ID, RECEIPT_ID);

      // OCR extraction fields are reserved for Phase 2
      expect(result.ocr_vendor).toBeNull();
      expect(result.ocr_amount).toBeNull();
      expect(result.ocr_date).toBeNull();
      // Status is visible (operational field)
      expect(result.ocr_status).toBe('complete');
    });

    it('should convert Decimal amount to number', async () => {
      mockPrismaService.receipt.findFirst.mockResolvedValue(
        mockReceiptRecord({ amount: '125.50' }),
      );

      const result = await service.getReceiptById(TENANT_ID, RECEIPT_ID);

      expect(typeof result.amount).toBe('number');
      expect(result.amount).toBe(125.5);
    });
  });
});
