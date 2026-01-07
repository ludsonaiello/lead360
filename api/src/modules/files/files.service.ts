import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
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
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      license: {
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      insurance: {
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      logo: {
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'],
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
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        maxSizeBytes: 5 * 1024 * 1024, // 5MB
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
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
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
    const { category, entity_type, entity_id, file_type, start_date, end_date, search, page = 1, limit = 20 } = query;

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

    // Hard delete from filesystem - delete main file
    await this.fileStorage.deleteFileByPath(file.storage_path);

    // Delete thumbnail if exists
    if (file.has_thumbnail && file.thumbnail_path) {
      try {
        await this.fileStorage.deleteFileByPath(file.thumbnail_path);
        this.logger.log(`Deleted thumbnail for file ${fileId}: ${file.thumbnail_path}`);
      } catch (error) {
        this.logger.warn(`Failed to delete thumbnail for file ${fileId}: ${error.message}`);
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

    // Hard delete from filesystem - delete main files
    await Promise.all(
      trashedFiles.map((file) => this.fileStorage.deleteFileByPath(file.storage_path)),
    );

    // Delete thumbnails if they exist
    await Promise.all(
      trashedFiles
        .filter((f) => f.has_thumbnail && f.thumbnail_path)
        .map(async (file) => {
          try {
            await this.fileStorage.deleteFileByPath(file.thumbnail_path!);
            this.logger.log(`Deleted thumbnail for trashed file ${file.file_id}`);
          } catch (error) {
            this.logger.warn(`Failed to delete thumbnail for file ${file.file_id}: ${error.message}`);
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
   * Create a temporary share link for a file
   */
  async createShareLink(tenantId: string, userId: string, dto: CreateShareLinkDto) {
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
    if (checkDownloadLimit && shareLink.max_downloads && shareLink.download_count >= shareLink.max_downloads) {
      throw new BadRequestException('Maximum download limit reached');
    }

    // Verify password if required
    if (shareLink.password_hash) {
      if (!password) {
        throw new UnauthorizedException('Password required');
      }
      const passwordValid = await bcrypt.compare(password, shareLink.password_hash);
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
    const shareLink = await this.validateShareLink(shareToken, dto.password, false);

    // Increment view_count (not download_count)
    await this.prisma.file_share_link.update({
      where: { id: shareLink.id },
      data: {
        view_count: shareLink.view_count + 1,
        last_accessed_at: new Date(),
      },
    });

    // Get file URL from storage
    const storageProvider = await this.storageFactory.getProvider(shareLink.tenant_id);
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
    const shareLink = await this.validateShareLink(shareToken, dto.password, true);

    // Increment download_count
    await this.prisma.file_share_link.update({
      where: { id: shareLink.id },
      data: {
        download_count: shareLink.download_count + 1,
        last_accessed_at: new Date(),
      },
    });

    // Get file URL from storage
    const storageProvider = await this.storageFactory.getProvider(shareLink.tenant_id);
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
    if (shareLink.max_downloads && shareLink.download_count >= shareLink.max_downloads) {
      throw new BadRequestException('Maximum download limit reached');
    }

    // Verify password if required
    if (shareLink.password_hash) {
      if (!dto.password) {
        throw new UnauthorizedException('Password required');
      }

      const passwordValid = await bcrypt.compare(dto.password, shareLink.password_hash);
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
    const storageProvider = await this.storageFactory.getProvider(shareLink.tenant_id);
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
      throw new BadRequestException('Some files not found or do not belong to this tenant');
    }

    // Get storage provider
    const storageProvider = await this.storageFactory.getProvider(tenantId);

    // Delete from storage
    await Promise.all(
      files.map((file) => storageProvider.delete(file.file_id, file.storage_path)),
    );

    // Delete thumbnails if they exist
    await Promise.all(
      files
        .filter((f) => f.has_thumbnail && f.thumbnail_path)
        .map((file) => storageProvider.delete(file.file_id, file.thumbnail_path!)),
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
  async bulkDownload(tenantId: string, userId: string, dto: BulkDownloadDto): Promise<Buffer> {
    const { file_ids, zip_name } = dto;

    // Validation
    if (!file_ids || file_ids.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (file_ids.length > 50) {
      throw new BadRequestException('Cannot download more than 50 files at once');
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
        this.logger.warn(`Failed to download file ${file.id}: ${error.message}`);
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
}
