import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../../core/database/prisma.service';
import { FileStorageService } from '../../core/file-storage/file-storage.service';
import { FileCategory } from './dto/upload-file.dto';

describe('FilesService', () => {
  let service: FilesService;
  let prismaService: PrismaService;
  let fileStorageService: FileStorageService;

  const mockPrismaService = {
    file: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    tenant: {
      findMany: jest.fn(),
    },
  };

  const mockFileStorageService = {
    uploadFile: jest.fn(),
    getFileInfo: jest.fn(),
    deleteFileByPath: jest.fn(),
  };

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockFileId = 'file-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FileStorageService,
          useValue: mockFileStorageService,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    prismaService = module.get<PrismaService>(PrismaService);
    fileStorageService = module.get<FileStorageService>(FileStorageService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    const mockFile = {
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    const mockUploadDto = {
      category: FileCategory.QUOTE,
      entity_type: 'quote',
      entity_id: 'quote-123',
    };

    it('should upload a file successfully with entity_id', async () => {
      const mockStorageResult = {
        file_id: mockFileId,
        url: '/public/tenant-123/files/file-123.pdf',
        metadata: {
          original_filename: 'test.pdf',
          mime_type: 'application/pdf',
          size_bytes: 1024,
          storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
        },
      };

      const mockFileRecord = {
        id: 1,
        file_id: mockFileId,
        original_filename: 'test.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1024,
        category: FileCategory.QUOTE,
        created_at: new Date(),
      };

      mockFileStorageService.uploadFile.mockResolvedValue(mockStorageResult);
      mockPrismaService.file.create.mockResolvedValue(mockFileRecord);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.uploadFile(mockTenantId, mockUserId, mockFile, mockUploadDto);

      expect(mockFileStorageService.uploadFile).toHaveBeenCalledWith(
        mockTenantId,
        mockFile,
        expect.objectContaining({
          category: FileCategory.QUOTE,
        }),
      );

      expect(mockPrismaService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          file_id: mockFileId,
          tenant_id: mockTenantId,
          uploaded_by: mockUserId,
          entity_type: 'quote',
          entity_id: 'quote-123',
          is_orphan: false, // Should be false when entity_id provided
        }),
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();

      expect(result).toEqual({
        message: 'File uploaded successfully',
        file_id: mockFileId,
        url: mockStorageResult.url,
        file: expect.objectContaining({
          file_id: mockFileId,
          original_filename: 'test.pdf',
        }),
      });
    });

    it('should mark file as orphan when no entity_id provided', async () => {
      const uploadDtoNoEntity = {
        category: FileCategory.MISC,
      };

      const mockStorageResult = {
        file_id: mockFileId,
        url: '/public/tenant-123/files/file-123.pdf',
        metadata: {
          original_filename: 'test.pdf',
          mime_type: 'application/pdf',
          size_bytes: 1024,
          storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
        },
      };

      mockFileStorageService.uploadFile.mockResolvedValue(mockStorageResult);
      mockPrismaService.file.create.mockResolvedValue({
        id: 1,
        file_id: mockFileId,
        is_orphan: true,
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.uploadFile(mockTenantId, mockUserId, mockFile, uploadDtoNoEntity);

      expect(mockPrismaService.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          is_orphan: true, // Should be true when no entity_id
          entity_id: null,
        }),
      });
    });
  });

  describe('findOne', () => {
    it('should find a file by file_id', async () => {
      const mockFile = {
        id: 1,
        file_id: mockFileId,
        original_filename: 'test.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1024,
        category: FileCategory.QUOTE,
        entity_type: 'quote',
        entity_id: 'quote-123',
        is_orphan: false,
        uploaded_by: mockUserId,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.file.findFirst.mockResolvedValue(mockFile);
      mockFileStorageService.getFileInfo.mockResolvedValue({
        exists: true,
        url: '/public/tenant-123/files/file-123.pdf',
      });

      const result = await service.findOne(mockTenantId, mockFileId);

      expect(mockPrismaService.file.findFirst).toHaveBeenCalledWith({
        where: {
          file_id: mockFileId,
          tenant_id: mockTenantId,
          is_trashed: false,
        },
      });

      expect(result).toEqual(expect.objectContaining({
        file_id: mockFileId,
        url: '/public/tenant-123/files/file-123.pdf',
      }));
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockTenantId, mockFileId)).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      const wrongTenantId = 'wrong-tenant';
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      await expect(service.findOne(wrongTenantId, mockFileId)).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.file.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenant_id: wrongTenantId,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated files with filters', async () => {
      const mockFiles = [
        {
          id: 1,
          file_id: 'file-1',
          original_filename: 'quote1.pdf',
          category: FileCategory.QUOTE,
        },
        {
          id: 2,
          file_id: 'file-2',
          original_filename: 'quote2.pdf',
          category: FileCategory.QUOTE,
        },
      ];

      mockPrismaService.file.count.mockResolvedValue(2);
      mockPrismaService.file.findMany.mockResolvedValue(mockFiles);
      mockFileStorageService.getFileInfo.mockResolvedValue({
        exists: true,
        url: '/public/tenant-123/files/file-1.pdf',
      });

      const query = {
        category: FileCategory.QUOTE,
        page: 1,
        limit: 20,
      };

      const result = await service.findAll(mockTenantId, query);

      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenant_id: mockTenantId,
          category: FileCategory.QUOTE,
          is_trashed: false,
        }),
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });

      expect(result.pagination).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      expect(result.data).toHaveLength(2);
    });

    it('should filter by entity_type and entity_id', async () => {
      mockPrismaService.file.count.mockResolvedValue(1);
      mockPrismaService.file.findMany.mockResolvedValue([]);

      await service.findAll(mockTenantId, {
        entity_type: 'quote',
        entity_id: 'quote-123',
      });

      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entity_type: 'quote',
            entity_id: 'quote-123',
          }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('should hard delete a file (filesystem and database)', async () => {
      const mockFile = {
        id: 1,
        file_id: mockFileId,
        storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
        original_filename: 'test.pdf',
        category: FileCategory.QUOTE,
      };

      mockPrismaService.file.findFirst.mockResolvedValue(mockFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue(mockFile);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.delete(mockTenantId, mockFileId, mockUserId);

      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(mockFile.storage_path);
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: mockFile.id },
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
      expect(result).toEqual({ message: 'File deleted successfully' });
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      await expect(service.delete(mockTenantId, mockFileId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOrphans', () => {
    it('should find and mark orphan files (30+ days old)', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const mockOrphans = [
        {
          id: 1,
          file_id: 'orphan-1',
          original_filename: 'orphan1.pdf',
          is_orphan: false, // Not yet marked
          orphaned_at: null,
          created_at: thirtyOneDaysAgo,
        },
        {
          id: 2,
          file_id: 'orphan-2',
          original_filename: 'orphan2.pdf',
          is_orphan: true, // Already marked
          orphaned_at: thirtyOneDaysAgo,
          created_at: thirtyOneDaysAgo,
        },
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockOrphans);
      mockPrismaService.file.updateMany.mockResolvedValue({ count: 1 });
      mockFileStorageService.getFileInfo.mockResolvedValue({
        exists: true,
        url: '/public/tenant-123/files/orphan-1.pdf',
      });

      const result = await service.findOrphans(mockTenantId);

      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          entity_id: null,
          created_at: expect.any(Object),
          is_trashed: false,
        },
        orderBy: { created_at: 'asc' },
        select: expect.any(Object),
      });

      expect(mockPrismaService.file.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } }, // Only the unmarked one
        data: {
          is_orphan: true,
          orphaned_at: expect.any(Date),
        },
      });

      expect(result.total).toBe(2);
      expect(result.marked_as_orphan).toBe(1);
    });
  });

  describe('moveOrphansToTrash', () => {
    it('should move orphans to trash (30+ days after being marked)', async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const mockOrphansToTrash = [
        {
          id: 1,
          file_id: 'orphan-1',
          orphaned_at: sixtyDaysAgo,
        },
        {
          id: 2,
          file_id: 'orphan-2',
          orphaned_at: sixtyDaysAgo,
        },
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockOrphansToTrash);
      mockPrismaService.file.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.moveOrphansToTrash(mockTenantId, mockUserId);

      expect(mockPrismaService.file.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2] },
        },
        data: {
          is_trashed: true,
          trashed_at: expect.any(Date),
        },
      });

      expect(result).toEqual({
        message: '2 orphan files moved to trash',
        count: 2,
      });
    });

    it('should return zero count if no orphans ready for trash', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([]);

      const result = await service.moveOrphansToTrash(mockTenantId, mockUserId);

      expect(result).toEqual({
        message: 'No orphan files ready to move to trash',
        count: 0,
      });
    });
  });

  describe('cleanupTrashedFiles', () => {
    it('should permanently delete trashed files (30+ days in trash)', async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const mockTrashedFiles = [
        {
          id: 1,
          file_id: 'trashed-1',
          storage_path: '/uploads/public/tenant-123/files/trashed-1.pdf',
          trashed_at: sixtyDaysAgo,
        },
        {
          id: 2,
          file_id: 'trashed-2',
          storage_path: '/uploads/public/tenant-123/files/trashed-2.pdf',
          trashed_at: sixtyDaysAgo,
        },
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockTrashedFiles);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.cleanupTrashedFiles(mockTenantId, mockUserId);

      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.file.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2] },
        },
      });

      expect(result).toEqual({
        message: '2 trashed files permanently deleted',
        count: 2,
      });
    });

    it('should return zero count if no trashed files ready for deletion', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([]);

      const result = await service.cleanupTrashedFiles(mockTenantId, mockUserId);

      expect(result).toEqual({
        message: 'No trashed files ready for permanent deletion',
        count: 0,
      });
    });
  });

  describe('Validation Rules', () => {
    it('should apply correct validation rules for quote category', async () => {
      const mockFile = {
        originalname: 'quote.pdf',
        mimetype: 'application/pdf',
        size: 5 * 1024 * 1024, // 5MB
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockFileStorageService.uploadFile.mockResolvedValue({
        file_id: 'file-123',
        url: '/test.pdf',
        metadata: {
          original_filename: 'quote.pdf',
          mime_type: 'application/pdf',
          size_bytes: 5 * 1024 * 1024,
          storage_path: '/path',
        },
      });
      mockPrismaService.file.create.mockResolvedValue({});
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.uploadFile(mockTenantId, mockUserId, mockFile, {
        category: FileCategory.QUOTE,
      });

      expect(mockFileStorageService.uploadFile).toHaveBeenCalledWith(
        mockTenantId,
        mockFile,
        expect.objectContaining({
          maxSizeBytes: 10 * 1024 * 1024, // 10MB for quotes
          allowedMimeTypes: expect.arrayContaining([
            'application/pdf',
            'application/msword',
          ]),
        }),
      );
    });

    it('should apply correct validation rules for misc category', async () => {
      const mockFile = {
        originalname: 'doc.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 15 * 1024 * 1024, // 15MB
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockFileStorageService.uploadFile.mockResolvedValue({
        file_id: 'file-123',
        url: '/test.xlsx',
        metadata: {
          original_filename: 'doc.xlsx',
          mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size_bytes: 15 * 1024 * 1024,
          storage_path: '/path',
        },
      });
      mockPrismaService.file.create.mockResolvedValue({});
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.uploadFile(mockTenantId, mockUserId, mockFile, {
        category: FileCategory.MISC,
      });

      expect(mockFileStorageService.uploadFile).toHaveBeenCalledWith(
        mockTenantId,
        mockFile,
        expect.objectContaining({
          maxSizeBytes: 20 * 1024 * 1024, // 20MB for misc
          allowedMimeTypes: expect.arrayContaining([
            'text/plain',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ]),
        }),
      );
    });
  });
});
