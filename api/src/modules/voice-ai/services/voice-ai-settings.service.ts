import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { tenant_voice_ai_settings } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { UpsertTenantVoiceSettingsDto } from '../dto/upsert-tenant-voice-settings.dto';
import { TenantVoiceAiSettingsDto } from '../dto/tenant-voice-settings-response.dto';
import { AdminOverrideTenantVoiceDto } from '../dto/admin-override-tenant-voice.dto';

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
   * Safely parse enabled_languages JSON string to array.
   * Returns default ['en'] if parsing fails or value is invalid.
   */
  private parseEnabledLanguages(jsonString: string | null): string[] {
    if (!jsonString) {
      return ['en'];
    }

    try {
      const parsed = JSON.parse(jsonString);
      // Validate that it's an array of strings
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return parsed;
      }
      return ['en'];
    } catch (error) {
      // Corrupted JSON - fall back to default
      return ['en'];
    }
  }

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

  /**
   * Get settings for a tenant — creates default row if first access.
   * Returns settings with plan entitlement info.
   *
   * This method ensures a settings record always exists for the tenant.
   * If no record exists, it creates one with default values.
   *
   * @param tenantId Tenant UUID
   * @returns Complete settings with plan entitlement information
   */
  async getSettings(tenantId: string): Promise<TenantVoiceAiSettingsDto> {
    // Verify tenant exists and get plan info
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscription_plan: {
          select: {
            voice_ai_enabled: true,
            voice_ai_minutes_included: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    // Get or create settings record
    let settings = await this.prisma.tenant_voice_ai_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    // Create default record on first access
    if (!settings) {
      settings = await this.prisma.tenant_voice_ai_settings.create({
        data: {
          tenant_id: tenantId,
          is_enabled: false,
          default_language: 'en',
          enabled_languages: JSON.stringify(['en']),
          booking_enabled: true,
          lead_creation_enabled: true,
          transfer_enabled: true,
        },
      });
    }

    // Parse enabled_languages from JSON safely
    const enabledLanguages = this.parseEnabledLanguages(settings.enabled_languages);

    // Build response with plan entitlement info
    return {
      id: settings.id,
      tenant_id: settings.tenant_id,
      is_enabled: settings.is_enabled,
      default_language: settings.default_language,
      enabled_languages: enabledLanguages,
      custom_greeting: settings.custom_greeting,
      custom_instructions: settings.custom_instructions,
      after_hours_behavior: settings.after_hours_behavior,
      booking_enabled: settings.booking_enabled,
      lead_creation_enabled: settings.lead_creation_enabled,
      transfer_enabled: settings.transfer_enabled,
      default_transfer_number: settings.default_transfer_number,
      default_transfer_number_id: settings.default_transfer_number_id,
      max_call_duration_seconds: settings.max_call_duration_seconds,
      created_at: settings.created_at,
      updated_at: settings.updated_at,
      updated_by: settings.updated_by,
      plan_includes_voice_ai:
        tenant.subscription_plan?.voice_ai_enabled === true,
      plan_monthly_minutes:
        tenant.subscription_plan?.voice_ai_minutes_included || 0,
      monthly_minutes_override: settings.monthly_minutes_override,
      admin_notes: settings.admin_notes,
    };
  }

  /**
   * Check if tenant can use Voice AI right now.
   * Returns { allowed: boolean, reason?: string }
   *
   * This is called by the SIP service (BAS17) before routing calls.
   *
   * @param tenantId Tenant UUID
   * @returns Entitlement check result
   */
  async checkEntitlement(
    tenantId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check if plan includes Voice AI first
    const planIncludesVoiceAi = await this.isVoiceAiIncludedInPlan(tenantId);

    if (!planIncludesVoiceAi) {
      return {
        allowed: false,
        reason: 'plan_not_included',
      };
    }

    // Get settings - this will create default row with is_enabled: false if first access
    // CRITICAL: Must use getSettings() not getTenantSettings() to ensure defaults are created
    const settings = await this.getSettings(tenantId);

    // Check if Voice AI is disabled
    if (!settings.is_enabled) {
      return {
        allowed: false,
        reason: 'disabled_by_tenant',
      };
    }

    // All checks passed
    return {
      allowed: true,
    };
  }

  /**
   * Admin override: update settings on behalf of tenant.
   * No plan restriction check (admin can override).
   *
   * This method allows platform admins to override infrastructure settings
   * like provider selection, monthly minutes, etc.
   *
   * @param tenantId Tenant UUID
   * @param dto Admin override settings
   * @param adminUserId User UUID of the admin making the change
   * @returns Updated settings with plan entitlement info
   */
  async adminOverride(
    tenantId: string,
    dto: AdminOverrideTenantVoiceDto,
    adminUserId: string,
  ): Promise<TenantVoiceAiSettingsDto> {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscription_plan: {
          select: {
            voice_ai_enabled: true,
            voice_ai_minutes_included: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    // Build update payload — only include fields explicitly provided in the DTO
    const updateData: Record<string, unknown> = {
      updated_by: adminUserId,
    };

    // Handle force_enabled override
    if (dto.force_enabled !== undefined) {
      // Note: force_enabled is not a field in the schema
      // For now, we'll update is_enabled directly
      // If you need a separate force_enabled field, add it to the schema
      if (dto.force_enabled !== null) {
        updateData.is_enabled = dto.force_enabled;
      }
    }

    if (dto.monthly_minutes_override !== undefined) {
      updateData.monthly_minutes_override = dto.monthly_minutes_override;
    }
    if (dto.stt_provider_override_id !== undefined) {
      updateData.stt_provider_override_id = dto.stt_provider_override_id;
    }
    if (dto.llm_provider_override_id !== undefined) {
      updateData.llm_provider_override_id = dto.llm_provider_override_id;
    }
    if (dto.tts_provider_override_id !== undefined) {
      updateData.tts_provider_override_id = dto.tts_provider_override_id;
    }
    if (dto.admin_notes !== undefined) {
      updateData.admin_notes = dto.admin_notes;
    }

    // Upsert the settings
    const settings = await this.prisma.tenant_voice_ai_settings.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        ...updateData,
        // Set defaults for required fields on create
        is_enabled: (updateData.is_enabled as boolean) ?? false,
        default_language: 'en',
        enabled_languages: JSON.stringify(['en']),
        booking_enabled: true,
        lead_creation_enabled: true,
        transfer_enabled: true,
      },
      update: updateData,
    });

    // Parse enabled_languages from JSON safely
    const enabledLanguages = this.parseEnabledLanguages(settings.enabled_languages);

    // Build response with plan entitlement info
    return {
      id: settings.id,
      tenant_id: settings.tenant_id,
      is_enabled: settings.is_enabled,
      default_language: settings.default_language,
      enabled_languages: enabledLanguages,
      custom_greeting: settings.custom_greeting,
      custom_instructions: settings.custom_instructions,
      after_hours_behavior: settings.after_hours_behavior,
      booking_enabled: settings.booking_enabled,
      lead_creation_enabled: settings.lead_creation_enabled,
      transfer_enabled: settings.transfer_enabled,
      default_transfer_number: settings.default_transfer_number,
      default_transfer_number_id: settings.default_transfer_number_id,
      max_call_duration_seconds: settings.max_call_duration_seconds,
      created_at: settings.created_at,
      updated_at: settings.updated_at,
      updated_by: settings.updated_by,
      plan_includes_voice_ai:
        tenant.subscription_plan?.voice_ai_enabled === true,
      plan_monthly_minutes:
        tenant.subscription_plan?.voice_ai_minutes_included || 0,
      monthly_minutes_override: settings.monthly_minutes_override,
      admin_notes: settings.admin_notes,
    };
  }
}
