import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import type {
  IStorageProvider,
  UploadOptions,
  UploadResult,
  StorageProviderConfig,
} from '../interfaces/storage-provider.interface';

/**
 * Local Filesystem Storage Provider
 *
 * Stores files on the local filesystem in the uploads/public/{tenant}/{folder} structure.
 * This is the default storage provider for the platform.
 */
@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;

  constructor(private readonly config: StorageProviderConfig) {
    this.basePath = config.localBasePath || resolve(__dirname, '../../../..', '../uploads/public');
    this.logger.log(`LocalStorageProvider initialized with base path: ${this.basePath}`);
  }

  /**
   * Upload a file to local filesystem
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    const { originalFilename, mimeType, buffer, category, tenantId } = options;

    // Generate unique file ID
    const fileId = randomUUID();
    const fileExtension = this.getFileExtension(originalFilename);
    const fileName = `${fileId}.${fileExtension}`;

    // Determine folder based on category
    const folder = category === 'logo' ? 'images' : 'files';
    const tenantDir = join(this.basePath, tenantId, folder);

    // Create directory if it doesn't exist
    await fs.mkdir(tenantDir, { recursive: true });

    // Save file
    const filePath = join(tenantDir, fileName);
    await fs.writeFile(filePath, buffer);

    // Build URL (relative to nginx public serving path)
    const url = `/public/${tenantId}/${folder}/${fileName}`;

    this.logger.log(`File uploaded: ${fileId} (${fileName}) to ${filePath}`);

    return {
      fileId,
      storagePath: filePath,
      url,
      size: buffer.length,
    };
  }

  /**
   * Upload a thumbnail to local filesystem
   */
  async uploadThumbnail(options: UploadOptions): Promise<UploadResult> {
    const { originalFilename, mimeType, buffer, tenantId } = options;

    // Generate unique file ID (reuse from parent file if provided)
    const fileId = randomUUID();
    const fileExtension = this.getFileExtension(originalFilename);
    const fileName = `${fileId}_thumb.${fileExtension}`;

    // Thumbnails go in images folder
    const folder = 'images';
    const tenantDir = join(this.basePath, tenantId, folder);

    // Create directory if it doesn't exist
    await fs.mkdir(tenantDir, { recursive: true });

    // Save thumbnail
    const filePath = join(tenantDir, fileName);
    await fs.writeFile(filePath, buffer);

    // Build URL
    const url = `/public/${tenantId}/${folder}/${fileName}`;

    this.logger.log(`Thumbnail uploaded: ${fileId} to ${filePath}`);

    return {
      fileId,
      storagePath: filePath,
      url,
      size: buffer.length,
    };
  }

  /**
   * Download a file from local filesystem
   */
  async download(fileId: string, storagePath: string): Promise<Buffer> {
    try {
      const buffer = await fs.readFile(storagePath);
      this.logger.log(`File downloaded: ${fileId} from ${storagePath}`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file ${fileId}: ${error.message}`);
      throw new Error(`File not found: ${fileId}`);
    }
  }

  /**
   * Delete a file from local filesystem
   */
  async delete(fileId: string, storagePath: string): Promise<void> {
    try {
      await fs.unlink(storagePath);
      this.logger.log(`File deleted: ${fileId} from ${storagePath}`);
    } catch (error) {
      // File doesn't exist or already deleted, ignore
      this.logger.warn(`Failed to delete file ${fileId}: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in local filesystem
   */
  async exists(fileId: string, storagePath: string): Promise<boolean> {
    try {
      await fs.access(storagePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file URL for local storage (returns relative URL served by nginx)
   */
  async getFileUrl(fileId: string, storagePath: string): Promise<string> {
    // Extract relative path from absolute storage path
    // storagePath: /var/www/lead360.app/uploads/public/{tenant}/{folder}/{filename}
    // url: /public/{tenant}/{folder}/{filename}
    const relativePath = storagePath.split('/uploads/public/')[1];
    return `/public/${relativePath}`;
  }

  /**
   * Get provider type
   */
  getProviderType(): 'local' | 's3' {
    return 'local';
  }

  /**
   * Extract file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()! : '';
  }
}
