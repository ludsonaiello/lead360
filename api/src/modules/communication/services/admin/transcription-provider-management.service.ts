import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { EncryptionService } from '../../../../core/encryption/encryption.service';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { OpenAI } from 'openai';
import {
  CreateTranscriptionProviderDto,
  UpdateTranscriptionProviderDto,
} from '../../dto/admin/transcription-provider.dto';

/**
 * TranscriptionProviderManagementService
 *
 * Manages transcription provider configurations (OpenAI Whisper, Deepgram, AssemblyAI, etc.)
 *
 * Responsibilities:
 * - Create/update/delete transcription provider configurations
 * - Test provider API connectivity and credentials
 * - Track provider usage and costs
 * - Manage system default providers
 * - Ensure provider dependencies before deletion
 *
 * Security:
 * - API keys encrypted at rest using EncryptionService
 * - All operations require SystemAdmin role (enforced at controller level)
 * - Complete audit trail via database timestamps
 *
 * @class TranscriptionProviderManagementService
 * @since Sprint 11
 */
@Injectable()
export class TranscriptionProviderManagementService {
  private readonly logger = new Logger(
    TranscriptionProviderManagementService.name,
  );

  // Supported transcription providers
  private readonly SUPPORTED_PROVIDERS = [
    'openai_whisper',
    'deepgram',
    'assemblyai',
    'oracle',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Create new transcription provider configuration
   *
   * Creates a new transcription provider with encrypted credentials.
   * Can be set as system default or tenant-specific.
   *
   * @param dto - Provider configuration data
   * @returns Promise<TranscriptionProviderConfig>
   */
  async createProvider(
    dto: CreateTranscriptionProviderDto,
  ): Promise<TranscriptionProviderConfig> {
    this.logger.log(`Creating transcription provider: ${dto.provider_name}`);

    try {
      // Validate provider name
      if (!this.SUPPORTED_PROVIDERS.includes(dto.provider_name)) {
        throw new BadRequestException(
          `Unsupported provider: ${dto.provider_name}. Must be one of: ${this.SUPPORTED_PROVIDERS.join(', ')}`,
        );
      }

      // If setting as system default, unset current default
      if (dto.is_system_default) {
        await this.prisma.transcription_provider_configuration.updateMany({
          where: {
            is_system_default: true,
            tenant_id: null,
          },
          data: {
            is_system_default: false,
          },
        });
        this.logger.log('Unset previous system default provider');
      }

      // Encrypt configuration (contains API keys)
      const encryptedConfig = this.encryptionService.encrypt(
        JSON.stringify({
          api_key: dto.api_key,
          api_endpoint: dto.api_endpoint,
          model: dto.model,
          language: dto.language,
          additional_settings: dto.additional_settings || {},
        }),
      );

      // Create provider configuration
      const provider =
        await this.prisma.transcription_provider_configuration.create({
          data: {
            id: uuidv4(),
            tenant_id: dto.tenant_id || null,
            provider_name: dto.provider_name,
            is_system_default: dto.is_system_default || false,
            status: 'active',
            configuration_json: encryptedConfig,
            usage_limit: dto.usage_limit || 10000,
            usage_current: 0,
            cost_per_minute: dto.cost_per_minute || 0.006,
          },
          include: {
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
              },
            },
          },
        });

      this.logger.log(`Transcription provider created: ${provider.id}`);

      return this.formatProviderResponse(provider);
    } catch (error) {
      this.logger.error(
        'Failed to create transcription provider:',
        error.message,
      );
      this.logger.error('Error stack:', error.stack);

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to create transcription provider');
    }
  }

  /**
   * Get specific transcription provider with usage statistics
   *
   * Returns provider configuration (without sensitive credentials) and usage stats.
   *
   * @param id - Provider ID
   * @returns Promise<TranscriptionProviderWithStats>
   */
  async getProvider(id: string): Promise<TranscriptionProviderWithStats> {
    this.logger.log(`Fetching transcription provider: ${id}`);

    try {
      const provider =
        await this.prisma.transcription_provider_configuration.findUnique({
          where: { id },
          include: {
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
              },
            },
          },
        });

      if (!provider) {
        throw new NotFoundException(`Transcription provider ${id} not found`);
      }

      // Get usage statistics
      const stats = await this.getProviderUsageStats(
        provider.id,
        provider.tenant_id,
      );

      return {
        ...this.formatProviderResponse(provider),
        statistics: stats,
      };
    } catch (error) {
      this.logger.error(
        'Failed to fetch transcription provider:',
        error.message,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(
        'Failed to retrieve transcription provider',
      );
    }
  }

  /**
   * Update transcription provider configuration
   *
   * Updates provider settings, credentials, usage limits, or default status.
   *
   * @param id - Provider ID
   * @param dto - Update data
   * @returns Promise<TranscriptionProviderConfig>
   */
  async updateProvider(
    id: string,
    dto: UpdateTranscriptionProviderDto,
  ): Promise<TranscriptionProviderConfig> {
    this.logger.log(`Updating transcription provider: ${id}`);

    try {
      // Check if provider exists
      const existing =
        await this.prisma.transcription_provider_configuration.findUnique({
          where: { id },
        });

      if (!existing) {
        throw new NotFoundException(`Transcription provider ${id} not found`);
      }

      // If setting as system default, unset current default
      if (dto.is_system_default && !existing.is_system_default) {
        await this.prisma.transcription_provider_configuration.updateMany({
          where: {
            is_system_default: true,
            tenant_id: null,
            id: { not: id },
          },
          data: {
            is_system_default: false,
          },
        });
        this.logger.log('Unset previous system default provider');
      }

      // Prepare update data
      const updateData: any = {};

      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }

      if (dto.usage_limit !== undefined) {
        updateData.usage_limit = dto.usage_limit;
      }

      if (dto.cost_per_minute !== undefined) {
        updateData.cost_per_minute = dto.cost_per_minute;
      }

      if (dto.is_system_default !== undefined) {
        updateData.is_system_default = dto.is_system_default;
      }

      // If updating credentials/config
      if (dto.api_key || dto.api_endpoint || dto.model || dto.language) {
        // Decrypt existing config
        const existingConfig = JSON.parse(
          this.encryptionService.decrypt(existing.configuration_json),
        );

        // Merge with updates
        const newConfig = {
          api_key: dto.api_key || existingConfig.api_key,
          api_endpoint: dto.api_endpoint || existingConfig.api_endpoint,
          model: dto.model || existingConfig.model,
          language: dto.language || existingConfig.language,
          additional_settings:
            dto.additional_settings || existingConfig.additional_settings,
        };

        // Re-encrypt
        updateData.configuration_json = this.encryptionService.encrypt(
          JSON.stringify(newConfig),
        );
      }

      // Update provider
      const updated =
        await this.prisma.transcription_provider_configuration.update({
          where: { id },
          data: updateData,
          include: {
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
              },
            },
          },
        });

      this.logger.log(`Transcription provider ${id} updated successfully`);

      return this.formatProviderResponse(updated);
    } catch (error) {
      this.logger.error(
        'Failed to update transcription provider:',
        error.message,
      );
      this.logger.error('Error stack:', error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException('Failed to update transcription provider');
    }
  }

  /**
   * Delete transcription provider
   *
   * Deletes a provider configuration after checking for dependencies.
   * Cannot delete if there are active transcriptions using this provider.
   *
   * @param id - Provider ID
   * @returns Promise<{ success: boolean; message: string }>
   */
  async deleteProvider(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Deleting transcription provider: ${id}`);

    try {
      // Check if provider exists
      const provider =
        await this.prisma.transcription_provider_configuration.findUnique({
          where: { id },
        });

      if (!provider) {
        throw new NotFoundException(`Transcription provider ${id} not found`);
      }

      // Check for active transcriptions using this provider
      const activeTranscriptions = await this.prisma.call_transcription.count({
        where: {
          transcription_provider: provider.provider_name,
          tenant_id: provider.tenant_id,
          status: { in: ['queued', 'processing'] },
        },
      });

      if (activeTranscriptions > 0) {
        throw new ConflictException(
          `Cannot delete provider with ${activeTranscriptions} active transcription(s). Wait for completion or cancel them first.`,
        );
      }

      // Delete provider
      await this.prisma.transcription_provider_configuration.delete({
        where: { id },
      });

      this.logger.log(`Transcription provider ${id} deleted successfully`);

      return {
        success: true,
        message: `Transcription provider deleted successfully`,
      };
    } catch (error) {
      this.logger.error(
        'Failed to delete transcription provider:',
        error.message,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to delete transcription provider');
    }
  }

  /**
   * Test transcription provider connectivity
   *
   * Tests provider API connectivity by attempting to authenticate
   * and optionally transcribe a test audio file.
   *
   * @param id - Provider ID
   * @param audioUrl - Optional test audio URL
   * @returns Promise<ProviderTestResult>
   */
  async testProvider(
    id: string,
    audioUrl?: string,
  ): Promise<ProviderTestResult> {
    this.logger.log(`========================================`);
    this.logger.log(`[TEST PROVIDER] Starting test`);
    this.logger.log(`[TEST PROVIDER] Provider ID: ${id}`);
    this.logger.log(`[TEST PROVIDER] Audio URL: ${audioUrl || 'NOT PROVIDED'}`);
    this.logger.log(`========================================`);

    try {
      const provider =
        await this.prisma.transcription_provider_configuration.findUnique({
          where: { id },
        });

      if (!provider) {
        this.logger.error(`[TEST PROVIDER] Provider not found: ${id}`);
        throw new NotFoundException(`Transcription provider ${id} not found`);
      }

      this.logger.log(
        `[TEST PROVIDER] Provider found: ${provider.provider_name}`,
      );
      this.logger.log(`[TEST PROVIDER] Provider status: ${provider.status}`);
      this.logger.log(
        `[TEST PROVIDER] Is system default: ${provider.is_system_default}`,
      );

      // Decrypt configuration to get API key
      this.logger.log(`[TEST PROVIDER] Decrypting configuration...`);
      const config = JSON.parse(
        this.encryptionService.decrypt(provider.configuration_json),
      );
      this.logger.log(`[TEST PROVIDER] Configuration decrypted successfully`);
      this.logger.log(
        `[TEST PROVIDER] Config keys: ${Object.keys(config).join(', ')}`,
      );

      const startTime = Date.now();
      this.logger.log(
        `[TEST PROVIDER] Test started at: ${new Date(startTime).toISOString()}`,
      );

      try {
        // Make REAL API call to test the transcription provider
        let testResult: any;

        this.logger.log(
          `[TEST PROVIDER] Calling provider-specific test method...`,
        );
        switch (provider.provider_name) {
          case 'openai_whisper':
            this.logger.log(`[TEST PROVIDER] Routing to OpenAI Whisper test`);
            testResult = await this.testOpenAIWhisper(config, audioUrl);
            break;

          case 'deepgram':
            this.logger.log(`[TEST PROVIDER] Routing to Deepgram test`);
            testResult = await this.testDeepgram(config, audioUrl);
            break;

          case 'assemblyai':
            this.logger.log(`[TEST PROVIDER] Routing to AssemblyAI test`);
            testResult = await this.testAssemblyAI(config, audioUrl);
            break;

          default:
            this.logger.error(
              `[TEST PROVIDER] Unknown provider: ${provider.provider_name}`,
            );
            throw new BadRequestException(
              `Provider ${provider.provider_name} testing not yet implemented`,
            );
        }

        const responseTime = Date.now() - startTime;

        this.logger.log(`========================================`);
        this.logger.log(`[TEST PROVIDER] ✅ Test completed successfully`);
        this.logger.log(`[TEST PROVIDER] Response time: ${responseTime}ms`);
        this.logger.log(
          `[TEST PROVIDER] Test result: ${JSON.stringify(testResult)}`,
        );
        this.logger.log(`========================================`);

        return {
          test_status: 'success',
          provider_name: provider.provider_name,
          response_time_ms: responseTime,
          transcription_preview: testResult.transcription || null,
          quota_remaining: provider.usage_limit
            ? provider.usage_limit - provider.usage_current
            : null,
          api_key_valid: true,
        };
      } catch (apiError) {
        const responseTime = Date.now() - startTime;

        this.logger.error(
          `Provider ${provider.provider_name} test failed: ${apiError.message}`,
        );

        return {
          test_status: 'failed',
          provider_name: provider.provider_name,
          response_time_ms: responseTime,
          transcription_preview: null,
          quota_remaining: 0,
          api_key_valid: false,
          error_message: apiError.message,
        };
      }
    } catch (error) {
      this.logger.error(
        'Failed to test transcription provider:',
        error.message,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      return {
        test_status: 'failed',
        provider_name: 'unknown',
        response_time_ms: 0,
        transcription_preview: null,
        quota_remaining: 0,
        api_key_valid: false,
        error_message: error.message,
      };
    }
  }

  /**
   * List all transcription providers with usage statistics
   *
   * Returns all configured transcription providers (system and tenant-specific)
   * with usage statistics.
   *
   * @returns Promise<TranscriptionProviderWithStats[]>
   */
  async listProviders(): Promise<TranscriptionProviderWithStats[]> {
    this.logger.log('Listing all transcription providers');

    try {
      const providers =
        await this.prisma.transcription_provider_configuration.findMany({
          include: {
            tenant: {
              select: {
                id: true,
                company_name: true,
                subdomain: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        });

      // Get statistics for each provider
      const providersWithStats = await Promise.all(
        providers.map(async (provider) => {
          const stats = await this.getProviderUsageStats(
            provider.id,
            provider.tenant_id,
          );

          return {
            ...this.formatProviderResponse(provider),
            statistics: stats,
          };
        }),
      );

      this.logger.log(
        `Found ${providersWithStats.length} transcription providers`,
      );

      return providersWithStats;
    } catch (error) {
      this.logger.error(
        'Failed to list transcription providers:',
        error.message,
      );
      throw new BadRequestException(
        'Failed to retrieve transcription providers',
      );
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Get usage statistics for a provider
   */
  private async getProviderUsageStats(
    providerId: string,
    tenantId: string | null,
  ) {
    const provider =
      await this.prisma.transcription_provider_configuration.findUnique({
        where: { id: providerId },
      });

    if (!provider) {
      return this.getDefaultStats();
    }

    // For system default providers (tenant_id: null), count ALL transcriptions across all tenants
    // For tenant-specific providers, count only that tenant's transcriptions
    const whereClause = {
      transcription_provider: provider.provider_name,
      ...(tenantId && { tenant_id: tenantId }), // Only filter by tenant_id if it's set (not null)
    };

    const [totalCount, successCount, failedCount, totalCost] =
      await Promise.all([
        this.prisma.call_transcription.count({
          where: whereClause,
        }),
        this.prisma.call_transcription.count({
          where: {
            ...whereClause,
            status: 'completed',
          },
        }),
        this.prisma.call_transcription.count({
          where: {
            ...whereClause,
            status: 'failed',
          },
        }),
        this.prisma.call_transcription.aggregate({
          where: whereClause,
          _sum: {
            cost: true,
          },
        }),
      ]);

    return {
      total_transcriptions: totalCount,
      successful: successCount,
      failed: failedCount,
      success_rate:
        totalCount > 0
          ? ((successCount / totalCount) * 100).toFixed(2)
          : '0.00',
      total_cost: totalCost._sum.cost?.toFixed(2) || '0.00',
    };
  }

  /**
   * Get default statistics structure
   */
  private getDefaultStats() {
    return {
      total_transcriptions: 0,
      successful: 0,
      failed: 0,
      success_rate: '0.00',
      total_cost: '0.00',
    };
  }

  /**
   * Format provider response (exclude sensitive credentials)
   */
  private formatProviderResponse(provider: any): TranscriptionProviderConfig {
    // Decrypt config to get non-sensitive fields
    let model = null;
    let language = null;
    let api_endpoint = null;
    let additional_settings = {};

    try {
      const config = JSON.parse(
        this.encryptionService.decrypt(provider.configuration_json),
      );
      model = config.model || null;
      language = config.language || null;
      api_endpoint = config.api_endpoint || null;
      additional_settings = config.additional_settings || {};

      this.logger.debug(
        `[FORMAT PROVIDER] ID: ${provider.id}, Model: ${model}, Language: ${language}, Endpoint: ${api_endpoint}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to decrypt provider config for ${provider.id}: ${error.message}`,
      );
      this.logger.error(error.stack);
    }

    return {
      id: provider.id,
      provider_name: provider.provider_name,
      model,
      language,
      api_endpoint,
      additional_settings,
      tenant: provider.tenant,
      is_system_default: provider.is_system_default,
      status: provider.status,
      usage_limit: provider.usage_limit,
      usage_current: provider.usage_current,
      cost_per_minute: provider.cost_per_minute,
      created_at: provider.created_at,
      updated_at: provider.updated_at,
    };
  }

  /**
   * Test OpenAI Whisper API connectivity
   */
  private async testOpenAIWhisper(config: any, audioUrl?: string) {
    const endpoint =
      config.api_endpoint || 'https://api.openai.com/v1/audio/translations';

    this.logger.log(
      `[OpenAI Whisper Test] Starting test with audioUrl: ${audioUrl || 'NOT PROVIDED'}`,
    );
    this.logger.log(`[OpenAI Whisper Test] Endpoint: ${endpoint}`);
    this.logger.log(
      `[OpenAI Whisper Test] API Key: ${config.api_key ? config.api_key.substring(0, 10) + '...' : 'NOT SET'}`,
    );

    // If no audio URL provided, just test API key validity with a simple request
    if (!audioUrl) {
      this.logger.log(
        '[OpenAI Whisper Test] No audio URL - testing API key validity only',
      );
      this.logger.log(
        '[OpenAI Whisper Test] Making request to: https://api.openai.com/v1/models',
      );

      try {
        const response = await axios.get('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${config.api_key}`,
          },
          timeout: 10000,
        });

        this.logger.log(
          `[OpenAI Whisper Test] API Key validation response: ${response.status}`,
        );
        this.logger.log(
          `[OpenAI Whisper Test] Response data: ${JSON.stringify(response.data).substring(0, 200)}...`,
        );

        if (response.status === 200) {
          return {
            transcription:
              'API key valid. Provide audioUrl parameter to test actual transcription.',
          };
        }

        throw new Error('Invalid API key');
      } catch (error) {
        this.logger.error(
          `[OpenAI Whisper Test] API Key validation failed: ${error.message}`,
        );
        this.logger.error(
          `[OpenAI Whisper Test] Error details: ${JSON.stringify(error.response?.data || error)}`,
        );
        throw error;
      }
    }

    // If audio URL provided, transcribe it
    this.logger.log(
      '[OpenAI Whisper Test] Audio URL provided - attempting REAL transcription',
    );
    this.logger.log(`[OpenAI Whisper Test] Audio URL: ${audioUrl}`);
    this.logger.log(
      '[OpenAI Whisper Test] Step 1: Downloading audio file from URL...',
    );

    try {
      // Download the audio file from URL
      const response = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      this.logger.log(
        `[OpenAI Whisper Test] Audio file downloaded: ${response.data.byteLength} bytes`,
      );
      this.logger.log(
        `[OpenAI Whisper Test] Content-Type: ${response.headers['content-type']}`,
      );

      // Convert arraybuffer to File-like object
      const audioBuffer = Buffer.from(response.data);
      const fileName = audioUrl.split('/').pop() || 'audio.mp3';

      this.logger.log(
        `[OpenAI Whisper Test] Step 2: Creating OpenAI client...`,
      );
      const openai = new OpenAI({
        apiKey: config.api_key,
      });

      this.logger.log(
        '[OpenAI Whisper Test] Step 3: Uploading to OpenAI Whisper API...',
      );
      const transcriptionStartTime = Date.now();

      // Create a File object from the buffer
      const file = new File([audioBuffer], fileName, {
        type: response.headers['content-type'] || 'audio/mpeg',
      });

      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: config.model || 'whisper-1',
        language: config.language || 'en',
      });

      const transcriptionTime = Date.now() - transcriptionStartTime;

      this.logger.log(
        `[OpenAI Whisper Test] ✅ Transcription completed in ${transcriptionTime}ms`,
      );
      this.logger.log(
        `[OpenAI Whisper Test] Transcription text: ${transcription.text.substring(0, 100)}...`,
      );

      return {
        transcription: transcription.text,
      };
    } catch (error) {
      this.logger.error(
        `[OpenAI Whisper Test] ❌ Transcription failed: ${error.message}`,
      );
      this.logger.error(`[OpenAI Whisper Test] Error stack: ${error.stack}`);

      if (error.response) {
        this.logger.error(
          `[OpenAI Whisper Test] API Response: ${JSON.stringify(error.response.data)}`,
        );
      }

      throw new Error(`OpenAI Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Test Deepgram API connectivity
   */
  private async testDeepgram(config: any, audioUrl?: string) {
    const endpoint =
      config.api_endpoint || 'https://api.deepgram.com/v1/listen';

    // Test API key validity
    if (!audioUrl) {
      // Test by checking projects endpoint
      const response = await axios.get('https://api.deepgram.com/v1/projects', {
        headers: {
          Authorization: `Token ${config.api_key}`,
        },
        timeout: 10000,
      });

      if (response.status === 200) {
        return {
          transcription:
            'API key valid. Provide audioUrl parameter to test actual transcription.',
        };
      }

      throw new Error('Invalid API key');
    }

    // If audio URL provided, transcribe it
    const response = await axios.post(
      `${endpoint}?model=${config.model || 'nova-2'}&language=${config.language || 'en'}`,
      {
        url: audioUrl,
      },
      {
        headers: {
          Authorization: `Token ${config.api_key}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    return {
      transcription:
        response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
        'Transcription completed successfully',
    };
  }

  /**
   * Test AssemblyAI API connectivity
   */
  private async testAssemblyAI(config: any, audioUrl?: string) {
    const endpoint =
      config.api_endpoint || 'https://api.assemblyai.com/v2/transcript';

    // Test API key validity
    if (!audioUrl) {
      // Validate API key by checking account endpoint
      const response = await axios.get(
        'https://api.assemblyai.com/v2/account',
        {
          headers: {
            authorization: config.api_key,
          },
          timeout: 10000,
        },
      );

      if (response.status === 200) {
        return {
          transcription:
            'API key valid. Provide audioUrl parameter to test actual transcription.',
        };
      }

      throw new Error('Invalid API key');
    }

    // Submit transcription job
    const submitResponse = await axios.post(
      endpoint,
      {
        audio_url: audioUrl,
        language_code: config.language || 'en',
      },
      {
        headers: {
          authorization: config.api_key,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    const transcriptId = submitResponse.data.id;

    // Poll for completion (up to 30 seconds)
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            authorization: config.api_key,
          },
          timeout: 10000,
        },
      );

      if (statusResponse.data.status === 'completed') {
        return {
          transcription:
            statusResponse.data.text || 'Transcription completed successfully',
        };
      }

      if (statusResponse.data.status === 'error') {
        throw new Error(
          `AssemblyAI transcription failed: ${statusResponse.data.error}`,
        );
      }
    }

    return {
      transcription:
        'Transcription submitted successfully (still processing, check later for results)',
    };
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TranscriptionProviderConfig {
  id: string;
  provider_name: string;
  model: string | null;
  language: string | null;
  api_endpoint: string | null;
  additional_settings: any;
  tenant: any;
  is_system_default: boolean;
  status: string;
  usage_limit: number;
  usage_current: number;
  cost_per_minute: any;
  created_at: Date;
  updated_at: Date;
}

export interface TranscriptionProviderWithStats extends TranscriptionProviderConfig {
  statistics: {
    total_transcriptions: number;
    successful: number;
    failed: number;
    success_rate: string;
    total_cost: string;
  };
}

export interface ProviderTestResult {
  test_status: 'success' | 'failed';
  provider_name: string;
  response_time_ms: number;
  transcription_preview: string | null;
  quota_remaining: number | null;
  api_key_valid: boolean;
  error_message?: string;
}
