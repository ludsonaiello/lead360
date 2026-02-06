import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TenantInsuranceService } from './tenant-insurance.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../core/file-storage/file-storage.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('TenantInsuranceService', () => {
  let service: TenantInsuranceService;
  let prisma: PrismaService;
  let fileStorage: FileStorageService;

  const mockPrismaService = {
    tenantInsurance: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    file: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockFileStorageService = {
    uploadFile: jest.fn(),
    deleteFileByPath: jest.fn(),
  };

  const mockAuditLogger = {
    log: jest.fn(),
    logAuth: jest.fn(),
    logTenantChange: jest.fn(),
    logRBACChange: jest.fn(),
    logFailedAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantInsuranceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FileStorageService,
          useValue: mockFileStorageService,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    service = module.get<TenantInsuranceService>(TenantInsuranceService);
    prisma = module.get<PrismaService>(PrismaService);
    fileStorage = module.get<FileStorageService>(FileStorageService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreate', () => {
    it('should return existing insurance record', async () => {
      const mockInsurance = {
        id: 'insurance-123',
        tenant_id: 'tenant-123',
        gl_policy_number: 'GL-123456',
        gl_document_file: null,
        wc_document_file: null,
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(
        mockInsurance,
      );

      const result = await service.findOrCreate('tenant-123');

      expect(
        mockPrismaService.tenant_insurance.findUnique,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: 'tenant-123' },
        }),
      );
      expect(result).toEqual(mockInsurance);
    });

    it('should create insurance record if not found', async () => {
      const mockCreatedInsurance = {
        id: 'insurance-123',
        tenant_id: 'tenant-123',
        gl_document_file: null,
        wc_document_file: null,
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant_insurance.create.mockResolvedValue(
        mockCreatedInsurance,
      );

      const result = await service.findOrCreate('tenant-123');

      expect(mockPrismaService.tenant_insurance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tenant_id: 'tenant-123' },
        }),
      );
      expect(result).toEqual(mockCreatedInsurance);
    });
  });

  describe('uploadGLDocument', () => {
    const mockFile = {
      originalname: 'gl-insurance.pdf',
      mimetype: 'application/pdf',
      size: 2 * 1024 * 1024,
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    it('should upload GL document successfully', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';

      const mockInsurance = {
        id: 'insurance-123',
        tenant_id: tenantId,
        gl_document_file_id: null,
      };

      const mockUploadResult = {
        file_id: 'file-123',
        url: '/public/tenant-123/files/file-123.pdf',
        metadata: {
          original_filename: 'gl-insurance.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2 * 1024 * 1024,
          storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
        },
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(
        mockInsurance,
      );
      mockFileStorageService.uploadFile.mockResolvedValue(mockUploadResult);
      mockPrismaService.file.create.mockResolvedValue({
        id: 1,
        file_id: 'file-123',
      });
      mockPrismaService.tenant_insurance.update.mockResolvedValue({
        ...mockInsurance,
        gl_document_file_id: 'file-123',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.uploadGLDocument(tenantId, mockFile, userId);

      expect(mockFileStorageService.uploadFile).toHaveBeenCalledWith(
        tenantId,
        mockFile,
        {
          allowedMimeTypes: [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
          ],
          maxSizeBytes: 10 * 1024 * 1024,
          category: 'insurance',
        },
      );

      expect(result).toEqual({
        message: 'GL document uploaded successfully',
        file_id: 'file-123',
        url: mockUploadResult.url,
      });
    });

    it('should replace existing GL document (hard delete old)', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';

      const mockInsurance = {
        id: 'insurance-123',
        tenant_id: tenantId,
        gl_document_file_id: 'old-file-123',
      };

      const mockOldFile = {
        id: 1,
        file_id: 'old-file-123',
        storage_path: '/uploads/public/tenant-123/files/old-file-123.pdf',
      };

      const mockUploadResult = {
        file_id: 'new-file-123',
        url: '/public/tenant-123/files/new-file-123.pdf',
        metadata: {
          original_filename: 'new-gl-insurance.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2 * 1024 * 1024,
          storage_path: '/uploads/public/tenant-123/files/new-file-123.pdf',
        },
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(
        mockInsurance,
      );
      mockPrismaService.file.findUnique.mockResolvedValue(mockOldFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue(mockOldFile);
      mockFileStorageService.uploadFile.mockResolvedValue(mockUploadResult);
      mockPrismaService.file.create.mockResolvedValue({
        id: 2,
        file_id: 'new-file-123',
      });
      mockPrismaService.tenant_insurance.update.mockResolvedValue({
        ...mockInsurance,
        gl_document_file_id: 'new-file-123',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.uploadGLDocument(tenantId, mockFile, userId);

      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        mockOldFile.storage_path,
      );
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: mockOldFile.id },
      });
    });

    it('should create insurance record if it does not exist', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';

      const mockCreatedInsurance = {
        id: 'insurance-123',
        tenant_id: tenantId,
        gl_document_file_id: null,
      };

      const mockUploadResult = {
        file_id: 'file-123',
        url: '/public/tenant-123/files/file-123.pdf',
        metadata: {
          original_filename: 'gl-insurance.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2 * 1024 * 1024,
          storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
        },
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(null);
      mockPrismaService.tenant_insurance.create.mockResolvedValue(
        mockCreatedInsurance,
      );
      mockFileStorageService.uploadFile.mockResolvedValue(mockUploadResult);
      mockPrismaService.file.create.mockResolvedValue({
        id: 1,
        file_id: 'file-123',
      });
      mockPrismaService.tenant_insurance.update.mockResolvedValue({
        ...mockCreatedInsurance,
        gl_document_file_id: 'file-123',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.uploadGLDocument(tenantId, mockFile, userId);

      expect(mockPrismaService.tenant_insurance.create).toHaveBeenCalled();
      expect(result.file_id).toBe('file-123');
    });
  });

  describe('uploadWCDocument', () => {
    const mockFile = {
      originalname: 'wc-insurance.pdf',
      mimetype: 'application/pdf',
      size: 2 * 1024 * 1024,
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    it('should upload WC document successfully', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';

      const mockInsurance = {
        id: 'insurance-123',
        tenant_id: tenantId,
        wc_document_file_id: null,
      };

      const mockUploadResult = {
        file_id: 'file-123',
        url: '/public/tenant-123/files/file-123.pdf',
        metadata: {
          original_filename: 'wc-insurance.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2 * 1024 * 1024,
          storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
        },
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(
        mockInsurance,
      );
      mockFileStorageService.uploadFile.mockResolvedValue(mockUploadResult);
      mockPrismaService.file.create.mockResolvedValue({
        id: 1,
        file_id: 'file-123',
      });
      mockPrismaService.tenant_insurance.update.mockResolvedValue({
        ...mockInsurance,
        wc_document_file_id: 'file-123',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.uploadWCDocument(tenantId, mockFile, userId);

      expect(result).toEqual({
        message: 'WC document uploaded successfully',
        file_id: 'file-123',
        url: mockUploadResult.url,
      });
    });

    it('should replace existing WC document (hard delete old)', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';

      const mockInsurance = {
        id: 'insurance-123',
        tenant_id: tenantId,
        wc_document_file_id: 'old-file-123',
      };

      const mockOldFile = {
        id: 1,
        file_id: 'old-file-123',
        storage_path: '/uploads/public/tenant-123/files/old-file-123.pdf',
      };

      const mockUploadResult = {
        file_id: 'new-file-123',
        url: '/public/tenant-123/files/new-file-123.pdf',
        metadata: {
          original_filename: 'new-wc-insurance.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2 * 1024 * 1024,
          storage_path: '/uploads/public/tenant-123/files/new-file-123.pdf',
        },
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(
        mockInsurance,
      );
      mockPrismaService.file.findUnique.mockResolvedValue(mockOldFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue(mockOldFile);
      mockFileStorageService.uploadFile.mockResolvedValue(mockUploadResult);
      mockPrismaService.file.create.mockResolvedValue({
        id: 2,
        file_id: 'new-file-123',
      });
      mockPrismaService.tenant_insurance.update.mockResolvedValue({
        ...mockInsurance,
        wc_document_file_id: 'new-file-123',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.uploadWCDocument(tenantId, mockFile, userId);

      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        mockOldFile.storage_path,
      );
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: mockOldFile.id },
      });
    });
  });

  describe('deleteGLDocument', () => {
    it('should delete GL document (hard delete)', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const fileId = 'file-123';

      const mockInsurance = {
        id: 'insurance-123',
        tenant_id: tenantId,
        gl_document_file_id: fileId,
      };

      const mockFile = {
        id: 1,
        file_id: fileId,
        storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(
        mockInsurance,
      );
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue(mockFile);
      mockPrismaService.tenant_insurance.update.mockResolvedValue({
        ...mockInsurance,
        gl_document_file_id: null,
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.deleteGLDocument(tenantId, userId);

      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        mockFile.storage_path,
      );
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: mockFile.id },
      });
      expect(result).toEqual({ message: 'GL document deleted successfully' });
    });

    it('should throw BadRequestException if GL document does not exist', async () => {
      const mockInsurance = {
        id: 'insurance-123',
        tenant_id: 'tenant-123',
        gl_document_file_id: null,
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(
        mockInsurance,
      );

      await expect(
        service.deleteGLDocument('tenant-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteWCDocument', () => {
    it('should delete WC document (hard delete)', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-123';
      const fileId = 'file-123';

      const mockInsurance = {
        id: 'insurance-123',
        tenant_id: tenantId,
        wc_document_file_id: fileId,
      };

      const mockFile = {
        id: 1,
        file_id: fileId,
        storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(
        mockInsurance,
      );
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue(mockFile);
      mockPrismaService.tenant_insurance.update.mockResolvedValue({
        ...mockInsurance,
        wc_document_file_id: null,
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.deleteWCDocument(tenantId, userId);

      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        mockFile.storage_path,
      );
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: mockFile.id },
      });
      expect(result).toEqual({ message: 'WC document deleted successfully' });
    });

    it('should throw BadRequestException if WC document does not exist', async () => {
      const mockInsurance = {
        id: 'insurance-123',
        tenant_id: 'tenant-123',
        wc_document_file_id: null,
      };

      mockPrismaService.tenant_insurance.findUnique.mockResolvedValue(
        mockInsurance,
      );

      await expect(
        service.deleteWCDocument('tenant-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
