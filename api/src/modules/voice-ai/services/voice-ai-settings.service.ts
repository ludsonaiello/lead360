import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { tenant_voice_ai_settings } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { UpsertTenantVoiceSettingsDto } from '../dto/upsert-tenant-voice-settings.dto';

/**
 * VoiceAiSettingsService
 *
 * Manages per-tenant Voice AI behavior settings.
 *
 * Security rules:
 *   - getTenantSettings()  → read tenant's own settings (or null if never configured)
 *   - upsertTenantSettings() → write behavior fields only; infrastructure overrides are admin-only (B11)
 *   - isVoiceAiIncludedInPlan() → joins tenant → subscription_plan → voice_ai_enabled
 *
 * GUARD: enabling Voice AI requires the subscription plan to have voice_ai_enabled = true.
 * Tenants on plans without this flag receive a 403 ForbiddenException.
 */
@Injectable()
export class VoiceAiSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve the tenant's current Voice AI settings.
   * Returns null if the tenant has never configured them — callers should
   * fall back to global defaults (handled by the context builder).
   */
  async getTenantSettings(
    tenantId: string,
  ): Promise<tenant_voice_ai_settings | null> {
    return this.prisma.tenant_voice_ai_settings.findUnique({
      where: { tenant_id: tenantId },
    });
  }

  /**
   * Create or update tenant Voice AI behavior settings.
   *
   * Only behavior fields can be written here.
   * Infrastructure override fields (provider IDs, monthly_minutes_override, admin_notes,
   * stt/llm/tts_config_override, voice_id_override) are admin-only and must not appear in this DTO.
   *
   * GUARD: If is_enabled is being set to true, verifies that the tenant's subscription plan
   * includes Voice AI. Throws 403 if not.
   *
   * @param tenantId  Derived from JWT — never from the request body
   * @param dto       Validated behavior settings
   */
  async upsertTenantSettings(
    tenantId: string,
    dto: UpsertTenantVoiceSettingsDto,
  ): Promise<tenant_voice_ai_settings> {
    // Plan guard: enabling Voice AI requires plan to have voice_ai_enabled = true
    if (dto.is_enabled === true) {
      const planIncludesVoiceAi = await this.isVoiceAiIncludedInPlan(tenantId);
      if (!planIncludesVoiceAi) {
        throw new ForbiddenException(
          'Your current subscription plan does not include Voice AI. Please upgrade your plan to enable this feature.',
        );
      }
    }

    // Serialize enabled_languages string[] to JSON text for storage.
    // Use loose != null (not !== undefined) so that an explicitly passed null value
    // from a misbehaving client does NOT become the string "null" in the database.
    // Both null and undefined are treated as "field not provided — keep existing value".
    const enabledLanguagesJson =
      dto.enabled_languages != null
        ? JSON.stringify(dto.enabled_languages)
        : undefined;

    // Build update payload — only include fields explicitly provided in the DTO.
    // This enables true PATCH semantics: unset fields are NOT overwritten.
    const updateData: Record<string, unknown> = {};
    if (dto.is_enabled !== undefined) updateData.is_enabled = dto.is_enabled;
    if (enabledLanguagesJson !== undefined)
      updateData.enabled_languages = enabledLanguagesJson;
    if (dto.custom_greeting !== undefined)
      updateData.custom_greeting = dto.custom_greeting;
    if (dto.custom_instructions !== undefined)
      updateData.custom_instructions = dto.custom_instructions;
    if (dto.booking_enabled !== undefined)
      updateData.booking_enabled = dto.booking_enabled;
    if (dto.lead_creation_enabled !== undefined)
      updateData.lead_creation_enabled = dto.lead_creation_enabled;
    if (dto.transfer_enabled !== undefined)
      updateData.transfer_enabled = dto.transfer_enabled;
    if (dto.default_transfer_number !== undefined)
      updateData.default_transfer_number = dto.default_transfer_number;
    if (dto.max_call_duration_seconds !== undefined)
      updateData.max_call_duration_seconds = dto.max_call_duration_seconds;

    return this.prisma.tenant_voice_ai_settings.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        ...updateData,
      },
      update: updateData,
    });
  }

  /**
   * Check whether the tenant's current subscription plan includes Voice AI.
   *
   * Joins: tenant → subscription_plan → voice_ai_enabled
   * Returns false if tenant has no plan assigned (trial / unassigned).
   *
   * @throws NotFoundException if tenantId does not exist in the database
   */
  async isVoiceAiIncludedInPlan(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscription_plan: {
          select: { voice_ai_enabled: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    return tenant.subscription_plan?.voice_ai_enabled === true;
  }
}
