import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectDocumentService } from './project-document.service';
import { ProjectActivityService } from './project-activity.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { ProjectDocumentType } from '../dto/upload-project-document.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-uuid-aaa';
const TENANT_B = 'tenant-uuid-bbb';
const PROJECT_ID = 'project-uuid-001';
const USER_ID = 'user-uuid-001';
const FILE_ID = 'file-uuid-001';
const DOC_ID = 'doc-uuid-001';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const mockProject = (overrides: any = {}) => ({
  id: PROJECT_ID,
  tenant_id: TENANT_A,
  project_number: 'PRJ-2026-0001',
  name: 'Test Project',
  ...overrides,
});

const mockDocument = (overrides: any = {}) => ({
  id: DOC_ID,
  tenant_id: TENANT_A,
  project_id: PROJECT_ID,
  file_id: FILE_ID,
  file_url: `/public/${TENANT_A}/files/${FILE_ID}.pdf`,
  file_name: 'contract.pdf',
  document_type: 'contract',
  description: 'Signed contract',
  is_public: false,
  uploaded_by_user_id: USER_ID,
  created_at: new Date('2026-03-13T10:00:00.000Z'),
  updated_at: new Date('2026-03-13T10:00:00.000Z'),
  ...overrides,
});

const mockUploadResult = (overrides: any = {}) => ({
  message: 'File uploaded successfully',
  file_id: FILE_ID,
  url: `/public/${TENANT_A}/files/${FILE_ID}.pdf`,
  file: {
    id: 'file-record-id',
    file_id: FILE_ID,
    original_filename: 'contract.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1024,
    original_size_bytes: 1024,
    category: 'contract',
    url: `/public/${TENANT_A}/files/${FILE_ID}.pdf`,
    has_thumbnail: false,
    is_optimized: false,
    width: null,
    height: null,
    created_at: new Date(),
  },
  ...overrides,
});

const mockFile = (): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'contract.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('fake-file-content'),
    size: 1024,
  }) as Express.Multer.File;

// ---------------------------------------------------------------------------
// Mock Services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  project: {
    findFirst: jest.fn(),
  },
  project_document: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn().mockResolvedValue(undefined),
};

const mockFilesService = {
  uploadFile: jest.fn(),
  delete: jest.fn().mockResolvedValue(undefined),
};

