import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { UpsertCredentialDto } from '../dto/upsert-credential.dto';
import { SafeCredentialDto } from '../dto/safe-credential.dto';

/**
 * VoiceAiCredentialsService
 *
 * Manages encrypted API credentials for Voice AI providers.
 * Security contract:
 *   - findAll()         → only masked keys in response
 *   - findByProviderId() → get single credential by provider ID (masked)
 *   - upsert()          → encrypts with AES-256-GCM before storing
 *   - delete()          → hard delete (credentials are admin-managed, no tenant_id)
 *   - getDecryptedKey() → INTERNAL USE ONLY — never exposed via controller
 *   - testConnection()  → validate stored API key with provider API
 */
@Injectable()
export class VoiceAiCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * List all credentials with masked keys only.
   * Reads the pre-computed masked_api_key column — no decryption performed.
   */
  async findAll(): Promise<SafeCredentialDto[]> {
    const creds = await this.prisma.voice_ai_credentials.findMany();

    return creds.map((c) => this.toSafeDto(c));
  }

  /**
   * Get credential for a specific provider (by provider ID).
   * Returns null if no credential set yet.
   * Returns only masked key — no decryption performed.
   */
  async findByProviderId(providerId: string): Promise<SafeCredentialDto | null> {
    const cred = await this.prisma.voice_ai_credentials.findUnique({
      where: { provider_id: providerId },
    });

    if (!cred) {
      return null;
    }

    return this.toSafeDto(cred);
  }

  /**
   * Upsert a credential for the given provider.
   * Encrypts the plain api_key and derives the masked representation from
   * the PLAIN key (last 4 chars) before encryption — ciphertext is not human-readable.
   *
   * @param providerId  UUID of the voice_ai_provider row
   * @param dto         Contains the plain api_key (validated ≥10 chars) and optional additional_config
   * @param updatedBy   User ID from JWT — never from request body
   */
  async upsert(
    providerId: string,
    dto: UpsertCredentialDto,
    updatedBy: string,
  ): Promise<SafeCredentialDto> {
    // Verify the provider exists before upserting
    const provider = await this.prisma.voice_ai_provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID "${providerId}" not found`);
    }

    // Derive masked key from PLAIN key (first 4 + ... + last 4)
    // Match the format specified in sprint: first 4 + ... + last 4
    const first4 = dto.api_key.slice(0, 4);
    const last4 = dto.api_key.slice(-4);
    const maskedApiKey = `${first4}...${last4}`;

    // EncryptionService.encrypt() is synchronous (AES-256-GCM)
    const encryptedApiKey = this.encryption.encrypt(dto.api_key);

    const cred = await this.prisma.voice_ai_credentials.upsert({
      where: { provider_id: providerId },
      create: {
        provider_id: providerId,
        encrypted_api_key: encryptedApiKey,
        masked_api_key: maskedApiKey,
        additional_config: dto.additional_config ?? null,
        updated_by: updatedBy,
      },
      update: {
        encrypted_api_key: encryptedApiKey,
        masked_api_key: maskedApiKey,
        additional_config: dto.additional_config ?? null,
        updated_by: updatedBy,
      },
    });

    return this.toSafeDto(cred);
  }

  /**
   * Delete the credential for the given provider.
   * Throws 404 if no credential exists.
   */
  async delete(providerId: string): Promise<void> {
    // Verify credential exists before attempting delete (gives proper 404 vs Prisma P2025)
    const existing = await this.prisma.voice_ai_credentials.findUnique({
      where: { provider_id: providerId },
    });

    if (!existing) {
      throw new NotFoundException(
        `No credential found for provider ID "${providerId}"`,
      );
    }

    await this.prisma.voice_ai_credentials.delete({
      where: { provider_id: providerId },
    });
  }

  /**
   * Test if the stored API key is valid by attempting a lightweight API call.
   *
   * - For Deepgram: attempts to list available models
   * - For OpenAI: attempts to list available models
   * - For Cartesia: attempts to list available voices
   *
   * @param providerId UUID of the voice_ai_provider row
   * @returns Object with success status and descriptive message
   */
  async testConnection(providerId: string): Promise<{ success: boolean; message: string }> {
    // Get the provider to determine which API to test
    const provider = await this.prisma.voice_ai_provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID "${providerId}" not found`);
    }

    // Get the decrypted API key
    let apiKey: string;
    try {
      apiKey = await this.getDecryptedKey(providerId);
    } catch (error) {
      return {
        success: false,
        message: `No credential found for provider "${provider.display_name}"`,
      };
    }

    // Test the connection based on provider type
    try {
      switch (provider.provider_key.toLowerCase()) {
        case 'deepgram':
          await this.testDeepgramConnection(apiKey);
          break;
        case 'openai':
          await this.testOpenAIConnection(apiKey);
          break;
        case 'cartesia':
          await this.testCartesiaConnection(apiKey);
          break;
        default:
          return {
            success: false,
            message: `Unknown provider type: ${provider.provider_key}`,
          };
      }

      return {
        success: true,
        message: `Successfully validated ${provider.display_name} API key`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Failed to validate ${provider.display_name} API key: ${errorMessage}`,
      };
    }
  }

  /**
   * Retrieve the decrypted API key for a provider.
   *
   * INTERNAL USE ONLY — used by the context builder (Sprint B06) to pass
   * credentials to the Python agent. This method is NEVER called from a controller.
   * Decrypted keys must not be cached.
   */
  async getDecryptedKey(providerId: string): Promise<string> {
    const cred = await this.prisma.voice_ai_credentials.findUnique({
      where: { provider_id: providerId },
    });

    if (!cred) {
      throw new NotFoundException(
        `No credential found for provider ID "${providerId}"`,
      );
    }

    // EncryptionService.decrypt() is synchronous
    return this.encryption.decrypt(cred.encrypted_api_key);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Map a Prisma credential row to the safe SafeCredentialDto shape.
   * Reads the pre-stored masked_api_key column — no derivation needed at read time.
   */
  private toSafeDto(cred: {
    id: string;
    provider_id: string;
    masked_api_key: string;
    additional_config: string | null;
    created_at: Date;
    updated_at: Date;
    updated_by: string | null;
  }): SafeCredentialDto {
    return {
      id: cred.id,
      provider_id: cred.provider_id,
      masked_api_key: cred.masked_api_key,
      additional_config: cred.additional_config,
      created_at: cred.created_at,
      updated_at: cred.updated_at,
      updated_by: cred.updated_by,
    };
  }

  /**
   * Test Deepgram API connection by attempting to list available projects.
   * Throws error if API key is invalid or request times out (10s).
   */
  private async testDeepgramConnection(apiKey: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        method: 'GET',
        headers: {
          Authorization: `Token ${apiKey}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Deepgram API returned status ${response.status}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Deepgram API request timed out after 10 seconds');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Test OpenAI API connection by attempting to list available models.
   * Throws error if API key is invalid or request times out (10s).
   */
  private async testOpenAIConnection(apiKey: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API returned status ${response.status}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('OpenAI API request timed out after 10 seconds');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Test Cartesia API connection by attempting to list available voices.
   * Throws error if API key is invalid or request times out (10s).
   */
  private async testCartesiaConnection(apiKey: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch('https://api.cartesia.ai/voices', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Cartesia-Version': '2024-06-10',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Cartesia API returned status ${response.status}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Cartesia API request timed out after 10 seconds');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
