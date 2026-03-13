import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { FileStorageService } from '../../core/file-storage/file-storage.service';
import { StorageProviderFactory } from '../../core/file-storage/storage-provider.factory';
import { ImageProcessorService } from '../../core/file-storage/image-processor.service';
import { AuditLoggerService } from '../audit/services/audit-logger.service';
import { UploadFileDto, FileCategory } from './dto/upload-file.dto';
import { FileQueryDto } from './dto/file-query.dto';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { AccessShareLinkDto } from './dto/access-share-link.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { BulkDownloadDto } from './dto/bulk-download.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly storageFactory: StorageProviderFactory,
    private readonly imageProcessor: ImageProcessorService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Check storage quota before upload
   * Throws ForbiddenException if tenant exceeds their storage limit
   */
  async checkStorageQuota(
    tenantId: string,
    newFileSizeBytes: number,
  ): Promise<void> {
    // Get tenant's subscription plan
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription_plan: true },
    });

    // If no plan or no storage limit, allow upload (unlimited)
    if (!tenant?.subscription_plan?.max_storage_gb) {
      return;
    }

    // Calculate current storage usage (exclude trashed files)
    const currentUsage = await this.prisma.file.aggregate({
      where: {
        tenant_id: tenantId,
        is_trashed: false,
      },
      _sum: {
        size_bytes: true,
      },
    });

    const currentBytes = currentUsage._sum.size_bytes || 0;
    const maxBytes =
      Number(tenant.subscription_plan.max_storage_gb) * 1024 * 1024 * 1024; // GB to bytes
    const newTotalBytes = currentBytes + newFileSizeBytes;

    if (newTotalBytes > maxBytes) {
      const currentGB = (currentBytes / (1024 * 1024 * 1024)).toFixed(2);
      const maxGB = Number(tenant.subscription_plan.max_storage_gb).toFixed(2);
      const fileSizeMB = (newFileSizeBytes / (1024 * 1024)).toFixed(2);

      throw new ForbiddenException(
        `Storage quota exceeded. You are using ${currentGB} GB of ${maxGB} GB. ` +
          `This file (${fileSizeMB} MB) would exceed your limit. ` +
          `Please upgrade your plan or delete some files to free up space.`,
      );
    }

    this.logger.log(
      `Storage quota check passed for tenant ${tenantId}: ` +
        `${((currentBytes / maxBytes) * 100).toFixed(1)}% used (${(currentBytes / (1024 * 1024 * 1024)).toFixed(2)} GB / ${Number(tenant.subscription_plan.max_storage_gb).toFixed(2)} GB)`,
    );
  }

  /**
   * Get tenant storage usage statistics
   * Returns current usage, quota limit, and percentage used
   */
  async getTenantStorageUsage(tenantId: string) {
    // Get tenant's subscription plan
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription_plan: true },
    });

    // Calculate current storage usage and file count (exclude trashed files)
    const [currentUsage, fileCount] = await Promise.all([
      this.prisma.file.aggregate({
        where: {
          tenant_id: tenantId,
          is_trashed: false,
        },
        _sum: {
          size_bytes: true,
        },
      }),
      this.prisma.file.count({
        where: {
          tenant_id: tenantId,
          is_trashed: false,
        },
      }),
    ]);

    const currentBytes = currentUsage._sum.size_bytes || 0;
    const currentGB = currentBytes / (1024 * 1024 * 1024);
    const maxStorageGB = tenant?.subscription_plan?.max_storage_gb
      ? Number(tenant.subscription_plan.max_storage_gb)
      : null;

    const isUnlimited = maxStorageGB === null;
    const percentageUsed = isUnlimited
      ? null
      : (currentGB / maxStorageGB) * 100;

    return {
      current_usage_bytes: currentBytes,
      current_usage_gb: Number(currentGB.toFixed(2)),
      max_storage_gb: maxStorageGB,
      percentage_used:
        percentageUsed !== null ? Number(percentageUsed.toFixed(2)) : null,
      is_unlimited: isUnlimited,
      file_count: fileCount,
    };
  }

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
          'image/webp',
          'image/heic',
          'image/heif',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      invoice: {
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
        ],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      license: {
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
        ],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      insurance: {
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
        ],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      logo: {
        allowedMimeTypes: [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/svg+xml',
          'image/webp',
        ],
        maxSizeBytes: 5 * 1024 * 1024, // 5MB
      },
      contract: {
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        maxSizeBytes: 15 * 1024 * 1024, // 15MB
      },
      receipt: {
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
        ],
        maxSizeBytes: 25 * 1024 * 1024, // 25MB — Sprint 11 requirement
      },
      photo: {
        allowedMimeTypes: [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          'image/heic',
          'image/heif',
        ],
        maxSizeBytes: 20 * 1024 * 1024, // 20MB
      },
      report: {
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        maxSizeBytes: 25 * 1024 * 1024, // 25MB
      },
      signature: {
        allowedMimeTypes: [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
        ],
        maxSizeBytes: 2 * 1024 * 1024, // 2MB
      },
      misc: {
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
        ],
        maxSizeBytes: 20 * 1024 * 1024, // 20MB for misc files
      },
    };

    return rules[category];
  }

  /**
   * Upload a file with optimization and thumbnail generation
   */
  async uploadFile(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    uploadDto: UploadFileDto,
  ) {
    // Get validation rules by category
    const validationRules = this.getValidationRules(uploadDto.category);

    // Validate file type
    if (!validationRules.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${validationRules.allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file size
    if (file.size > validationRules.maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds ${(validationRules.maxSizeBytes / (1024 * 1024)).toFixed(2)}MB limit`,
      );
    }

    // Check storage quota before upload
    await this.checkStorageQuota(tenantId, file.size);

    // Get storage provider for this tenant
    const storageProvider = await this.storageFactory.getProvider(tenantId);

    let processedBuffer = file.buffer;
    let originalSize = file.size;
    let thumbnailResult: any = null;
    let imageMetadata: any = null;

    // Process image if it's an image file
    if (this.imageProcessor.isImage(file.mimetype)) {
      const processed = await this.imageProcessor.processImage(
        file.buffer,
        file.mimetype,
        tenantId,
      );

      processedBuffer = processed.processedBuffer;
      originalSize = processed.originalSize;
      imageMetadata = {
        width: processed.width,
        height: processed.height,
        is_optimized: processed.wasOptimized,
        optimization_quality: 85,
      };

      // Upload thumbnail if generated
      if (processed.thumbnailBuffer) {
        thumbnailResult = await storageProvider.uploadThumbnail({
          originalFilename: `thumb_${file.originalname}`,
          mimeType: 'image/webp',
          buffer: processed.thumbnailBuffer,
          category: uploadDto.category,
          tenantId,
        });
      }
    }

    // Upload main file using storage provider
    const uploadResult = await storageProvider.upload({
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      buffer: processedBuffer,
      category: uploadDto.category,
      tenantId,
    });

    // Create File record in database
    const fileRecord = await this.prisma.file.create({
      data: {
        id: randomBytes(16).toString('hex'),
        file_id: uploadResult.fileId,
        tenant_id: tenantId,
        uploaded_by: userId,
        original_filename: file.originalname,
        mime_type: file.mimetype,
        size_bytes: uploadResult.size,
        original_size_bytes: originalSize,
        category: uploadDto.category,
        storage_path: uploadResult.storagePath,
        storage_provider: storageProvider.getProviderType(),
        s3_bucket: uploadResult.bucket,
        s3_key: uploadResult.key,
        s3_region: uploadResult.region,
        entity_type: uploadDto.entity_type || null,
        entity_id: uploadDto.entity_id || null,
        is_orphan: !uploadDto.entity_id,
        width: imageMetadata?.width,
        height: imageMetadata?.height,
        is_optimized: imageMetadata?.is_optimized || false,
        optimization_quality: imageMetadata?.optimization_quality,
        has_thumbnail: !!thumbnailResult,
        thumbnail_path: thumbnailResult?.storagePath,
        thumbnail_s3_key: thumbnailResult?.key,
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
        storage_provider: fileRecord.storage_provider,
      },
      description: `File "${fileRecord.original_filename}" uploaded`,
      metadata: {
        category: uploadDto.category,
        entity_type: uploadDto.entity_type,
        entity_id: uploadDto.entity_id,
        was_optimized: imageMetadata?.is_optimized || false,
        has_thumbnail: !!thumbnailResult,
      },
    });

    return {
      message: 'File uploaded successfully',
      file_id: uploadResult.fileId,
      url: uploadResult.url,
      file: {
        id: fileRecord.id,
        file_id: fileRecord.file_id,
        original_filename: fileRecord.original_filename,
        mime_type: fileRecord.mime_type,
        size_bytes: fileRecord.size_bytes,
        original_size_bytes: fileRecord.original_size_bytes,
        category: fileRecord.category,
        url: uploadResult.url,
        has_thumbnail: fileRecord.has_thumbnail,
        is_optimized: fileRecord.is_optimized,
        width: fileRecord.width,
        height: fileRecord.height,
        created_at: fileRecord.created_at,
      },
    };
  }

  /**
   * Find one file by ID
   * @param tenantId - Tenant ID for authenticated requests, null for public access
   * @param fileId - File ID
   */
  async findOne(tenantId: string | null, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: {
        file_id: fileId,
        ...(tenantId && { tenant_id: tenantId }), // Filter by tenant only if authenticated
        is_trashed: false, // Don't show trashed files
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Security check: If not authenticated, verify file is part of active public quote
    if (!tenantId) {
      const isPublic = await this.isFilePubliclyAccessible(file.id);
      if (!isPublic) {
        throw new NotFoundException('File not found'); // Don't reveal it exists
      }
    }

    // Get URL from storage (use file's tenant_id for storage lookup)
    const fileInfo = await this.fileStorage.getFileInfo(file.tenant_id, fileId);

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
  async findAll(tenantId: string | null, query: FileQueryDto) {
    const {
      category,
      entity_type,
      entity_id,
      file_type,
      start_date,
      end_date,
      search,
      page = 1,
      limit = 20,
    } = query;

    // Build where clause
    const where: any = {
      is_trashed: false, // Don't show trashed files
    };

    // Only filter by tenant_id if provided (null for platform admins viewing all files)
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    if (category) {
      where.category = category;
    }

    if (entity_type) {
      where.entity_type = entity_type;
    }

    if (entity_id) {
      where.entity_id = entity_id;
    }

    // Filter by file type (image, pdf, document)
    if (file_type) {
      if (file_type === 'image') {
        where.mime_type = { startsWith: 'image/' };
      } else if (file_type === 'pdf') {
        where.mime_type = 'application/pdf';
      } else if (file_type === 'document') {
        where.mime_type = {
          in: [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
          ],
        };
      }
    }

    // Filter by date range
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(start_date);
      }
      if (end_date) {
        where.created_at.lte = new Date(end_date);
      }
    }

    // Search by filename (MySQL is case-insensitive by default for string comparisons)
    if (search) {
      where.original_filename = {
        contains: search,
      };
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
        tenant_id: true,
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
        const fileInfo = await this.fileStorage.getFileInfo(
          file.tenant_id,
          file.file_id,
        );
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

    // Hard delete from filesystem - delete main file
    await this.fileStorage.deleteFileByPath(file.storage_path);

    // Delete thumbnail if exists
    if (file.has_thumbnail && file.thumbnail_path) {
      try {
        await this.fileStorage.deleteFileByPath(file.thumbnail_path);
        this.logger.log(
          `Deleted thumbnail for file ${fileId}: ${file.thumbnail_path}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to delete thumbnail for file ${fileId}: ${error.message}`,
        );
        // Don't fail the whole operation if thumbnail deletion fails
      }
    }

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
        has_thumbnail: file.has_thumbnail,
        thumbnail_path: file.thumbnail_path,
      },
      description: `File "${file.original_filename}" deleted`,
      metadata: {
        category: file.category,
        entity_type: file.entity_type,
        entity_id: file.entity_id,
        thumbnail_deleted: file.has_thumbnail,
      },
    });

    return { message: 'File deleted successfully' };
  }

  /**
   * Find orphan files (files not attached to any entity)
   *
   * Orphan detection excludes files that are:
   * - Linked to quotes as latest PDF (quote.latest_pdf_file_id)
   * - Have entity_id set (attached to an entity)
   * - Created within the last 30 days
   * - Already trashed
   */
  async findOrphans(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all file IDs that are linked as latest PDFs in quotes (exclude from orphan detection)
    const linkedPdfFileIds = await this.getLinkedPdfFileIds(tenantId);

    // Find files where entity_id is null and created > 30 days ago
    // EXCLUDE files that are linked as latest PDFs
    const orphans = await this.prisma.file.findMany({
      where: {
        tenant_id: tenantId,
        entity_id: null,
        created_at: {
          lte: thirtyDaysAgo,
        },
        is_trashed: false,
        id: {
          notIn: linkedPdfFileIds.length > 0 ? linkedPdfFileIds : undefined, // ✅ CRITICAL: Exclude linked PDFs from orphan detection
        },
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
        const fileInfo = await this.fileStorage.getFileInfo(
          tenantId,
          file.file_id,
        );
        return {
          ...file,
          url: fileInfo.url,
          days_orphaned: file.orphaned_at
            ? Math.floor(
                (Date.now() - new Date(file.orphaned_at).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : Math.floor(
                (Date.now() - new Date(file.created_at).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
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

    // Hard delete from filesystem - delete main files
    await Promise.all(
      trashedFiles.map((file) =>
        this.fileStorage.deleteFileByPath(file.storage_path),
      ),
    );

    // Delete thumbnails if they exist
    await Promise.all(
      trashedFiles
        .filter((f) => f.has_thumbnail && f.thumbnail_path)
        .map(async (file) => {
          try {
            await this.fileStorage.deleteFileByPath(file.thumbnail_path!);
            this.logger.log(
              `Deleted thumbnail for trashed file ${file.file_id}`,
            );
          } catch (error) {
            this.logger.warn(
              `Failed to delete thumbnail for file ${file.file_id}: ${error.message}`,
            );
          }
        }),
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

  /**
   * Get all file IDs that are linked as latest PDFs in quotes
   *
   * These files must NOT be marked as orphans even if they have no entity_id,
   * because they are actively referenced by quotes.
   *
   * @param tenantId - Tenant ID
   * @returns Array of file IDs that are linked as latest PDFs
   */
  private async getLinkedPdfFileIds(tenantId: string): Promise<string[]> {
    const quotes = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        latest_pdf_file_id: { not: null },
      },
      select: {
        latest_pdf_file_id: true,
      },
    });

    // Filter out nulls and return unique file IDs
    const fileIds = quotes
      .map((q) => q.latest_pdf_file_id)
      .filter((id): id is string => id !== null);

    this.logger.debug(
      `Found ${fileIds.length} linked PDF files for tenant ${tenantId} (excluded from orphan detection)`,
    );

    return fileIds;
  }

  /**
   * Create a temporary share link for a file
   */
  async createShareLink(
    tenantId: string,
    userId: string,
    dto: CreateShareLinkDto,
  ) {
    // Verify file exists and belongs to tenant
    const file = await this.prisma.file.findFirst({
      where: {
        file_id: dto.file_id,
        tenant_id: tenantId,
        is_trashed: false,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Generate cryptographically secure share token (64-char hex = 256 bits)
    const shareToken = randomBytes(32).toString('hex');

    // Hash password if provided
    let passwordHash: string | null = null;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    // Parse expiration date if provided
    const expiresAt = dto.expires_at ? new Date(dto.expires_at) : null;

    // Create share link record
    const shareLink = await this.prisma.file_share_link.create({
      data: {
        id: randomBytes(16).toString('hex'),
        tenant_id: tenantId,
        file_id: dto.file_id,
        share_token: shareToken,
        password_hash: passwordHash,
        expires_at: expiresAt,
        max_downloads: dto.max_downloads || null,
        created_by: userId,
      },
    });

    // Create audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'file_share_link',
      entityId: shareLink.id,
      tenantId: tenantId,
      actorUserId: userId,
      after: {
        id: shareLink.id,
        file_id: shareLink.file_id,
        share_token: shareToken,
        has_password: !!passwordHash,
        expires_at: expiresAt,
        max_downloads: dto.max_downloads,
      },
      description: `Share link created for file "${file.original_filename}"`,
      metadata: {
        file_id: dto.file_id,
        has_password: !!passwordHash,
      },
    });

    // Return share link with public URL
    const shareUrl = `/public/share/${shareToken}`;

    return {
      message: 'Share link created successfully',
      share_link: {
        id: shareLink.id,
        share_token: shareToken,
        share_url: shareUrl,
        file_id: shareLink.file_id,
        expires_at: shareLink.expires_at,
        max_downloads: shareLink.max_downloads,
        download_count: shareLink.download_count,
        view_count: shareLink.view_count,
        has_password: !!passwordHash,
        created_at: shareLink.created_at,
      },
    };
  }

  /**
   * Validate share link (password, expiration, max downloads, etc.)
   * Returns the share link if valid, throws exception otherwise
   *
   * @private
   * @param shareToken - Share token
   * @param password - Optional password for password-protected links
   * @param checkDownloadLimit - Whether to check max_downloads limit (true for downloads, false for views)
   * @returns Valid share link with file data
   */
  private async validateShareLink(
    shareToken: string,
    password?: string,
    checkDownloadLimit: boolean = false,
  ) {
    // Find share link by token
    const shareLink = await this.prisma.file_share_link.findUnique({
      where: { share_token: shareToken },
      include: { file: true },
    });

    if (!shareLink) {
      throw new NotFoundException('Share link not found');
    }

    if (!shareLink.is_active) {
      throw new BadRequestException('This share link has been revoked');
    }

    if (shareLink.expires_at && new Date() > shareLink.expires_at) {
      throw new BadRequestException('This share link has expired');
    }

    // Check download limit only for downloads, not views
    if (
      checkDownloadLimit &&
      shareLink.max_downloads &&
      shareLink.download_count >= shareLink.max_downloads
    ) {
      throw new BadRequestException('Maximum download limit reached');
    }

    // Verify password if required
    if (shareLink.password_hash) {
      if (!password) {
        throw new UnauthorizedException('Password required');
      }
      const passwordValid = await bcrypt.compare(
        password,
        shareLink.password_hash,
      );
      if (!passwordValid) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    return shareLink;
  }

  /**
   * View/access a shared file (increments view_count, not download_count)
   * Public endpoint, no authentication required
   *
   * @param shareToken - Share token (64-char hex)
   * @param dto - Access DTO with optional password
   * @returns File information and share link stats
   */
  async viewShareLink(shareToken: string, dto: AccessShareLinkDto) {
    // Validate share link (no download limit check for views)
    const shareLink = await this.validateShareLink(
      shareToken,
      dto.password,
      false,
    );

    // Increment view_count (not download_count)
    await this.prisma.file_share_link.update({
      where: { id: shareLink.id },
      data: {
        view_count: shareLink.view_count + 1,
        last_accessed_at: new Date(),
      },
    });

    // Get file URL from storage
    const storageProvider = await this.storageFactory.getProvider(
      shareLink.tenant_id,
    );
    const fileUrl = await storageProvider.getFileUrl(
      shareLink.file.file_id,
      shareLink.file.storage_path,
    );

    return {
      message: 'Access granted',
      file: {
        file_id: shareLink.file.file_id,
        original_filename: shareLink.file.original_filename,
        mime_type: shareLink.file.mime_type,
        size_bytes: shareLink.file.size_bytes,
        url: fileUrl,
        has_thumbnail: shareLink.file.has_thumbnail,
        width: shareLink.file.width,
        height: shareLink.file.height,
      },
      share_info: {
        view_count: shareLink.view_count + 1,
        download_count: shareLink.download_count,
        max_downloads: shareLink.max_downloads,
        expires_at: shareLink.expires_at,
      },
    };
  }

  /**
   * Download a shared file (increments download_count)
   * Public endpoint, no authentication required
   *
   * @param shareToken - Share token (64-char hex)
   * @param dto - Access DTO with optional password
   * @returns File information and share link stats
   */
  async downloadShareLink(shareToken: string, dto: AccessShareLinkDto) {
    // Validate share link (check download limit for downloads)
    const shareLink = await this.validateShareLink(
      shareToken,
      dto.password,
      true,
    );

    // Increment download_count
    await this.prisma.file_share_link.update({
      where: { id: shareLink.id },
      data: {
        download_count: shareLink.download_count + 1,
        last_accessed_at: new Date(),
      },
    });

    // Get file URL from storage
    const storageProvider = await this.storageFactory.getProvider(
      shareLink.tenant_id,
    );
    const fileUrl = await storageProvider.getFileUrl(
      shareLink.file.file_id,
      shareLink.file.storage_path,
    );

    return {
      message: 'Download granted',
      file: {
        file_id: shareLink.file.file_id,
        original_filename: shareLink.file.original_filename,
        mime_type: shareLink.file.mime_type,
        size_bytes: shareLink.file.size_bytes,
        url: fileUrl,
        has_thumbnail: shareLink.file.has_thumbnail,
        width: shareLink.file.width,
        height: shareLink.file.height,
      },
      share_info: {
        view_count: shareLink.view_count,
        download_count: shareLink.download_count + 1,
        max_downloads: shareLink.max_downloads,
        expires_at: shareLink.expires_at,
      },
    };
  }

  /**
   * Access a shared file (public endpoint, no tenant check)
   * @deprecated Use viewShareLink() or downloadShareLink() instead
   */
  async accessShareLink(shareToken: string, dto: AccessShareLinkDto) {
    // Find share link by token
    const shareLink = await this.prisma.file_share_link.findUnique({
      where: { share_token: shareToken },
      include: {
        file: true,
      },
    });

    if (!shareLink) {
      throw new NotFoundException('Share link not found');
    }

    // Check if share link is active
    if (!shareLink.is_active) {
      throw new BadRequestException('This share link has been revoked');
    }

    // Check if expired
    if (shareLink.expires_at && new Date() > shareLink.expires_at) {
      throw new BadRequestException('This share link has expired');
    }

    // Check if max downloads reached
    if (
      shareLink.max_downloads &&
      shareLink.download_count >= shareLink.max_downloads
    ) {
      throw new BadRequestException('Maximum download limit reached');
    }

    // Verify password if required
    if (shareLink.password_hash) {
      if (!dto.password) {
        throw new UnauthorizedException('Password required');
      }

      const passwordValid = await bcrypt.compare(
        dto.password,
        shareLink.password_hash,
      );
      if (!passwordValid) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    // Increment download count and update last_accessed_at
    await this.prisma.file_share_link.update({
      where: { id: shareLink.id },
      data: {
        download_count: shareLink.download_count + 1,
        last_accessed_at: new Date(),
      },
    });

    // Get file URL from storage
    const storageProvider = await this.storageFactory.getProvider(
      shareLink.tenant_id,
    );
    const fileUrl = await storageProvider.getFileUrl(
      shareLink.file.file_id,
      shareLink.file.storage_path,
    );

    return {
      message: 'Access granted',
      file: {
        file_id: shareLink.file.file_id,
        original_filename: shareLink.file.original_filename,
        mime_type: shareLink.file.mime_type,
        size_bytes: shareLink.file.size_bytes,
        url: fileUrl,
        has_thumbnail: shareLink.file.has_thumbnail,
        width: shareLink.file.width,
        height: shareLink.file.height,
      },
      share_info: {
        download_count: shareLink.download_count + 1,
        max_downloads: shareLink.max_downloads,
        expires_at: shareLink.expires_at,
      },
    };
  }

  /**
   * Revoke a share link
   */
  async revokeShareLink(tenantId: string, userId: string, shareLinkId: string) {
    // Find share link
    const shareLink = await this.prisma.file_share_link.findFirst({
      where: {
        id: shareLinkId,
        tenant_id: tenantId,
      },
    });

    if (!shareLink) {
      throw new NotFoundException('Share link not found');
    }

    // Mark as inactive
    await this.prisma.file_share_link.update({
      where: { id: shareLinkId },
      data: { is_active: false },
    });

    // Create audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'file_share_link',
      entityId: shareLinkId,
      tenantId: tenantId,
      actorUserId: userId,
      before: { is_active: true },
      after: { is_active: false },
      description: `Share link revoked`,
      metadata: {
        file_id: shareLink.file_id,
        share_token: shareLink.share_token,
      },
    });

    return { message: 'Share link revoked successfully' };
  }

  /**
   * List share links for a file
   */
  async listShareLinks(tenantId: string, fileId?: string) {
    const where: any = {
      tenant_id: tenantId,
    };

    if (fileId) {
      where.file_id = fileId;
    }

    const shareLinks = await this.prisma.file_share_link.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        file: {
          select: {
            file_id: true,
            original_filename: true,
            mime_type: true,
          },
        },
      },
    });

    return {
      share_links: shareLinks.map((link) => ({
        id: link.id,
        share_token: link.share_token,
        share_url: `/public/share/${link.share_token}`,
        file_id: link.file_id,
        file_name: link.file.original_filename,
        has_password: !!link.password_hash,
        expires_at: link.expires_at,
        max_downloads: link.max_downloads,
        download_count: link.download_count,
        is_active: link.is_active,
        created_at: link.created_at,
        last_accessed_at: link.last_accessed_at,
      })),
      total: shareLinks.length,
    };
  }

  /**
   * Bulk delete files
   */
  async bulkDelete(tenantId: string, userId: string, dto: BulkDeleteDto) {
    // Verify all files exist and belong to tenant
    const files = await this.prisma.file.findMany({
      where: {
        file_id: { in: dto.file_ids },
        tenant_id: tenantId,
      },
    });

    if (files.length !== dto.file_ids.length) {
      throw new BadRequestException(
        'Some files not found or do not belong to this tenant',
      );
    }

    // Get storage provider
    const storageProvider = await this.storageFactory.getProvider(tenantId);

    // Delete from storage
    await Promise.all(
      files.map((file) =>
        storageProvider.delete(file.file_id, file.storage_path),
      ),
    );

    // Delete thumbnails if they exist
    await Promise.all(
      files
        .filter((f) => f.has_thumbnail && f.thumbnail_path)
        .map((file) =>
          storageProvider.delete(file.file_id, file.thumbnail_path!),
        ),
    );

    // Delete from database
    await this.prisma.file.deleteMany({
      where: {
        id: { in: files.map((f) => f.id) },
      },
    });

    // Create audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'file',
      entityId: tenantId,
      tenantId: tenantId,
      actorUserId: userId,
      before: {
        count: files.length,
        files: files.map((f) => ({
          id: f.id,
          file_id: f.file_id,
          original_filename: f.original_filename,
        })),
      },
      description: `${files.length} files bulk deleted`,
      metadata: {
        operation: 'bulk_delete',
        file_ids: dto.file_ids,
        file_count: files.length,
      },
    });

    return {
      message: `${files.length} files deleted successfully`,
      count: files.length,
    };
  }

  /**
   * Bulk download files as ZIP
   *
   * @param tenantId - Tenant ID
   * @param userId - User ID (for audit log)
   * @param dto - Bulk download DTO
   * @returns ZIP buffer
   */
  async bulkDownload(
    tenantId: string,
    userId: string,
    dto: BulkDownloadDto,
  ): Promise<Buffer> {
    const { file_ids, zip_name } = dto;

    // Validation
    if (!file_ids || file_ids.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (file_ids.length > 50) {
      throw new BadRequestException(
        'Cannot download more than 50 files at once',
      );
    }

    // Get storage provider for tenant
    const provider = await this.storageFactory.getProvider(tenantId);

    // Fetch all files from database
    const files = await this.prisma.file.findMany({
      where: {
        id: { in: file_ids },
        tenant_id: tenantId,
        is_trashed: false,
      },
      select: {
        id: true,
        storage_path: true,
        original_filename: true,
        mime_type: true,
      },
    });

    if (files.length === 0) {
      throw new NotFoundException('No files found');
    }

    // Create ZIP archive
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    const zipPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      archive.on('error', (err: Error) => {
        reject(err);
      });
    });

    // Download and add each file to archive
    for (const file of files) {
      try {
        const fileBuffer = await provider.download(file.id, file.storage_path);
        archive.append(fileBuffer, { name: file.original_filename });
      } catch (error) {
        this.logger.warn(
          `Failed to download file ${file.id}: ${error.message}`,
        );
        // Continue with other files
      }
    }

    archive.finalize();

    const zipBuffer = await zipPromise;

    // Audit log
    await this.auditLogger.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'file',
      entity_id: file_ids[0] || 'bulk_operation',
      action_type: 'accessed',
      description: `${files.length} files bulk downloaded`,
      before_json: {
        count: files.length,
        files: files.map((f) => ({
          id: f.id,
          original_filename: f.original_filename,
        })),
      },
      metadata_json: {
        operation: 'bulk_download',
        file_ids,
        file_count: files.length,
        zip_size: zipBuffer.length,
      },
    });

    return zipBuffer;
  }

  // ============================================================================
  // ADMIN METHODS (Platform Admin Only - Bypass Tenant Isolation)
  // ============================================================================

  /**
   * List all files for Platform Admin (bypasses tenant isolation)
   * Optionally filter by tenant_id if provided
   */
  async findAllForAdmin(query: any) {
    const {
      tenant_id,
      page = 1,
      limit = 50,
      status,
      mime_type,
      search,
      category,
      entity_type,
      file_type,
    } = query;

    // Enforce max limit
    const safeLimit = Math.min(limit, 100);

    const where: any = {};

    // Only filter by tenant if provided
    if (tenant_id) {
      where.tenant_id = tenant_id;
    }

    if (status === 'deleted') {
      where.is_trashed = true;
    } else if (status === 'active') {
      where.is_trashed = false;
    }

    if (mime_type) {
      where.mime_type = mime_type;
    }

    if (search) {
      where.original_filename = { contains: search };
    }

    if (category) {
      where.category = category;
    }

    if (entity_type) {
      where.entity_type = entity_type;
    }

    // Filter by file type (image, document, other)
    if (file_type) {
      if (file_type === 'image') {
        where.mime_type = {
          startsWith: 'image/',
        };
      } else if (file_type === 'document') {
        where.OR = [
          { mime_type: { startsWith: 'application/pdf' } },
          { mime_type: { contains: 'document' } },
          { mime_type: { contains: 'word' } },
          { mime_type: { contains: 'excel' } },
          { mime_type: { contains: 'spreadsheet' } },
          { mime_type: { startsWith: 'text/' } },
        ];
      } else if (file_type === 'other') {
        where.NOT = {
          OR: [
            { mime_type: { startsWith: 'image/' } },
            { mime_type: { startsWith: 'application/pdf' } },
            { mime_type: { contains: 'document' } },
            { mime_type: { contains: 'word' } },
            { mime_type: { contains: 'excel' } },
            { mime_type: { contains: 'spreadsheet' } },
            { mime_type: { startsWith: 'text/' } },
          ],
        };
      }
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        include: {
          tenant_file_tenant_idTotenant: {
            select: {
              id: true,
              company_name: true,
            },
          },
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
        skip: (page - 1) * safeLimit,
        take: safeLimit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      data: files,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / safeLimit),
        total_count: total,
        limit: safeLimit,
      },
    };
  }

  /**
   * Get file by ID for Platform Admin (bypasses tenant isolation)
   */
  async getFileByIdForAdmin(fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        tenant_file_tenant_idTotenant: {
          select: {
            id: true,
            company_name: true,
          },
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        file_share_links: {
          select: {
            id: true,
            share_token: true,
            password_hash: true,
            expires_at: true,
            download_count: true,
            view_count: true,
            is_active: true,
            created_at: true,
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    return file;
  }

  /**
   * Delete file for Platform Admin (bypasses tenant isolation)
   * Soft deletes from database and removes from storage
   */
  async deleteFileForAdmin(fileId: string, adminUserId: string) {
    const file = await this.getFileByIdForAdmin(fileId);

    if (file.is_trashed) {
      throw new BadRequestException('File is already deleted');
    }

    // Try to delete from storage (best effort)
    try {
      // Delete main file
      await this.fileStorage.deleteFileByPath(file.storage_path);

      // Delete thumbnail if exists
      if (file.has_thumbnail && file.thumbnail_path) {
        await this.fileStorage.deleteFileByPath(file.thumbnail_path);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete file from storage: ${error.message}`);
      // Continue with database soft delete even if storage delete fails
    }

    // Soft delete in database
    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        is_trashed: true,
        trashed_at: new Date(),
      },
    });

    // Audit log
    await this.auditLogger.log({
      tenant_id: file.tenant_id,
      actor_user_id: adminUserId,
      actor_type: 'user',
      entity_type: 'file',
      entity_id: fileId,
      action_type: 'deleted',
      description: `File "${file.original_filename}" deleted by Platform Admin`,
      before_json: {
        id: file.id,
        original_filename: file.original_filename,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        tenant_id: file.tenant_id,
        tenant_name: file.tenant_file_tenant_idTotenant.company_name,
      },
      metadata_json: {
        admin_action: true,
        admin_user_id: adminUserId,
        storage_provider: file.storage_provider,
        category: file.category,
      },
    });

    return { success: true, message: 'File deleted successfully' };
  }

  /**
   * Get storage statistics by tenant for Platform Admin
   * Shows storage consumption per tenant
   */
  async getStorageStatsByTenant() {
    const stats = await this.prisma.file.groupBy({
      by: ['tenant_id'],
      where: {
        is_trashed: false,
      },
      _count: {
        id: true,
      },
      _sum: {
        size_bytes: true,
      },
    });

    // Fetch tenant names
    const tenantIds = stats.map((s) => s.tenant_id);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, company_name: true },
    });

    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    return stats
      .map((stat) => {
        const tenant = tenantMap.get(stat.tenant_id);
        const fileCount = stat._count?.id || 0;
        const totalBytes = stat._sum?.size_bytes || 0;
        return {
          tenant_id: stat.tenant_id,
          tenant_name: tenant?.company_name || 'Unknown',
          file_count: fileCount,
          total_bytes: totalBytes,
          total_mb: (totalBytes / (1024 * 1024)).toFixed(2),
        };
      })
      .sort((a, b) => b.total_bytes - a.total_bytes); // Sort by size descending
  }

  /**
   * Get all share links for Platform Admin (bypasses tenant isolation)
   * Optionally filter by tenant_id
   */
  async getAllShareLinksForAdmin(query: any) {
    const { tenant_id, active_only = false, page = 1, limit = 50 } = query;

    // Enforce max limit
    const safeLimit = Math.min(limit, 100);

    const where: any = {};

    if (tenant_id) {
      where.tenant_id = tenant_id;
    }

    if (active_only) {
      where.is_active = true;
      where.OR = [{ expires_at: null }, { expires_at: { gt: new Date() } }];
    }

    const [shareLinks, total] = await Promise.all([
      this.prisma.file_share_link.findMany({
        where,
        include: {
          file: {
            select: {
              id: true,
              original_filename: true,
              mime_type: true,
              size_bytes: true,
              category: true,
            },
          },
          tenant: {
            select: {
              id: true,
              company_name: true,
            },
          },
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
        skip: (page - 1) * safeLimit,
        take: safeLimit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.file_share_link.count({ where }),
    ]);

    return {
      data: shareLinks,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / safeLimit),
        total_count: total,
        limit: safeLimit,
      },
    };
  }

  /**
   * Get platform-wide file statistics for admin dashboard
   */
  async getFileStatsForAdmin() {
    const [
      totalFiles,
      totalDeleted,
      totalSize,
      filesByCategory,
      filesByMimeType,
      orphanFiles,
    ] = await Promise.all([
      this.prisma.file.count({ where: { is_trashed: false } }),
      this.prisma.file.count({ where: { is_trashed: true } }),
      this.prisma.file.aggregate({
        where: { is_trashed: false },
        _sum: { size_bytes: true },
      }),
      this.prisma.file.groupBy({
        by: ['category'],
        where: { is_trashed: false },
        _count: { id: true },
      }),
      this.prisma.file.groupBy({
        by: ['mime_type'],
        where: { is_trashed: false },
        _count: { id: true },
      }),
      this.prisma.file.count({
        where: {
          is_trashed: false,
          is_orphan: true,
        },
      }),
    ]);

    return {
      total_files: totalFiles,
      total_deleted: totalDeleted,
      total_size_bytes: totalSize._sum.size_bytes || 0,
      total_size_mb: ((totalSize._sum.size_bytes || 0) / (1024 * 1024)).toFixed(
        2,
      ),
      orphan_files: orphanFiles,
      by_category: filesByCategory.map((item) => ({
        category: item.category,
        count: item._count?.id || 0,
      })),
      by_mime_type: filesByMimeType
        .map((item) => ({
          mime_type: item.mime_type,
          count: item._count?.id || 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10), // Top 10 MIME types
    };
  }

  /**
   * Check if a file is publicly accessible (part of an active public quote)
   * Files are public if they are:
   * - Tenant logo
   * - Vendor signature
   * - Quote PDF
   * - Quote attachment
   * AND the quote has an active public access token
   */
  private async isFilePubliclyAccessible(fileId: string): Promise<boolean> {
    // Check if file is a tenant logo with active public quotes
    const tenantLogo = await this.prisma.tenant.findFirst({
      where: {
        logo_file_id: fileId,
        quotes: {
          some: {
            public_access: {
              some: {
                is_active: true,
                OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
              },
            },
          },
        },
      },
    });
    if (tenantLogo) return true;

    // Check if file is a vendor signature with active public quotes
    const vendorSignature = await this.prisma.vendor.findFirst({
      where: {
        signature_file_id: fileId,
        quotes: {
          some: {
            public_access: {
              some: {
                is_active: true,
                OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
              },
            },
          },
        },
      },
    });
    if (vendorSignature) return true;

    // Check if file is a quote PDF or attachment
    const quoteFile = await this.prisma.quote.findFirst({
      where: {
        OR: [
          { latest_pdf_file_id: fileId },
          {
            attachments: {
              some: { file_id: fileId },
            },
          },
        ],
        public_access: {
          some: {
            is_active: true,
            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
          },
        },
      },
    });
    if (quoteFile) return true;

    return false;
  }
}
