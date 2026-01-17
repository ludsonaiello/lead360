import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class WebhookAuthService {
  private readonly logger = new Logger(WebhookAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate webhook API key and return tenant ID
   * @param apiKey - API key from request headers
   * @param tenantId - Tenant ID extracted from subdomain
   * @returns Webhook API key record if valid
   * @throws UnauthorizedException if invalid
   */
  async validateApiKey(apiKey: string, tenantId: string): Promise<any> {
    if (!apiKey || !tenantId) {
      this.logger.error('Missing API key or tenant information');
      throw new UnauthorizedException('Missing API key or tenant information');
    }

    this.logger.log(`Validating API key for tenant ${tenantId}`);
    this.logger.log(`API key prefix: ${apiKey.substring(0, 25)}...`);

    // Find all webhook API keys for this tenant
    const webhookKeys = await this.prisma.webhook_api_key.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
    });

    this.logger.log(`Found ${webhookKeys.length} active webhook API keys for tenant ${tenantId}`);

    if (!webhookKeys || webhookKeys.length === 0) {
      this.logger.warn(
        `No active webhook API keys found for tenant ${tenantId}`,
      );
      throw new UnauthorizedException('Invalid API key');
    }

    // Check each key (bcrypt compare with api_secret field)
    for (const keyRecord of webhookKeys) {
      this.logger.log(`Checking key record ${keyRecord.id}...`);
      const isValid = await bcrypt.compare(apiKey, keyRecord.api_secret);
      this.logger.log(`Bcrypt compare result for key ${keyRecord.id}: ${isValid}`);

      if (isValid) {
        // Update last used timestamp
        await this.prisma.webhook_api_key.update({
          where: { id: keyRecord.id },
          data: { last_used_at: new Date() },
        });

        this.logger.log(
          `Webhook API key validated for tenant ${tenantId}, key ID: ${keyRecord.id}`,
        );

        return keyRecord;
      }
    }

    this.logger.warn(
      `Invalid API key provided for tenant ${tenantId} - none of the ${webhookKeys.length} keys matched`,
    );
    throw new UnauthorizedException('Invalid API key');
  }

  /**
   * Create a new webhook API key for a tenant
   * @param tenantId - Tenant ID
   * @param userId - User creating the key
   * @param keyName - Key name/description
   * @returns Created key record with plain text key (ONLY TIME IT'S VISIBLE)
   */
  async createApiKey(
    tenantId: string,
    userId: string,
    keyName?: string,
  ): Promise<{ key: string; record: any }> {
    // Generate cryptographically strong API key and secret
    const plainKey = this.generateApiKey();
    const apiKeyHash = await bcrypt.hash(plainKey, 10); // For api_key field (unique index)
    const apiSecretHash = await bcrypt.hash(plainKey, 12); // For api_secret field (validation)

    const keyId = this.generateUUID();
    const keyRecord = await this.prisma.webhook_api_key.create({
      data: {
        id: keyId,
        tenant_id: tenantId,
        api_key: apiKeyHash, // Hashed for unique constraint
        api_secret: apiSecretHash, // Hashed for validation
        key_name: keyName || 'Webhook API Key',
        created_by_user_id: userId,
        is_active: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            subdomain: true,
            company_name: true,
          },
        },
        created_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Webhook API key created for tenant ${tenantId} by user ${userId}`,
    );

    return {
      key: plainKey, // IMPORTANT: Return plain key - user MUST save it now
      record: keyRecord,
    };
  }

  /**
   * List all webhook API keys for a tenant
   * @param tenantId - Tenant ID
   * @returns Array of API key records (hashes only, no plain text)
   */
  async listApiKeys(tenantId: string): Promise<any[]> {
    return this.prisma.webhook_api_key.findMany({
      where: { tenant_id: tenantId },
      include: {
        tenant: {
          select: {
            id: true,
            subdomain: true,
            company_name: true,
          },
        },
        created_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Deactivate (soft delete) an API key
   * @param tenantId - Tenant ID (for security check)
   * @param keyId - API key ID
   */
  async deactivateApiKey(tenantId: string, keyId: string): Promise<void> {
    // Verify key belongs to tenant
    const keyRecord = await this.prisma.webhook_api_key.findFirst({
      where: {
        id: keyId,
        tenant_id: tenantId,
      },
    });

    if (!keyRecord) {
      throw new UnauthorizedException('API key not found or access denied');
    }

    await this.prisma.webhook_api_key.update({
      where: { id: keyId },
      data: { is_active: false },
    });

    this.logger.log(
      `Webhook API key ${keyId} deactivated for tenant ${tenantId}`,
    );
  }

  /**
   * Toggle API key active status
   * @param tenantId - Tenant ID (for security check)
   * @param keyId - API key ID
   * @returns Updated API key record
   */
  async toggleApiKey(tenantId: string, keyId: string): Promise<any> {
    // Verify key belongs to tenant
    const keyRecord = await this.prisma.webhook_api_key.findFirst({
      where: {
        id: keyId,
        tenant_id: tenantId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            subdomain: true,
          },
        },
        created_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!keyRecord) {
      throw new UnauthorizedException('API key not found or access denied');
    }

    // Toggle the is_active status
    const updated = await this.prisma.webhook_api_key.update({
      where: { id: keyId },
      data: { is_active: !keyRecord.is_active },
      include: {
        tenant: {
          select: {
            id: true,
            subdomain: true,
          },
        },
        created_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Webhook API key ${keyId} toggled to ${updated.is_active ? 'active' : 'inactive'} for tenant ${tenantId}`,
    );

    return updated;
  }

  /**
   * Generate a cryptographically strong API key
   * Format: lead360_webhook_[32 random hex chars]
   * @returns API key string
   */
  private generateApiKey(): string {
    const randomBytes = require('crypto').randomBytes(32).toString('hex');
    return `lead360_webhook_${randomBytes}`;
  }

  /**
   * Generate UUID v4
   * @returns UUID string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
