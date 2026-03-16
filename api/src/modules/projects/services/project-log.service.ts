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
import { CreateProjectLogDto } from '../dto/create-project-log.dto';

/**
 * Determines the log_attachment_file_type from a MIME type.
 */
function resolveAttachmentFileType(
  mimeType: string,
): 'photo' | 'pdf' | 'document' {
  if (mimeType.startsWith('image/')) return 'photo';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'document';
}

@Injectable()
export class ProjectLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
    private readonly filesService: FilesService,
    private readonly projectActivityService: ProjectActivityService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. create(tenantId, projectId, userId, dto, files)
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    projectId: string,
    userId: string,
    dto: CreateProjectLogDto,
    files: Express.Multer.File[] = [],
  ) {
    // Validate content is not empty
    if (!dto.content || dto.content.trim().length === 0) {
      throw new BadRequestException('Log content is required');
    }

    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true, project_number: true },
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

    // Determine log_date: use provided date or default to today
    const logDate = dto.log_date ? new Date(dto.log_date) : new Date();

    // Create the log record
    const log = await this.prisma.project_log.create({
      data: {
        tenant_id: tenantId,
        project_id: projectId,
        task_id: dto.task_id ?? null,
        author_user_id: userId,
        log_date: logDate,
        content: dto.content.trim(),
        is_public: dto.is_public ?? false,
        weather_delay: dto.weather_delay ?? false,
      },
    });

    // Process attachments
    const attachmentRecords: any[] = [];

    for (const file of files) {
      const fileType = resolveAttachmentFileType(file.mimetype);
      const fileCategory =
        fileType === 'photo' ? FileCategory.PHOTO : FileCategory.MISC;

      const result = await this.filesService.uploadFile(
        tenantId,
        userId,
        file,
        {
          category: fileCategory,
          entity_type: 'project_log',
          entity_id: log.id,
        },
      );

      const attachment = await this.prisma.project_log_attachment.create({
        data: {
          tenant_id: tenantId,
          log_id: log.id,
          file_id: result.file.file_id,
          file_url: result.url,
          file_name: file.originalname,
          file_type: fileType,
          file_size_bytes: file.size ?? null,
        },
      });

      attachmentRecords.push(attachment);

      // If this attachment is a photo, also create a project_photo record
      if (fileType === 'photo') {
        let thumbnailUrl: string | null = null;
        if (result.file.has_thumbnail) {
          const fileRecord = await this.prisma.file.findFirst({
            where: { file_id: result.file.file_id },
            select: { thumbnail_path: true },
          });
          if (fileRecord?.thumbnail_path) {
            const publicIdx = fileRecord.thumbnail_path.indexOf('/public/');
            if (publicIdx !== -1) {
              thumbnailUrl = fileRecord.thumbnail_path.substring(publicIdx);
            }
          }
        }

        await this.prisma.project_photo.create({
          data: {
            tenant_id: tenantId,
            project_id: projectId,
            task_id: dto.task_id ?? null,
            log_id: log.id,
            file_id: result.file.file_id,
            file_url: result.url,
            thumbnail_url: thumbnailUrl,
            caption: null,
            is_public: dto.is_public ?? false,
            uploaded_by_user_id: userId,
          },
        });
      }
    }

    // Audit log
    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'project_log',
      entityId: log.id,
      tenantId,
      actorUserId: userId,
      after: {
        id: log.id,
        project_id: projectId,
        task_id: log.task_id,
        content: log.content,
        is_public: log.is_public,
        weather_delay: log.weather_delay,
        attachment_count: attachmentRecords.length,
      },
      description: `Added log to project ${project.project_number}`,
    });

    // Fire-and-forget activity log
    this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'log_added',
      description: `Added daily log${dto.weather_delay ? ' (weather delay)' : ''}`,
      metadata: {
        log_id: log.id,
        task_id: log.task_id,
        is_public: log.is_public,
        attachment_count: attachmentRecords.length,
      },
    });

    // Fetch the full log with author and attachments for the response
    return this.findOneById(tenantId, projectId, log.id);
  }

  // ---------------------------------------------------------------------------
  // 2. findAll(tenantId, projectId, query)
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    projectId: string,
    query: {
      is_public?: boolean;
      has_attachments?: boolean;
      date_from?: string;
      date_to?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
      project_id: projectId,
    };

    if (query.is_public !== undefined) {
      where.is_public = query.is_public;
    }

    if (query.has_attachments === true) {
      where.attachments = { some: {} };
    } else if (query.has_attachments === false) {
      where.attachments = { none: {} };
    }

    if (query.date_from || query.date_to) {
      where.log_date = {};
      if (query.date_from) {
        where.log_date.gte = new Date(query.date_from);
      }
      if (query.date_to) {
        // Include the entire date_to day
        const endDate = new Date(query.date_to);
        endDate.setUTCHours(23, 59, 59, 999);
        where.log_date.lte = endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.project_log.findMany({
        where,
        include: {
          author: {
            select: { id: true, first_name: true, last_name: true },
          },
          attachments: true,
        },
        orderBy: [{ log_date: 'desc' }, { created_at: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.project_log.count({ where }),
    ]);

    return {
      data: logs.map((log) => this.formatLogResponse(log)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 3. delete(tenantId, projectId, logId, userId)
  // ---------------------------------------------------------------------------

  async delete(
    tenantId: string,
    projectId: string,
    logId: string,
    userId: string,
  ) {
    const log = await this.prisma.project_log.findFirst({
      where: {
        id: logId,
        tenant_id: tenantId,
        project_id: projectId,
      },
      include: {
        attachments: true,
      },
    });

    if (!log) {
      throw new NotFoundException('Log not found');
    }

    // Find project_photo records linked to this log for cleanup
    const linkedPhotos = await this.prisma.project_photo.findMany({
      where: { log_id: logId, tenant_id: tenantId },
      select: { id: true, file_id: true },
    });

    // Collect ALL attachment file IDs for storage cleanup
    const fileIdsToDelete: string[] = log.attachments.map(
      (a) => a.file_id,
    );

    // Delete linked project_photo records first (removes FK to file)
    if (linkedPhotos.length > 0) {
      await this.prisma.project_photo.deleteMany({
        where: { log_id: logId, tenant_id: tenantId },
      });
    }

    // Hard delete the log — cascade deletes project_log_attachment records
    await this.prisma.project_log.delete({
      where: { id: logId },
    });

    // Delete all attachment files from storage
    for (const fileId of fileIdsToDelete) {
      await this.filesService.delete(tenantId, fileId, userId);
    }

    // Audit log
    await this.auditLoggerService.logTenantChange({
      action: 'deleted',
      entityType: 'project_log',
      entityId: logId,
      tenantId,
      actorUserId: userId,
      before: {
        id: log.id,
        project_id: projectId,
        content: log.content,
        is_public: log.is_public,
        attachment_count: log.attachments.length,
        photo_count: linkedPhotos.length,
      },
      description: `Deleted log from project ${projectId}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. findAttachments(tenantId, projectId, logId)
  // ---------------------------------------------------------------------------

  async findAttachments(
    tenantId: string,
    projectId: string,
    logId: string,
  ) {
    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify log exists and belongs to project + tenant
    const log = await this.prisma.project_log.findFirst({
      where: {
        id: logId,
        tenant_id: tenantId,
        project_id: projectId,
      },
      include: {
        attachments: true,
      },
    });

    if (!log) {
      throw new NotFoundException('Log not found');
    }

    return {
      data: log.attachments.map((a: any) => ({
        id: a.id,
        file_url: a.file_url,
        file_name: a.file_name,
        file_type: a.file_type,
        file_size_bytes: a.file_size_bytes,
        created_at: a.created_at,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findOneById(
    tenantId: string,
    projectId: string,
    logId: string,
  ) {
    const log = await this.prisma.project_log.findFirst({
      where: {
        id: logId,
        tenant_id: tenantId,
        project_id: projectId,
      },
      include: {
        author: {
          select: { id: true, first_name: true, last_name: true },
        },
        attachments: true,
      },
    });

    if (!log) {
      throw new NotFoundException('Log not found');
    }

    return this.formatLogResponse(log);
  }

  private formatLogResponse(log: any) {
    return {
      id: log.id,
      project_id: log.project_id,
      task_id: log.task_id,
      author: log.author
        ? {
            id: log.author.id,
            first_name: log.author.first_name,
            last_name: log.author.last_name,
          }
        : null,
      log_date: log.log_date
        ? log.log_date.toISOString().split('T')[0]
        : null,
      content: log.content,
      is_public: log.is_public,
      weather_delay: log.weather_delay,
      attachments: (log.attachments ?? []).map((a: any) => ({
        id: a.id,
        file_url: a.file_url,
        file_name: a.file_name,
        file_type: a.file_type,
      })),
      created_at: log.created_at,
    };
  }
}
