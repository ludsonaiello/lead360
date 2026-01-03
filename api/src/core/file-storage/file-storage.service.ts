import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

export interface FileMetadata {
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
}

export interface UploadOptions {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  category: 'quote' | 'invoice' | 'license' | 'insurance' | 'misc' | 'logo';
}

@Injectable()
export class FileStorageService {
  private readonly uploadBasePath: string;

  constructor(private configService: ConfigService) {
    // Resolve path relative to API directory (../uploads/public from /var/www/lead360.app/api)
    const uploadsPath = this.configService.get<string>('UPLOADS_PATH') || '../uploads/public';
    this.uploadBasePath = resolve(__dirname, '../../..', uploadsPath);
  }

  /**
   * Upload a logo file for a tenant
   */
  async uploadLogo(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ file_id: string; url: string }> {
    // Validate file type
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed for logos.',
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit.');
    }

    // Generate unique file ID
    const fileId = randomUUID();
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;

    // Create directory structure: uploads/public/{tenant}/images/
    const tenantDir = join(this.uploadBasePath, tenantId, 'images');
    await fs.mkdir(tenantDir, { recursive: true });

    // Save file
    const filePath = join(tenantDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    // Return file ID and public URL
    const url = `/public/${tenantId}/images/${fileName}`;

    return { file_id: fileId, url };
  }

  /**
   * Upload a document file (license, insurance, etc.)
   */
  async uploadDocument(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ file_id: string; url: string }> {
    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF, PNG, JPG, and JPEG are allowed for documents.',
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit.');
    }

    // Generate unique file ID
    const fileId = randomUUID();
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;

    // Create directory structure: uploads/public/{tenant}/files/
    const tenantDir = join(this.uploadBasePath, tenantId, 'files');
    await fs.mkdir(tenantDir, { recursive: true });

    // Save file
    const filePath = join(tenantDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    // Return file ID and public URL
    const url = `/public/${tenantId}/files/${fileName}`;

    return { file_id: fileId, url };
  }

  /**
   * Delete a file
   */
  async deleteFile(tenantId: string, fileId: string, fileType: 'image' | 'file'): Promise<void> {
    const folder = fileType === 'image' ? 'images' : 'files';
    const dir = join(this.uploadBasePath, tenantId, folder);

    // Find file by ID (we don't know the extension)
    const files = await fs.readdir(dir);
    const fileToDelete = files.find((f) => f.startsWith(fileId));

    if (fileToDelete) {
      const filePath = join(dir, fileToDelete);
      await fs.unlink(filePath);
    }
  }

  /**
   * Generic file upload with configurable validation
   */
  async uploadFile(
    tenantId: string,
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<{ file_id: string; url: string; metadata: FileMetadata }> {
    // Validate file type
    if (!options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${options.allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file size
    if (file.size > options.maxSizeBytes) {
      const maxSizeMB = (options.maxSizeBytes / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(`File size exceeds ${maxSizeMB}MB limit.`);
    }

    // Generate unique file ID
    const fileId = randomUUID();
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;

    // Determine folder based on category
    const folder = options.category === 'logo' ? 'images' : 'files';
    const tenantDir = join(this.uploadBasePath, tenantId, folder);
    await fs.mkdir(tenantDir, { recursive: true });

    // Save file
    const filePath = join(tenantDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    // Build storage path and URL
    const storagePath = join(tenantDir, fileName);
    const url = `/public/${tenantId}/${folder}/${fileName}`;

    // Build metadata
    const metadata: FileMetadata = {
      original_filename: file.originalname,
      mime_type: file.mimetype,
      size_bytes: file.size,
      storage_path: storagePath,
    };

    return { file_id: fileId, url, metadata };
  }

  /**
   * Get file information by file_id
   */
  async getFileInfo(
    tenantId: string,
    fileId: string,
  ): Promise<{
    exists: boolean;
    path?: string;
    url?: string;
  }> {
    // Search in both images/ and files/ directories
    const folders = ['images', 'files'];

    for (const folder of folders) {
      try {
        const dir = join(this.uploadBasePath, tenantId, folder);
        const files = await fs.readdir(dir);
        const foundFile = files.find((f) => f.startsWith(fileId));

        if (foundFile) {
          const filePath = join(dir, foundFile);
          const url = `/public/${tenantId}/${folder}/${foundFile}`;
          return { exists: true, path: filePath, url };
        }
      } catch (error) {
        // Directory doesn't exist, continue to next folder
        continue;
      }
    }

    return { exists: false };
  }

  /**
   * Delete file by storage path (for hard deletes)
   */
  async deleteFileByPath(storagePath: string): Promise<void> {
    try {
      await fs.unlink(storagePath);
    } catch (error) {
      // File doesn't exist or already deleted, ignore error
    }
  }
}
