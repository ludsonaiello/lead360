import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VoiceAiContextBuilderService } from './voice-ai-context-builder.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { VoiceAiCredentialsService } from './voice-ai-credentials.service';
import { VoiceAiGlobalConfigService } from './voice-ai-global-config.service';
import { VoiceTransferNumbersService } from './voice-transfer-numbers.service';

describe('VoiceAiContextBuilderService', () => {
  let service: VoiceAiContextBuilderService;
  let prisma: PrismaService;
  let credentialsService: VoiceAiCredentialsService;
  let globalConfigService: VoiceAiGlobalConfigService;
  let transferNumbersService: VoiceTransferNumbersService;

  // Mock data
  const mockTenant = {
    id: 'tenant-123',
    company_name: 'Test Company',
    primary_contact_phone: '+1234567890',
    primary_contact_email: 'test@example.com',
    timezone: 'America/New_York',
    default_language: 'en',
    business_description: 'A test business',
    subscription_plan: {
      voice_ai_enabled: true,
      voice_ai_minutes_included: 100,
      voice_ai_overage_rate: null,
    },
    tenant_address: [],
  };

  const mockGlobalConfig = {
    id: 'global-1',
    is_active: true,
    default_language: 'en',
    default_greeting_template: 'Hello! Welcome to {business_name}.',
    default_system_prompt: 'You are a helpful assistant.',
    default_max_call_duration_seconds: 600,
    default_stt_provider_id: 'stt-provider-1',
    default_llm_provider_id: 'llm-provider-1',
    default_tts_provider_id: 'tts-provider-1',
    default_voice_id: 'default-voice',
    default_stt_config: '{}',
    default_llm_config: '{}',
    default_tts_config: '{}',
    recovery_messages: '["Sorry, I didn\'t catch that."]',
    filler_phrases: '["Let me check that for you."]',
    long_wait_messages: '["Still checking..."]',
    system_error_messages: '["Something went wrong."]',
  };

  const mockTtsProvider = {
    id: 'tts-provider-1',
    provider_key: 'cartesia',
    provider_type: 'TTS',
    display_name: 'Cartesia',
    is_active: true,
  };

  // Sprint 18: Global profile + tenant override architecture
  const mockGlobalProfile = {
    id: 'global-profile-123',
    language_code: 'es',
    language_name: 'Spanish',
    voice_id: 'spanish-voice-id',
    voice_provider_type: 'tts',
    default_greeting: 'Buenos días!',
    default_instructions: 'You are a helpful Spanish-speaking assistant.',
    display_name: 'Spanish - Professional',
    description: 'Professional Spanish voice agent',
    is_active: true,
    display_order: 0,
    created_at: new Date(),
    updated_at: new Date(),
    updated_by: null,
  };

  const mockTenantOverride = {
    id: 'override-123',
    tenant_id: 'tenant-123',
    agent_profile_id: 'global-profile-123',
    custom_greeting: 'Hola! Bienvenido a Test Company!',
    custom_instructions: 'Always mention our plumbing services.',
    is_active: true,
    display_order: 0,
    created_at: new Date(),
    updated_at: new Date(),
    updated_by: null,
    agent_profile: mockGlobalProfile,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceAiContextBuilderService,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: jest.fn(),
            },
            tenant_voice_ai_settings: {
              findUnique: jest.fn(),
            },
            voice_ai_agent_profile: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            tenant_voice_agent_profile_override: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            voice_usage_record: {
              aggregate: jest.fn(),
            },
            voice_ai_provider: {
              findUnique: jest.fn(),
            },
            tenant_service: {
              findMany: jest.fn(),
            },
            tenant_service_area: {
              findMany: jest.fn(),
            },
            tenant_business_hours: {
              findUnique: jest.fn(),
            },
            tenant_industry: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: VoiceAiCredentialsService,
          useValue: {
            getDecryptedKey: jest.fn(),
          },
        },
        {
          provide: VoiceAiGlobalConfigService,
          useValue: {
            getRawConfig: jest.fn(),
          },
        },
        {
          provide: VoiceTransferNumbersService,
          useValue: {
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VoiceAiContextBuilderService>(
      VoiceAiContextBuilderService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    credentialsService = module.get<VoiceAiCredentialsService>(
      VoiceAiCredentialsService,
    );
    globalConfigService = module.get<VoiceAiGlobalConfigService>(
      VoiceAiGlobalConfigService,
    );
    transferNumbersService = module.get<VoiceTransferNumbersService>(
      VoiceTransferNumbersService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildContext - agent profile resolution', () => {
    beforeEach(() => {
      // Setup default mocks for all tests
      jest
        .spyOn(globalConfigService, 'getRawConfig')
        .mockResolvedValue(mockGlobalConfig as any);
      jest.spyOn(prisma.voice_usage_record, 'aggregate').mockResolvedValue({
        _sum: { usage_quantity: 0 },
      } as any);
      // Return mock TTS provider when requested
      jest
        .spyOn(prisma.voice_ai_provider, 'findUnique')
        .mockImplementation((args: any) => {
          if (args.where.id === 'tts-provider-1') {
            return Promise.resolve(mockTtsProvider as any);
          }
          return Promise.resolve(null);
        });
      // Return mock API key for TTS provider
      jest
        .spyOn(credentialsService, 'getDecryptedKey')
        .mockImplementation((providerId: string) => {
          if (providerId === 'tts-provider-1') {
            return Promise.resolve('mock-tts-api-key');
          }
          return Promise.resolve(null);
        });
      jest.spyOn(prisma.tenant_service, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.tenant_service_area, 'findMany').mockResolvedValue([]);
      jest
        .spyOn(prisma.tenant_business_hours, 'findUnique')
        .mockResolvedValue(null);
      jest.spyOn(prisma.tenant_industry, 'findMany').mockResolvedValue([]);
      jest.spyOn(transferNumbersService, 'findAll').mockResolvedValue([]);
    });

    it('should resolve global profile with tenant override (Step 1 - Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          enabled_languages: '["en"]',
          voice_id_override: 'default-voice',
          default_agent_profile_id: null,
          is_enabled: true,
          custom_instructions: null,
          custom_greeting: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(mockGlobalProfile as any);

      jest
        .spyOn(prisma.tenant_voice_agent_profile_override, 'findFirst')
        .mockResolvedValue(mockTenantOverride as any);

      const context = await service.buildContext(
        'tenant-123',
        'CA123',
        'global-profile-123',
      );

      expect(context.behavior.language).toBe('es'); // From global profile
      expect(context.providers.tts?.voice_id).toBe('spanish-voice-id'); // From global profile
      expect(context.behavior.greeting).toBe('Hola! Bienvenido a Test Company!'); // From tenant override
      expect(context.behavior.system_prompt).toContain('Always mention our plumbing services.'); // From tenant override
      expect(context.active_agent_profile).toEqual({
        id: 'global-profile-123',
        title: 'Spanish - Professional',
        language_code: 'es',
        is_override: true,
      });
    });

    it('should resolve global profile WITHOUT tenant override (Step 1 - Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          enabled_languages: '["en"]',
          voice_id_override: 'default-voice',
          default_agent_profile_id: null,
          is_enabled: true,
          custom_instructions: null,
          custom_greeting: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(mockGlobalProfile as any);

      jest
        .spyOn(prisma.tenant_voice_agent_profile_override, 'findFirst')
        .mockResolvedValue(null); // No tenant override

      const context = await service.buildContext(
        'tenant-123',
        'CA123',
        'global-profile-123',
      );

      expect(context.behavior.language).toBe('es');
      expect(context.providers.tts?.voice_id).toBe('spanish-voice-id');
      expect(context.behavior.greeting).toBe('Buenos días!'); // From global default
      expect(context.behavior.system_prompt).toContain('You are a helpful Spanish-speaking assistant.'); // From global default
      expect(context.active_agent_profile).toEqual({
        id: 'global-profile-123',
        title: 'Spanish - Professional',
        language_code: 'es',
        is_override: false,
      });
    });

    it('should fall back to default_agent_profile_id if agentProfileId not provided (Step 2 - Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          default_agent_profile_id: 'override-123',
          enabled_languages: '["en"]',
          voice_id_override: 'default-voice',
          is_enabled: true,
          custom_instructions: null,
          custom_greeting: null,
        } as any);

      jest
        .spyOn(prisma.tenant_voice_agent_profile_override, 'findFirst')
        .mockResolvedValue(mockTenantOverride as any);

      const context = await service.buildContext('tenant-123', 'CA123');

      expect(context.behavior.language).toBe('es'); // From global profile via override
      expect(context.active_agent_profile).not.toBeNull();
      expect(context.active_agent_profile?.id).toBe('global-profile-123');
      expect(context.active_agent_profile?.is_override).toBe(true);
    });

    it('should fall back to existing behavior if no profile resolved (Step 3 - Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          default_agent_profile_id: null,
          enabled_languages: '["fr"]',
          voice_id_override: 'fallback-voice',
          is_enabled: true,
          custom_instructions: null,
          custom_greeting: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(null); // No global profile found

      jest
        .spyOn(prisma.tenant_voice_agent_profile_override, 'findFirst')
        .mockResolvedValue(null);

      const context = await service.buildContext('tenant-123', 'CA123');

      expect(context.behavior.language).toBe('fr'); // From enabled_languages
      expect(context.providers.tts?.voice_id).toBe('fallback-voice'); // From override
      expect(context.active_agent_profile).toBeNull(); // No profile resolved
    });

    it('should gracefully fall back if global profile is inactive (Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          enabled_languages: '["en"]',
          voice_id_override: 'default-voice',
          default_agent_profile_id: null,
          is_enabled: true,
          custom_instructions: null,
          custom_greeting: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(null); // Inactive filtered out

      const context = await service.buildContext(
        'tenant-123',
        'CA123',
        'inactive-global-profile-id',
      );

      expect(context.active_agent_profile).toBeNull();
      // Falls through to existing behavior
      expect(context.behavior.language).toBe('en');
    });

    it('should APPEND override instructions to tenant instructions (Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          custom_instructions: 'You work for a plumbing company.',
          enabled_languages: '["en"]',
          voice_id_override: 'default-voice',
          default_agent_profile_id: null,
          is_enabled: true,
          custom_greeting: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(mockGlobalProfile as any);

      jest
        .spyOn(prisma.tenant_voice_agent_profile_override, 'findFirst')
        .mockResolvedValue({
          ...mockTenantOverride,
          custom_instructions: 'You speak Spanish.',
        } as any);

      const context = await service.buildContext(
        'tenant-123',
        'CA123',
        'global-profile-123',
      );

      expect(context.behavior.system_prompt).toContain(
        'You work for a plumbing company.',
      );
      expect(context.behavior.system_prompt).toContain('You speak Spanish.');
      // Both instructions present (APPEND behavior)
    });

    it('should use override greeting over tenant custom_greeting (Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          custom_greeting: 'Welcome to our company!',
          enabled_languages: '["en"]',
          voice_id_override: 'default-voice',
          default_agent_profile_id: null,
          is_enabled: true,
          custom_instructions: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(mockGlobalProfile as any);

      jest
        .spyOn(prisma.tenant_voice_agent_profile_override, 'findFirst')
        .mockResolvedValue(mockTenantOverride as any);

      const context = await service.buildContext(
        'tenant-123',
        'CA123',
        'global-profile-123',
      );

      expect(context.behavior.greeting).toBe('Hola! Bienvenido a Test Company!'); // Override greeting wins
    });

    it('should use global profile voice_id over tenant voice_id_override (Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          voice_id_override: 'tenant-override-voice',
          enabled_languages: '["en"]',
          default_agent_profile_id: null,
          is_enabled: true,
          custom_instructions: null,
          custom_greeting: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(mockGlobalProfile as any);

      jest
        .spyOn(prisma.tenant_voice_agent_profile_override, 'findFirst')
        .mockResolvedValue(null);

      const context = await service.buildContext(
        'tenant-123',
        'CA123',
        'global-profile-123',
      );

      expect(context.providers.tts?.voice_id).toBe('spanish-voice-id'); // Global profile voice wins
    });

    it('should enforce multi-tenant isolation in override resolution (Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          enabled_languages: '["en"]',
          voice_id_override: 'default-voice',
          default_agent_profile_id: null,
          is_enabled: true,
          custom_instructions: null,
          custom_greeting: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(mockGlobalProfile as any);

      const overrideFindFirstSpy = jest.spyOn(
        prisma.tenant_voice_agent_profile_override,
        'findFirst',
      );
      overrideFindFirstSpy.mockResolvedValue(null);

      await service.buildContext('tenant-123', 'CA123', 'global-profile-123');

      // Verify tenant_id filter was applied to override lookup
      expect(overrideFindFirstSpy).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-123',
          agent_profile_id: 'global-profile-123',
          is_active: true,
        },
      });
    });

    it('should use global default_greeting when override greeting is null (Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          custom_greeting: 'Tenant greeting',
          enabled_languages: '["en"]',
          voice_id_override: 'default-voice',
          default_agent_profile_id: null,
          is_enabled: true,
          custom_instructions: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(mockGlobalProfile as any);

      jest
        .spyOn(prisma.tenant_voice_agent_profile_override, 'findFirst')
        .mockResolvedValue({
          ...mockTenantOverride,
          custom_greeting: null,
        } as any);

      const context = await service.buildContext(
        'tenant-123',
        'CA123',
        'global-profile-123',
      );

      // Should use global default_greeting when override is null
      expect(context.behavior.greeting).toBe('Buenos días!');
    });

    it('should use global default_instructions when override instructions is null (Sprint 18)', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        tenant_address: [],
      } as any);

      jest
        .spyOn(prisma.tenant_voice_ai_settings, 'findUnique')
        .mockResolvedValue({
          tenant_id: 'tenant-123',
          custom_instructions: 'Tenant instructions',
          enabled_languages: '["en"]',
          voice_id_override: 'default-voice',
          default_agent_profile_id: null,
          is_enabled: true,
          custom_greeting: null,
        } as any);

      jest
        .spyOn(prisma.voice_ai_agent_profile, 'findFirst')
        .mockResolvedValue(mockGlobalProfile as any);

      jest
        .spyOn(prisma.tenant_voice_agent_profile_override, 'findFirst')
        .mockResolvedValue({
          ...mockTenantOverride,
          custom_instructions: null,
        } as any);

      const context = await service.buildContext(
        'tenant-123',
        'CA123',
        'global-profile-123',
      );

      // Should contain tenant instructions + global default_instructions
      expect(context.behavior.system_prompt).toContain('Tenant instructions');
      expect(context.behavior.system_prompt).toContain('You are a helpful Spanish-speaking assistant.');
      expect(context.behavior.system_prompt).not.toContain('null');
    });
  });

  describe('buildContext - error handling', () => {
    it('should throw NotFoundException if tenant does not exist', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(globalConfigService, 'getRawConfig')
        .mockResolvedValue(mockGlobalConfig as any);

      await expect(service.buildContext('nonexistent-tenant')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if global config not initialized', async () => {
      jest
        .spyOn(prisma.tenant, 'findUnique')
        .mockResolvedValue(mockTenant as any);
      jest.spyOn(globalConfigService, 'getRawConfig').mockResolvedValue(null);

      await expect(service.buildContext('tenant-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
