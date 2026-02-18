import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { voice_ai_global_config } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { UpdateGlobalConfigDto } from '../dto/update-global-config.dto';

/**
 * Shape returned by getConfig().
 * LiveKit keys and agent_api_key_hash are NEVER included.
 * Only the preview and a boolean presence flag for LiveKit keys.
 */
export interface SafeGlobalConfig {
  id: string;
  default_stt_provider_id: string | null;
  default_llm_provider_id: string | null;
  default_tts_provider_id: string | null;
  default_stt_config: string | null;
  default_llm_config: string | null;
  default_tts_config: string | null;
  default_voice_id: string | null;
  default_language: string;
  default_languages: string;
  default_greeting_template: string;
  default_system_prompt: string;
  default_max_call_duration_seconds: number;
  default_transfer_behavior: string;
  default_tools_enabled: string;
  livekit_sip_trunk_url: string | null;
  /** true when livekit_api_key is stored, false otherwise — key itself is never returned */
  livekit_api_key_set: boolean;
  /** true when livekit_api_secret is stored, false otherwise */
  livekit_api_secret_set: boolean;
  agent_api_key_preview: string | null;
  max_concurrent_calls: number;
  updated_at: Date;
  updated_by: string | null;
}

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
   * LiveKit API keys and the agent key hash are masked from the response.
   */
  async getConfig(): Promise<SafeGlobalConfig> {
    const config = await this.prisma.voice_ai_global_config.findUnique({
      where: { id: this.SINGLETON_ID },
    });

    if (!config) {
      throw new BadRequestException(
        'Global config has not been initialized. Run the database seed.',
      );
    }

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
  ): Promise<SafeGlobalConfig> {
    this.validateJsonFields(dto);

    // Build the update payload, encrypting LiveKit keys if provided
    const updateData: Partial<Record<string, unknown>> = {};

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
    if (dto.livekit_sip_trunk_url !== undefined)
      updateData.livekit_sip_trunk_url = dto.livekit_sip_trunk_url;
    if (dto.max_concurrent_calls !== undefined)
      updateData.max_concurrent_calls = dto.max_concurrent_calls;

    // Encrypt LiveKit keys — never store plaintext
    if (dto.livekit_api_key !== undefined) {
      updateData.livekit_api_key = this.encryption.encrypt(dto.livekit_api_key);
    }
    if (dto.livekit_api_secret !== undefined) {
      updateData.livekit_api_secret = this.encryption.encrypt(
        dto.livekit_api_secret,
      );
    }

    updateData.updated_by = userId;

    const config = await this.prisma.voice_ai_global_config.upsert({
      where: { id: this.SINGLETON_ID },
      create: {
        id: this.SINGLETON_ID,
        ...updateData,
      },
      update: updateData,
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Strip sensitive fields from the Prisma row before sending to the client.
   * - livekit_api_key → replaced with boolean livekit_api_key_set
   * - livekit_api_secret → replaced with boolean livekit_api_secret_set
   * - agent_api_key_hash → omitted entirely; preview remains
   */
  private toSafeConfig(config: voice_ai_global_config): SafeGlobalConfig {
    return {
      id: config.id,
      default_stt_provider_id: config.default_stt_provider_id,
      default_llm_provider_id: config.default_llm_provider_id,
      default_tts_provider_id: config.default_tts_provider_id,
      default_stt_config: config.default_stt_config,
      default_llm_config: config.default_llm_config,
      default_tts_config: config.default_tts_config,
      default_voice_id: config.default_voice_id,
      default_language: config.default_language,
      default_languages: config.default_languages,
      default_greeting_template: config.default_greeting_template,
      default_system_prompt: config.default_system_prompt,
      default_max_call_duration_seconds: config.default_max_call_duration_seconds,
      default_transfer_behavior: config.default_transfer_behavior,
      default_tools_enabled: config.default_tools_enabled,
      livekit_sip_trunk_url: config.livekit_sip_trunk_url,
      livekit_api_key_set: config.livekit_api_key !== null,
      livekit_api_secret_set: config.livekit_api_secret !== null,
      agent_api_key_preview: config.agent_api_key_preview,
      max_concurrent_calls: config.max_concurrent_calls,
      updated_at: config.updated_at,
      updated_by: config.updated_by,
    };
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
