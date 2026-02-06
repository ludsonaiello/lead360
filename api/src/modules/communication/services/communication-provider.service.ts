import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  JsonSchemaValidatorService,
  ValidationResult,
} from './json-schema-validator.service';

export interface Provider {
  id: string;
  provider_key: string;
  provider_name: string;
  provider_type: string;
  credentials_schema: any;
  config_schema?: any;
  default_config?: any;
  supports_webhooks: boolean;
  webhook_events?: any;
  webhook_verification_method?: string | null;
  documentation_url?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  is_system: boolean;
}

/**
 * Communication Provider Service
 *
 * Manages provider registry, validation, and provider operations
 * Follows established patterns from RBAC and Auth modules
 */
@Injectable()
export class CommunicationProviderService {
  private readonly logger = new Logger(CommunicationProviderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: JsonSchemaValidatorService,
  ) {}

  /**
   * Get all active providers, optionally filtered by type
   * PUBLIC method - no tenant isolation needed
   */
  async getActiveProviders(type?: string): Promise<Provider[]> {
    const providers = await this.prisma.communication_provider.findMany({
      where: {
        is_active: true,
        ...(type && { provider_type: type as any }),
      },
      orderBy: { provider_name: 'asc' },
    });

    this.logger.debug(
      `Found ${providers.length} active providers${type ? ` of type ${type}` : ''}`,
    );

    return providers as Provider[];
  }

  /**
   * Get all providers (including inactive) - ADMIN ONLY
   */
  async getAllProviders(): Promise<Provider[]> {
    const providers = await this.prisma.communication_provider.findMany({
      orderBy: [{ provider_type: 'asc' }, { provider_name: 'asc' }],
    });

    this.logger.debug(`Found ${providers.length} total providers`);

    return providers as Provider[];
  }

  /**
   * Get provider by key
   */
  async getProvider(providerKey: string): Promise<Provider> {
    const provider = await this.prisma.communication_provider.findUnique({
      where: { provider_key: providerKey },
    });

    if (!provider) {
      throw new NotFoundException(
        `Provider with key '${providerKey}' not found`,
      );
    }

    return provider as Provider;
  }

  /**
   * Get provider by ID
   */
  async getProviderById(providerId: string): Promise<Provider> {
    const provider = await this.prisma.communication_provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${providerId}' not found`);
    }

