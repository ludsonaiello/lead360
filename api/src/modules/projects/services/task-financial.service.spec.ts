import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TaskFinancialService } from './task-financial.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { FinancialEntryService } from '../../financial/services/financial-entry.service';
import { ReceiptService } from '../../financial/services/receipt.service';

describe('TaskFinancialService', () => {
  let service: TaskFinancialService;

  const TENANT_A = 'tenant-a-uuid';
  const TENANT_B = 'tenant-b-uuid';
  const USER_ID = 'user-uuid';
  const PROJECT_ID = 'project-uuid';
  const TASK_ID = 'task-uuid';
  const CATEGORY_ID = 'category-uuid';

  const mockPrisma = {
    project: {
      findFirst: jest.fn(),
    },
    project_task: {
      findFirst: jest.fn(),
    },
  };

  const mockFinancialEntryService = {
    createEntry: jest.fn(),
    getTaskEntries: jest.fn(),
  };

  const mockReceiptService = {
    uploadReceipt: jest.fn(),
    getTaskReceipts: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskFinancialService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FinancialEntryService, useValue: mockFinancialEntryService },
        { provide: ReceiptService, useValue: mockReceiptService },
      ],
    }).compile();

    service = module.get<TaskFinancialService>(TaskFinancialService);
  });

  // ---------------------------------------------------------------------------
  // Helper to set up valid project + task mocks
  // ---------------------------------------------------------------------------
  function setupValidProjectAndTask(tenantId = TENANT_A) {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      tenant_id: tenantId,
    });
    mockPrisma.project_task.findFirst.mockResolvedValue({
      id: TASK_ID,
      project_id: PROJECT_ID,
      tenant_id: tenantId,
    });
  }

  // ===========================================================================
  // createTaskCostEntry
  // ===========================================================================
  describe('createTaskCostEntry', () => {
    const dto = {
      category_id: CATEGORY_ID,
      amount: 450.0,
      entry_date: '2026-03-10',
      vendor_name: 'Home Depot',
      notes: 'Lumber for framing',
    };

    it('should create a cost entry with project_id and task_id pre-filled', async () => {
      setupValidProjectAndTask();

      const expectedEntry = {
        id: 'entry-uuid',
        tenant_id: TENANT_A,
        project_id: PROJECT_ID,
        task_id: TASK_ID,
        category_id: CATEGORY_ID,
        amount: 450.0,
        entry_date: new Date('2026-03-10'),
        vendor_name: 'Home Depot',
        notes: 'Lumber for framing',
        category: { id: CATEGORY_ID, name: 'Material', type: 'material' },
      };
      mockFinancialEntryService.createEntry.mockResolvedValue(expectedEntry);

      const result = await service.createTaskCostEntry(
        TENANT_A,
        USER_ID,
        PROJECT_ID,
        TASK_ID,
        dto,
      );

      expect(result).toEqual(expectedEntry);
      expect(mockFinancialEntryService.createEntry).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        {
          project_id: PROJECT_ID,
          task_id: TASK_ID,
          category_id: CATEGORY_ID,
          amount: 450.0,
          entry_date: '2026-03-10',
          vendor_name: 'Home Depot',
          crew_member_id: undefined,
          subcontractor_id: undefined,
          notes: 'Lumber for framing',
        },
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.createTaskCostEntry(TENANT_A, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createTaskCostEntry(TENANT_A, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow('Project not found');
    });

    it('should throw NotFoundException when task does not belong to project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        tenant_id: TENANT_A,
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.createTaskCostEntry(TENANT_A, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.createTaskCostEntry(TENANT_A, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow('Task not found in this project');
    });
  });

  // ===========================================================================
  // getTaskCostEntries
  // ===========================================================================
  describe('getTaskCostEntries', () => {
    it('should return cost entries for a valid task', async () => {
      setupValidProjectAndTask();

      const entries = [
        { id: 'e1', amount: 100, category: { type: 'material' } },
        { id: 'e2', amount: 200, category: { type: 'labor' } },
      ];
      mockFinancialEntryService.getTaskEntries.mockResolvedValue(entries);

      const result = await service.getTaskCostEntries(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
      );

      expect(result).toEqual(entries);
      expect(mockFinancialEntryService.getTaskEntries).toHaveBeenCalledWith(
        TENANT_A,
        TASK_ID,
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskCostEntries(TENANT_A, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // uploadTaskReceipt
  // ===========================================================================
  describe('uploadTaskReceipt', () => {
    const mockFile = {
      originalname: 'receipt.jpg',
      mimetype: 'image/jpeg',
      size: 1024 * 1024,
      buffer: Buffer.from('fake'),
    } as Express.Multer.File;

    const dto = {
      vendor_name: 'Lowes',
      amount: 99.5,
      receipt_date: '2026-03-12',
    };

    it('should upload a receipt with project_id and task_id pre-filled', async () => {
      setupValidProjectAndTask();

      const expectedReceipt = {
        id: 'receipt-uuid',
        project_id: PROJECT_ID,
        task_id: TASK_ID,
        file_url: '/public/tenant-a/files/receipt-uuid.jpg',
      };
      mockReceiptService.uploadReceipt.mockResolvedValue(expectedReceipt);

      const result = await service.uploadTaskReceipt(
        TENANT_A,
        USER_ID,
        PROJECT_ID,
        TASK_ID,
        mockFile,
        dto,
      );

      expect(result).toEqual(expectedReceipt);
      expect(mockReceiptService.uploadReceipt).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        mockFile,
        {
          project_id: PROJECT_ID,
          task_id: TASK_ID,
          vendor_name: 'Lowes',
          amount: 99.5,
          receipt_date: '2026-03-12',
        },
      );
    });

    it('should throw NotFoundException when task does not belong to project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        tenant_id: TENANT_A,
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadTaskReceipt(
          TENANT_A,
          USER_ID,
          PROJECT_ID,
          TASK_ID,
          mockFile,
          dto,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // getTaskReceipts
  // ===========================================================================
  describe('getTaskReceipts', () => {
    it('should return receipts for a valid task', async () => {
      setupValidProjectAndTask();

      const receipts = [
        { id: 'r1', file_url: '/public/tenant/files/r1.jpg' },
        { id: 'r2', file_url: '/public/tenant/files/r2.pdf' },
      ];
      mockReceiptService.getTaskReceipts.mockResolvedValue(receipts);

      const result = await service.getTaskReceipts(
        TENANT_A,
        PROJECT_ID,
        TASK_ID,
      );

      expect(result).toEqual(receipts);
      expect(mockReceiptService.getTaskReceipts).toHaveBeenCalledWith(
        TENANT_A,
        TASK_ID,
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskReceipts(TENANT_A, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // Multi-Tenant Isolation Tests
  // ===========================================================================
  describe('Multi-Tenant Isolation', () => {
    const dto = {
      category_id: CATEGORY_ID,
      amount: 100,
      entry_date: '2026-03-10',
    };

    it('should not allow tenant B to create cost entry on tenant A project', async () => {
      // Project exists for tenant A, but we query as tenant B
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.createTaskCostEntry(TENANT_B, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow(NotFoundException);

      // Verify the query included tenant_id filter
      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
        select: { id: true },
      });
    });

    it('should not allow tenant B to list cost entries on tenant A project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskCostEntries(TENANT_B, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow tenant B to upload receipt on tenant A project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const mockFile = {
        originalname: 'receipt.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      await expect(
        service.uploadTaskReceipt(
          TENANT_B,
          USER_ID,
          PROJECT_ID,
          TASK_ID,
          mockFile,
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow tenant B to list receipts on tenant A project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskReceipts(TENANT_B, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
