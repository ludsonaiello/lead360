import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { FileCleanupProcessor } from './file-cleanup.processor';
import { PrismaService } from '../../../core/database/prisma.service';
import { FilesService } from '../files.service';

describe('FileCleanupProcessor', () => {
  let processor: FileCleanupProcessor;
  let prismaService: PrismaService;
  let filesService: FilesService;

  const mockPrismaService = {
    tenant: {
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  const mockFilesService = {
    findOrphans: jest.fn(),
    moveOrphansToTrash: jest.fn(),
    cleanupTrashedFiles: jest.fn(),
  };

  const mockJob = {
    data: {},
  } as Job;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileCleanupProcessor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
      ],
    }).compile();

    processor = module.get<FileCleanupProcessor>(FileCleanupProcessor);
    prismaService = module.get<PrismaService>(PrismaService);
    filesService = module.get<FilesService>(FilesService);

    // Mock Logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleDailyCleanup', () => {
    it('should process all tenants and cleanup orphan files', async () => {
      const mockTenants = [
        { id: 'tenant-1', company_name: 'Company A' },
        { id: 'tenant-2', company_name: 'Company B' },
      ];

      const mockOwner = { id: 'owner-123' };

      mockPrismaService.tenant.findMany.mockResolvedValue(mockTenants);
      mockPrismaService.user.findFirst.mockResolvedValue(mockOwner);

      mockFilesService.findOrphans.mockResolvedValue({
        orphans: [],
        total: 2,
        marked_as_orphan: 2,
      });

      mockFilesService.moveOrphansToTrash.mockResolvedValue({
        message: '1 orphan files moved to trash',
        count: 1,
      });

      mockFilesService.cleanupTrashedFiles.mockResolvedValue({
        message: '3 trashed files permanently deleted',
        count: 3,
      });

      const result = await processor.handleDailyCleanup(mockJob);

      expect(mockPrismaService.tenant.findMany).toHaveBeenCalled();
      expect(mockFilesService.findOrphans).toHaveBeenCalledTimes(2);
      expect(mockFilesService.moveOrphansToTrash).toHaveBeenCalledTimes(2);
      expect(mockFilesService.cleanupTrashedFiles).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        success: true,
        tenantsProcessed: 2,
        totalOrphansMarked: 4, // 2 per tenant
        totalOrphansTrashed: 2, // 1 per tenant
        totalTrashedDeleted: 6, // 3 per tenant
      });
    });

    it('should skip tenants without an owner', async () => {
      const mockTenants = [
        { id: 'tenant-1', company_name: 'Company A' },
        { id: 'tenant-2', company_name: 'Company B' },
      ];

      mockPrismaService.tenant.findMany.mockResolvedValue(mockTenants);
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce({ id: 'owner-1' }) // First tenant has owner
        .mockResolvedValueOnce(null); // Second tenant has no owner

      mockFilesService.findOrphans.mockResolvedValue({
        orphans: [],
        total: 1,
        marked_as_orphan: 1,
      });

      mockFilesService.moveOrphansToTrash.mockResolvedValue({
        count: 0,
      });

      mockFilesService.cleanupTrashedFiles.mockResolvedValue({
        count: 0,
      });

      const result = await processor.handleDailyCleanup(mockJob);

      // findOrphans should be called for both tenants
      expect(mockFilesService.findOrphans).toHaveBeenCalledTimes(2);

      // moveOrphansToTrash and cleanupTrashedFiles should only be called for tenant with owner
      expect(mockFilesService.moveOrphansToTrash).toHaveBeenCalledTimes(1);
      expect(mockFilesService.cleanupTrashedFiles).toHaveBeenCalledTimes(1);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('has no owner'),
      );
    });

    it('should continue processing other tenants if one fails', async () => {
      const mockTenants = [
        { id: 'tenant-1', company_name: 'Company A' },
        { id: 'tenant-2', company_name: 'Company B' },
        { id: 'tenant-3', company_name: 'Company C' },
      ];

      mockPrismaService.tenant.findMany.mockResolvedValue(mockTenants);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'owner-123' });

      mockFilesService.findOrphans
        .mockResolvedValueOnce({ orphans: [], total: 0, marked_as_orphan: 0 })
        .mockRejectedValueOnce(new Error('Database error')) // Second tenant fails
        .mockResolvedValueOnce({ orphans: [], total: 0, marked_as_orphan: 0 });

      mockFilesService.moveOrphansToTrash.mockResolvedValue({ count: 0 });
      mockFilesService.cleanupTrashedFiles.mockResolvedValue({ count: 0 });

      const result = await processor.handleDailyCleanup(mockJob);

      // Should still process all 3 tenants
      expect(mockFilesService.findOrphans).toHaveBeenCalledTimes(3);

      // Error should be logged
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing tenant'),
        expect.any(String),
      );

      // Job should still succeed
      expect(result.success).toBe(true);
      expect(result.tenantsProcessed).toBe(3);
    });

    it('should handle three-stage orphan lifecycle correctly', async () => {
      const mockTenant = { id: 'tenant-1', company_name: 'Company A' };
      const mockOwner = { id: 'owner-123' };

      mockPrismaService.tenant.findMany.mockResolvedValue([mockTenant]);
      mockPrismaService.user.findFirst.mockResolvedValue(mockOwner);

      // Stage 1: Mark as orphan
      mockFilesService.findOrphans.mockResolvedValue({
        orphans: [{ file_id: 'orphan-1' }],
        total: 1,
        marked_as_orphan: 1,
      });

      // Stage 2: Move to trash
      mockFilesService.moveOrphansToTrash.mockResolvedValue({
        message: '1 orphan files moved to trash',
        count: 1,
      });

      // Stage 3: Permanent delete
      mockFilesService.cleanupTrashedFiles.mockResolvedValue({
        message: '1 trashed files permanently deleted',
        count: 1,
      });

      const result = await processor.handleDailyCleanup(mockJob);

      // Verify all three stages were called in sequence
      expect(mockFilesService.findOrphans).toHaveBeenCalledWith('tenant-1');
      expect(mockFilesService.moveOrphansToTrash).toHaveBeenCalledWith(
        'tenant-1',
        'owner-123',
      );
      expect(mockFilesService.cleanupTrashedFiles).toHaveBeenCalledWith(
        'tenant-1',
        'owner-123',
      );

      expect(result.totalOrphansMarked).toBe(1);
      expect(result.totalOrphansTrashed).toBe(1);
      expect(result.totalTrashedDeleted).toBe(1);
    });

    it('should query for owner with correct user_roles relation', async () => {
      const mockTenant = { id: 'tenant-1', company_name: 'Company A' };

      mockPrismaService.tenant.findMany.mockResolvedValue([mockTenant]);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'owner-123' });
      mockFilesService.findOrphans.mockResolvedValue({
        orphans: [],
        total: 0,
        marked_as_orphan: 0,
      });
      mockFilesService.moveOrphansToTrash.mockResolvedValue({ count: 0 });
      mockFilesService.cleanupTrashedFiles.mockResolvedValue({ count: 0 });

      await processor.handleDailyCleanup(mockJob);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          user_role_user_role_user_idTouser: {
            some: {
              role: {
                name: 'Owner',
              },
            },
          },
        },
        select: { id: true },
      });
    });
  });

  describe('handleManualCleanup', () => {
    it('should process manual cleanup for specific tenant', async () => {
      const manualJob = {
        data: {
          tenantId: 'tenant-123',
          userId: 'user-123',
        },
      } as Job<{ tenantId: string; userId: string }>;

      mockFilesService.findOrphans.mockResolvedValue({
        orphans: [{ file_id: 'orphan-1' }],
        total: 2,
        marked_as_orphan: 2,
      });

      mockFilesService.moveOrphansToTrash.mockResolvedValue({
        message: '1 orphan files moved to trash',
        count: 1,
      });

      mockFilesService.cleanupTrashedFiles.mockResolvedValue({
        message: '3 trashed files permanently deleted',
        count: 3,
      });

      const result = await processor.handleManualCleanup(manualJob);

      expect(mockFilesService.findOrphans).toHaveBeenCalledWith('tenant-123');
      expect(mockFilesService.moveOrphansToTrash).toHaveBeenCalledWith(
        'tenant-123',
        'user-123',
      );
      expect(mockFilesService.cleanupTrashedFiles).toHaveBeenCalledWith(
        'tenant-123',
        'user-123',
      );

      expect(result).toEqual({
        success: true,
        orphansMarked: 2,
        orphansTrashed: 1,
        trashedDeleted: 3,
      });
    });

    it('should handle errors in manual cleanup', async () => {
      const manualJob = {
        data: {
          tenantId: 'tenant-123',
          userId: 'user-123',
        },
      } as Job<{ tenantId: string; userId: string }>;

      const error = new Error('Cleanup failed');
      mockFilesService.findOrphans.mockRejectedValue(error);

      await expect(processor.handleManualCleanup(manualJob)).rejects.toThrow(
        'Cleanup failed',
      );

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Manual cleanup failed'),
        expect.any(String),
      );
    });
  });

  describe('Logging', () => {
    it('should log progress for each tenant', async () => {
      const mockTenants = [{ id: 'tenant-1', company_name: 'Company A' }];

      mockPrismaService.tenant.findMany.mockResolvedValue(mockTenants);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'owner-123' });

      mockFilesService.findOrphans.mockResolvedValue({
        orphans: [],
        total: 5,
        marked_as_orphan: 5,
      });

      mockFilesService.moveOrphansToTrash.mockResolvedValue({
        count: 3,
      });

      mockFilesService.cleanupTrashedFiles.mockResolvedValue({
        count: 2,
      });

      await processor.handleDailyCleanup(mockJob);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Marked 5 files as orphan'),
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Moved 3 orphan files to trash'),
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Permanently deleted 2 trashed files'),
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Daily cleanup completed'),
      );
    });

    it('should log summary with correct totals', async () => {
      const mockTenants = [
        { id: 'tenant-1', company_name: 'Company A' },
        { id: 'tenant-2', company_name: 'Company B' },
      ];

      mockPrismaService.tenant.findMany.mockResolvedValue(mockTenants);
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'owner-123' });

      mockFilesService.findOrphans.mockResolvedValue({
        orphans: [],
        total: 5,
        marked_as_orphan: 5,
      });

      mockFilesService.moveOrphansToTrash.mockResolvedValue({ count: 3 });
      mockFilesService.cleanupTrashedFiles.mockResolvedValue({ count: 2 });

      await processor.handleDailyCleanup(mockJob);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Daily cleanup completed: 10 files marked as orphan, 6 orphans moved to trash, 4 trashed files deleted',
      );
    });
  });
});
