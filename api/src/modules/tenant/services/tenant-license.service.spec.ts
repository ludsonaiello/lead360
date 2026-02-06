import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantLicenseService } from './tenant-license.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../core/file-storage/file-storage.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('TenantLicenseService', () => {
  let service: TenantLicenseService;
  let prisma: PrismaService;
  let fileStorage: FileStorageService;

  const mockPrismaService = {
    tenantLicense: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    licenseType: {
      findUnique: jest.fn(),
    },
    file: {
      findFirst: jest.fn(),
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
        TenantLicenseService,
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

    service = module.get<TenantLicenseService>(TenantLicenseService);
    prisma = module.get<PrismaService>(PrismaService);
    fileStorage = module.get<FileStorageService>(FileStorageService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create license with audit logging', async () => {
      const createDto = {
        license_type_id: 'type-123',
        license_number: 'CA-123456',
        issuing_state: 'CA',
        issue_date: '2024-01-01',
        expiry_date: '2026-01-01',
      };

      const createdLicense = {
        id: 'license-123',
        tenant_id: 'tenant-123',
        ...createDto,
      };

      // Mock license type exists
      mockPrismaService.license_type.findUnique.mockResolvedValue({
        id: 'type-123',
        name: 'Contractor License',
      });

      mockPrismaService.tenant_license.create.mockResolvedValue(createdLicense);

      const result = await service.create(
        'tenant-123',
        createDto as any,
        'user-123',
      );

      expect(result).toEqual(createdLicense);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('findExpiring', () => {
    it('should find licenses expiring within specified days', async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringLicenses = [
        {
          id: 'license-1',
          tenant_id: 'tenant-123',
          license_number: 'CA-111111',
          expiry_date: thirtyDaysFromNow,
        },
      ];

      mockPrismaService.tenant_license.findMany.mockResolvedValue(
        expiringLicenses,
      );

      const result = await service.findExpiring('tenant-123', 30);

      expect(result).toEqual(expiringLicenses);
      expect(result.length).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete license without document', async () => {
      const license = {
        id: 'license-123',
        tenant_id: 'tenant-123',
        license_number: 'CA-123456',
        document_file_id: null,
      };

      mockPrismaService.tenant_license.findFirst.mockResolvedValue(license);
      mockPrismaService.tenant_license.delete.mockResolvedValue(license);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.delete(
        'tenant-123',
        'license-123',
        'user-123',
      );

      expect(result).toEqual({ message: 'License deleted successfully' });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
      expect(mockFileStorageService.deleteFileByPath).not.toHaveBeenCalled();
    });

    it('should delete license and cascade delete associated document file', async () => {
      const tenantId = 'tenant-123';
      const licenseId = 'license-123';
      const userId = 'user-123';
      const fileId = 'file-123';

      const license = {
        id: licenseId,
        tenant_id: tenantId,
        license_number: 'CA-123456',
        document_file_id: fileId,
      };

      const mockFile = {
        id: 1,
        file_id: fileId,
        storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
      };

      mockPrismaService.tenant_license.findFirst.mockResolvedValue(license);
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue(mockFile);
      mockPrismaService.tenant_license.delete.mockResolvedValue(license);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.delete(tenantId, licenseId, userId);

      // Verify file was hard deleted from filesystem
      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        mockFile.storage_path,
      );

      // Verify file record was deleted from database
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: mockFile.id },
      });

      // Verify license was deleted
      expect(mockPrismaService.tenant_license.delete).toHaveBeenCalledWith({
        where: { id: licenseId },
      });

      // Verify audit log includes deleted file info
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'DELETE',
          entity_type: 'TenantLicense',
          entity_id: licenseId,
          metadata_json: expect.objectContaining({
            deleted_file_id: fileId,
          }),
        }),
      });

      expect(result).toEqual({ message: 'License deleted successfully' });
    });

    it('should throw NotFoundException if license not found', async () => {
      mockPrismaService.tenant_license.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('tenant-123', 'nonexistent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadDocument', () => {
    const mockFile = {
      originalname: 'license.pdf',
      mimetype: 'application/pdf',
      size: 2 * 1024 * 1024, // 2MB
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    it('should upload license document successfully', async () => {
      const tenantId = 'tenant-123';
      const licenseId = 'license-123';
      const userId = 'user-123';

      const mockLicense = {
        id: licenseId,
        tenant_id: tenantId,
        license_number: 'CA-123456',
        document_file_id: null,
      };

      const mockUploadResult = {
        file_id: 'file-123',
        url: '/public/tenant-123/files/file-123.pdf',
        metadata: {
          original_filename: 'license.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2 * 1024 * 1024,
          storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
        },
      };

      mockPrismaService.tenant_license.findFirst.mockResolvedValue(mockLicense);
      mockFileStorageService.uploadFile.mockResolvedValue(mockUploadResult);
      mockPrismaService.file.create.mockResolvedValue({
        id: 1,
        file_id: 'file-123',
      });
      mockPrismaService.tenant_license.update.mockResolvedValue({
        ...mockLicense,
        document_file_id: 'file-123',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.uploadDocument(
        tenantId,
        licenseId,
        mockFile,
        userId,
      );

      // Verify license exists check
      expect(mockPrismaService.tenant_license.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: licenseId,
            tenant_id: tenantId,
          }),
        }),
      );

      // Verify file upload with correct validation rules (license category)
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
          maxSizeBytes: 10 * 1024 * 1024, // 10MB for license
          category: 'license',
        },
      );

      // Verify license record updated with file_id
      expect(mockPrismaService.tenant_license.update).toHaveBeenCalledWith({
        where: { id: licenseId },
        data: { document_file_id: 'file-123' },
      });

      // Verify audit log created
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: tenantId,
          actor_user_id: userId,
          action: 'license_document_uploaded',
          entity_type: 'license',
          entity_id: licenseId,
        }),
      });

      expect(result).toEqual({
        message: 'Document uploaded successfully',
        file_id: 'file-123',
        url: mockUploadResult.url,
      });
    });

    it('should replace existing document when uploading new one (hard delete old)', async () => {
      const tenantId = 'tenant-123';
      const licenseId = 'license-123';
      const userId = 'user-123';

      const oldFileId = 'old-file-123';

      const mockLicense = {
        id: licenseId,
        tenant_id: tenantId,
        document_file_id: oldFileId, // Existing document
      };

      const mockOldFile = {
        id: 1,
        file_id: oldFileId,
        storage_path: '/uploads/public/tenant-123/files/old-file-123.pdf',
      };

      const mockUploadResult = {
        file_id: 'new-file-123',
        url: '/public/tenant-123/files/new-file-123.pdf',
        metadata: {
          original_filename: 'new-license.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2 * 1024 * 1024,
          storage_path: '/uploads/public/tenant-123/files/new-file-123.pdf',
        },
      };

      mockPrismaService.tenant_license.findFirst.mockResolvedValue(mockLicense);
      mockPrismaService.file.findUnique.mockResolvedValue(mockOldFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue(mockOldFile);
      mockFileStorageService.uploadFile.mockResolvedValue(mockUploadResult);
      mockPrismaService.file.create.mockResolvedValue({
        id: 2,
        file_id: 'new-file-123',
      });
      mockPrismaService.tenant_license.update.mockResolvedValue({
        ...mockLicense,
        document_file_id: 'new-file-123',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.uploadDocument(tenantId, licenseId, mockFile, userId);

      // Verify old file was hard deleted from filesystem
      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        mockOldFile.storage_path,
      );

      // Verify old file was hard deleted from database
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: mockOldFile.id },
      });

      // Verify new file uploaded
      expect(mockFileStorageService.uploadFile).toHaveBeenCalled();

      // Verify license updated with new file_id
      expect(mockPrismaService.tenant_license.update).toHaveBeenCalledWith({
        where: { id: licenseId },
        data: { document_file_id: 'new-file-123' },
      });
    });

    it('should throw NotFoundException if license does not exist', async () => {
      mockPrismaService.tenant_license.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadDocument(
          'tenant-123',
          'nonexistent',
          mockFile,
          'user-123',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockFileStorageService.uploadFile).not.toHaveBeenCalled();
    });

    it('should enforce tenant isolation on upload', async () => {
      const wrongTenantId = 'wrong-tenant';
      const licenseId = 'license-123';

      mockPrismaService.tenant_license.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadDocument(wrongTenantId, licenseId, mockFile, 'user-123'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.tenant_license.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: licenseId,
            tenant_id: wrongTenantId, // Should check tenant_id
          }),
        }),
      );
    });
  });

  describe('deleteDocument', () => {
    it('should delete license document (hard delete)', async () => {
      const tenantId = 'tenant-123';
      const licenseId = 'license-123';
      const userId = 'user-123';
      const fileId = 'file-123';

      const mockLicense = {
        id: licenseId,
        tenant_id: tenantId,
        document_file_id: fileId,
      };

      const mockFile = {
        id: 1,
        file_id: fileId,
        storage_path: '/uploads/public/tenant-123/files/file-123.pdf',
      };

      mockPrismaService.tenant_license.findFirst.mockResolvedValue(mockLicense);
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockFileStorageService.deleteFileByPath.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue(mockFile);
      mockPrismaService.tenant_license.update.mockResolvedValue({
        ...mockLicense,
        document_file_id: null,
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.deleteDocument(tenantId, licenseId, userId);

      // Verify hard delete from filesystem
      expect(mockFileStorageService.deleteFileByPath).toHaveBeenCalledWith(
        mockFile.storage_path,
      );

      // Verify hard delete from database
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: mockFile.id },
      });

      // Verify license updated to remove file_id
      expect(mockPrismaService.tenant_license.update).toHaveBeenCalledWith({
        where: { id: licenseId },
        data: { document_file_id: null },
      });

      // Verify audit log
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();

      expect(result).toEqual({
        message: 'Document deleted successfully',
      });
    });

    it('should throw NotFoundException if license does not exist', async () => {
      mockPrismaService.tenant_license.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDocument('tenant-123', 'nonexistent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if document does not exist', async () => {
      const mockLicense = {
        id: 'license-123',
        tenant_id: 'tenant-123',
        document_file_id: null, // No document
      };

      mockPrismaService.tenant_license.findFirst.mockResolvedValue(mockLicense);

      await expect(
        service.deleteDocument('tenant-123', 'license-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);

      expect(mockFileStorageService.deleteFileByPath).not.toHaveBeenCalled();
    });
  });
});
