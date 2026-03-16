import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectLogService } from './project-log.service';
import { ProjectActivityService } from './project-activity.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-uuid-aaa';
const TENANT_B = 'tenant-uuid-bbb';
const PROJECT_ID = 'project-uuid-001';
const TASK_ID = 'task-uuid-001';
const USER_ID = 'user-uuid-001';
const LOG_ID = 'log-uuid-001';
const FILE_ID = 'file-uuid-001';
const ATTACHMENT_ID = 'attachment-uuid-001';

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

const mockTask = (overrides: any = {}) => ({
  id: TASK_ID,
  tenant_id: TENANT_A,
  project_id: PROJECT_ID,
  title: 'Install Drywall',
  deleted_at: null,
  ...overrides,
});

const mockLog = (overrides: any = {}) => ({
  id: LOG_ID,
  tenant_id: TENANT_A,
  project_id: PROJECT_ID,
  task_id: null,
  author_user_id: USER_ID,
  log_date: new Date('2026-04-05'),
  content: 'Foundation pour completed today. Weather was clear.',
  is_public: false,
  weather_delay: false,
  created_at: new Date('2026-04-05T16:00:00.000Z'),
  updated_at: new Date('2026-04-05T16:00:00.000Z'),
  author: {
    id: USER_ID,
    first_name: 'Jane',
    last_name: 'Admin',
  },
  attachments: [],
  ...overrides,
});

const mockAttachment = (overrides: any = {}) => ({
  id: ATTACHMENT_ID,
  tenant_id: TENANT_A,
  log_id: LOG_ID,
  file_id: FILE_ID,
  file_url: `/public/${TENANT_A}/images/${FILE_ID}.webp`,
  file_name: 'foundation.jpg',
  file_type: 'photo',
  file_size_bytes: 2048,
  created_at: new Date('2026-04-05T16:00:00.000Z'),
  ...overrides,
});

const mockUploadResult = (overrides: any = {}) => ({
  message: 'File uploaded successfully',
  file_id: FILE_ID,
  url: `/public/${TENANT_A}/images/${FILE_ID}.webp`,
  file: {
    id: 'file-record-id',
    file_id: FILE_ID,
    original_filename: 'foundation.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 2048,
    original_size_bytes: 4096,
    category: 'photo',
    url: `/public/${TENANT_A}/images/${FILE_ID}.webp`,
    has_thumbnail: true,
    is_optimized: true,
    width: 1920,
    height: 1080,
    created_at: new Date(),
  },
  ...overrides,
});

const mockFileRecord = (overrides: any = {}) => ({
  thumbnail_path: `/var/www/lead360.app/uploads/public/${TENANT_A}/images/thumb-uuid_thumb.webp`,
  ...overrides,
});

const mockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    fieldname: 'attachments',
    originalname: 'foundation.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-data'),
    size: 2048,
    ...overrides,
  }) as Express.Multer.File;

const mockPdfFile = (): Express.Multer.File =>
  ({
    fieldname: 'attachments',
    originalname: 'report.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('fake-pdf-data'),
    size: 10240,
  }) as Express.Multer.File;

// ---------------------------------------------------------------------------
// Mock Services
// ---------------------------------------------------------------------------

