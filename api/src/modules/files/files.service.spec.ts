import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../../core/database/prisma.service';
import { FileStorageService } from '../../core/file-storage/file-storage.service';
import { StorageProviderFactory } from '../../core/file-storage/storage-provider.factory';
import { ImageProcessorService } from '../../core/file-storage/image-processor.service';
import { AuditLoggerService } from '../audit/services/audit-logger.service';
import { FileCategory } from './dto/upload-file.dto';
import * as bcrypt from 'bcrypt';

describe('FilesService', () => {
  let service: FilesService;
  let prismaService: PrismaService;
  let storageFactory: StorageProviderFactory;
  let imageProcessor: ImageProcessorService;

  const mockStorageProvider = {
    upload: jest.fn(),
    uploadThumbnail: jest.fn(),
    delete: jest.fn(),
    getFileUrl: jest.fn(),
    getProviderType: jest.fn().mockReturnValue('local'),
  };

  const mockPrismaService = {
    file: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    file_share_link: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockFileStorageService = {
    uploadFile: jest.fn(),
    getFileInfo: jest.fn(),
    deleteFileByPath: jest.fn(),
  };

  const mockStorageFactory = {
    getProvider: jest.fn().mockResolvedValue(mockStorageProvider),
  };

  const mockImageProcessor = {
    isImage: jest.fn(),
    processImage: jest.fn(),
  };

  const mockAuditLogger = {
    log: jest.fn(),
    logAuth: jest.fn(),
    logTenantChange: jest.fn(),
    logRBACChange: jest.fn(),
    logFailedAction: jest.fn(),
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
        {
          provide: StorageProviderFactory,
          useValue: mockStorageFactory,
        },
        {
          provide: ImageProcessorService,
          useValue: mockImageProcessor,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    prismaService = module.get<PrismaService>(PrismaService);
    storageFactory = module.get<StorageProviderFactory>(StorageProviderFactory);
    imageProcessor = module.get<ImageProcessorService>(ImageProcessorService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    const mockBuffer = Buffer.from('test file content');
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test-image.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: mockBuffer.length,
      buffer: mockBuffer,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const uploadDto = {
      category: 'photo' as FileCategory,
      entity_type: 'lead',
      entity_id: 'lead-123',
      uploaded_by: mockUserId,
    };

    it('should upload an image file with optimization', async () => {
      mockImageProcessor.isImage.mockReturnValue(true);
      mockImageProcessor.processImage.mockResolvedValue({
        processedBuffer: Buffer.from('optimized'),
        thumbnailBuffer: Buffer.from('thumbnail'),
        width: 1920,
        height: 1080,
        format: 'webp',
        originalSize: 1000,
        processedSize: 700,
        wasOptimized: true,
        hadThumbnail: true,
      });

      mockStorageProvider.upload.mockResolvedValue({
        fileId: mockFileId,
        storagePath: 'tenant-123/images/file-123.webp',
        url: 'https://example.com/file-123.webp',
        size: 700,
      });

      mockStorageProvider.uploadThumbnail.mockResolvedValue({
        fileId: 'file-123-thumb',
        storagePath: 'tenant-123/images/file-123_thumb.webp',
        url: 'https://example.com/file-123_thumb.webp',
        size: 100,
      });

      mockPrismaService.file.create.mockResolvedValue({
        id: mockFileId,
        tenant_id: mockTenantId,
        original_filename: 'test-image.jpg',
        storage_filename: 'file-123.webp',
        storage_path: 'tenant-123/images/file-123.webp',
        file_size: 700,
        mime_type: 'image/jpeg',
        category: 'photo',
        entity_type: 'lead',
        entity_id: 'lead-123',
        uploaded_by: mockUserId,
        url: 'https://example.com/file-123.webp',
        has_thumbnail: true,
        thumbnail_url: 'https://example.com/file-123_thumb.webp',
        is_optimized: true,
        width: 1920,
        height: 1080,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.uploadFile(
        mockTenantId,
        mockUserId,
        mockFile,
        uploadDto,
      );

      expect(mockImageProcessor.isImage).toHaveBeenCalledWith('image/jpeg');
      expect(mockImageProcessor.processImage).toHaveBeenCalled();
      expect(mockStorageProvider.upload).toHaveBeenCalled();
      expect(mockStorageProvider.uploadThumbnail).toHaveBeenCalled();
      expect(mockPrismaService.file.create).toHaveBeenCalled();
      expect(result.file.id).toBe(mockFileId);
      expect(result.file.is_optimized).toBe(true);
    });

    it('should upload a non-image file without optimization', async () => {
      const pdfFile = {
        ...mockFile,
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      };

      mockImageProcessor.isImage.mockReturnValue(false);
      mockStorageProvider.upload.mockResolvedValue({
        fileId: mockFileId,
        storagePath: 'tenant-123/files/file-123.pdf',
        url: 'https://example.com/file-123.pdf',
        size: mockBuffer.length,
      });

      mockPrismaService.file.create.mockResolvedValue({
        id: mockFileId,
        tenant_id: mockTenantId,
        original_filename: 'document.pdf',
        storage_filename: 'file-123.pdf',
        storage_path: 'tenant-123/files/file-123.pdf',
        file_size: mockBuffer.length,
        mime_type: 'application/pdf',
        category: 'invoice',
        entity_type: null,
        entity_id: null,
        uploaded_by: mockUserId,
        url: 'https://example.com/file-123.pdf',
        has_thumbnail: false,
        thumbnail_url: null,
        is_optimized: false,
        width: null,
        height: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.uploadFile(
        mockTenantId,
        mockUserId,
        pdfFile,
        {
          category: FileCategory.INVOICE,
        },
      );

      expect(mockImageProcessor.isImage).toHaveBeenCalledWith(
        'application/pdf',
      );
      expect(mockImageProcessor.processImage).not.toHaveBeenCalled();
      expect(mockPrismaService.file.create).toHaveBeenCalled();
      expect(result.file.is_optimized).toBe(false);
    });

    it('should throw error if file upload fails', async () => {
      mockImageProcessor.isImage.mockReturnValue(false);
      mockStorageProvider.upload.mockRejectedValue(new Error('Storage error'));

      await expect(
        service.uploadFile(mockTenantId, mockUserId, mockFile, uploadDto),
      ).rejects.toThrow('Storage error');
    });
  });

  describe('findOne', () => {
    it('should return a file by ID', async () => {
      const mockFile = {
        id: mockFileId,
        tenant_id: mockTenantId,
        original_filename: 'test.jpg',
        storage_filename: 'file-123.jpg',
        storage_path: 'tenant-123/images/file-123.jpg',
        file_size: 1000,
        mime_type: 'image/jpeg',
        category: 'photo',
        entity_type: null,
        entity_id: null,
        uploaded_by: mockUserId,
        url: 'https://example.com/file-123.jpg',
        has_thumbnail: false,
        thumbnail_url: null,
        is_optimized: false,
        width: null,
        height: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.file.findFirst.mockResolvedValue(mockFile);
      mockFileStorageService.getFileInfo.mockResolvedValue({
        url: 'https://example.com/file-123.jpg',
        size: 1000,
      });

      const result = await service.findOne(mockTenantId, mockFileId);

      expect(mockPrismaService.file.findFirst).toHaveBeenCalledWith({
        where: {
          file_id: mockFileId,
          tenant_id: mockTenantId,
          is_trashed: false,
        },
      });
      expect(result.url).toBe('https://example.com/file-123.jpg');
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockTenantId, mockFileId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated files', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          file_id: 'file-1',
          original_filename: 'file1.jpg',
          tenant_id: mockTenantId,
        },
        {
          id: 'file-2',
          file_id: 'file-2',
          original_filename: 'file2.jpg',
          tenant_id: mockTenantId,
        },
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockFiles);
      mockPrismaService.file.count.mockResolvedValue(2);
      mockFileStorageService.getFileInfo.mockResolvedValue({
        url: 'https://example.com/file.jpg',
        size: 1000,
      });

      const result = await service.findAll(mockTenantId, {
        page: 1,
        limit: 20,
      });

      expect(result.data.length).toBe(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: { tenant_id: mockTenantId, is_trashed: false },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          file_id: true,
          original_filename: true,
          mime_type: true,
          size_bytes: true,
          category: true,
          entity_type: true,
          entity_id: true,
          is_orphan: true,
          uploaded_by: true,
          created_at: true,
          updated_at: true,
        },
      });
    });

    it('should filter files by category', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([]);
      mockPrismaService.file.count.mockResolvedValue(0);

      await service.findAll(mockTenantId, {
        page: 1,
        limit: 20,
        category: FileCategory.PHOTO,
      });

      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          is_trashed: false,
          category: FileCategory.PHOTO,
        },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          file_id: true,
          original_filename: true,
          mime_type: true,
          size_bytes: true,
          category: true,
          entity_type: true,
          entity_id: true,
          is_orphan: true,
          uploaded_by: true,
          created_at: true,
          updated_at: true,
        },
      });
    });

    it('should filter files by entity_id', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([]);
      mockPrismaService.file.count.mockResolvedValue(0);

      await service.findAll(mockTenantId, {
        page: 1,
        limit: 20,
        entity_id: 'lead-123',
      });

      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          is_trashed: false,
          entity_id: 'lead-123',
        },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          file_id: true,
          original_filename: true,
          mime_type: true,
          size_bytes: true,
          category: true,
          entity_type: true,
          entity_id: true,
          is_orphan: true,
          uploaded_by: true,
          created_at: true,
          updated_at: true,
        },
      });
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      const mockFile = {
        id: mockFileId,
        tenant_id: mockTenantId,
        storage_path: 'tenant-123/files/file-123.pdf',
        storage_filename: 'file-123.pdf',
        has_thumbnail: false,
        thumbnail_url: null,
      };

      mockPrismaService.file.findFirst.mockResolvedValue(mockFile);
      mockPrismaService.file.delete.mockResolvedValue(mockFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);

      await service.delete(mockTenantId, mockFileId, mockUserId);

      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        'tenant-123/files/file-123.pdf',
      );
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: mockFileId },
      });
    });

    it('should delete file and thumbnail if thumbnail exists', async () => {
      const mockFile = {
        id: mockFileId,
        tenant_id: mockTenantId,
        storage_path: 'tenant-123/images/file-123.webp',
        storage_filename: 'file-123.webp',
        has_thumbnail: true,
        thumbnail_url: 'https://example.com/file-123_thumb.webp',
      };

      mockPrismaService.file.findFirst.mockResolvedValue(mockFile);
      mockPrismaService.file.delete.mockResolvedValue(mockFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);

      await service.delete(mockTenantId, mockFileId, mockUserId);

      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        'tenant-123/images/file-123.webp',
      );
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(mockTenantId, mockFileId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOrphans', () => {
    it('should find orphaned files older than 30 days', async () => {
      const mockOrphans = [
        {
          id: 'orphan-1',
          file_id: 'orphan-1',
          original_filename: 'orphan1.jpg',
          entity_id: null,
          created_at: new Date(),
        },
        {
          id: 'orphan-2',
          file_id: 'orphan-2',
          original_filename: 'orphan2.jpg',
          entity_id: null,
          created_at: new Date(),
        },
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockOrphans);
      mockPrismaService.file.updateMany.mockResolvedValue({ count: 2 });
      mockFileStorageService.getFileInfo.mockResolvedValue({
        url: 'https://example.com/file.jpg',
        size: 1000,
      });

      const result = await service.findOrphans(mockTenantId);

      expect(result.orphans).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.marked_as_orphan).toBe(2);
      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          entity_id: null,
          created_at: { lte: expect.any(Date) },
          is_trashed: false,
        },
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          file_id: true,
          original_filename: true,
          mime_type: true,
          size_bytes: true,
          category: true,
          is_orphan: true,
          orphaned_at: true,
          created_at: true,
        },
      });
    });
  });

  describe('moveOrphansToTrash', () => {
    it('should move orphan files to trash', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([
        { id: 'file-1', file_id: 'file-1' },
        { id: 'file-2', file_id: 'file-2' },
        { id: 'file-3', file_id: 'file-3' },
        { id: 'file-4', file_id: 'file-4' },
        { id: 'file-5', file_id: 'file-5' },
      ]);
      mockPrismaService.file.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.moveOrphansToTrash(mockTenantId, mockUserId);

      expect(result.message).toContain('5 orphan files moved to trash');
      expect(result.count).toBe(5);
      expect(mockPrismaService.file.updateMany).toHaveBeenCalled();
    });
  });

  describe('cleanupTrashedFiles', () => {
    it('should permanently delete trashed files older than 30 days', async () => {
      const mockTrashedFiles = [
        {
          id: 'trash-1',
          storage_path: 'tenant-123/files/trash-1.pdf',
          storage_filename: 'trash-1.pdf',
          has_thumbnail: false,
        },
        {
          id: 'trash-2',
          storage_path: 'tenant-123/files/trash-2.pdf',
          storage_filename: 'trash-2.pdf',
          has_thumbnail: false,
        },
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockTrashedFiles);
      mockPrismaService.file.deleteMany.mockResolvedValue({ count: 2 });
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);

      const result = await service.cleanupTrashedFiles(
        mockTenantId,
        mockUserId,
      );

      expect(result.count).toBe(2);
      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledTimes(2);
    });
  });

  describe('createShareLink', () => {
    it('should create a share link without password', async () => {
      const mockFile = {
        id: mockFileId,
        tenant_id: mockTenantId,
        original_filename: 'test.pdf',
      };

      const mockShareLink = {
        id: 'share-123',
        file_id: mockFileId,
        tenant_id: mockTenantId,
        share_token: 'a'.repeat(64),
        password_hash: null,
        expires_at: null,
        max_downloads: null,
        download_count: 0,
        is_active: true,
        created_by: mockUserId,
        created_at: new Date(),
        last_accessed_at: null,
      };

      mockPrismaService.file.findFirst.mockResolvedValue(mockFile);
      mockPrismaService.file_share_link.create.mockResolvedValue(mockShareLink);

      const result = await service.createShareLink(mockTenantId, mockUserId, {
        file_id: mockFileId,
      });

      expect(result.share_link.share_token).toHaveLength(64);
      expect(mockPrismaService.file_share_link.create).toHaveBeenCalled();
    });

    it('should create a share link with password', async () => {
      const mockFile = {
        id: mockFileId,
        tenant_id: mockTenantId,
        original_filename: 'test.pdf',
      };

      mockPrismaService.file.findFirst.mockResolvedValue(mockFile);
      mockPrismaService.file_share_link.create.mockResolvedValue({
        id: 'share-123',
        file_id: mockFileId,
        share_token: 'a'.repeat(64),
        password_hash: 'hashed',
      });

      const result = await service.createShareLink(mockTenantId, mockUserId, {
        file_id: mockFileId,
        password: 'test123',
      });

      expect(mockPrismaService.file_share_link.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          password_hash: expect.any(String),
        }),
      });
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.file.findFirst.mockResolvedValue(null);

      await expect(
        service.createShareLink(mockTenantId, mockUserId, {
          file_id: mockFileId,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('accessShareLink', () => {
    it('should access share link without password', async () => {
      const mockShareLink = {
        id: 'share-123',
        file_id: mockFileId,
        tenant_id: mockTenantId,
        share_token: 'a'.repeat(64),
        password_hash: null,
        expires_at: null,
        max_downloads: null,
        download_count: 0,
        is_active: true,
        created_by: mockUserId,
        created_at: new Date(),
        last_accessed_at: null,
        file: {
          id: mockFileId,
          original_filename: 'test.pdf',
          file_size: 1000,
          mime_type: 'application/pdf',
          url: 'https://example.com/test.pdf',
        },
      };

      mockPrismaService.file_share_link.findUnique.mockResolvedValue(
        mockShareLink,
      );
      mockPrismaService.file_share_link.update.mockResolvedValue(mockShareLink);

      const result = await service.accessShareLink('a'.repeat(64), {});

      expect(result.file).toBeDefined();
      expect(mockPrismaService.file_share_link.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password required but not provided', async () => {
      const mockShareLink = {
        id: 'share-123',
        password_hash: await bcrypt.hash('test123', 10),
        is_active: true,
        expires_at: null,
        max_downloads: null,
        download_count: 0,
      };

      mockPrismaService.file_share_link.findUnique.mockResolvedValue(
        mockShareLink,
      );

      await expect(service.accessShareLink('a'.repeat(64), {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw NotFoundException if share link not found', async () => {
      mockPrismaService.file_share_link.findUnique.mockResolvedValue(null);

      await expect(
        service.accessShareLink('invalid-token', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if share link expired', async () => {
      const mockShareLink = {
        id: 'share-123',
        password_hash: null,
        is_active: true,
        expires_at: new Date(Date.now() - 86400000), // Yesterday
        max_downloads: null,
        download_count: 0,
      };

      mockPrismaService.file_share_link.findUnique.mockResolvedValue(
        mockShareLink,
      );

      await expect(service.accessShareLink('a'.repeat(64), {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if max downloads exceeded', async () => {
      const mockShareLink = {
        id: 'share-123',
        password_hash: null,
        is_active: true,
        expires_at: null,
        max_downloads: 5,
        download_count: 5,
      };

      mockPrismaService.file_share_link.findUnique.mockResolvedValue(
        mockShareLink,
      );

      await expect(service.accessShareLink('a'.repeat(64), {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('revokeShareLink', () => {
    it('should revoke a share link', async () => {
      const mockShareLink = {
        id: 'share-123',
        tenant_id: mockTenantId,
        is_active: true,
      };

      mockPrismaService.file_share_link.findFirst.mockResolvedValue(
        mockShareLink,
      );
      mockPrismaService.file_share_link.update.mockResolvedValue({
        ...mockShareLink,
        is_active: false,
      });

      await service.revokeShareLink(mockTenantId, mockUserId, 'share-123');

      expect(mockPrismaService.file_share_link.update).toHaveBeenCalledWith({
        where: { id: 'share-123' },
        data: { is_active: false },
      });
    });

    it('should throw NotFoundException if share link not found', async () => {
      mockPrismaService.file_share_link.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeShareLink(mockTenantId, mockUserId, 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listShareLinks', () => {
    it('should list all share links for tenant', async () => {
      const mockShareLinks = [
        {
          id: 'share-1',
          file_id: 'file-1',
          tenant_id: mockTenantId,
          share_token: 'token1',
          password_hash: null,
          expires_at: null,
          max_downloads: null,
          download_count: 0,
          file: { original_filename: 'file1.pdf' },
        },
        {
          id: 'share-2',
          file_id: 'file-2',
          tenant_id: mockTenantId,
          share_token: 'token2',
          password_hash: null,
          expires_at: null,
          max_downloads: null,
          download_count: 0,
          file: { original_filename: 'file2.pdf' },
        },
      ];

      mockPrismaService.file_share_link.findMany.mockResolvedValue(
        mockShareLinks,
      );

      const result = await service.listShareLinks(mockTenantId);

      expect(result.share_links.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should list share links filtered by file_id', async () => {
      const mockShareLinks = [
        {
          id: 'share-1',
          file_id: mockFileId,
          tenant_id: mockTenantId,
          share_token: 'token1',
          password_hash: null,
          expires_at: null,
          max_downloads: null,
          download_count: 0,
          file: { original_filename: 'test.pdf' },
        },
      ];

      mockPrismaService.file_share_link.findMany.mockResolvedValue(
        mockShareLinks,
      );

      const result = await service.listShareLinks(mockTenantId, mockFileId);

      expect(mockPrismaService.file_share_link.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          file_id: mockFileId,
        },
        include: {
          file: {
            select: {
              file_id: true,
              original_filename: true,
              mime_type: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple files', async () => {
      const fileIds = ['file-1', 'file-2', 'file-3'];
      const mockFiles = [
        {
          id: 'file-1',
          file_id: 'file-1',
          storage_path: 'tenant-123/files/file-1.pdf',
          storage_filename: 'file-1.pdf',
          has_thumbnail: false,
        },
        {
          id: 'file-2',
          file_id: 'file-2',
          storage_path: 'tenant-123/files/file-2.pdf',
          storage_filename: 'file-2.pdf',
          has_thumbnail: false,
        },
        {
          id: 'file-3',
          file_id: 'file-3',
          storage_path: 'tenant-123/files/file-3.pdf',
          storage_filename: 'file-3.pdf',
          has_thumbnail: false,
        },
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockFiles);
      mockPrismaService.file.deleteMany.mockResolvedValue({ count: 3 });
      mockStorageProvider.delete.mockResolvedValue(undefined);

      const result = await service.bulkDelete(mockTenantId, mockUserId, {
        file_ids: fileIds,
      });

      expect(result.count).toBe(3);
      expect(mockPrismaService.file.deleteMany).toHaveBeenCalled();
      expect(mockStorageProvider.delete).toHaveBeenCalledTimes(3);
    });

    it('should throw BadRequestException if no files provided', async () => {
      await expect(
        service.bulkDelete(mockTenantId, mockUserId, { file_ids: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if too many files provided', async () => {
      const tooManyFiles = Array(101).fill('file-id');

      await expect(
        service.bulkDelete(mockTenantId, mockUserId, {
          file_ids: tooManyFiles,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
