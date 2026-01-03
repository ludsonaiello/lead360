import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileCategory } from './dto/upload-file.dto';

describe('FilesController', () => {
  let controller: FilesController;
  let service: FilesService;

  const mockFilesService = {
    uploadFile: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    findOrphans: jest.fn(),
    moveOrphansToTrash: jest.fn(),
    cleanupTrashedFiles: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      tenant_id: 'tenant-123',
    },
  };

  const mockFile = {
    originalname: 'test.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test'),
  } as Express.Multer.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    service = module.get<FilesService>(FilesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should upload a file and return result', async () => {
      const uploadDto = {
        category: FileCategory.QUOTE,
        entity_type: 'quote',
        entity_id: 'quote-123',
      };

      const mockResult = {
        message: 'File uploaded successfully',
        file_id: 'file-123',
        url: '/public/tenant-123/files/file-123.pdf',
        file: {
          id: 1,
          file_id: 'file-123',
          original_filename: 'test.pdf',
        },
      };

      mockFilesService.uploadFile.mockResolvedValue(mockResult);

      const result = await controller.uploadFile(mockRequest, mockFile, uploadDto);

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        mockRequest.user.tenant_id,
        mockRequest.user.id,
        mockFile,
        uploadDto,
      );

      expect(result).toEqual(mockResult);
    });
  });

  describe('findAll', () => {
    it('should return paginated files list', async () => {
      const query = {
        category: FileCategory.QUOTE,
        page: 1,
        limit: 20,
      };

      const mockResult = {
        data: [
          {
            id: 1,
            file_id: 'file-1',
            original_filename: 'quote1.pdf',
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockFilesService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockRequest, query);

      expect(mockFilesService.findAll).toHaveBeenCalledWith(
        mockRequest.user.tenant_id,
        query,
      );

      expect(result).toEqual(mockResult);
    });

    it('should filter by entity_type and entity_id', async () => {
      const query = {
        entity_type: 'quote',
        entity_id: 'quote-123',
      };

      mockFilesService.findAll.mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      await controller.findAll(mockRequest, query);

      expect(mockFilesService.findAll).toHaveBeenCalledWith(
        mockRequest.user.tenant_id,
        expect.objectContaining({
          entity_type: 'quote',
          entity_id: 'quote-123',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single file by ID', async () => {
      const fileId = 'file-123';
      const mockResult = {
        id: 1,
        file_id: fileId,
        original_filename: 'test.pdf',
        url: '/public/tenant-123/files/file-123.pdf',
      };

      mockFilesService.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOne(mockRequest, fileId);

      expect(mockFilesService.findOne).toHaveBeenCalledWith(
        mockRequest.user.tenant_id,
        fileId,
      );

      expect(result).toEqual(mockResult);
    });
  });

  describe('delete', () => {
    it('should delete a file and return success message', async () => {
      const fileId = 'file-123';
      const mockResult = { message: 'File deleted successfully' };

      mockFilesService.delete.mockResolvedValue(mockResult);

      const result = await controller.delete(mockRequest, fileId);

      expect(mockFilesService.delete).toHaveBeenCalledWith(
        mockRequest.user.tenant_id,
        fileId,
        mockRequest.user.id,
      );

      expect(result).toEqual(mockResult);
    });
  });

  describe('findOrphans', () => {
    it('should return list of orphan files (Admin/Owner only)', async () => {
      const mockResult = {
        orphans: [
          {
            id: 1,
            file_id: 'orphan-1',
            original_filename: 'orphan.pdf',
            days_orphaned: 35,
          },
        ],
        total: 1,
        marked_as_orphan: 1,
      };

      mockFilesService.findOrphans.mockResolvedValue(mockResult);

      const result = await controller.findOrphans(mockRequest);

      expect(mockFilesService.findOrphans).toHaveBeenCalledWith(
        mockRequest.user.tenant_id,
      );

      expect(result).toEqual(mockResult);
    });
  });

  describe('moveOrphansToTrash', () => {
    it('should move orphan files to trash (Admin/Owner only)', async () => {
      const mockResult = {
        message: '3 orphan files moved to trash',
        count: 3,
      };

      mockFilesService.moveOrphansToTrash.mockResolvedValue(mockResult);

      const result = await controller.moveOrphansToTrash(mockRequest);

      expect(mockFilesService.moveOrphansToTrash).toHaveBeenCalledWith(
        mockRequest.user.tenant_id,
        mockRequest.user.id,
      );

      expect(result).toEqual(mockResult);
    });

    it('should return zero count if no orphans ready', async () => {
      const mockResult = {
        message: 'No orphan files ready to move to trash',
        count: 0,
      };

      mockFilesService.moveOrphansToTrash.mockResolvedValue(mockResult);

      const result = await controller.moveOrphansToTrash(mockRequest);

      expect(result.count).toBe(0);
    });
  });

  describe('cleanupTrashedFiles', () => {
    it('should permanently delete trashed files (Admin/Owner only)', async () => {
      const mockResult = {
        message: '5 trashed files permanently deleted',
        count: 5,
      };

      mockFilesService.cleanupTrashedFiles.mockResolvedValue(mockResult);

      const result = await controller.cleanupTrashedFiles(mockRequest);

      expect(mockFilesService.cleanupTrashedFiles).toHaveBeenCalledWith(
        mockRequest.user.tenant_id,
        mockRequest.user.id,
      );

      expect(result).toEqual(mockResult);
    });

    it('should return zero count if no trashed files ready', async () => {
      const mockResult = {
        message: 'No trashed files ready for permanent deletion',
        count: 0,
      };

      mockFilesService.cleanupTrashedFiles.mockResolvedValue(mockResult);

      const result = await controller.cleanupTrashedFiles(mockRequest);

      expect(result.count).toBe(0);
    });
  });

  describe('Tenant Isolation', () => {
    it('should always use tenant_id from authenticated user', async () => {
      const query = { category: FileCategory.QUOTE };

      mockFilesService.findAll.mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      await controller.findAll(mockRequest, query);

      // Verify tenant_id is taken from request.user, not from query params
      expect(mockFilesService.findAll).toHaveBeenCalledWith(
        mockRequest.user.tenant_id,
        expect.any(Object),
      );
    });

    it('should enforce tenant isolation on file deletion', async () => {
      mockFilesService.delete.mockResolvedValue({
        message: 'File deleted successfully',
      });

      await controller.delete(mockRequest, 'file-123');

      expect(mockFilesService.delete).toHaveBeenCalledWith(
        mockRequest.user.tenant_id, // Tenant ID from authenticated user
        'file-123',
        mockRequest.user.id,
      );
    });
  });
});