    return provider as Provider;
  }

  /**
   * Validate provider credentials against JSON Schema
   */
  async validateProviderCredentials(
    provider: Provider,
    credentials: object,
  ): Promise<ValidationResult> {
    if (!provider.credentials_schema) {
      throw new BadRequestException(
        `Provider ${provider.provider_key} has no credentials schema`,
      );
    }

    const result = this.validator.validate(
      provider.credentials_schema,
      credentials,
    );

    if (!result.valid) {
      this.logger.warn(
        `Credentials validation failed for ${provider.provider_key}: ${JSON.stringify(result.errors)}`,
      );
    }

    return result;
  }

  /**
   * Validate provider configuration against JSON Schema
   */
  async validateProviderConfig(
    provider: Provider,
    config: object,
  ): Promise<ValidationResult> {
    // If no config schema, validation passes
    if (!provider.config_schema) {
      return { valid: true };
    }

    const result = this.validator.validate(provider.config_schema, config);

    if (!result.valid) {
      this.logger.warn(
        `Config validation failed for ${provider.provider_key}: ${JSON.stringify(result.errors)}`,
      );
    }

    return result;
  }

  /**
   * Validate both credentials and config
   */
  async validateProviderSettings(
    provider: Provider,
    credentials: object,
    config?: object,
  ): Promise<{ valid: boolean; errors?: Record<string, string> }> {
    const errors: Record<string, string> = {};

    // Validate credentials
    const credentialsResult = await this.validateProviderCredentials(
      provider,
      credentials,
    );

    if (!credentialsResult.valid) {
      credentialsResult.errors?.forEach((err) => {
        errors[`credentials.${err.field}`] = err.message;
      });
    }

    // Validate config if provided
    if (config) {
      const configResult = await this.validateProviderConfig(provider, config);

      if (!configResult.valid) {
        configResult.errors?.forEach((err) => {
          errors[`provider_config.${err.field}`] = err.message;
        });
      }
    }

    if (Object.keys(errors).length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * Create provider (ADMIN ONLY)
   */
  async createProvider(data: {
    provider_key: string;
    provider_name: string;
    provider_type: string;
    credentials_schema: any;
    config_schema?: any;
    default_config?: any;
    supports_webhooks: boolean;
    webhook_events?: any;
    webhook_verification_method?: string;
    documentation_url?: string;
    logo_url?: string;
  }): Promise<Provider> {
    const { randomBytes } = await import('crypto');

    const provider = await this.prisma.communication_provider.create({
      data: {
        id: randomBytes(16).toString('hex'),
        ...data,
        provider_type: data.provider_type as any,
        is_system: false, // User-created providers are not system providers
      },
    });

    this.logger.log(`Created provider: ${provider.provider_key}`);

    return provider as Provider;
  }

  /**
   * Update provider (ADMIN ONLY)
   */
  async updateProvider(
    providerKey: string,
    data: Partial<{
      provider_name: string;
      credentials_schema: any;
      config_schema: any;
      default_config: any;
      supports_webhooks: boolean;
      webhook_events: any;
      webhook_verification_method: string;
      documentation_url: string;
      logo_url: string;
      is_active: boolean;
    }>,
  ): Promise<Provider> {
    // Verify provider exists
    await this.getProvider(providerKey);

    const provider = await this.prisma.communication_provider.update({
      where: { provider_key: providerKey },
      data,
    });

    this.logger.log(`Updated provider: ${providerKey}`);

    return provider as Provider;
  }

  /**
   * Toggle provider active status (ADMIN ONLY)
   */
  async toggleProviderStatus(providerKey: string): Promise<Provider> {
    const provider = await this.getProvider(providerKey);

    // System providers cannot be deactivated
    if (provider.is_system && provider.is_active) {
      throw new BadRequestException('System providers cannot be deactivated');
    }

    const updated = await this.prisma.communication_provider.update({
      where: { provider_key: providerKey },
      data: { is_active: !provider.is_active },
    });

    this.logger.log(
      `Toggled provider ${providerKey}: ${provider.is_active ? 'inactive' : 'active'}`,
    );

    return updated as Provider;
  }

  /**
   * Delete provider (ADMIN ONLY)
   * System providers cannot be deleted
   */
  async deleteProvider(providerKey: string): Promise<void> {
    const provider = await this.getProvider(providerKey);

    if (provider.is_system) {
      throw new BadRequestException('System providers cannot be deleted');
    }

    // Check if provider is in use
    const inUse = await this.isProviderInUse(provider.id);
    if (inUse) {
      throw new BadRequestException(
        'Cannot delete provider that is currently in use',
      );
    }

    await this.prisma.communication_provider.delete({
      where: { provider_key: providerKey },
    });

    this.logger.log(`Deleted provider: ${providerKey}`);
  }

  /**
   * Check if provider is in use by any tenant or platform config
   */
  private async isProviderInUse(providerId: string): Promise<boolean> {
    const [platformCount, tenantCount] = await Promise.all([
      this.prisma.platform_email_config.count({
        where: { provider_id: providerId },
      }),
      this.prisma.tenant_email_config.count({
        where: { provider_id: providerId },
      }),
    ]);

    return platformCount + tenantCount > 0;
  }

  /**
   * Get provider statistics (ADMIN ONLY)
   */
  async getProviderStats(providerKey: string): Promise<{
    provider: Provider;
    platform_configs: number;
    tenant_configs: number;
    total_events: number;
    events_last_24h: number;
  }> {
    const provider = await this.getProvider(providerKey);

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const [platformConfigs, tenantConfigs, totalEvents, eventsLast24h] =
      await Promise.all([
        this.prisma.platform_email_config.count({
          where: { provider_id: provider.id },
        }),
        this.prisma.tenant_email_config.count({
          where: { provider_id: provider.id },
        }),
        this.prisma.communication_event.count({
          where: { provider_id: provider.id },
        }),
        this.prisma.communication_event.count({
          where: {
            provider_id: provider.id,
            created_at: { gte: oneDayAgo },
          },
        }),
      ]);

    return {
      provider,
      platform_configs: platformConfigs,
      tenant_configs: tenantConfigs,
      total_events: totalEvents,
      events_last_24h: eventsLast24h,
    };
  }

  // Controller-friendly method aliases
  async findAll(filters: any) {
    return this.prisma.communication_provider.findMany({
      where: {
        ...(filters.type && { provider_type: filters.type }),
        ...(filters.is_active !== undefined && {
          is_active: filters.is_active,
        }),
        ...(filters.include_system === false && { is_system: false }),
      },
      include: {
        _count: {
          select: {
            platform_email_configs: true,
            tenant_email_configs: true,
            communication_events: true,
          },
        },
      },
      orderBy: [{ provider_type: 'asc' }, { provider_name: 'asc' }],
    });
  }

  async create(dto: any, userId: string) {
    return this.createProvider(dto);
  }

  async update(key: string, dto: any, userId: string) {
    return this.updateProvider(key, dto);
  }

  async toggleActive(key: string, userId: string) {
    return this.toggleProviderStatus(key);
  }

  async delete(key: string, userId: string) {
    return this.deleteProvider(key);
  }

  async getStats(key: string) {
    return this.getProviderStats(key);
  }
}
