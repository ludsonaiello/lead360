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
        where: { file_id: result.file.file_id },
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
}
