/**
 * Storage Provider Interface
 *
 * Defines the contract that all storage providers (Local, S3, etc.) must implement.
 * This abstraction allows the system to switch between storage backends without
 * changing business logic.
 */

export interface UploadResult {
  fileId: string;
  storagePath: string;
  url: string;
  size: number;
  bucket?: string; // For S3
  key?: string; // For S3
  region?: string; // For S3
}

export interface UploadOptions {
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  category: string;
  tenantId: string;
}

export interface StorageProviderConfig {
  provider: 'local' | 's3';
  // S3 configuration
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretKey?: string;
  s3UseSsl?: boolean;
  s3ForcePathStyle?: boolean;
  // Local configuration
  localBasePath?: string;
}

export interface IStorageProvider {
  /**
   * Upload a file to storage
   */
  upload(options: UploadOptions): Promise<UploadResult>;

  /**
   * Upload a thumbnail to storage
   */
  uploadThumbnail(options: UploadOptions): Promise<UploadResult>;

  /**
   * Download a file from storage
   */
  download(fileId: string, storagePath: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   */
  delete(fileId: string, storagePath: string): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(fileId: string, storagePath: string): Promise<boolean>;

  /**
   * Get file URL (public or pre-signed)
   */
  getFileUrl(fileId: string, storagePath: string): Promise<string>;

  /**
   * Get provider type
   */
  getProviderType(): 'local' | 's3';
}
