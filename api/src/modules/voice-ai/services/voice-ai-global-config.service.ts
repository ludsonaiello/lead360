import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { voice_ai_global_config } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { UpdateGlobalConfigDto } from '../dto/update-global-config.dto';
import {
  GlobalConfigResponseDto,
  SafeProviderInfo,
} from '../dto/global-config-response.dto';

/**
 * VoiceAiGlobalConfigService
 *
 * Manages the singleton voice_ai_global_config row (id = 'default').
 *
 * Security contract:
 *   - getConfig()          → safe shape with no raw LiveKit keys or hash
 *   - updateConfig()       → encrypts LiveKit keys when provided; records updated_by
 *   - regenerateAgentKey() → creates SHA-256(hex) hash; plain key returned ONCE, never stored
 *
 * Used by Sprint B04 context builder to read resolved defaults.
 */
@Injectable()
export class VoiceAiGlobalConfigService {
  private readonly SINGLETON_ID = 'default';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Retrieve the global config singleton.
   * Creates the row with defaults if it doesn't exist (upsert pattern).
   * Returns response WITH relation details (provider display_name).
   * LiveKit API keys and the agent key hash are masked from the response.
   */
  async getConfig(): Promise<GlobalConfigResponseDto> {
    // Upsert to ensure the singleton row exists
    const config = await this.prisma.voice_ai_global_config.upsert({
      where: { id: this.SINGLETON_ID },
      create: {
        id: this.SINGLETON_ID,
      },
      update: {},
      include: {
        stt_provider: true,
        llm_provider: true,
        tts_provider: true,
      },
    });

    return this.toSafeConfig(config);
  }

  /**
   * Update the global config singleton.
   * Encrypts livekit_api_key and livekit_api_secret when provided.
   * Records the user who made the change via updated_by.
   *
   * Uses upsert so the singleton row is created if it somehow doesn't exist.
   */
  async updateConfig(
    userId: string,
    dto: UpdateGlobalConfigDto,
  ): Promise<GlobalConfigResponseDto> {
    this.validateJsonFields(dto);

    // Build the update payload, encrypting LiveKit keys if provided
    const updateData: Partial<Record<string, unknown>> = {};

    if (dto.agent_enabled !== undefined)
      updateData.agent_enabled = dto.agent_enabled;
    if (dto.default_stt_provider_id !== undefined)
      updateData.default_stt_provider_id = dto.default_stt_provider_id;
    if (dto.default_llm_provider_id !== undefined)
      updateData.default_llm_provider_id = dto.default_llm_provider_id;
    if (dto.default_tts_provider_id !== undefined)
      updateData.default_tts_provider_id = dto.default_tts_provider_id;
    if (dto.default_voice_id !== undefined)
      updateData.default_voice_id = dto.default_voice_id;
    if (dto.default_language !== undefined)
      updateData.default_language = dto.default_language;
    if (dto.default_languages !== undefined)
      updateData.default_languages = dto.default_languages;
    if (dto.default_greeting_template !== undefined)
      updateData.default_greeting_template = dto.default_greeting_template;
    if (dto.default_system_prompt !== undefined)
      updateData.default_system_prompt = dto.default_system_prompt;
    if (dto.default_max_call_duration_seconds !== undefined)
      updateData.default_max_call_duration_seconds =
        dto.default_max_call_duration_seconds;
    if (dto.default_transfer_behavior !== undefined)
      updateData.default_transfer_behavior = dto.default_transfer_behavior;
    if (dto.default_tools_enabled !== undefined)
      updateData.default_tools_enabled = dto.default_tools_enabled;
    if (dto.default_stt_config !== undefined)
      updateData.default_stt_config = dto.default_stt_config;
    if (dto.default_llm_config !== undefined)
      updateData.default_llm_config = dto.default_llm_config;
    if (dto.default_tts_config !== undefined)
      updateData.default_tts_config = dto.default_tts_config;
    if (dto.livekit_url !== undefined)
      updateData.livekit_url = dto.livekit_url;
    if (dto.livekit_sip_trunk_url !== undefined)
      updateData.livekit_sip_trunk_url = dto.livekit_sip_trunk_url;
    if (dto.max_concurrent_calls !== undefined)
      updateData.max_concurrent_calls = dto.max_concurrent_calls;

    // Encrypt LiveKit keys — never store plaintext
    // Handle three cases: undefined (don't update), null (clear), string (encrypt)
    if (dto.livekit_api_key !== undefined) {
      updateData.livekit_api_key =
        dto.livekit_api_key !== null
          ? this.encryption.encrypt(dto.livekit_api_key)
          : null;
    }
    if (dto.livekit_api_secret !== undefined) {
      updateData.livekit_api_secret =
        dto.livekit_api_secret !== null
          ? this.encryption.encrypt(dto.livekit_api_secret)
          : null;
    }

    updateData.updated_by = userId;

    const config = await this.prisma.voice_ai_global_config.upsert({
      where: { id: this.SINGLETON_ID },
      create: {
        id: this.SINGLETON_ID,
        ...updateData,
      },
      update: updateData,
      include: {
        stt_provider: true,
        llm_provider: true,
        tts_provider: true,
      },
    });

    return this.toSafeConfig(config);
  }