const mockProjectActivityService = {
  logActivity: jest.fn().mockResolvedValue(null),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectDocumentService', () => {
  let service: ProjectDocumentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectDocumentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: FilesService, useValue: mockFilesService },
        { provide: ProjectActivityService, useValue: mockProjectActivityService },
      ],
    }).compile();

    service = module.get<ProjectDocumentService>(ProjectDocumentService);
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // upload()
  // -----------------------------------------------------------------------

  describe('upload()', () => {
    it('should upload document and return correct shape', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.project_document.create.mockResolvedValue(mockDocument());

      const result = await service.upload(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        mockFile(),
        {
          document_type: ProjectDocumentType.CONTRACT,
          description: 'Signed contract',
        },
      );

      expect(result.id).toBe(DOC_ID);
      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.document_type).toBe('contract');
      expect(result.description).toBe('Signed contract');
      expect(result.is_public).toBe(false);
      expect(result.file_url).toBeDefined();
    });

    it('should call FilesService.uploadFile with correct category mapping', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.project_document.create.mockResolvedValue(mockDocument());

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {
        document_type: ProjectDocumentType.CONTRACT,
      });

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        expect.anything(),
        expect.objectContaining({
          category: 'contract',
          entity_type: 'project_document',
          entity_id: PROJECT_ID,
        }),
      );
    });

    it('should map permit type to misc FileCategory', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.project_document.create.mockResolvedValue(mockDocument());

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {
        document_type: ProjectDocumentType.PERMIT,
      });

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        expect.anything(),
        expect.objectContaining({ category: 'misc' }),
      );
    });

    it('should map agreement type to contract FileCategory', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.project_document.create.mockResolvedValue(mockDocument());

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {
        document_type: ProjectDocumentType.AGREEMENT,
      });

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        expect.anything(),
        expect.objectContaining({ category: 'contract' }),
      );
    });

    it('should throw BadRequestException when file is missing', async () => {
      await expect(
        service.upload(TENANT_A, PROJECT_ID, USER_ID, null as any, {
          document_type: ProjectDocumentType.CONTRACT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {
          document_type: ProjectDocumentType.CONTRACT,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log on upload', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.project_document.create.mockResolvedValue(mockDocument());

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {
        document_type: ProjectDocumentType.CONTRACT,
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project_document',
          tenantId: TENANT_A,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should log project activity on upload', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.project_document.create.mockResolvedValue(mockDocument());

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {
        document_type: ProjectDocumentType.CONTRACT,
      });

      expect(mockProjectActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          project_id: PROJECT_ID,
          activity_type: 'document_added',
        }),
      );
    });

    it('should set is_public to false by default', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.project_document.create.mockResolvedValue(mockDocument());

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {
        document_type: ProjectDocumentType.CONTRACT,
      });

      expect(mockPrismaService.project_document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          is_public: false,
        }),
      });
    });
  });

  // -----------------------------------------------------------------------
  // findAll()
  // -----------------------------------------------------------------------

  describe('findAll()', () => {
    it('should return all documents for a project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      const docs = [mockDocument(), mockDocument({ id: 'doc-uuid-002' })];
      mockPrismaService.project_document.findMany.mockResolvedValue(docs);

      const result = await service.findAll(TENANT_A, PROJECT_ID);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.project_document.findMany).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_A, project_id: PROJECT_ID },
        orderBy: { created_at: 'desc' },
      });
    });

    it('should filter by document_type when provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_document.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, PROJECT_ID, {
        document_type: 'permit',
      });

      expect(mockPrismaService.project_document.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          project_id: PROJECT_ID,
          document_type: 'permit',
        },
        orderBy: { created_at: 'desc' },
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(TENANT_A, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------

  describe('delete()', () => {
    it('should delete document and file from storage', async () => {
      mockPrismaService.project_document.findFirst.mockResolvedValue(mockDocument());
      mockPrismaService.project_document.delete.mockResolvedValue(mockDocument());

      await service.delete(TENANT_A, PROJECT_ID, DOC_ID, USER_ID);

      expect(mockPrismaService.project_document.delete).toHaveBeenCalledWith({
        where: { id: DOC_ID },
      });
      expect(mockFilesService.delete).toHaveBeenCalledWith(
        TENANT_A,
        FILE_ID,
        USER_ID,
      );
    });

    it('should throw NotFoundException when document does not exist', async () => {
      mockPrismaService.project_document.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(TENANT_A, PROJECT_ID, DOC_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log on delete', async () => {
      mockPrismaService.project_document.findFirst.mockResolvedValue(mockDocument());
      mockPrismaService.project_document.delete.mockResolvedValue(mockDocument());

      await service.delete(TENANT_A, PROJECT_ID, DOC_ID, USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'project_document',
          entityId: DOC_ID,
          tenantId: TENANT_A,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Tenant Isolation
  // -----------------------------------------------------------------------

  describe('Tenant Isolation', () => {
    it('upload: verifies project belongs to tenant', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.upload(TENANT_B, PROJECT_ID, USER_ID, mockFile(), {
          document_type: ProjectDocumentType.CONTRACT,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
      });
    });

    it('findAll: filters by tenant_id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject({ tenant_id: TENANT_B }));
      mockPrismaService.project_document.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_B, PROJECT_ID);

      expect(mockPrismaService.project_document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_B }),
        }),
      );
    });

    it('delete: verifies document belongs to tenant', async () => {
      mockPrismaService.project_document.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(TENANT_B, PROJECT_ID, DOC_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project_document.findFirst).toHaveBeenCalledWith({
        where: {
          id: DOC_ID,
          tenant_id: TENANT_B,
          project_id: PROJECT_ID,
        },
      });
    });
  });
});
