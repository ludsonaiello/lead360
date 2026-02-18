import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { UpsertCredentialDto } from '../dto/upsert-credential.dto';

/**
 * Shape returned by all public-facing credential methods.
 * Encrypted keys NEVER leave the service — only masked representation is exposed.
 */
export interface MaskedCredential {
  id: string;
  provider_id: string;
  provider_key: string;
  masked_key: string; // e.g. "****4abc"
  updated_by: string | null;
  updated_at: Date;
}

/**
 * VoiceAiCredentialsService
 *
 * Manages encrypted API credentials for Voice AI providers.
 * Security contract:
 *   - findAll()        → only masked keys in response
 *   - upsert()         → encrypts with AES-256-GCM before storing
 *   - delete()         → hard delete (credentials are admin-managed, no tenant_id)
 *   - getDecryptedKey() → INTERNAL USE ONLY — never exposed via controller
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
  async findAll(): Promise<MaskedCredential[]> {
    const creds = await this.prisma.voice_ai_credentials.findMany({
      include: {
        provider: { select: { provider_key: true } },
      },
    });

    return creds.map((c) => this.mask(c));
  }

  /**
   * Upsert a credential for the given provider.
   * Encrypts the plain api_key and derives the masked representation from
   * the PLAIN key (last 4 chars) before encryption — ciphertext is not human-readable.
   *
   * @param providerId  UUID of the voice_ai_provider row
   * @param dto         Contains the plain api_key (validated ≥10 chars)
   * @param updatedBy   User ID from JWT — never from request body
   */
  async upsert(
    providerId: string,
    dto: UpsertCredentialDto,
    updatedBy: string,
  ): Promise<MaskedCredential> {
    // Verify the provider exists before upserting
    const provider = await this.prisma.voice_ai_provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID "${providerId}" not found`);
    }

    // Derive last4 from PLAIN key before encryption — ciphertext chars are not human-readable
    const last4 = dto.api_key.slice(-4);
    const maskedApiKey = `****${last4}`;

    // EncryptionService.encrypt() is synchronous (AES-256-GCM)
    const encryptedApiKey = this.encryption.encrypt(dto.api_key);

    const cred = await this.prisma.voice_ai_credentials.upsert({
      where: { provider_id: providerId },
      create: {
        provider_id: providerId,
        encrypted_api_key: encryptedApiKey,
        masked_api_key: maskedApiKey,
        updated_by: updatedBy,
      },
      update: {
        encrypted_api_key: encryptedApiKey,
        masked_api_key: maskedApiKey,
        updated_by: updatedBy,
      },
      include: {
        provider: { select: { provider_key: true } },
      },
    });

    return this.mask(cred);
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
   * Map a Prisma credential row (with included provider) to the safe MaskedCredential shape.
   * Reads the pre-stored masked_api_key column — no derivation needed at read time.
   */
  private mask(cred: {
    id: string;
    provider_id: string;
    provider: { provider_key: string } | null;
    masked_api_key: string;
    updated_by: string | null;
    updated_at: Date;
  }): MaskedCredential {
    return {
      id: cred.id,
      provider_id: cred.provider_id,
      provider_key: cred.provider?.provider_key ?? '',
      masked_key: cred.masked_api_key,
      updated_by: cred.updated_by,
      updated_at: cred.updated_at,
    };
  }
}