  /**
   * Regenerate the agent API key.
   *
   * Steps:
   *  1. Generate a cryptographically random UUID as the plain key.
   *  2. Hash it with SHA-256 and store the HEX digest (64 chars) in agent_api_key_hash.
   *     (B06a VoiceAgentKeyGuard performs timing-safe hex comparison against this value.)
   *  3. Store the last 4 chars of the UUID as agent_api_key_preview for UI display.
   *  4. Return the plain key ONCE — it is never persisted.
   */
  async regenerateAgentKey(): Promise<{
    plain_key: string;
    preview: string;
    warning: string;
  }> {
    const plainKey = randomUUID();
    const hash = createHash('sha256').update(plainKey).digest('hex'); // 64-char hex string
    const preview = `...${plainKey.slice(-4)}`;

    await this.prisma.voice_ai_global_config.upsert({
      where: { id: this.SINGLETON_ID },
      create: {
        id: this.SINGLETON_ID,
        agent_api_key_hash: hash,
        agent_api_key_preview: preview,
      },
      update: {
        agent_api_key_hash: hash,
        agent_api_key_preview: preview,
      },
    });

    return {
      plain_key: plainKey,
      preview,
      warning: 'Save this key now. It will not be shown again.',
    };
  }

  /**
   * Retrieve the raw config for internal use (e.g. context builder in B04/B06).
   * Returns the full Prisma row including encrypted LiveKit keys.
   * NEVER expose this method via a controller.
   */
  async getRawConfig(): Promise<voice_ai_global_config | null> {
    return this.prisma.voice_ai_global_config.findUnique({
      where: { id: this.SINGLETON_ID },
    });
  }

  /**
   * Get LiveKit connection details (decrypted) for agent worker (BAS19).
   * INTERNAL USE ONLY - never expose via controller.
   *
   * Returns decrypted LiveKit URL, API key, and API secret.
   * Throws BadRequestException if LiveKit credentials are not configured.
   */
  async getLiveKitConfig(): Promise<{
    url: string;
    apiKey: string;
    apiSecret: string;
  }> {
    const config = await this.getRawConfig();

    if (!config) {
      throw new BadRequestException(
        'Global config has not been initialized. Run the database seed.',
      );
    }

    if (!config.livekit_url) {
      throw new BadRequestException(
        'LiveKit URL is not configured in global config.',
      );
    }

    if (!config.livekit_api_key || !config.livekit_api_secret) {
      throw new BadRequestException(
        'LiveKit API credentials are not configured in global config.',
      );
    }

    // Decrypt the LiveKit credentials
    const apiKey = this.encryption.decrypt(config.livekit_api_key);
    const apiSecret = this.encryption.decrypt(config.livekit_api_secret);

    return {
      url: config.livekit_url,
      apiKey,
      apiSecret,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Strip sensitive fields from the Prisma row before sending to the client.
   * - livekit_api_key → replaced with boolean livekit_api_key_set
   * - livekit_api_secret → replaced with boolean livekit_api_secret_set
   * - agent_api_key_hash → omitted entirely; preview remains
   * - Includes resolved provider objects (display_name, provider_key)
   */
  private toSafeConfig(config: any): GlobalConfigResponseDto {
    const dto = new GlobalConfigResponseDto();

    dto.id = config.id;
    dto.agent_enabled = config.agent_enabled;
    dto.default_stt_config = config.default_stt_config;
    dto.default_llm_config = config.default_llm_config;
    dto.default_tts_config = config.default_tts_config;
    dto.default_voice_id = config.default_voice_id;
    dto.default_language = config.default_language;
    dto.default_languages = config.default_languages;
    dto.default_greeting_template = config.default_greeting_template;
    dto.default_system_prompt = config.default_system_prompt;
    dto.default_max_call_duration_seconds =
      config.default_max_call_duration_seconds;
    dto.default_transfer_behavior = config.default_transfer_behavior;
    dto.default_tools_enabled = config.default_tools_enabled;
    dto.livekit_url = config.livekit_url;
    dto.livekit_sip_trunk_url = config.livekit_sip_trunk_url;
    dto.livekit_api_key_set = config.livekit_api_key !== null;
    dto.livekit_api_secret_set = config.livekit_api_secret !== null;
    dto.agent_api_key_preview = config.agent_api_key_preview;
    dto.max_concurrent_calls = config.max_concurrent_calls;
    dto.updated_at = config.updated_at;
    dto.updated_by = config.updated_by;

    // Map provider relations to safe info objects
    dto.default_stt_provider = config.stt_provider
      ? this.toSafeProvider(config.stt_provider)
      : null;
    dto.default_llm_provider = config.llm_provider
      ? this.toSafeProvider(config.llm_provider)
      : null;
    dto.default_tts_provider = config.tts_provider
      ? this.toSafeProvider(config.tts_provider)
      : null;

    return dto;
  }

  /**
   * Map voice_ai_provider to safe provider info.
   */
  private toSafeProvider(provider: any): SafeProviderInfo {
    const info = new SafeProviderInfo();
    info.id = provider.id;
    info.provider_key = provider.provider_key;
    info.provider_type = provider.provider_type;
    info.display_name = provider.display_name;
    return info;
  }

  /**
   * Validate that JSON string fields (if provided) are parseable JSON.
   * Throws 400 BadRequestException with a descriptive message on failure.
   */
  private validateJsonFields(dto: UpdateGlobalConfigDto): void {
    const jsonFields: Array<{ field: string; value: string | undefined }> = [
      { field: 'default_languages', value: dto.default_languages },
      { field: 'default_tools_enabled', value: dto.default_tools_enabled },
      { field: 'default_stt_config', value: dto.default_stt_config },
      { field: 'default_llm_config', value: dto.default_llm_config },
      { field: 'default_tts_config', value: dto.default_tts_config },
    ];

    for (const { field, value } of jsonFields) {
      if (value !== undefined) {
        try {
          JSON.parse(value);
        } catch {
          throw new BadRequestException(
            `Field "${field}" must be valid JSON. Received: ${value}`,
          );
        }
      }
    }
  }
}