const mockPrismaService = {
  project: {
    findFirst: jest.fn(),
  },
  project_task: {
    findFirst: jest.fn(),
  },
  project_log: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  project_log_attachment: {
    create: jest.fn(),
  },
  project_photo: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  file: {
    findFirst: jest.fn(),
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

describe('ProjectLogService', () => {
  let service: ProjectLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectLogService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: FilesService, useValue: mockFilesService },
        {
          provide: ProjectActivityService,
          useValue: mockProjectActivityService,
        },
      ],
    }).compile();

    service = module.get<ProjectLogService>(ProjectLogService);
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------

  describe('create()', () => {
    it('should create a log and return correct response shape', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      const result = await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        {
          content: 'Foundation pour completed today. Weather was clear.',
          log_date: '2026-04-05',
          is_public: false,
        },
        [],
      );

      expect(result.id).toBe(LOG_ID);
      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.content).toBe(
        'Foundation pour completed today. Weather was clear.',
      );
      expect(result.log_date).toBe('2026-04-05');
      expect(result.is_public).toBe(false);
      expect(result.weather_delay).toBe(false);
      expect(result.author).toEqual({
        id: USER_ID,
        first_name: 'Jane',
        last_name: 'Admin',
      });
      expect(result.attachments).toEqual([]);
      expect(result.created_at).toBeDefined();
    });

    it('should default log_date to today when not provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'Daily update' },
        [],
      );

      expect(mockPrismaService.project_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          log_date: expect.any(Date),
        }),
      });
    });

    it('should default is_public to false', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'Daily update' },
        [],
      );

      expect(mockPrismaService.project_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          is_public: false,
        }),
      });
    });

    it('should default weather_delay to false', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'Daily update' },
        [],
      );

      expect(mockPrismaService.project_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          weather_delay: false,
        }),
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          TENANT_A,
          PROJECT_ID,
          USER_ID,
          { content: 'test' },
          [],
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when content is empty', async () => {
      await expect(
        service.create(
          TENANT_A,
          PROJECT_ID,
          USER_ID,
          { content: '' },
          [],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when content is whitespace only', async () => {
      await expect(
        service.create(
          TENANT_A,
          PROJECT_ID,
          USER_ID,
          { content: '   ' },
          [],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate task_id belongs to project when provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ task_id: TASK_ID, author: undefined, attachments: undefined }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ task_id: TASK_ID }),
      );

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'Task update', task_id: TASK_ID },
        [],
      );

      expect(mockPrismaService.project_task.findFirst).toHaveBeenCalledWith({
        where: {
          id: TASK_ID,
          tenant_id: TENANT_A,
          project_id: PROJECT_ID,
          deleted_at: null,
        },
      });
    });

    it('should throw NotFoundException when task does not belong to project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          TENANT_A,
          PROJECT_ID,
          USER_ID,
          { content: 'Task update', task_id: 'nonexistent-task' },
          [],
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upload attachments and create attachment records', async () => {
      const file = mockFile();
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.project_log_attachment.create.mockResolvedValue(
        mockAttachment(),
      );
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue({});
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [mockAttachment()] }),
      );

      const result = await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'With photos' },
        [file],
      );

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        file,
        expect.objectContaining({
          category: 'photo',
          entity_type: 'project_log',
        }),
      );
      expect(
        mockPrismaService.project_log_attachment.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_A,
          log_id: LOG_ID,
          file_type: 'photo',
        }),
      });
      expect(result.attachments).toHaveLength(1);
    });

    it('should create project_photo records for photo attachments', async () => {
      const file = mockFile();
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.project_log_attachment.create.mockResolvedValue(
        mockAttachment(),
      );
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue({});
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'With photos' },
        [file],
      );

      expect(mockPrismaService.project_photo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_A,
          project_id: PROJECT_ID,
          log_id: LOG_ID,
          file_id: FILE_ID,
        }),
      });
    });

    it('should NOT create project_photo for PDF attachments', async () => {
      const file = mockPdfFile();
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockFilesService.uploadFile.mockResolvedValue(
        mockUploadResult({
          file: { ...mockUploadResult().file, has_thumbnail: false },
        }),
      );
      mockPrismaService.project_log_attachment.create.mockResolvedValue(
        mockAttachment({ file_type: 'pdf', file_name: 'report.pdf' }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'With PDF' },
        [file],
      );

      expect(mockPrismaService.project_photo.create).not.toHaveBeenCalled();
    });

    it('should use FileCategory.MISC for PDF and document attachments', async () => {
      const file = mockPdfFile();
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockFilesService.uploadFile.mockResolvedValue(
        mockUploadResult({
          file: { ...mockUploadResult().file, has_thumbnail: false },
        }),
      );
      mockPrismaService.project_log_attachment.create.mockResolvedValue(
        mockAttachment({ file_type: 'pdf' }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'With PDF' },
        [file],
      );

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        file,
        expect.objectContaining({
          category: 'misc',
        }),
      );
    });

    it('should create audit log on creation', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'Daily update' },
        [],
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project_log',
          entityId: LOG_ID,
          tenantId: TENANT_A,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should log log_added activity', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'Daily update' },
        [],
      );

      expect(mockProjectActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          project_id: PROJECT_ID,
          activity_type: 'log_added',
        }),
      );
    });

    it('should trim content before storing', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: '  Daily update  ' },
        [],
      );

      expect(mockPrismaService.project_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: 'Daily update',
        }),
      });
    });

    it('should store tenant_id in log record', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.create.mockResolvedValue(
        mockLog({ author: undefined, attachments: undefined }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(mockLog());

      await service.create(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        { content: 'test' },
        [],
      );

      expect(mockPrismaService.project_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_A,
          project_id: PROJECT_ID,
          author_user_id: USER_ID,
        }),
      });
    });
  });

  // -----------------------------------------------------------------------
  // findAll()
  // -----------------------------------------------------------------------

  describe('findAll()', () => {
    it('should return paginated logs ordered by log_date DESC, created_at DESC', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      const logs = [
        mockLog({ id: 'log-1', log_date: new Date('2026-04-05') }),
        mockLog({ id: 'log-2', log_date: new Date('2026-04-04') }),
      ];
      mockPrismaService.project_log.findMany.mockResolvedValue(logs);
      mockPrismaService.project_log.count.mockResolvedValue(2);

      const result = await service.findAll(TENANT_A, PROJECT_ID);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ log_date: 'desc' }, { created_at: 'desc' }],
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by is_public', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, PROJECT_ID, { is_public: true });

      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_public: true }),
        }),
      );
    });

    it('should filter by has_attachments=true', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, PROJECT_ID, {
        has_attachments: true,
      });

      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attachments: { some: {} },
          }),
        }),
      );
    });

    it('should filter by has_attachments=false', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, PROJECT_ID, {
        has_attachments: false,
      });

      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attachments: { none: {} },
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, PROJECT_ID, {
        date_from: '2026-04-01',
        date_to: '2026-04-30',
      });

      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            log_date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(50);

      const result = await service.findAll(TENANT_A, PROJECT_ID, {
        page: 3,
        limit: 10,
      });

      expect(result.meta).toEqual({
        total: 50,
        page: 3,
        limit: 10,
        totalPages: 5,
      });
      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should clamp limit to 100 max', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, PROJECT_ID, { limit: 500 });

      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(TENANT_A, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include author and attachments in response', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findMany.mockResolvedValue([
        mockLog({ attachments: [mockAttachment()] }),
      ]);
      mockPrismaService.project_log.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A, PROJECT_ID);

      expect(result.data[0].author).toEqual({
        id: USER_ID,
        first_name: 'Jane',
        last_name: 'Admin',
      });
      expect(result.data[0].attachments).toHaveLength(1);
      expect(result.data[0].attachments[0]).toEqual({
        id: ATTACHMENT_ID,
        file_url: expect.any(String),
        file_name: 'foundation.jpg',
        file_type: 'photo',
      });
    });

    it('should format log_date as YYYY-MM-DD string', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findMany.mockResolvedValue([
        mockLog({ log_date: new Date('2026-04-05T00:00:00.000Z') }),
      ]);
      mockPrismaService.project_log.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A, PROJECT_ID);

      expect(result.data[0].log_date).toBe('2026-04-05');
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------

  describe('delete()', () => {
    it('should hard delete log and its attachments', async () => {
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [] }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.delete.mockResolvedValue(mockLog());

      await service.delete(TENANT_A, PROJECT_ID, LOG_ID, USER_ID);

      expect(mockPrismaService.project_log.delete).toHaveBeenCalledWith({
        where: { id: LOG_ID },
      });
    });

    it('should throw NotFoundException when log does not exist', async () => {
      mockPrismaService.project_log.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(TENANT_A, PROJECT_ID, LOG_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete non-photo files from storage', async () => {
      const pdfAttachment = mockAttachment({
        id: 'att-pdf',
        file_id: 'pdf-file-id',
        file_type: 'pdf',
        file_name: 'report.pdf',
      });
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [pdfAttachment] }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.delete.mockResolvedValue(mockLog());

      await service.delete(TENANT_A, PROJECT_ID, LOG_ID, USER_ID);

      expect(mockFilesService.delete).toHaveBeenCalledWith(
        TENANT_A,
        'pdf-file-id',
        USER_ID,
      );
    });

    it('should delete project_photo records when log has photo attachments', async () => {
      const photoAttachment = mockAttachment({
        file_type: 'photo',
        file_id: 'photo-file-id',
      });
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [photoAttachment] }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        { id: 'photo-uuid-1', file_id: 'photo-file-id' },
      ]);
      mockPrismaService.project_photo.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.project_log.delete.mockResolvedValue(mockLog());

      await service.delete(TENANT_A, PROJECT_ID, LOG_ID, USER_ID);

      expect(mockPrismaService.project_photo.deleteMany).toHaveBeenCalledWith({
        where: { log_id: LOG_ID, tenant_id: TENANT_A },
      });
    });

    it('should delete photo files from storage after removing project_photo records', async () => {
      const photoAttachment = mockAttachment({
        file_type: 'photo',
        file_id: 'photo-file-id',
      });
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [photoAttachment] }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        { id: 'photo-uuid-1', file_id: 'photo-file-id' },
      ]);
      mockPrismaService.project_photo.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.project_log.delete.mockResolvedValue(mockLog());

      await service.delete(TENANT_A, PROJECT_ID, LOG_ID, USER_ID);

      expect(mockFilesService.delete).toHaveBeenCalledWith(
        TENANT_A,
        'photo-file-id',
        USER_ID,
      );
    });

    it('should delete ALL files (photo + non-photo) when mixed attachments', async () => {
      const photoAtt = mockAttachment({
        id: 'att-photo',
        file_type: 'photo',
        file_id: 'photo-file',
      });
      const pdfAtt = mockAttachment({
        id: 'att-pdf',
        file_type: 'pdf',
        file_id: 'pdf-file',
      });
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [photoAtt, pdfAtt] }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        { id: 'photo-uuid-1', file_id: 'photo-file' },
      ]);
      mockPrismaService.project_photo.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.project_log.delete.mockResolvedValue(mockLog());

      await service.delete(TENANT_A, PROJECT_ID, LOG_ID, USER_ID);

      expect(mockFilesService.delete).toHaveBeenCalledTimes(2);
      expect(mockFilesService.delete).toHaveBeenCalledWith(
        TENANT_A,
        'photo-file',
        USER_ID,
      );
      expect(mockFilesService.delete).toHaveBeenCalledWith(
        TENANT_A,
        'pdf-file',
        USER_ID,
      );
    });

    it('should not call deleteMany when no linked photos exist', async () => {
      const pdfAtt = mockAttachment({
        id: 'att-pdf',
        file_type: 'pdf',
        file_id: 'pdf-file',
      });
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [pdfAtt] }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.delete.mockResolvedValue(mockLog());

      await service.delete(TENANT_A, PROJECT_ID, LOG_ID, USER_ID);

      expect(mockPrismaService.project_photo.deleteMany).not.toHaveBeenCalled();
    });

    it('should create audit log on delete with photo_count', async () => {
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [] }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.delete.mockResolvedValue(mockLog());

      await service.delete(TENANT_A, PROJECT_ID, LOG_ID, USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'project_log',
          entityId: LOG_ID,
          tenantId: TENANT_A,
          actorUserId: USER_ID,
          before: expect.objectContaining({
            photo_count: 0,
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // findAttachments()
  // -----------------------------------------------------------------------

  describe('findAttachments()', () => {
    it('should return attachments for a log', async () => {
      const att = mockAttachment({
        file_size_bytes: 2048,
        created_at: new Date('2026-04-05T16:00:00.000Z'),
      });
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [att] }),
      );

      const result = await service.findAttachments(
        TENANT_A,
        PROJECT_ID,
        LOG_ID,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: ATTACHMENT_ID,
        file_url: expect.any(String),
        file_name: 'foundation.jpg',
        file_type: 'photo',
        file_size_bytes: 2048,
        created_at: expect.any(Date),
      });
    });

    it('should return empty array when log has no attachments', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [] }),
      );

      const result = await service.findAttachments(
        TENANT_A,
        PROJECT_ID,
        LOG_ID,
      );

      expect(result.data).toEqual([]);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findAttachments(TENANT_A, PROJECT_ID, LOG_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when log not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findFirst.mockResolvedValue(null);

      await expect(
        service.findAttachments(TENANT_A, PROJECT_ID, LOG_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include file_size_bytes and created_at in response', async () => {
      const att = mockAttachment({
        file_size_bytes: 10240,
        created_at: new Date('2026-04-05T18:30:00.000Z'),
      });
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [att] }),
      );

      const result = await service.findAttachments(
        TENANT_A,
        PROJECT_ID,
        LOG_ID,
      );

      expect(result.data[0].file_size_bytes).toBe(10240);
      expect(result.data[0].created_at).toEqual(
        new Date('2026-04-05T18:30:00.000Z'),
      );
    });

    it('should return multiple attachments of mixed types', async () => {
      const photoAtt = mockAttachment({
        id: 'att-1',
        file_type: 'photo',
        file_name: 'site.jpg',
      });
      const pdfAtt = mockAttachment({
        id: 'att-2',
        file_type: 'pdf',
        file_name: 'report.pdf',
      });
      const docAtt = mockAttachment({
        id: 'att-3',
        file_type: 'document',
        file_name: 'notes.docx',
      });
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_log.findFirst.mockResolvedValue(
        mockLog({ attachments: [photoAtt, pdfAtt, docAtt] }),
      );

      const result = await service.findAttachments(
        TENANT_A,
        PROJECT_ID,
        LOG_ID,
      );

      expect(result.data).toHaveLength(3);
      expect(result.data.map((a: any) => a.file_type)).toEqual([
        'photo',
        'pdf',
        'document',
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // Tenant Isolation
  // -----------------------------------------------------------------------

  describe('Tenant Isolation', () => {
    it('create: verifies project belongs to tenant', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          TENANT_B,
          PROJECT_ID,
          USER_ID,
          { content: 'test' },
          [],
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
        select: { id: true, project_number: true },
      });
    });

    it('findAll: filters by tenant_id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ tenant_id: TENANT_B }),
      );
      mockPrismaService.project_log.findMany.mockResolvedValue([]);
      mockPrismaService.project_log.count.mockResolvedValue(0);

      await service.findAll(TENANT_B, PROJECT_ID);

      expect(mockPrismaService.project_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_B }),
        }),
      );
    });

    it('delete: verifies log belongs to tenant', async () => {
      mockPrismaService.project_log.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(TENANT_B, PROJECT_ID, LOG_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project_log.findFirst).toHaveBeenCalledWith({
        where: {
          id: LOG_ID,
          tenant_id: TENANT_B,
          project_id: PROJECT_ID,
        },
        include: { attachments: true },
      });
    });

    it('findAttachments: verifies project belongs to tenant', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findAttachments(TENANT_B, PROJECT_ID, LOG_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
        select: { id: true },
      });
    });

    it('findAttachments: verifies log belongs to tenant + project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ tenant_id: TENANT_B }),
      );
      mockPrismaService.project_log.findFirst.mockResolvedValue(null);

      await expect(
        service.findAttachments(TENANT_B, PROJECT_ID, LOG_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project_log.findFirst).toHaveBeenCalledWith({
        where: {
          id: LOG_ID,
          tenant_id: TENANT_B,
          project_id: PROJECT_ID,
        },
        include: { attachments: true },
      });
    });
  });

  // -----------------------------------------------------------------------
  // Immutability — no update method exists
  // -----------------------------------------------------------------------

  describe('Immutability', () => {
    it('should not expose an update method', () => {
      expect((service as any).update).toBeUndefined();
    });
  });
});
