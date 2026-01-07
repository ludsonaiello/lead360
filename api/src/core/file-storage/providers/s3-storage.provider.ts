import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import type {
  IStorageProvider,
  UploadOptions,
  UploadResult,
  StorageProviderConfig,
} from '../interfaces/storage-provider.interface';

/**
 * S3-Compatible Storage Provider
 *
 * Stores files in S3-compatible object storage (AWS S3, MinIO, DigitalOcean Spaces, etc.).
 * Supports custom endpoints for S3-compatible services.
 */
@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly config: StorageProviderConfig) {
    // Validate S3 configuration
    if (!config.s3Bucket || !config.s3AccessKeyId || !config.s3SecretKey) {
      throw new Error('S3 configuration is incomplete. Required: bucket, accessKeyId, secretKey');
    }

    this.bucket = config.s3Bucket;
    this.region = config.s3Region || 'us-east-1';

    // Initialize S3 client
    this.s3Client = new S3Client({
      endpoint: config.s3Endpoint,
      region: this.region,
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretKey,
      },
      forcePathStyle: config.s3ForcePathStyle ?? false,
      tls: config.s3UseSsl ?? true,
    });

    this.logger.log(`S3StorageProvider initialized: bucket=${this.bucket}, region=${this.region}`);
  }

  /**
   * Upload a file to S3
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    const { originalFilename, mimeType, buffer, category, tenantId } = options;

    // Generate unique file ID
    const fileId = randomUUID();
    const fileExtension = this.getFileExtension(originalFilename);
    const fileName = `${fileId}.${fileExtension}`;

    // Determine folder based on category
    const folder = category === 'logo' ? 'images' : 'files';
    const s3Key = `${tenantId}/${folder}/${fileName}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalFilename,
        tenantId,
        category,
      },
    });

    await this.s3Client.send(command);

    // Generate pre-signed URL (valid for 1 hour)
    const url = await this.getFileUrl(fileId, s3Key);

    this.logger.log(`File uploaded to S3: ${fileId} (${s3Key})`);

    return {
      fileId,
      storagePath: s3Key, // For S3, storage path is the S3 key
      url,
      size: buffer.length,
      bucket: this.bucket,
      key: s3Key,
      region: this.region,
    };
  }

  /**
   * Upload a thumbnail to S3
   */
  async uploadThumbnail(options: UploadOptions): Promise<UploadResult> {
    const { originalFilename, mimeType, buffer, tenantId } = options;

    // Generate unique file ID
    const fileId = randomUUID();
    const fileExtension = this.getFileExtension(originalFilename);
    const fileName = `${fileId}_thumb.${fileExtension}`;

    // Thumbnails go in images folder
    const folder = 'images';
    const s3Key = `${tenantId}/${folder}/${fileName}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalFilename,
        tenantId,
        isThumbnail: 'true',
      },
    });

    await this.s3Client.send(command);

    // Generate pre-signed URL
    const url = await this.getFileUrl(fileId, s3Key);

    this.logger.log(`Thumbnail uploaded to S3: ${fileId} (${s3Key})`);

    return {
      fileId,
      storagePath: s3Key,
      url,
      size: buffer.length,
      bucket: this.bucket,
      key: s3Key,
      region: this.region,
    };
  }

  /**
   * Download a file from S3
   */
  async download(fileId: string, storagePath: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storagePath, // storagePath is the S3 key
      });

      const response = await this.s3Client.send(command);
      const buffer = await this.streamToBuffer(response.Body as any);

      this.logger.log(`File downloaded from S3: ${fileId} (${storagePath})`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file ${fileId} from S3: ${error.message}`);
      throw new Error(`File not found: ${fileId}`);
    }
  }

  /**
   * Delete a file from S3
   */
  async delete(fileId: string, storagePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted from S3: ${fileId} (${storagePath})`);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${fileId} from S3: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in S3
   */
  async exists(fileId: string, storagePath: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get pre-signed URL for S3 file (valid for 1 hour)
   */
  async getFileUrl(fileId: string, storagePath: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    });

    // Generate pre-signed URL valid for 1 hour
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return url;
  }

  /**
   * Get provider type
   */
  getProviderType(): 'local' | 's3' {
    return 's3';
  }

  /**
   * Extract file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()! : '';
  }

  /**
   * Convert readable stream to buffer
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
