import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectPhotoService } from './project-photo.service';
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
const FILE_ID = 'file-uuid-001';
const PHOTO_ID = 'photo-uuid-001';

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

const mockPhoto = (overrides: any = {}) => ({
  id: PHOTO_ID,
  tenant_id: TENANT_A,
  project_id: PROJECT_ID,
  task_id: null,
  log_id: null,
  file_id: FILE_ID,
  file_url: `/public/${TENANT_A}/images/${FILE_ID}.webp`,
  thumbnail_url: `/public/${TENANT_A}/images/thumb-uuid_thumb.webp`,
  caption: 'Foundation pour complete',
  is_public: true,
  taken_at: new Date('2026-03-10'),
  uploaded_by_user_id: USER_ID,
  created_at: new Date('2026-03-13T10:00:00.000Z'),
  updated_at: new Date('2026-03-13T10:00:00.000Z'),
  ...overrides,
});

const mockUploadResult = (overrides: any = {}) => ({
  message: 'File uploaded successfully',
  file_id: FILE_ID,
  url: `/public/${TENANT_A}/images/${FILE_ID}.webp`,
  file: {
    id: 'file-record-id',
    file_id: FILE_ID,
    original_filename: 'photo.jpg',
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

const mockFile = (): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-data'),
    size: 2048,
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
  project_photo: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

describe('ProjectPhotoService', () => {
  let service: ProjectPhotoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectPhotoService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: FilesService, useValue: mockFilesService },
        { provide: ProjectActivityService, useValue: mockProjectActivityService },
      ],
    }).compile();

    service = module.get<ProjectPhotoService>(ProjectPhotoService);
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // upload()
  // -----------------------------------------------------------------------

  describe('upload()', () => {
    it('should upload photo and return correct shape', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(mockPhoto());

      const result = await service.upload(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        mockFile(),
        {
          caption: 'Foundation pour complete',
          is_public: true,
          taken_at: '2026-03-10',
        },
      );

      expect(result.id).toBe(PHOTO_ID);
      expect(result.project_id).toBe(PROJECT_ID);
      expect(result.caption).toBe('Foundation pour complete');
      expect(result.is_public).toBe(true);
      expect(result.taken_at).toBe('2026-03-10');
      expect(result.file_url).toBeDefined();
      expect(result.thumbnail_url).toBeDefined();
    });

    it('should call FilesService with photo category', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(mockPhoto());

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {});

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        expect.anything(),
        expect.objectContaining({
          category: 'photo',
          entity_type: 'project_photo',
          entity_id: PROJECT_ID,
        }),
      );
    });

    it('should validate task_id belongs to project when provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(
        mockPhoto({ task_id: TASK_ID }),
      );

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {
        task_id: TASK_ID,
      });

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
        service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {
          task_id: 'nonexistent-task-id',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when file is missing', async () => {
      await expect(
        service.upload(TENANT_A, PROJECT_ID, USER_ID, null as any, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log on upload', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(mockPhoto());

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {});

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project_photo',
          tenantId: TENANT_A,
        }),
      );
    });

    it('should log photo_added activity', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(mockPhoto());

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {});

      expect(mockProjectActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          project_id: PROJECT_ID,
          activity_type: 'photo_added',
        }),
      );
    });

    it('should set is_public to false by default', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(mockPhoto({ is_public: false }));

      await service.upload(TENANT_A, PROJECT_ID, USER_ID, mockFile(), {});

      expect(mockPrismaService.project_photo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          is_public: false,
        }),
      });
    });

    it('should handle no thumbnail gracefully', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(
        mockUploadResult({
          file: { ...mockUploadResult().file, has_thumbnail: false },
        }),
      );
      mockPrismaService.project_photo.create.mockResolvedValue(
        mockPhoto({ thumbnail_url: null }),
      );

      const result = await service.upload(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        mockFile(),
        {},
      );

      expect(result.thumbnail_url).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // findAll()
  // -----------------------------------------------------------------------

  describe('findAll()', () => {
    it('should return photos ordered by created_at DESC', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      const photos = [
        mockPhoto({ id: 'p1', created_at: new Date('2026-03-13T12:00:00Z') }),
        mockPhoto({ id: 'p2', created_at: new Date('2026-03-13T10:00:00Z') }),
      ];
      mockPrismaService.project_photo.findMany.mockResolvedValue(photos);

      const result = await service.findAll(TENANT_A, PROJECT_ID);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_A, project_id: PROJECT_ID },
        orderBy: { created_at: 'desc' },
      });
    });

    it('should filter by task_id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, PROJECT_ID, { task_id: TASK_ID });

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ task_id: TASK_ID }),
        }),
      );
    });

    it('should filter by is_public', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, PROJECT_ID, { is_public: true });

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_public: true }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, PROJECT_ID, {
        date_from: '2026-03-01',
        date_to: '2026-03-31',
      });

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(TENANT_A, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should format taken_at as YYYY-MM-DD string', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        mockPhoto({ taken_at: new Date('2026-03-10T00:00:00.000Z') }),
      ]);

      const result = await service.findAll(TENANT_A, PROJECT_ID);

      expect(result[0].taken_at).toBe('2026-03-10');
    });

    it('should return null for taken_at when not set', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        mockPhoto({ taken_at: null }),
      ]);

      const result = await service.findAll(TENANT_A, PROJECT_ID);

      expect(result[0].taken_at).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------

  describe('update()', () => {
    it('should update caption and is_public', async () => {
      const existing = mockPhoto();
      const updated = mockPhoto({
        caption: 'Updated caption',
        is_public: false,
      });
      mockPrismaService.project_photo.findFirst.mockResolvedValue(existing);
      mockPrismaService.project_photo.update.mockResolvedValue(updated);

      const result = await service.update(
        TENANT_A,
        PROJECT_ID,
        PHOTO_ID,
        USER_ID,
        { caption: 'Updated caption', is_public: false },
      );

      expect(result.caption).toBe('Updated caption');
      expect(result.is_public).toBe(false);
    });

    it('should only update provided fields', async () => {
      mockPrismaService.project_photo.findFirst.mockResolvedValue(mockPhoto());
      mockPrismaService.project_photo.update.mockResolvedValue(
        mockPhoto({ caption: 'New caption' }),
      );

      await service.update(TENANT_A, PROJECT_ID, PHOTO_ID, USER_ID, {
        caption: 'New caption',
      });

      expect(mockPrismaService.project_photo.update).toHaveBeenCalledWith({
        where: { id: PHOTO_ID },
        data: { caption: 'New caption' },
      });
    });

    it('should throw NotFoundException when photo does not exist', async () => {
      mockPrismaService.project_photo.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_A, PROJECT_ID, PHOTO_ID, USER_ID, {
          caption: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log on update', async () => {
      mockPrismaService.project_photo.findFirst.mockResolvedValue(mockPhoto());
      mockPrismaService.project_photo.update.mockResolvedValue(mockPhoto());

      await service.update(TENANT_A, PROJECT_ID, PHOTO_ID, USER_ID, {
        caption: 'test',
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'project_photo',
          tenantId: TENANT_A,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------

  describe('delete()', () => {
    it('should delete photo record and file from storage', async () => {
      mockPrismaService.project_photo.findFirst.mockResolvedValue(mockPhoto());
      mockPrismaService.project_photo.delete.mockResolvedValue(mockPhoto());

      await service.delete(TENANT_A, PROJECT_ID, PHOTO_ID, USER_ID);

      expect(mockPrismaService.project_photo.delete).toHaveBeenCalledWith({
        where: { id: PHOTO_ID },
      });
      expect(mockFilesService.delete).toHaveBeenCalledWith(
        TENANT_A,
        FILE_ID,
        USER_ID,
      );
    });

    it('should throw NotFoundException when photo does not exist', async () => {
      mockPrismaService.project_photo.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(TENANT_A, PROJECT_ID, PHOTO_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log on delete', async () => {
      mockPrismaService.project_photo.findFirst.mockResolvedValue(mockPhoto());
      mockPrismaService.project_photo.delete.mockResolvedValue(mockPhoto());

      await service.delete(TENANT_A, PROJECT_ID, PHOTO_ID, USER_ID);

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'project_photo',
          entityId: PHOTO_ID,
          tenantId: TENANT_A,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getTimeline()
  // -----------------------------------------------------------------------

  describe('getTimeline()', () => {
    const LOG_ID = 'log-uuid-001';

    const mockTimelinePhoto = (overrides: any = {}) => ({
      ...mockPhoto(),
      task: null,
      log: null,
      uploaded_by_user: { first_name: 'Jane', last_name: 'Admin' },
      ...overrides,
    });

    it('should return photos grouped by date', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        mockTimelinePhoto({
          id: 'p1',
          taken_at: new Date('2026-03-12T00:00:00.000Z'),
          created_at: new Date('2026-03-12T10:00:00.000Z'),
        }),
        mockTimelinePhoto({
          id: 'p2',
          taken_at: new Date('2026-03-10T00:00:00.000Z'),
          created_at: new Date('2026-03-11T10:00:00.000Z'),
        }),
      ]);

      const result = await service.getTimeline(TENANT_A, PROJECT_ID);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].date).toBe('2026-03-12');
      expect(result.data[0].photos).toHaveLength(1);
      expect(result.data[1].date).toBe('2026-03-10');
      expect(result.data[1].photos).toHaveLength(1);
    });

    it('should order by taken_at DESC with fallback to created_at', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        mockTimelinePhoto({
          id: 'p1',
          taken_at: new Date('2026-03-08T00:00:00.000Z'),
          created_at: new Date('2026-03-15T10:00:00.000Z'),
        }),
        mockTimelinePhoto({
          id: 'p2',
          taken_at: null,
          created_at: new Date('2026-03-12T10:00:00.000Z'),
        }),
        mockTimelinePhoto({
          id: 'p3',
          taken_at: new Date('2026-03-14T00:00:00.000Z'),
          created_at: new Date('2026-03-14T16:00:00.000Z'),
        }),
      ]);

      const result = await service.getTimeline(TENANT_A, PROJECT_ID);

      // Order: p3 (taken 3/14) → p2 (created 3/12, no taken_at) → p1 (taken 3/8)
      const allPhotos = result.data.flatMap((g) => g.photos);
      expect(allPhotos[0].id).toBe('p3');
      expect(allPhotos[1].id).toBe('p2');
      expect(allPhotos[2].id).toBe('p1');
    });

    it('should include task, log, and uploaded_by info', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        mockTimelinePhoto({
          task: { id: TASK_ID, title: 'Foundation Pour' },
          log: { id: LOG_ID },
          uploaded_by_user: { first_name: 'Jane', last_name: 'Admin' },
        }),
      ]);

      const result = await service.getTimeline(TENANT_A, PROJECT_ID);
      const photo = result.data[0].photos[0];

      expect(photo.task).toEqual({ id: TASK_ID, title: 'Foundation Pour' });
      expect(photo.log).toEqual({ id: LOG_ID });
      expect(photo.uploaded_by).toEqual({
        first_name: 'Jane',
        last_name: 'Admin',
      });
    });

    it('should return null for task and log when not linked', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        mockTimelinePhoto({ task: null, log: null }),
      ]);

      const result = await service.getTimeline(TENANT_A, PROJECT_ID);
      const photo = result.data[0].photos[0];

      expect(photo.task).toBeNull();
      expect(photo.log).toBeNull();
    });

    it('should filter by task_id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      await service.getTimeline(TENANT_A, PROJECT_ID, { task_id: TASK_ID });

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ task_id: TASK_ID }),
        }),
      );
    });

    it('should filter by is_public', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      await service.getTimeline(TENANT_A, PROJECT_ID, { is_public: true });

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_public: true }),
        }),
      );
    });

    it('should filter by date range using effective date (OR logic)', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      await service.getTimeline(TENANT_A, PROJECT_ID, {
        date_from: '2026-03-01',
        date_to: '2026-03-31',
      });

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                taken_at: {
                  gte: expect.any(Date),
                  lte: expect.any(Date),
                },
              },
              {
                taken_at: null,
                created_at: {
                  gte: expect.any(Date),
                  lte: expect.any(Date),
                },
              },
            ],
          }),
        }),
      );
    });

    it('should paginate correctly', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      // Create 5 photos
      const photos = Array.from({ length: 5 }, (_, i) =>
        mockTimelinePhoto({
          id: `p${i + 1}`,
          taken_at: new Date(`2026-03-${15 - i}T00:00:00.000Z`),
          created_at: new Date(`2026-03-${15 - i}T10:00:00.000Z`),
        }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue(photos);

      const result = await service.getTimeline(TENANT_A, PROJECT_ID, {
        page: 2,
        limit: 2,
      });

      expect(result.meta).toEqual({
        total: 5,
        page: 2,
        limit: 2,
        totalPages: 3,
      });
      // Page 2 should have photos p3 and p4
      const allPhotos = result.data.flatMap((g) => g.photos);
      expect(allPhotos).toHaveLength(2);
      expect(allPhotos[0].id).toBe('p3');
      expect(allPhotos[1].id).toBe('p4');
    });

    it('should enforce max limit of 100', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      const result = await service.getTimeline(TENANT_A, PROJECT_ID, {
        limit: 500,
      });

      expect(result.meta.limit).toBe(100);
    });

    it('should return correct meta with defaults', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        mockTimelinePhoto(),
      ]);

      const result = await service.getTimeline(TENANT_A, PROJECT_ID);

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should throw NotFoundException for nonexistent project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getTimeline(TENANT_A, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include relations in Prisma query', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      await service.getTimeline(TENANT_A, PROJECT_ID);

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            task: { select: { id: true, title: true } },
            log: { select: { id: true } },
            uploaded_by_user: {
              select: { first_name: true, last_name: true },
            },
          },
        }),
      );
    });

    it('should group multiple photos on the same date together', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_photo.findMany.mockResolvedValue([
        mockTimelinePhoto({
          id: 'p1',
          taken_at: new Date('2026-03-10T00:00:00.000Z'),
          created_at: new Date('2026-03-10T08:00:00.000Z'),
        }),
        mockTimelinePhoto({
          id: 'p2',
          taken_at: new Date('2026-03-10T00:00:00.000Z'),
          created_at: new Date('2026-03-10T14:00:00.000Z'),
        }),
      ]);

      const result = await service.getTimeline(TENANT_A, PROJECT_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].date).toBe('2026-03-10');
      expect(result.data[0].photos).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // batchUpload()
  // -----------------------------------------------------------------------

  describe('batchUpload()', () => {
    const mockFiles = (): Express.Multer.File[] => [
      {
        fieldname: 'files',
        originalname: 'photo1.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-1'),
        size: 2048,
      } as Express.Multer.File,
      {
        fieldname: 'files',
        originalname: 'photo2.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-2'),
        size: 3072,
      } as Express.Multer.File,
    ];

    it('should upload multiple photos and return array', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create
        .mockResolvedValueOnce(mockPhoto({ id: 'batch-p1' }))
        .mockResolvedValueOnce(mockPhoto({ id: 'batch-p2' }));

      const result = await service.batchUpload(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        mockFiles(),
        { caption: 'Batch photos', is_public: false },
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('batch-p1');
      expect(result[1].id).toBe('batch-p2');
    });

    it('should call FilesService for each file', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(mockPhoto());

      await service.batchUpload(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        mockFiles(),
        {},
      );

      expect(mockFilesService.uploadFile).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when no files provided', async () => {
      await expect(
        service.batchUpload(TENANT_A, PROJECT_ID, USER_ID, [], {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when files is null', async () => {
      await expect(
        service.batchUpload(TENANT_A, PROJECT_ID, USER_ID, null as any, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for nonexistent project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.batchUpload(
          TENANT_A,
          PROJECT_ID,
          USER_ID,
          mockFiles(),
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate task_id when provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.batchUpload(TENANT_A, PROJECT_ID, USER_ID, mockFiles(), {
          task_id: 'nonexistent-task',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log for each photo', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(mockPhoto());

      await service.batchUpload(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        mockFiles(),
        {},
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(2);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'project_photo',
          tenantId: TENANT_A,
        }),
      );
    });

    it('should log batch activity', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(mockPhoto());

      await service.batchUpload(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        mockFiles(),
        {},
      );

      expect(mockProjectActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          project_id: PROJECT_ID,
          activity_type: 'photos_batch_added',
          description: 'Batch uploaded 2 photos',
        }),
      );
    });

    it('should apply shared metadata to all photos in batch', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      mockPrismaService.project_task.findFirst.mockResolvedValue(mockTask());
      mockFilesService.uploadFile.mockResolvedValue(mockUploadResult());
      mockPrismaService.file.findFirst.mockResolvedValue(mockFileRecord());
      mockPrismaService.project_photo.create.mockResolvedValue(
        mockPhoto({ task_id: TASK_ID, is_public: true }),
      );

      await service.batchUpload(
        TENANT_A,
        PROJECT_ID,
        USER_ID,
        mockFiles(),
        {
          task_id: TASK_ID,
          is_public: true,
          taken_at: '2026-03-10',
        },
      );

      // Both create calls should have the same metadata
      expect(mockPrismaService.project_photo.create).toHaveBeenCalledTimes(2);
      for (const call of mockPrismaService.project_photo.create.mock.calls) {
        expect(call[0].data).toEqual(
          expect.objectContaining({
            task_id: TASK_ID,
            is_public: true,
            taken_at: new Date('2026-03-10'),
          }),
        );
      }
    });
  });

  // -----------------------------------------------------------------------
  // Tenant Isolation
  // -----------------------------------------------------------------------

  describe('Tenant Isolation', () => {
    it('upload: verifies project belongs to tenant', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.upload(TENANT_B, PROJECT_ID, USER_ID, mockFile(), {}),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
      });
    });

    it('findAll: filters by tenant_id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ tenant_id: TENANT_B }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_B, PROJECT_ID);

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_B }),
        }),
      );
    });

    it('getTimeline: filters by tenant_id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ tenant_id: TENANT_B }),
      );
      mockPrismaService.project_photo.findMany.mockResolvedValue([]);

      await service.getTimeline(TENANT_B, PROJECT_ID);

      expect(mockPrismaService.project_photo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_B }),
        }),
      );
    });

    it('getTimeline: rejects project from another tenant', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getTimeline(TENANT_B, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
      });
    });

    it('batchUpload: verifies project belongs to tenant', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.batchUpload(TENANT_B, PROJECT_ID, USER_ID, [mockFile()], {}),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
      });
    });

    it('update: verifies photo belongs to tenant', async () => {
      mockPrismaService.project_photo.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_B, PROJECT_ID, PHOTO_ID, USER_ID, {
          caption: 'hack',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project_photo.findFirst).toHaveBeenCalledWith({
        where: {
          id: PHOTO_ID,
          tenant_id: TENANT_B,
          project_id: PROJECT_ID,
        },
      });
    });

    it('delete: verifies photo belongs to tenant', async () => {
      mockPrismaService.project_photo.findFirst.mockResolvedValue(null);

      await expect(
        service.delete(TENANT_B, PROJECT_ID, PHOTO_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project_photo.findFirst).toHaveBeenCalledWith({
        where: {
          id: PHOTO_ID,
          tenant_id: TENANT_B,
          project_id: PROJECT_ID,
        },
      });
    });
  });
});
