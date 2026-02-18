import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VoiceAiContextBuilderService } from './voice-ai-context-builder.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { VoiceAiCredentialsService } from './voice-ai-credentials.service';
import { VoiceAiGlobalConfigService } from './voice-ai-global-config.service';
import { VoiceTransferNumbersService } from './voice-transfer-numbers.service';

/**
 * VoiceAiContextBuilderService Unit Tests — Sprint B13
 *
 * Test coverage (7 cases):
 *   1. Tenant with no settings uses global defaults
 *   2. Greeting template substitution with {business_name}
 *   3. Tenant language override from enabled_languages
 *   4. Provider fallback chain: tenant has no STT override → uses global default
 *   5. Quota calculation: minutes_used=450, minutes_included=500 → remaining=50, not exceeded
 *   6. Quota exceeded: minutes_used=500, minutes_included=500, no overage rate
 *   7. monthly_minutes_override overrides plan's voice_ai_minutes_included
 */
describe('VoiceAiContextBuilderService', () => {
  let service: VoiceAiContextBuilderService;
  let prisma: jest.Mocked<PrismaService>;
  let credentialsService: jest.Mocked<VoiceAiCredentialsService>;
  let globalConfigService: jest.Mocked<VoiceAiGlobalConfigService>;
  let transferNumbersService: jest.Mocked<VoiceTransferNumbersService>;

  const TENANT_ID = 'tenant-uuid-abc';
  const STT_PROVIDER_ID = 'stt-provider-uuid';
  const LLM_PROVIDER_ID = 'llm-provider-uuid';
  const TTS_PROVIDER_ID = 'tts-provider-uuid';

  const baseTenant = {
    id: TENANT_ID,
    company_name: 'Acme Plumbing',
    primary_contact_phone: '+15551234567',
    timezone: 'America/New_York',
    default_language: 'en',
    subscription_plan: {
      voice_ai_enabled: true,
      voice_ai_minutes_included: 500,
      voice_ai_overage_rate: null,
    },
  };

  const baseGlobalConfig = {
    id: 'default',
    default_stt_provider_id: STT_PROVIDER_ID,
    default_llm_provider_id: LLM_PROVIDER_ID,
    default_tts_provider_id: TTS_PROVIDER_ID,
    default_stt_config: null,
    default_llm_config: null,
    default_tts_config: null,
    default_voice_id: null,
    default_language: 'en',
    default_languages: '["en"]',
    default_greeting_template: 'Hello, thank you for calling {business_name}! How can I help you today?',
    default_system_prompt: 'You are a helpful phone assistant.',
    default_max_call_duration_seconds: 600,
    default_transfer_behavior: 'end_call',
    default_tools_enabled: '{"booking":true,"lead_creation":true,"call_transfer":true}',
    livekit_sip_trunk_url: null,
    livekit_api_key: null,
    livekit_api_secret: null,
    agent_api_key_hash: null,
    agent_api_key_preview: null,
    max_concurrent_calls: 100,
    updated_at: new Date(),
    updated_by: null,
  };

  const sttProvider = {
    id: STT_PROVIDER_ID,
    provider_key: 'deepgram',
    provider_type: 'STT',
    display_name: 'Deepgram',
    description: null,
    logo_url: null,
    documentation_url: null,
    capabilities: null,
    config_schema: null,
    default_config: null,
    pricing_info: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const llmProvider = { ...sttProvider, id: LLM_PROVIDER_ID, provider_key: 'openai', provider_type: 'LLM', display_name: 'OpenAI' };
  const ttsProvider = { ...sttProvider, id: TTS_PROVIDER_ID, provider_key: 'cartesia', provider_type: 'TTS', display_name: 'Cartesia' };

  function buildMockPrisma(overrides: {
    tenant?: object | null;
    tenantSettings?: object | null;
    sttAggSeconds?: number;
    providers?: { stt?: object | null; llm?: object | null; tts?: object | null };
  } = {}) {
    const mockPrisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(overrides.tenant !== undefined ? overrides.tenant : baseTenant),
      },
      tenant_voice_ai_settings: {
        findUnique: jest.fn().mockResolvedValue(overrides.tenantSettings !== undefined ? overrides.tenantSettings : null),
      },
      voice_usage_record: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { usage_quantity: overrides.sttAggSeconds !== undefined ? overrides.sttAggSeconds : 0 },
        }),
      },
      voice_ai_provider: {
        findUnique: jest.fn().mockImplementation((args: { where: { id: string } }) => {
          const providers = overrides.providers ?? {};
          const id = args.where.id;
          if (id === STT_PROVIDER_ID) return Promise.resolve(providers.stt !== undefined ? providers.stt : sttProvider);
          if (id === LLM_PROVIDER_ID) return Promise.resolve(providers.llm !== undefined ? providers.llm : llmProvider);
          if (id === TTS_PROVIDER_ID) return Promise.resolve(providers.tts !== undefined ? providers.tts : ttsProvider);
          return Promise.resolve(null);
        }),
      },
      tenant_service: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenant_service_area: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    return mockPrisma as unknown as jest.Mocked<PrismaService>;
  }

  async function buildService(prismaOverride: jest.Mocked<PrismaService>) {
    prisma = prismaOverride;

    credentialsService = {
      getDecryptedKey: jest.fn().mockResolvedValue('decrypted-api-key'),
    } as unknown as jest.Mocked<VoiceAiCredentialsService>;

    globalConfigService = {
      getRawConfig: jest.fn().mockResolvedValue(baseGlobalConfig),
    } as unknown as jest.Mocked<VoiceAiGlobalConfigService>;

    transferNumbersService = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<VoiceTransferNumbersService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceAiContextBuilderService,
        { provide: PrismaService, useValue: prisma },
        { provide: VoiceAiCredentialsService, useValue: credentialsService },
        { provide: VoiceAiGlobalConfigService, useValue: globalConfigService },
        { provide: VoiceTransferNumbersService, useValue: transferNumbersService },
      ],
    }).compile();

    return module.get<VoiceAiContextBuilderService>(VoiceAiContextBuilderService);
  }

  // ─── Test 1 ─────────────────────────────────────────────────────────────────

  it('1. tenant with no settings uses global defaults (custom_greeting null → uses template)', async () => {
    const mockPrisma = buildMockPrisma({ tenantSettings: null });
    service = await buildService(mockPrisma);

    const ctx = await service.buildContext(TENANT_ID);

    // No custom greeting → global template interpolated with company_name
    expect(ctx.behavior.greeting).toBe(
      'Hello, thank you for calling Acme Plumbing! How can I help you today?',
    );
    // Boolean behavior fields default to true when no settings row
    expect(ctx.behavior.booking_enabled).toBe(true);
    expect(ctx.behavior.lead_creation_enabled).toBe(true);
    expect(ctx.behavior.transfer_enabled).toBe(true);
    // Duration defaults to global value
    expect(ctx.behavior.max_call_duration_seconds).toBe(600);
    expect(ctx.behavior.is_enabled).toBe(false);
  });

  // ─── Test 2 ─────────────────────────────────────────────────────────────────

  it('2. greeting template substitution: {business_name} replaced with actual company name', async () => {
    const tenantWithDifferentName = { ...baseTenant, company_name: 'Honey Do 4 You' };
    const mockPrisma = buildMockPrisma({ tenant: tenantWithDifferentName, tenantSettings: null });
    service = await buildService(mockPrisma);

    const ctx = await service.buildContext(TENANT_ID);

    expect(ctx.behavior.greeting).toBe(
      'Hello, thank you for calling Honey Do 4 You! How can I help you today?',
    );
    expect(ctx.tenant.company_name).toBe('Honey Do 4 You');
  });

  // ─── Test 3 ─────────────────────────────────────────────────────────────────

  it('3. tenant language override: enabled_languages used over global default', async () => {
    const tenantSettings = {
      id: 'settings-uuid',
      tenant_id: TENANT_ID,
      is_enabled: true,
      default_language: 'es',
      enabled_languages: '["es","en"]',
      custom_greeting: null,
      custom_instructions: null,
      after_hours_behavior: null,
      booking_enabled: null,
      lead_creation_enabled: null,
      transfer_enabled: null,
      default_transfer_number: null,
      max_call_duration_seconds: null,
      monthly_minutes_override: null,
      admin_notes: null,
      stt_provider_override_id: null,
      llm_provider_override_id: null,
      tts_provider_override_id: null,
      stt_config_override: null,
      llm_config_override: null,
      tts_config_override: null,
      voice_id_override: null,
      created_at: new Date(),
      updated_at: new Date(),
      updated_by: null,
    };
    const mockPrisma = buildMockPrisma({ tenantSettings });
    service = await buildService(mockPrisma);

    const ctx = await service.buildContext(TENANT_ID);

    // First language in tenant's enabled_languages list takes precedence
    expect(ctx.behavior.language).toBe('es');
  });

  // ─── Test 4 ─────────────────────────────────────────────────────────────────

  it('4. provider fallback chain: tenant has no STT override → uses global default_stt_provider_id', async () => {
    // Settings row exists but has no provider overrides → global defaults apply
    const tenantSettings = {
      id: 'settings-uuid',
      tenant_id: TENANT_ID,
      is_enabled: true,
      default_language: 'en',
      enabled_languages: '["en"]',
      custom_greeting: null,
      custom_instructions: null,
      after_hours_behavior: null,
      booking_enabled: null,
      lead_creation_enabled: null,
      transfer_enabled: null,
      default_transfer_number: null,
      max_call_duration_seconds: null,
      monthly_minutes_override: null,
      admin_notes: null,
      stt_provider_override_id: null,  // No override — should fall back to global
      llm_provider_override_id: null,
      tts_provider_override_id: null,
      stt_config_override: null,
      llm_config_override: null,
      tts_config_override: null,
      voice_id_override: null,
      created_at: new Date(),
      updated_at: new Date(),
      updated_by: null,
    };
    const mockPrisma = buildMockPrisma({ tenantSettings });
    service = await buildService(mockPrisma);

    const ctx = await service.buildContext(TENANT_ID);

    // Global STT provider should be resolved
    expect(ctx.providers.stt).not.toBeNull();
    expect(ctx.providers.stt?.provider_id).toBe(STT_PROVIDER_ID);
    expect(ctx.providers.stt?.provider_key).toBe('deepgram');
    expect(ctx.providers.stt?.api_key).toBe('decrypted-api-key');

    // Credentials service was called with the global STT provider ID
    expect(credentialsService.getDecryptedKey).toHaveBeenCalledWith(STT_PROVIDER_ID);
  });

  // ─── Test 5 ─────────────────────────────────────────────────────────────────

  it('5. quota calculation: minutes_used=450, minutes_included=500 → remaining=50, quota_exceeded=false', async () => {
    // 450 minutes = 27000 seconds of STT
    const sttSeconds = 27000;
    const mockPrisma = buildMockPrisma({ sttAggSeconds: sttSeconds, tenantSettings: null });
    service = await buildService(mockPrisma);

    const ctx = await service.buildContext(TENANT_ID);

    expect(ctx.quota.minutes_included).toBe(500);
    expect(ctx.quota.minutes_used).toBe(450);    // Math.ceil(27000 / 60) = 450
    expect(ctx.quota.minutes_remaining).toBe(50);
    expect(ctx.quota.quota_exceeded).toBe(false);
    expect(ctx.quota.overage_rate).toBeNull();
  });

  // ─── Test 6 ─────────────────────────────────────────────────────────────────

  it('6. quota exceeded: minutes_used=500, minutes_included=500, no overage rate → quota_exceeded=true', async () => {
    // 500 minutes = 30000 seconds of STT
    const sttSeconds = 30000;
    const mockPrisma = buildMockPrisma({ sttAggSeconds: sttSeconds, tenantSettings: null });
    service = await buildService(mockPrisma);

    const ctx = await service.buildContext(TENANT_ID);

    expect(ctx.quota.minutes_included).toBe(500);
    expect(ctx.quota.minutes_used).toBe(500);
    expect(ctx.quota.minutes_remaining).toBe(0);
    expect(ctx.quota.quota_exceeded).toBe(true);   // exceeded AND no overage rate → blocked
    expect(ctx.quota.overage_rate).toBeNull();
  });

  // ─── Test 7 ─────────────────────────────────────────────────────────────────

  it('7. monthly_minutes_override=1000 overrides plan voice_ai_minutes_included=500', async () => {
    const tenantSettings = {
      id: 'settings-uuid',
      tenant_id: TENANT_ID,
      is_enabled: true,
      default_language: 'en',
      enabled_languages: '["en"]',
      custom_greeting: null,
      custom_instructions: null,
      after_hours_behavior: null,
      booking_enabled: null,
      lead_creation_enabled: null,
      transfer_enabled: null,
      default_transfer_number: null,
      max_call_duration_seconds: null,
      monthly_minutes_override: 1000,   // Admin override
      admin_notes: null,
      stt_provider_override_id: null,
      llm_provider_override_id: null,
      tts_provider_override_id: null,
      stt_config_override: null,
      llm_config_override: null,
      tts_config_override: null,
      voice_id_override: null,
      created_at: new Date(),
      updated_at: new Date(),
      updated_by: null,
    };
    // 450 minutes used
    const sttSeconds = 27000;
    const mockPrisma = buildMockPrisma({ tenantSettings, sttAggSeconds: sttSeconds });
    service = await buildService(mockPrisma);

    const ctx = await service.buildContext(TENANT_ID);

    // Override (1000) takes precedence over plan (500)
    expect(ctx.quota.minutes_included).toBe(1000);
    expect(ctx.quota.minutes_used).toBe(450);
    expect(ctx.quota.minutes_remaining).toBe(550);
    expect(ctx.quota.quota_exceeded).toBe(false);
  });

  // ─── Additional coverage tests ────────────────────────────────────────────────

  it('8. tenant with services and service_areas maps them into context correctly', async () => {
    const mockPrisma = buildMockPrisma({ tenantSettings: null });
    // Override tenant_service and tenant_service_area to return data
    (mockPrisma.tenant_service.findMany as jest.Mock).mockResolvedValue([
      { service: { name: 'Plumbing Repair', description: 'General plumbing fixes' } },
      { service: { name: 'Water Heater', description: null } },
    ]);
    (mockPrisma.tenant_service_area.findMany as jest.Mock).mockResolvedValue([
      { type: 'city', value: 'Miami', state: 'FL' },
      { type: 'county', value: 'Dade', state: null },
    ]);
    service = await buildService(mockPrisma);

    const ctx = await service.buildContext(TENANT_ID);

    expect(ctx.services).toHaveLength(2);
    expect(ctx.services[0].name).toBe('Plumbing Repair');
    expect(ctx.services[0].description).toBe('General plumbing fixes');
    expect(ctx.services[1].description).toBeNull();

    expect(ctx.service_areas).toHaveLength(2);
    expect(ctx.service_areas[0].value).toBe('Miami');
    expect(ctx.service_areas[0].state).toBe('FL');
    expect(ctx.service_areas[1].state).toBeNull();
  });

  it('9. when provider has no credential stored, provider slot is null (soft failure)', async () => {
    const mockPrisma = buildMockPrisma({ tenantSettings: null });
    service = await buildService(mockPrisma);
    // Make getDecryptedKey fail for all providers (no credential stored)
    (credentialsService.getDecryptedKey as jest.Mock).mockRejectedValue(new Error('no cred'));

    const ctx = await service.buildContext(TENANT_ID);

    // All provider slots should be null (soft failure — credential not stored)
    expect(ctx.providers.stt).toBeNull();
    expect(ctx.providers.llm).toBeNull();
    expect(ctx.providers.tts).toBeNull();
  });

  it('10. when provider IDs are null in global config, provider slots are null', async () => {
    const globalConfigNoProviders = {
      ...baseGlobalConfig,
      default_stt_provider_id: null,
      default_llm_provider_id: null,
      default_tts_provider_id: null,
    };
    const mockPrisma = buildMockPrisma({ tenantSettings: null });

    // Build with null-provider global config from the start
    const nullProviderGlobalConfigService = {
      getRawConfig: jest.fn().mockResolvedValue(globalConfigNoProviders),
    } as unknown as jest.Mocked<VoiceAiGlobalConfigService>;

    const mockCredentialsSvc = {
      getDecryptedKey: jest.fn().mockResolvedValue('decrypted-api-key'),
    } as unknown as jest.Mocked<VoiceAiCredentialsService>;

    const mockTransferSvc = {
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<VoiceTransferNumbersService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceAiContextBuilderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VoiceAiCredentialsService, useValue: mockCredentialsSvc },
        { provide: VoiceAiGlobalConfigService, useValue: nullProviderGlobalConfigService },
        { provide: VoiceTransferNumbersService, useValue: mockTransferSvc },
      ],
    }).compile();

    const svc = module.get<VoiceAiContextBuilderService>(VoiceAiContextBuilderService);
    const ctx = await svc.buildContext(TENANT_ID);

    // No providers configured → all null
    expect(ctx.providers.stt).toBeNull();
    expect(ctx.providers.llm).toBeNull();
    expect(ctx.providers.tts).toBeNull();
    // provider.findUnique should NOT have been called (no IDs to look up)
    expect(mockPrisma.voice_ai_provider.findUnique).not.toHaveBeenCalled();
  });

  it('11. custom_greeting takes precedence over template when tenant settings exist', async () => {
    const tenantSettings = {
      id: 'settings-uuid',
      tenant_id: TENANT_ID,
      is_enabled: true,
      default_language: 'en',
      enabled_languages: '["en"]',
      custom_greeting: 'Welcome to Acme! How can we help you?',
      custom_instructions: null,
      after_hours_behavior: null,
      booking_enabled: null,
      lead_creation_enabled: null,
      transfer_enabled: null,
      default_transfer_number: null,
      max_call_duration_seconds: 300,
      monthly_minutes_override: null,
      admin_notes: null,
      stt_provider_override_id: null,
      llm_provider_override_id: null,
      tts_provider_override_id: null,
      stt_config_override: null,
      llm_config_override: null,
      tts_config_override: null,
      voice_id_override: null,
      created_at: new Date(),
      updated_at: new Date(),
      updated_by: null,
    };
    const mockPrisma = buildMockPrisma({ tenantSettings });
    service = await buildService(mockPrisma);

    const ctx = await service.buildContext(TENANT_ID);

    // Custom greeting used as-is (no template substitution)
    expect(ctx.behavior.greeting).toBe('Welcome to Acme! How can we help you?');
    // Max call duration from settings (300) overrides global default (600)
    expect(ctx.behavior.max_call_duration_seconds).toBe(300);
    expect(ctx.behavior.is_enabled).toBe(true);
  });

  // ─── Error cases ─────────────────────────────────────────────────────────────

  it('throws NotFoundException when tenant does not exist', async () => {
    const mockPrisma = buildMockPrisma({ tenant: null });
    service = await buildService(mockPrisma);

    await expect(service.buildContext('nonexistent-id')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when global config has not been initialized', async () => {
    const mockPrisma = buildMockPrisma({});

    // Initialize sibling services via buildService to set up outer let variables
    await buildService(mockPrisma);

    // Now override globalConfigService to return null (simulating uninitialized global config)
    const nullGlobalConfigService = {
      getRawConfig: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<VoiceAiGlobalConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceAiContextBuilderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VoiceAiCredentialsService, useValue: credentialsService },
        { provide: VoiceAiGlobalConfigService, useValue: nullGlobalConfigService },
        { provide: VoiceTransferNumbersService, useValue: transferNumbersService },
      ],
    }).compile();

    const svcWithNullConfig = module.get<VoiceAiContextBuilderService>(VoiceAiContextBuilderService);

    await expect(svcWithNullConfig.buildContext(TENANT_ID)).rejects.toThrow(BadRequestException);
  });
});
