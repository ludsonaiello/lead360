import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { FileStorageService } from '../../core/file-storage/file-storage.service';
import { AuditLoggerService } from '../audit/services/audit-logger.service';
import { UploadFileDto, FileCategory } from './dto/upload-file.dto';
import { FileQueryDto } from './dto/file-query.dto';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get validation rules by category
   */
  private getValidationRules(category: FileCategory) {
    const rules = {
      quote: {
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      invoice: {
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      license: {
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      insurance: {
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      misc: {
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ],
        maxSizeBytes: 20 * 1024 * 1024, // 20MB for misc files
      },
    };

    return rules[category];
  }

  /**
   * Upload a file
   */
  async uploadFile(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    uploadDto: UploadFileDto,
  ) {
    // Get validation rules by category
    const validationRules = this.getValidationRules(uploadDto.category);

    // Upload using FileStorageService
    const { file_id, url, metadata } = await this.fileStorage.uploadFile(tenantId, file, {
      ...validationRules,
      category: uploadDto.category,
    });

    // Create File record in database
    const fileRecord = await this.prisma.file.create({
      data: {
        file_id,
        tenant_id: tenantId,
        original_filename: metadata.original_filename,
        mime_type: metadata.mime_type,
        size_bytes: metadata.size_bytes,
        category: uploadDto.category,
        storage_path: metadata.storage_path,
        uploaded_by: userId,
        entity_type: uploadDto.entity_type || null,
        entity_id: uploadDto.entity_id || null,
        is_orphan: !uploadDto.entity_id, // Mark as potential orphan if no entity_id
      },
    });

    // Create audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'file',
      entityId: fileRecord.id,
      tenantId: tenantId,
      actorUserId: userId,
      after: {
        id: fileRecord.id,
        file_id: fileRecord.file_id,
        original_filename: fileRecord.original_filename,
        mime_type: fileRecord.mime_type,
        size_bytes: fileRecord.size_bytes,
        category: fileRecord.category,
        storage_path: fileRecord.storage_path,
      },
      description: `File "${fileRecord.original_filename}" uploaded`,
      metadata: {
        category: uploadDto.category,
        entity_type: uploadDto.entity_type,
        entity_id: uploadDto.entity_id,
      },
    });

    return {
      message: 'File uploaded successfully',
      file_id,
      url,
      file: {
        id: fileRecord.id,
        file_id: fileRecord.file_id,
        original_filename: fileRecord.original_filename,
        mime_type: fileRecord.mime_type,
        size_bytes: fileRecord.size_bytes,
        category: fileRecord.category,
        url,
        created_at: fileRecord.created_at,
      },
    };
  }

  /**
   * Find one file by ID
   */
  async findOne(tenantId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: {
        file_id: fileId,
        tenant_id: tenantId, // CRITICAL: Tenant isolation
        is_trashed: false, // Don't show trashed files
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Get URL from storage
    const fileInfo = await this.fileStorage.getFileInfo(tenantId, fileId);

    return {
      id: file.id,
      file_id: file.file_id,
      original_filename: file.original_filename,
      mime_type: file.mime_type,
      size_bytes: file.size_bytes,
      category: file.category,
      entity_type: file.entity_type,
      entity_id: file.entity_id,
      is_orphan: file.is_orphan,
      url: fileInfo.url,
      uploaded_by: file.uploaded_by,
      created_at: file.created_at,
      updated_at: file.updated_at,
    };
  }

  /**
   * Find all files with filters and pagination
   */
  async findAll(tenantId: string, query: FileQueryDto) {
    const { category, entity_type, entity_id, page = 1, limit = 20 } = query;

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
      is_trashed: false, // Don't show trashed files
    };

    if (category) {
      where.category = category;
    }

    if (entity_type) {
      where.entity_type = entity_type;
    }

    if (entity_id) {
      where.entity_id = entity_id;
    }

    // Get total count
    const total = await this.prisma.file.count({ where });

    // Get files
    const files = await this.prisma.file.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
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

    // Add URLs to files
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const fileInfo = await this.fileStorage.getFileInfo(tenantId, file.file_id);
        return {
          ...file,
          url: fileInfo.url,
        };
      }),
    );

    return {
      data: filesWithUrls,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Delete a file (hard delete immediately)
   */
  async delete(tenantId: string, fileId: string, userId: string) {
    // Get file record
    const file = await this.prisma.file.findFirst({
      where: {
        file_id: fileId,
        tenant_id: tenantId, // CRITICAL: Tenant isolation
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Hard delete from filesystem
    await this.fileStorage.deleteFileByPath(file.storage_path);

    // Hard delete from database
    await this.prisma.file.delete({
      where: { id: file.id },
    });

    // Create audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'file',
      entityId: file.id,
      tenantId: tenantId,
      actorUserId: userId,
      before: {
        id: file.id,
        file_id: file.file_id,
        original_filename: file.original_filename,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        category: file.category,
        storage_path: file.storage_path,
      },
      description: `File "${file.original_filename}" deleted`,
      metadata: {
        category: file.category,
        entity_type: file.entity_type,
        entity_id: file.entity_id,
      },
    });

    return { message: 'File deleted successfully' };
  }

  /**
   * Find orphan files (files not attached to any entity)
   */
  async findOrphans(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find files where entity_id is null and created > 30 days ago
    const orphans = await this.prisma.file.findMany({
      where: {
        tenant_id: tenantId,
        entity_id: null,
        created_at: {
          lte: thirtyDaysAgo,
        },
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

    // Mark as orphan if not already marked
    const orphanIds = orphans.filter((f) => !f.is_orphan).map((f) => f.id);
    if (orphanIds.length > 0) {
      await this.prisma.file.updateMany({
        where: { id: { in: orphanIds } },
        data: {
          is_orphan: true,
          orphaned_at: new Date(),
        },
      });
    }

    // Add URLs to orphans
    const orphansWithUrls = await Promise.all(
      orphans.map(async (file) => {
        const fileInfo = await this.fileStorage.getFileInfo(tenantId, file.file_id);
        return {
          ...file,
          url: fileInfo.url,
          days_orphaned: file.orphaned_at
            ? Math.floor((Date.now() - new Date(file.orphaned_at).getTime()) / (1000 * 60 * 60 * 24))
            : Math.floor((Date.now() - new Date(file.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        };
      }),
    );

    return {
      orphans: orphansWithUrls,
      total: orphans.length,
      marked_as_orphan: orphanIds.length,
    };
  }

  /**
   * Move orphan files to trash (orphans older than 30 days)
   */
  async moveOrphansToTrash(tenantId: string, userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find orphan files where orphaned_at > 30 days
    const orphansToTrash = await this.prisma.file.findMany({
      where: {
        tenant_id: tenantId,
        is_orphan: true,
        orphaned_at: {
          lte: thirtyDaysAgo,
        },
        is_trashed: false,
      },
    });

    if (orphansToTrash.length === 0) {
      return {
        message: 'No orphan files ready to move to trash',
        count: 0,
      };
    }

    // Mark as trashed
    await this.prisma.file.updateMany({
      where: {
        id: { in: orphansToTrash.map((f) => f.id) },
      },
      data: {
        is_trashed: true,
        trashed_at: new Date(),
      },
    });

    // Create audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'file',
      entityId: tenantId, // Using tenant ID for bulk operation
      tenantId: tenantId,
      actorUserId: userId,
      after: {
        is_trashed: true,
        count: orphansToTrash.length,
      },
      description: `${orphansToTrash.length} orphan files moved to trash`,
      metadata: {
        operation: 'bulk_trash',
        file_ids: orphansToTrash.map((f) => f.file_id),
        file_count: orphansToTrash.length,
      },
    });

    return {
      message: `${orphansToTrash.length} orphan files moved to trash`,
      count: orphansToTrash.length,
    };
  }

  /**
   * Cleanup trashed files (hard delete files trashed > 30 days)
   */
  async cleanupTrashedFiles(tenantId: string, userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find trashed files where trashed_at > 30 days
    const trashedFiles = await this.prisma.file.findMany({
      where: {
        tenant_id: tenantId,
        is_trashed: true,
        trashed_at: {
          lte: thirtyDaysAgo,
        },
      },
    });

    if (trashedFiles.length === 0) {
      return {
        message: 'No trashed files ready for permanent deletion',
        count: 0,
      };
    }

    // Hard delete from filesystem
    await Promise.all(
      trashedFiles.map((file) => this.fileStorage.deleteFileByPath(file.storage_path)),
    );

    // Hard delete from database
    await this.prisma.file.deleteMany({
      where: {
        id: { in: trashedFiles.map((f) => f.id) },
      },
    });

    // Create audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'file',
      entityId: tenantId, // Using tenant ID for bulk operation
      tenantId: tenantId,
      actorUserId: userId,
      before: {
        count: trashedFiles.length,
        files: trashedFiles.map((f) => ({
          id: f.id,
          file_id: f.file_id,
          original_filename: f.original_filename,
        })),
      },
      description: `${trashedFiles.length} trashed files permanently deleted`,
      metadata: {
        operation: 'bulk_delete',
        file_ids: trashedFiles.map((f) => f.file_id),
        file_count: trashedFiles.length,
      },
    });

    return {
      message: `${trashedFiles.length} trashed files permanently deleted`,
      count: trashedFiles.length,
    };
  }
}
