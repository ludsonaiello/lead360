import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { FileCategory } from '../../files/dto/upload-file.dto';
import { ProjectActivityService } from './project-activity.service';
import { UploadProjectPhotoDto } from '../dto/upload-project-photo.dto';
import { UpdateProjectPhotoDto } from '../dto/update-project-photo.dto';

@Injectable()
export class ProjectPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
    private readonly filesService: FilesService,
    private readonly projectActivityService: ProjectActivityService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. upload(tenantId, projectId, userId, file, dto)
  // ---------------------------------------------------------------------------

  async upload(
    tenantId: string,
    projectId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadProjectPhotoDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // If task_id is provided, verify the task belongs to this project + tenant
    if (dto.task_id) {
      const task = await this.prisma.project_task.findFirst({
        where: {
          id: dto.task_id,
          tenant_id: tenantId,
          project_id: projectId,
          deleted_at: null,
        },
      });

      if (!task) {
        throw new NotFoundException(
          'Task not found or does not belong to this project',
        );
      }
    }

    const result = await this.filesService.uploadFile(tenantId, userId, file, {
      category: FileCategory.PHOTO,
      entity_type: 'project_photo',
      entity_id: projectId,
    });

    // Derive thumbnail URL from file record's thumbnail_path
    let thumbnailUrl: string | null = null;
    if (result.file.has_thumbnail) {
      const fileRecord = await this.prisma.file.findFirst({
        where: { file_id: result.file.file_id, tenant_id: tenantId },
        select: { thumbnail_path: true },
      });
      if (fileRecord?.thumbnail_path) {
        // Convert physical path to Nginx-served URL
        // e.g. /var/www/.../uploads/public/{tenant}/images/uuid_thumb.webp → /public/{tenant}/images/uuid_thumb.webp
        const publicIdx = fileRecord.thumbnail_path.indexOf('/public/');
        if (publicIdx !== -1) {
          thumbnailUrl = fileRecord.thumbnail_path.substring(publicIdx);
        }
      }
    }

    const photo = await this.prisma.project_photo.create({
      data: {
        tenant_id: tenantId,
        project_id: projectId,
        task_id: dto.task_id ?? null,
        file_id: result.file.file_id,
        file_url: result.url,
        thumbnail_url: thumbnailUrl,
        caption: dto.caption ?? null,
        is_public: dto.is_public ?? false,
        taken_at: dto.taken_at ? new Date(dto.taken_at) : null,
        uploaded_by_user_id: userId,
      },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'project_photo',
      entityId: photo.id,
      tenantId,
      actorUserId: userId,
      after: {
        id: photo.id,
        project_id: projectId,
        task_id: photo.task_id,
        caption: photo.caption,
        is_public: photo.is_public,
      },
      description: `Uploaded photo to project ${project.project_number}${photo.caption ? `: ${photo.caption}` : ''}`,
    });

    // Fire-and-forget activity log
    this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'photo_added',
      description: `Uploaded photo${photo.caption ? `: ${photo.caption}` : ''}`,
      metadata: {
        photo_id: photo.id,
        task_id: photo.task_id,
        is_public: photo.is_public,
      },
    });

    return this.formatPhotoResponse(photo);
  }

  // ---------------------------------------------------------------------------
  // 2. findAll(tenantId, projectId, query)
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    projectId: string,
    query: {
      task_id?: string;
      is_public?: boolean;
      date_from?: string;
      date_to?: string;
    } = {},
  ) {
    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const where: any = {
      tenant_id: tenantId,
      project_id: projectId,
    };

    if (query.task_id) {
      where.task_id = query.task_id;
    }

    if (query.is_public !== undefined) {
      where.is_public = query.is_public;
    }

    if (query.date_from || query.date_to) {
      where.created_at = {};
      if (query.date_from) {
        where.created_at.gte = new Date(query.date_from);
      }
      if (query.date_to) {
        // Include the entire date_to day
        const endDate = new Date(query.date_to);
        endDate.setUTCHours(23, 59, 59, 999);
        where.created_at.lte = endDate;
      }
    }

    const photos = await this.prisma.project_photo.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return photos.map((photo) => this.formatPhotoResponse(photo));
  }

  // ---------------------------------------------------------------------------
  // 3. update(tenantId, projectId, photoId, userId, dto)
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    projectId: string,
    photoId: string,
    userId: string,
    dto: UpdateProjectPhotoDto,
  ) {
    const existing = await this.prisma.project_photo.findFirst({
      where: {
        id: photoId,
        tenant_id: tenantId,
        project_id: projectId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Photo not found');
    }

    const updateData: any = {};

    if (dto.caption !== undefined) {
      updateData.caption = dto.caption;
    }

    if (dto.is_public !== undefined) {
      updateData.is_public = dto.is_public;
    }

    const updated = await this.prisma.project_photo.update({
      where: { id: photoId },
      data: updateData,
    });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'project_photo',
      entityId: photoId,
      tenantId,
      actorUserId: userId,
      before: {
        caption: existing.caption,
        is_public: existing.is_public,
      },
      after: {
        caption: updated.caption,
        is_public: updated.is_public,
      },
      description: `Updated photo metadata for project ${projectId}`,
    });

    return this.formatPhotoResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // 4. delete(tenantId, projectId, photoId, userId)
  // ---------------------------------------------------------------------------

  async delete(
    tenantId: string,
    projectId: string,
    photoId: string,
    userId: string,
  ) {
    const photo = await this.prisma.project_photo.findFirst({
      where: {
        id: photoId,
        tenant_id: tenantId,
        project_id: projectId,
      },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    // Delete the photo record first (FK constraint: onDelete Restrict on file)
    await this.prisma.project_photo.delete({
      where: { id: photoId },
    });

    // Delete the file from storage
    await this.filesService.delete(tenantId, photo.file_id, userId);

    await this.auditLoggerService.logTenantChange({
      action: 'deleted',
      entityType: 'project_photo',
      entityId: photoId,
      tenantId,
      actorUserId: userId,
      before: {
        id: photo.id,
        file_url: photo.file_url,
        caption: photo.caption,
        project_id: projectId,
      },
      description: `Deleted photo from project ${projectId}${photo.caption ? `: ${photo.caption}` : ''}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 5. getTimeline(tenantId, projectId, query)
  // ---------------------------------------------------------------------------

  async getTimeline(
    tenantId: string,
    projectId: string,
    query: {
      task_id?: string;
      is_public?: boolean;
      date_from?: string;
      date_to?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const where: any = {
      tenant_id: tenantId,
      project_id: projectId,
    };

    if (query.task_id) {
      where.task_id = query.task_id;
    }

    if (query.is_public !== undefined) {
      where.is_public = query.is_public;
    }

    // Date range filtering on effective date (taken_at ?? created_at).
    // Uses OR to match photos where either taken_at falls in range,
    // or taken_at is null and created_at falls in range.
    if (query.date_from || query.date_to) {
      const dateFilter: any = {};
      if (query.date_from) {
        dateFilter.gte = new Date(query.date_from);
      }
      if (query.date_to) {
        const endDate = new Date(query.date_to);
        endDate.setUTCHours(23, 59, 59, 999);
        dateFilter.lte = endDate;
      }
      where.OR = [
        { taken_at: dateFilter },
        { taken_at: null, created_at: dateFilter },
      ];
    }

    // Fetch all matching photos with relations for enrichment.
    // Sorted and paginated in-memory because Prisma cannot do
    // ORDER BY COALESCE(taken_at, created_at) natively.
    // Acceptable for project-scoped photo counts (typically 10–500).
    const allPhotos = await this.prisma.project_photo.findMany({
      where,
      include: {
        task: { select: { id: true, title: true } },
        log: { select: { id: true } },
        uploaded_by_user: { select: { first_name: true, last_name: true } },
      },
    });

    // Sort by effective date (taken_at ?? created_at) DESC
    allPhotos.sort((a, b) => {
      const dateA = (a.taken_at ?? a.created_at).getTime();
      const dateB = (b.taken_at ?? b.created_at).getTime();
      return dateB - dateA;
    });

    // Pagination
    const total = allPhotos.length;
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;
    const paginatedPhotos = allPhotos.slice(skip, skip + limit);

    // Group by effective date
    const grouped = this.groupPhotosByDate(paginatedPhotos);

    return {
      data: grouped,
      meta: { total, page, limit, totalPages },
    };
  }

  // ---------------------------------------------------------------------------
  // 6. batchUpload(tenantId, projectId, userId, files, dto)
  // ---------------------------------------------------------------------------

  async batchUpload(
    tenantId: string,
    projectId: string,
    userId: string,
    files: Express.Multer.File[],
    dto: UploadProjectPhotoDto,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // If task_id is provided, verify the task belongs to this project + tenant
    if (dto.task_id) {
      const task = await this.prisma.project_task.findFirst({
        where: {
          id: dto.task_id,
          tenant_id: tenantId,
          project_id: projectId,
          deleted_at: null,
        },
      });

      if (!task) {
        throw new NotFoundException(
          'Task not found or does not belong to this project',
        );
      }
    }

    const results: any[] = [];

    for (const file of files) {
      const uploadResult = await this.filesService.uploadFile(
        tenantId,
        userId,
        file,
        {
          category: FileCategory.PHOTO,
          entity_type: 'project_photo',
          entity_id: projectId,
        },
      );

      // Derive thumbnail URL from file record's thumbnail_path
      let thumbnailUrl: string | null = null;
      if (uploadResult.file.has_thumbnail) {
        const fileRecord = await this.prisma.file.findFirst({
          where: { file_id: uploadResult.file.file_id, tenant_id: tenantId },
          select: { thumbnail_path: true },
        });
        if (fileRecord?.thumbnail_path) {
          const publicIdx = fileRecord.thumbnail_path.indexOf('/public/');
          if (publicIdx !== -1) {
            thumbnailUrl = fileRecord.thumbnail_path.substring(publicIdx);
          }
        }
      }

      const photo = await this.prisma.project_photo.create({
        data: {
          tenant_id: tenantId,
          project_id: projectId,
          task_id: dto.task_id ?? null,
          file_id: uploadResult.file.file_id,
          file_url: uploadResult.url,
          thumbnail_url: thumbnailUrl,
          caption: dto.caption ?? null,
          is_public: dto.is_public ?? false,
          taken_at: dto.taken_at ? new Date(dto.taken_at) : null,
          uploaded_by_user_id: userId,
        },
      });

      await this.auditLoggerService.logTenantChange({
        action: 'created',
        entityType: 'project_photo',
        entityId: photo.id,
        tenantId,
        actorUserId: userId,
        after: {
          id: photo.id,
          project_id: projectId,
          task_id: photo.task_id,
          caption: photo.caption,
          is_public: photo.is_public,
          batch_upload: true,
        },
        description: `Batch uploaded photo to project ${project.project_number}${photo.caption ? `: ${photo.caption}` : ''}`,
      });

      results.push(this.formatPhotoResponse(photo));
    }

    // Single activity log for the batch
    this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'photos_batch_added',
      description: `Batch uploaded ${files.length} photo${files.length > 1 ? 's' : ''}`,
      metadata: {
        photo_ids: results.map((r) => r.id),
        count: files.length,
        task_id: dto.task_id ?? null,
      },
    });

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private formatPhotoResponse(photo: any) {
    return {
      id: photo.id,
      project_id: photo.project_id,
      task_id: photo.task_id,
      file_id: photo.file_id,
      file_url: photo.file_url,
      thumbnail_url: photo.thumbnail_url,
      caption: photo.caption,
      is_public: photo.is_public,
      taken_at: photo.taken_at
        ? photo.taken_at.toISOString().split('T')[0]
        : null,
      uploaded_by_user_id: photo.uploaded_by_user_id,
      created_at: photo.created_at,
    };
  }

  private getEffectiveDate(photo: any): Date {
    return photo.taken_at ?? photo.created_at;
  }

  private getEffectiveDateString(photo: any): string {
    const date = this.getEffectiveDate(photo);
    return date.toISOString().split('T')[0];
  }

  private groupPhotosByDate(
    photos: any[],
  ): { date: string; photos: any[] }[] {
    const groups = new Map<string, any[]>();

    for (const photo of photos) {
      const dateStr = this.getEffectiveDateString(photo);
      if (!groups.has(dateStr)) {
        groups.set(dateStr, []);
      }
      groups.get(dateStr)!.push(this.formatTimelinePhotoResponse(photo));
    }

    return Array.from(groups.entries()).map(([date, photos]) => ({
      date,
      photos,
    }));
  }

  private formatTimelinePhotoResponse(photo: any) {
    return {
      id: photo.id,
      file_url: photo.file_url,
      thumbnail_url: photo.thumbnail_url,
      caption: photo.caption,
      is_public: photo.is_public,
      task: photo.task
        ? { id: photo.task.id, title: photo.task.title }
        : null,
      log: photo.log ? { id: photo.log.id } : null,
      uploaded_by: photo.uploaded_by_user
        ? {
            first_name: photo.uploaded_by_user.first_name,
            last_name: photo.uploaded_by_user.last_name,
          }
        : null,
      created_at: photo.created_at,
    };
  }
}
