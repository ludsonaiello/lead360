import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { VoiceAiCredentialsService } from './voice-ai-credentials.service';
import { VoiceAiGlobalConfigService } from './voice-ai-global-config.service';
import { VoiceTransferNumbersService } from './voice-transfer-numbers.service';

/**
 * Full merged context returned to the Python voice agent.
 *
 * Contains all data the agent needs for a single tenant:
 * - Tenant identity (company name, phone, timezone)
 * - Monthly usage quota
 * - Behavior configuration (greeting, features, duration limit)
 * - Decrypted provider credentials (STT, LLM, TTS)
 * - Services the business offers
 * - Geographic service areas
 * - Transfer numbers (ordered by display_order ASC)
 *
 * SECURITY: api_key fields contain DECRYPTED credentials.
 *   This object must NEVER be cached or logged.
 *   It is used exclusively for the internal agent endpoint (Sprint B06a).
 */
export interface FullVoiceAiContext {
  tenant: {
    id: string;
    company_name: string;
    phone: string | null;
    timezone: string;
    language: string | null;
  };
  quota: {
    minutes_included: number;
    minutes_used: number;
    minutes_remaining: number;
    overage_rate: number | null;
    quota_exceeded: boolean;
  };
  behavior: {
    is_enabled: boolean;
    language: string;
    greeting: string;
    custom_instructions: string | null;
    booking_enabled: boolean;
    lead_creation_enabled: boolean;
    transfer_enabled: boolean;
    max_call_duration_seconds: number;
  };
  providers: {
    /** provider_id: UUID of voice_ai_provider row — used by Python agent for usage tracking */
    stt: {
      provider_id: string;
      provider_key: string;
      api_key: string;
      config: Record<string, unknown>;
      cost_per_unit: number | null;
      cost_unit: string | null;
    } | null;
    llm: {
      provider_id: string;
      provider_key: string;
      api_key: string;
      config: Record<string, unknown>;
      cost_per_unit: number | null;
      cost_unit: string | null;
    } | null;
    tts: {
      provider_id: string;
      provider_key: string;
      api_key: string;
      config: Record<string, unknown>;
      voice_id: string | null;
      cost_per_unit: number | null;
      cost_unit: string | null;
    } | null;
  };
  services: Array<{ name: string; description: string | null }>;
  service_areas: Array<{ type: string; value: string; state: string | null }>;
  transfer_numbers: Array<{
    label: string;
    phone_number: string;
    transfer_type: string;
    is_default: boolean;
    available_hours: string | null;
  }>;
}

/**
 * VoiceAiContextBuilderService
 *
 * Assembles the complete FullVoiceAiContext for a tenant in one operation.
 * Used by the internal agent endpoint (Sprint B06a) to give the Python agent
 * everything it needs to handle a call.
 *
 * Architecture:
 *   - LAYER 1 (global defaults): voice_ai_global_config singleton
 *   - LAYER 2 (tenant behavior): tenant_voice_ai_settings (may be null → use defaults)
 *   - Provider selection: tenant override IDs → fall back to global config IDs
 *   - Quota: inline STT-seconds aggregation (VoiceUsageService from B07 does not exist yet)
 *   - Transfer numbers: delegated to VoiceTransferNumbersService (B05)
 *
 * NOTE: Quota logic is implemented inline here rather than delegated to VoiceUsageService.
 *   This avoids a circular dependency risk and keeps the context builder self-contained.
 *   The inline logic is intentionally identical to VoiceUsageService.getQuota().
 *
 * SECURITY:
 *   - Credentials are decrypted at call time via VoiceAiCredentialsService.getDecryptedKey()
 *   - Decrypted keys are NEVER cached — they exist only in the returned object lifetime
 *   - If a provider has no credential stored, its slot is set to null (not an error)
 */
