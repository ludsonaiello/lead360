import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import OpenAI from 'openai';

/**
 * Transcription Provider Service
 *
 * Manages transcription provider configurations for OpenAI Whisper, Oracle,
 * AssemblyAI, and other transcription services. Handles provider registration,
 * validation, configuration encryption, and usage tracking.
 *
 * Features:
 * - Multi-provider support (extensible architecture)
 * - Encrypted credential storage
 * - System-level and tenant-level provider configurations
 * - Automatic fallback to system defaults
 * - Usage tracking and limits enforcement
 * - Provider configuration validation
 *
 * @example
 * ```typescript
 * // Register system default OpenAI Whisper provider
 * await providerService.registerProvider(
 *   'openai_whisper',
 *   { api_key: 'sk-...', model: 'whisper-1', language: 'en' },
 *   null,
 *   true
 * );
 *
 * // Get active provider for tenant (with fallback)
 * const provider = await providerService.getActiveProvider(tenantId);
 * ```
 */
@Injectable()
export class TranscriptionProviderService {
  private readonly logger = new Logger(TranscriptionProviderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Register transcription provider
   *
   * Validates provider configuration, encrypts sensitive credentials,
   * and stores in database. Supports both system-level (shared) and
   * tenant-specific configurations.
   *
   * @param providerName - Provider identifier ('openai_whisper', 'oracle', 'assemblyai')
   * @param configJson - Provider-specific configuration object
   * @param tenantId - Optional tenant ID (null for system-level)
   * @param isSystemDefault - Whether this is the default provider for all tenants
   * @returns Created provider configuration
   * @throws BadRequestException if validation fails
   *
   * @example
   * ```typescript
   * // System default provider
   * await registerProvider('openai_whisper', {
   *   api_key: 'sk-...',
   *   model: 'whisper-1',
   *   language: 'en'
   * }, null, true);
   *
   * // Tenant-specific provider
   * await registerProvider('assemblyai', {
   *   api_key: 'xxx',
   *   tier: 'enterprise'
   * }, 'tenant-123', false);
   * ```
   */
  async registerProvider(
    providerName: string,
    configJson: any,
    tenantId?: string,
    isSystemDefault = false,
  ) {
    this.logger.log(
      `Registering ${providerName} provider${tenantId ? ` for tenant ${tenantId}` : ' (system-level)'}`,
    );

    // Validate configuration before storing
    await this.validateConfiguration(providerName, configJson);

    // Encrypt configuration (credentials must be encrypted at rest)
    const encryptedConfig = this.encryption.encrypt(
      JSON.stringify(configJson),
    );

    // If this is a system default, disable other system defaults
    if (isSystemDefault) {
      await this.prisma.transcription_provider_configuration.updateMany({
        where: {
          is_system_default: true,
          tenant_id: null,
        },
        data: {
          is_system_default: false,
        },
      });

      this.logger.log('Disabled previous system default provider');
    }

    const provider =
      await this.prisma.transcription_provider_configuration.create({
        data: {
          tenant_id: tenantId || null,
          provider_name: providerName,
          is_system_default: isSystemDefault,
          status: 'active',
          configuration_json: encryptedConfig,
          usage_current: 0,
        },
      });

    this.logger.log(`Provider registered successfully: ${provider.id}`);

    return provider;
  }

  /**
   * Get active transcription provider for tenant
   *
   * Implements fallback strategy:
   * 1. Try tenant-specific active provider first
   * 2. Fallback to system default if no tenant provider exists
   * 3. Throw error if no provider available
   *
   * @param tenantId - Optional tenant ID
   * @returns Active provider configuration
   * @throws NotFoundException if no active provider found
   *
   * @example
   * ```typescript
   * // Get provider for tenant (with automatic fallback)
   * const provider = await getActiveProvider('tenant-123');
   *
   * // Get system default
   * const systemProvider = await getActiveProvider();
   * ```
   */
  async getActiveProvider(tenantId?: string) {
    // Strategy 1: Try tenant-specific provider
    if (tenantId) {
      const tenantProvider =
        await this.prisma.transcription_provider_configuration.findFirst({
          where: {
            tenant_id: tenantId,
            status: 'active',
          },
        });

      if (tenantProvider) {
        this.logger.debug(
          `Using tenant-specific provider for ${tenantId}: ${tenantProvider.provider_name}`,
        );
        return tenantProvider;
      }
    }

    // Strategy 2: Fallback to system default
    const systemProvider =
      await this.prisma.transcription_provider_configuration.findFirst({
        where: {
          is_system_default: true,
          status: 'active',
        },
      });

    if (!systemProvider) {
      throw new NotFoundException(
        'No active transcription provider configured. Please configure OpenAI Whisper or another provider.',
      );
    }

    this.logger.debug(
      `Using system default provider: ${systemProvider.provider_name}`,
    );

    return systemProvider;
  }

  /**
   * Validate provider configuration
   *
   * Performs provider-specific validation of configuration objects.
   * Tests API connectivity where possible without making billable calls.
   *
   * @param providerName - Provider identifier
   * @param config - Configuration object to validate
   * @throws BadRequestException if configuration is invalid
   *
   * Validation rules:
   * - openai_whisper: Requires api_key, validates format
   * - oracle: Not yet implemented
   * - assemblyai: Not yet implemented
   */
  async validateConfiguration(
    providerName: string,
    config: any,
  ): Promise<void> {
    this.logger.debug(`Validating ${providerName} configuration`);

    switch (providerName) {
      case 'openai_whisper':
        return this.validateOpenAIWhisperConfig(config);

      case 'oracle':
        throw new BadRequestException(
          'Oracle transcription provider not yet implemented. Coming soon.',
        );

      case 'assemblyai':
        throw new BadRequestException(
          'AssemblyAI provider not yet implemented. Coming soon.',
        );

      case 'deepgram':
        throw new BadRequestException(
          'Deepgram provider not yet implemented. Coming soon.',
        );

      default:
        throw new BadRequestException(
          `Unknown transcription provider: ${providerName}. Supported providers: openai_whisper, oracle, assemblyai, deepgram`,
        );
    }
  }

  /**
   * Validate OpenAI Whisper configuration
   *
   * @param config - OpenAI configuration object
   * @throws BadRequestException if invalid
   *
   * Required fields:
   * - api_key: OpenAI API key (starts with sk-)
   *
   * Optional fields:
   * - model: Whisper model (default: whisper-1)
   * - language: ISO language code (default: auto-detect)
   */
  private async validateOpenAIWhisperConfig(config: any): Promise<void> {
    // Required: API key
    if (!config.api_key) {
      throw new BadRequestException(
        'OpenAI Whisper requires api_key in configuration',
      );
    }

    // Validate API key format (should start with sk-)
    if (!config.api_key.startsWith('sk-')) {
      throw new BadRequestException(
        'Invalid OpenAI API key format. Key should start with "sk-"',
      );
    }

    // Test API key validity (without making billable calls)
    try {
      const openai = new OpenAI({ apiKey: config.api_key });

      // Test by listing models (free operation)
      await openai.models.list();

      this.logger.log('OpenAI Whisper API key validated successfully');
    } catch (error) {
      this.logger.error(
        `OpenAI API key validation failed: ${error.message}`,
      );
      throw new BadRequestException(
        `Invalid OpenAI API key: ${error.message}. Please check your key and try again.`,
      );
    }

    // Validate optional model parameter
    if (config.model && !['whisper-1'].includes(config.model)) {
      this.logger.warn(
        `Unknown Whisper model: ${config.model}. Using whisper-1 as fallback.`,
      );
    }

    // Validate optional language parameter (ISO 639-1 codes)
    if (config.language) {
      const validLanguages = [
        'en',
        'es',
        'fr',
        'de',
        'it',
        'pt',
        'nl',
        'pl',
        'ru',
        'ja',
        'ko',
        'zh',
      ];
      if (
        !validLanguages.includes(config.language) &&
        config.language.length !== 2
      ) {
        this.logger.warn(
          `Invalid language code: ${config.language}. Will use auto-detection.`,
        );
      }
    }
  }

  /**
   * Get decrypted provider configuration
   *
   * Retrieves provider record and decrypts the configuration JSON.
   * Use this when you need to access provider credentials.
   *
   * @param providerId - Provider configuration ID
   * @returns Object containing provider record and decrypted config
   * @throws NotFoundException if provider not found
   *
   * @example
   * ```typescript
   * const { provider, config } = await getDecryptedConfig('provider-123');
   * const openai = new OpenAI({ apiKey: config.api_key });
   * ```
   */
  async getDecryptedConfig(providerId: string) {
    const provider =
      await this.prisma.transcription_provider_configuration.findUnique({
        where: { id: providerId },
      });

    if (!provider) {
      throw new NotFoundException(
        `Transcription provider not found: ${providerId}`,
      );
    }

    // Decrypt configuration
    const decrypted = JSON.parse(
      this.encryption.decrypt(provider.configuration_json),
    );

    return {
      provider,
      config: decrypted,
    };
  }

  /**
   * Increment usage counter for provider
   *
   * Tracks usage to enforce monthly limits. Should be called
   * after each successful transcription.
   *
   * @param providerId - Provider configuration ID
   *
   * @example
   * ```typescript
   * // After successful transcription
   * await incrementUsage(provider.id);
   * ```
   */
  async incrementUsage(providerId: string) {
    await this.prisma.transcription_provider_configuration.update({
      where: { id: providerId },
      data: {
        usage_current: {
          increment: 1,
        },
      },
    });

    this.logger.debug(`Incremented usage for provider ${providerId}`);
  }

  /**
   * Check if provider has exceeded usage limit
   *
   * @param providerId - Provider configuration ID
   * @returns true if limit exceeded, false otherwise
   */
  async hasExceededUsageLimit(providerId: string): Promise<boolean> {
    const provider =
      await this.prisma.transcription_provider_configuration.findUnique({
        where: { id: providerId },
        select: {
          usage_limit: true,
          usage_current: true,
        },
      });

    if (!provider) {
      throw new NotFoundException(
        `Transcription provider not found: ${providerId}`,
      );
    }

    // No limit set = unlimited
    if (!provider.usage_limit) {
      return false;
    }

    return provider.usage_current >= provider.usage_limit;
  }

  /**
   * Reset monthly usage counters
   *
   * Should be called via scheduled job at the start of each month.
   * Resets usage_current to 0 for all providers.
   */
  async resetMonthlyUsage() {
    const result =
      await this.prisma.transcription_provider_configuration.updateMany({
        where: {
          usage_current: {
            gt: 0,
          },
        },
        data: {
          usage_current: 0,
        },
      });

    this.logger.log(
      `Reset monthly usage for ${result.count} transcription providers`,
    );

    return result;
  }

  /**
   * Update provider status
   *
   * @param providerId - Provider configuration ID
   * @param status - New status ('active' | 'inactive')
   */
  async updateProviderStatus(
    providerId: string,
    status: 'active' | 'inactive',
  ) {
    const provider =
      await this.prisma.transcription_provider_configuration.update({
        where: { id: providerId },
        data: { status },
      });

    this.logger.log(`Updated provider ${providerId} status to ${status}`);

    return provider;
  }

  /**
   * List all providers for tenant (including system defaults)
   *
   * @param tenantId - Optional tenant ID
   * @returns Array of provider configurations
   */
  async listProviders(tenantId?: string) {
    const where: any = {
      OR: [{ is_system_default: true }, { tenant_id: tenantId }],
    };

    return this.prisma.transcription_provider_configuration.findMany({
      where,
      select: {
        id: true,
        provider_name: true,
        is_system_default: true,
        status: true,
        usage_limit: true,
        usage_current: true,
        cost_per_minute: true,
        created_at: true,
        updated_at: true,
        // Don't expose encrypted configuration
      },
      orderBy: [
        { is_system_default: 'desc' }, // System defaults first
        { created_at: 'desc' },
      ],
    });
  }
}
