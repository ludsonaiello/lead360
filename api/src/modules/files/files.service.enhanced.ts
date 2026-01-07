import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
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
        optimization_quality: 85, // Default quality
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
        uploaded_by: userId,
        entity_type: uploadDto.entity_type || null,
        entity_id: uploadDto.entity_id || null,
        is_orphan: !uploadDto.entity_id,
        // Image metadata
        width: imageMetadata?.width,
        height: imageMetadata?.height,
        is_optimized: imageMetadata?.is_optimized || false,
        optimization_quality: imageMetadata?.optimization_quality,
        // Thumbnail data
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

  // ... (continued in next part)
}