@Injectable()
export class VoiceAiContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsService: VoiceAiCredentialsService,
    private readonly globalConfigService: VoiceAiGlobalConfigService,
    private readonly transferNumbersService: VoiceTransferNumbersService,
  ) {}

  /**
   * Build the complete merged context for a tenant.
   *
   * Execution order:
   *   1. Load tenant + subscription_plan in parallel with tenant settings + global config
   *   2. Inline quota calculation (aggregate STT usage_quantity for current month)
   *   3. Resolve provider IDs (tenant override → global default)
   *   4. Load provider rows + decrypt credentials (parallel)
   *   5. Load services, service_areas, transfer_numbers (parallel)
   *   6. Assemble and return FullVoiceAiContext
   *
   * @param tenantId  UUID of the tenant — sourced from the call routing params, NOT from JWT
   * @throws NotFoundException if tenant does not exist
   * @throws BadRequestException if global config has not been initialized
   */
  async buildContext(tenantId: string): Promise<FullVoiceAiContext> {
    // Step 1: Load tenant, tenant settings, and global config concurrently
    const [tenant, tenantSettings, globalConfig] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          company_name: true,
          primary_contact_phone: true,
          timezone: true,
          default_language: true,
          subscription_plan: {
            select: {
              voice_ai_enabled: true,
              voice_ai_minutes_included: true,
              voice_ai_overage_rate: true,
            },
          },
        },
      }),
      this.prisma.tenant_voice_ai_settings.findUnique({
        where: { tenant_id: tenantId },
      }),
      this.globalConfigService.getRawConfig(),
    ]);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    if (!globalConfig) {
      throw new BadRequestException(
        'Global Voice AI configuration has not been initialized. Run the database seed.',
      );
    }

    // Step 2: Inline quota calculation
    // Quota logic mirrors VoiceUsageService.getQuota() and is kept inline intentionally
    // to keep this service self-contained (avoids an extra constructor dependency).
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() is 0-indexed

    // Minutes limit: tenant-level admin override takes precedence over plan default
    const minutesIncluded =
      tenantSettings?.monthly_minutes_override ??
      (tenant.subscription_plan?.voice_ai_minutes_included ?? 0);

    // Overage rate: null means calls are blocked when quota is exceeded (no overage billing)
    const overageRate =
      tenant.subscription_plan?.voice_ai_overage_rate != null
        ? Number(tenant.subscription_plan.voice_ai_overage_rate)
        : null;

    // Aggregate STT seconds for current month (Prisma returns Decimal — convert before Math.ceil)
    const sttAgg = await this.prisma.voice_usage_record.aggregate({
      where: {
        tenant_id: tenantId,
        year,
        month,
        provider_type: 'STT',
      },
      _sum: { usage_quantity: true },
    });

    const sttSeconds = Number(sttAgg._sum.usage_quantity ?? 0); // Decimal → number
    const minutesUsed = Math.ceil(sttSeconds / 60);
    const minutesRemaining = Math.max(0, minutesIncluded - minutesUsed);
    // quota_exceeded = true only when there is NO overage pricing configured.
    // Tenants with an overage_rate can continue calling at cost beyond their quota.
    const quotaExceeded = minutesUsed >= minutesIncluded && overageRate === null;

    // Step 3: Resolve provider IDs — tenant admin override → global config fallback
    const resolvedSttProviderId =
      tenantSettings?.stt_provider_override_id ??
      globalConfig.default_stt_provider_id;
    const resolvedLlmProviderId =
      tenantSettings?.llm_provider_override_id ??
      globalConfig.default_llm_provider_id;
    const resolvedTtsProviderId =
      tenantSettings?.tts_provider_override_id ??
      globalConfig.default_tts_provider_id;

    // Step 4: Load provider rows and decrypt credentials concurrently.
    // If a provider ID resolves to null (none configured) → that slot is null.
    // If a credential does not exist for a configured provider → slot is null (soft failure).
    const [sttProvider, llmProvider, ttsProvider] = await Promise.all([
      resolvedSttProviderId
        ? this.prisma.voice_ai_provider.findUnique({
            where: { id: resolvedSttProviderId },
          })
        : Promise.resolve(null),
      resolvedLlmProviderId
        ? this.prisma.voice_ai_provider.findUnique({
            where: { id: resolvedLlmProviderId },
          })
        : Promise.resolve(null),
      resolvedTtsProviderId
        ? this.prisma.voice_ai_provider.findUnique({
            where: { id: resolvedTtsProviderId },
          })
        : Promise.resolve(null),
    ]);

    // Decrypt credentials — soft-fail if credential not stored (returns null rather than throwing)
    const [sttApiKey, llmApiKey, ttsApiKey] = await Promise.all([
      resolvedSttProviderId && sttProvider
        ? this.credentialsService
            .getDecryptedKey(resolvedSttProviderId)
            .catch(() => null)
        : Promise.resolve(null),
      resolvedLlmProviderId && llmProvider
        ? this.credentialsService
            .getDecryptedKey(resolvedLlmProviderId)
            .catch(() => null)
        : Promise.resolve(null),
      resolvedTtsProviderId && ttsProvider
        ? this.credentialsService
            .getDecryptedKey(resolvedTtsProviderId)
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    // Parse provider configs — tenant override takes precedence over global default
    const sttConfig = this.parseJsonConfig(
      tenantSettings?.stt_config_override ?? globalConfig.default_stt_config,
    );
    const llmConfig = this.parseJsonConfig(
      tenantSettings?.llm_config_override ?? globalConfig.default_llm_config,
    );
    const ttsConfig = this.parseJsonConfig(
      tenantSettings?.tts_config_override ?? globalConfig.default_tts_config,
    );

    // TTS voice_id: tenant override → global default
    const ttsVoiceId =
      tenantSettings?.voice_id_override ?? globalConfig.default_voice_id ?? null;

    // Step 5: Load services, service areas, and transfer numbers concurrently
    const [tenantServices, serviceAreas, transferNumbers] = await Promise.all([
      this.prisma.tenant_service.findMany({
        where: { tenant_id: tenantId },
        include: {
          service: { select: { name: true, description: true } },
        },
      }),
      this.prisma.tenant_service_area.findMany({
        where: { tenant_id: tenantId },
        select: { type: true, value: true, state: true },
      }),
      this.transferNumbersService.findAll(tenantId),
    ]);

    // Step 6: Resolve behavior fields — tenant settings → global defaults
    const enabledLanguages = this.parseJsonArray(
      tenantSettings?.enabled_languages,
    );
    // Agent language: first language in tenant's list, or global default, or 'en'
    const language =
      enabledLanguages[0] ?? globalConfig.default_language ?? 'en';

    // Greeting: use tenant's custom_greeting if set, else apply {business_name} to global template.
    // replaceAll() is used (not replace()) so that templates with multiple {business_name}
    // occurrences are fully interpolated — replace() only substitutes the first match.
    const greeting = tenantSettings?.custom_greeting
      ? tenantSettings.custom_greeting
      : globalConfig.default_greeting_template.replaceAll(
          '{business_name}',
          tenant.company_name,
        );

    // Step 7: Assemble FullVoiceAiContext
    return {
      tenant: {
        id: tenant.id,
        company_name: tenant.company_name,
        phone: tenant.primary_contact_phone ?? null,
        timezone: tenant.timezone,
        language: tenant.default_language ?? null,
      },
      quota: {
        minutes_included: minutesIncluded,
        minutes_used: minutesUsed,
        minutes_remaining: minutesRemaining,
        overage_rate: overageRate,
        quota_exceeded: quotaExceeded,
      },
      behavior: {
        is_enabled: tenantSettings?.is_enabled ?? false,
        language,
        greeting,
        custom_instructions: tenantSettings?.custom_instructions ?? null,
        // Boolean fields: tenant-level setting ?? safe default = true
        booking_enabled: tenantSettings?.booking_enabled ?? true,
        lead_creation_enabled: tenantSettings?.lead_creation_enabled ?? true,
        transfer_enabled: tenantSettings?.transfer_enabled ?? true,
        max_call_duration_seconds:
          tenantSettings?.max_call_duration_seconds ??
          globalConfig.default_max_call_duration_seconds,
      },
      providers: {
        stt:
          sttProvider !== null && sttApiKey !== null
            ? {
                provider_id: sttProvider.id,
                provider_key: sttProvider.provider_key,
                api_key: sttApiKey,
                config: sttConfig,
                cost_per_unit: sttProvider.cost_per_unit != null
                  ? Number(sttProvider.cost_per_unit)
                  : null,
                cost_unit: sttProvider.cost_unit ?? null,
              }
            : null,
        llm:
          llmProvider !== null && llmApiKey !== null
            ? {
                provider_id: llmProvider.id,
                provider_key: llmProvider.provider_key,
                api_key: llmApiKey,
                config: llmConfig,
                cost_per_unit: llmProvider.cost_per_unit != null
                  ? Number(llmProvider.cost_per_unit)
                  : null,
                cost_unit: llmProvider.cost_unit ?? null,
              }
            : null,
        tts:
          ttsProvider !== null && ttsApiKey !== null
            ? {
                provider_id: ttsProvider.id,
                provider_key: ttsProvider.provider_key,
                api_key: ttsApiKey,
                config: ttsConfig,
                voice_id: ttsVoiceId,
                cost_per_unit: ttsProvider.cost_per_unit != null
                  ? Number(ttsProvider.cost_per_unit)
                  : null,
                cost_unit: ttsProvider.cost_unit ?? null,
              }
            : null,
      },
      services: tenantServices.map((ts) => ({
        name: ts.service.name,
        description: ts.service.description ?? null,
      })),
      service_areas: serviceAreas.map((sa) => ({
        type: sa.type,
        value: sa.value,
        state: sa.state ?? null,
      })),
      transfer_numbers: transferNumbers.map((tn) => ({
        label: tn.label,
        phone_number: tn.phone_number,
        transfer_type: tn.transfer_type,
        is_default: tn.is_default,
        available_hours: tn.available_hours ?? null,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Safely parse a JSON string into a plain object.
   * Returns an empty object on null, undefined, or malformed JSON.
   */
  private parseJsonConfig(
    jsonString: string | null | undefined,
  ): Record<string, unknown> {
    if (!jsonString) return {};
    try {
      const parsed: unknown = JSON.parse(jsonString);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Safely parse a JSON string that should be a string array.
   * Returns an empty array on null, undefined, or malformed JSON.
   */
  private parseJsonArray(jsonString: string | null | undefined): string[] {
    if (!jsonString) return [];
    try {
      const parsed: unknown = JSON.parse(jsonString);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
}
