import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import {
  IStorageProvider,
  StorageProviderConfig,
} from './interfaces/storage-provider.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

/**
 * Storage Provider Factory
 *
 * Creates the appropriate storage provider based on tenant configuration.
 * Supports per-tenant storage configuration (some tenants use local, others use S3).
 */
@Injectable()
export class StorageProviderFactory {
  private readonly logger = new Logger(StorageProviderFactory.name);
  private readonly providerCache = new Map<string, IStorageProvider>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get storage provider for a tenant
   *
   * @param tenantId - Tenant ID
   * @returns Storage provider instance
   */
  async getProvider(tenantId: string): Promise<IStorageProvider> {
    // Check cache first
    const cached = this.providerCache.get(tenantId);
    if (cached) {
      return cached;
    }

    // Load tenant storage configuration from database
    const storageConfig = await this.prisma.storage_config.findUnique({
      where: { tenant_id: tenantId },
    });

    let provider: IStorageProvider;

    if (storageConfig && storageConfig.storage_provider === 's3') {
      // Create S3 provider with tenant-specific configuration
      const config: StorageProviderConfig = {
        provider: 's3',
        s3Endpoint: storageConfig.s3_endpoint || undefined,
        s3Region: storageConfig.s3_region || undefined,
        s3Bucket: storageConfig.s3_bucket || undefined,
        s3AccessKeyId: storageConfig.s3_access_key_id || undefined,
        s3SecretKey: storageConfig.s3_secret_key || undefined,
        s3UseSsl: storageConfig.s3_use_ssl,
        s3ForcePathStyle: storageConfig.s3_force_path_style,
      };

      provider = new S3StorageProvider(config);
      this.logger.log(`Created S3 storage provider for tenant ${tenantId}`);
    } else {
      // Default to local storage
      const uploadsPath =
        this.configService.get<string>('UPLOADS_PATH') || '../uploads/public';
      const config: StorageProviderConfig = {
        provider: 'local',
        localBasePath: uploadsPath,
      };

      provider = new LocalStorageProvider(config);
      this.logger.log(`Created local storage provider for tenant ${tenantId}`);
    }

    // Cache the provider
    this.providerCache.set(tenantId, provider);

    return provider;
  }

  /**
   * Clear provider cache (useful when tenant storage config changes)
   *
   * @param tenantId - Tenant ID (optional, clears all if not provided)
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      this.providerCache.delete(tenantId);
      this.logger.log(`Cleared storage provider cache for tenant ${tenantId}`);
    } else {
      this.providerCache.clear();
      this.logger.log('Cleared all storage provider caches');
    }
  }

  /**
   * Get storage configuration for a tenant
   *
   * @param tenantId - Tenant ID
   * @returns Storage configuration or null if not configured
   */
  async getStorageConfig(tenantId: string) {
    return this.prisma.storage_config.findUnique({
      where: { tenant_id: tenantId },
    });
  }

  /**
   * Update storage configuration for a tenant
   *
   * @param tenantId - Tenant ID
   * @param config - Partial storage configuration
   */
  async updateStorageConfig(tenantId: string, config: any) {
    // Clear cache for this tenant
    this.clearCache(tenantId);

    // Upsert storage configuration
    return this.prisma.storage_config.upsert({
      where: { tenant_id: tenantId },
      create: {
        id: require('crypto').randomUUID(),
        tenant_id: tenantId,
        ...config,
      },
      update: config,
    });
  }
}
