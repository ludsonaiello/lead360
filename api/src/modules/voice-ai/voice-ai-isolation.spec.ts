import { Test, TestingModule } from '@nestjs/testing';
import { VoiceAiSettingsService } from './services/voice-ai-settings.service';
import { VoiceCallLogService } from './services/voice-call-log.service';
import { VoiceAiContextBuilderService } from './services/voice-ai-context-builder.service';
import { VoiceAiCredentialsService } from './services/voice-ai-credentials.service';
import { VoiceAiGlobalConfigService } from './services/voice-ai-global-config.service';
import { VoiceTransferNumbersService } from './services/voice-transfer-numbers.service';
import { VoiceUsageService } from './services/voice-usage.service';
import { PrismaService } from '../../core/database/prisma.service';

/**
 * Voice AI Multi-Tenant Isolation Tests — Sprint B13
 *
 * These are service-layer integration tests that verify complete tenant isolation
 * using two test tenants (A and B). Each test verifies that Tenant A cannot access
 * or receive Tenant B's data.
 *
 * Test coverage (3 cases):
 *   1. Tenant A cannot get Tenant B's settings (GET /voice-ai/settings scoped to requesting tenant)
 *   2. Tenant A cannot get Tenant B's call logs (GET /voice-ai/call-logs scoped to requesting tenant)
 *   3. Internal context endpoint scoped to tenantId param — agent gets only Tenant A data while Tenant B exists
 */
describe('Voice AI — Multi-Tenant Isolation', () => {
  // ─── Tenant fixtures ───────────────────────────────────────────────────────
  const TENANT_A_ID = 'tenant-a-uuid-111';
  const TENANT_B_ID = 'tenant-b-uuid-222';

  const tenantA = {
    id: TENANT_A_ID,
    company_name: 'Alpha Plumbing',
    primary_contact_phone: '+15550001111',
    timezone: 'America/New_York',
    default_language: 'en',
    subscription_plan: {
      voice_ai_enabled: true,
      voice_ai_minutes_included: 500,
      voice_ai_overage_rate: null,
    },
  };

  const tenantB = {
    id: TENANT_B_ID,
    company_name: 'Beta Electric',
    primary_contact_phone: '+15550002222',
    timezone: 'America/Chicago',
    default_language: 'es',
    subscription_plan: {
      voice_ai_enabled: true,
      voice_ai_minutes_included: 300,
      voice_ai_overage_rate: 0.05,
    },
  };

  const settingsA = {
    id: 'settings-a-uuid',
    tenant_id: TENANT_A_ID,
    is_enabled: true,
    default_language: 'en',
    enabled_languages: '["en"]',
    custom_greeting: 'Hello from Alpha Plumbing!',
    custom_instructions: 'Alpha instructions',
    after_hours_behavior: null,
    booking_enabled: true,
    lead_creation_enabled: true,
    transfer_enabled: true,
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

  const settingsB = {
    ...settingsA,
    id: 'settings-b-uuid',
    tenant_id: TENANT_B_ID,
    custom_greeting: 'Hola from Beta Electric!',
    custom_instructions: 'Beta instructions',
  };

  const callLogA = {
    id: 'call-log-a-uuid',
    tenant_id: TENANT_A_ID,
    call_sid: 'CA111aaa',
    from_number: '+15550001111',
    to_number: '+15559990001',
    direction: 'inbound',
    status: 'completed',
    outcome: 'booked',
    is_overage: false,
    duration_seconds: 120,
    transcript_summary: 'Alpha call transcript',
    full_transcript: 'Full alpha transcript',
    actions_taken: '["lead_created"]',
    lead_id: null,
    stt_provider_id: null,
    llm_provider_id: null,
    tts_provider_id: null,
    started_at: new Date(),
    ended_at: new Date(),
    created_at: new Date(),
  };

  const callLogB = {
    ...callLogA,
    id: 'call-log-b-uuid',
    tenant_id: TENANT_B_ID,
    call_sid: 'CB222bbb',
    transcript_summary: 'Beta call transcript — MUST NOT appear in Tenant A queries',
  };

  // ─── Scoping mock: returns different data based on tenant_id param ──────────

  function buildIsolatedPrisma() {
    return {
      tenant: {
        findUnique: jest.fn().mockImplementation((args: { where: { id: string } }) => {
          if (args.where.id === TENANT_A_ID) return Promise.resolve(tenantA);
          if (args.where.id === TENANT_B_ID) return Promise.resolve(tenantB);
          return Promise.resolve(null);
        }),
      },
      tenant_voice_ai_settings: {
        findUnique: jest.fn().mockImplementation((args: { where: { tenant_id: string } }) => {
          if (args.where.tenant_id === TENANT_A_ID) return Promise.resolve(settingsA);
          if (args.where.tenant_id === TENANT_B_ID) return Promise.resolve(settingsB);
          return Promise.resolve(null);
        }),
        upsert: jest.fn(),
      },
      voice_call_log: {
        findMany: jest.fn().mockImplementation((args: { where: { tenant_id: string } }) => {
          // Strict tenant scoping — return only that tenant's logs
          if (args.where.tenant_id === TENANT_A_ID) return Promise.resolve([callLogA]);
          if (args.where.tenant_id === TENANT_B_ID) return Promise.resolve([callLogB]);
          return Promise.resolve([]);
        }),
        count: jest.fn().mockImplementation((args: { where: { tenant_id: string } }) => {
          if (args.where.tenant_id === TENANT_A_ID) return Promise.resolve(1);
          if (args.where.tenant_id === TENANT_B_ID) return Promise.resolve(1);
          return Promise.resolve(0);
        }),
        findFirst: jest.fn(),
      },
      voice_usage_record: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { usage_quantity: 0 } }),
      },
      voice_ai_provider: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      tenant_service: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenant_service_area: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as jest.Mocked<PrismaService>;
  }

  // ─── Test 1 ──────────────────────────────────────────────────────────────────

  describe('Test 1: Tenant A cannot get Tenant B settings', () => {
    it('getTenantSettings(TENANT_A_ID) returns only Tenant A settings', async () => {
      const prisma = buildIsolatedPrisma();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VoiceAiSettingsService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();

      const settingsService = module.get<VoiceAiSettingsService>(VoiceAiSettingsService);

      const resultA = await settingsService.getTenantSettings(TENANT_A_ID);
      const resultB = await settingsService.getTenantSettings(TENANT_B_ID);

      // Tenant A gets their own settings
      expect(resultA?.tenant_id).toBe(TENANT_A_ID);
      expect(resultA?.custom_greeting).toBe('Hello from Alpha Plumbing!');

      // Tenant B gets their own settings — not A's
      expect(resultB?.tenant_id).toBe(TENANT_B_ID);
      expect(resultB?.custom_greeting).toBe('Hola from Beta Electric!');

      // Cross-tenant check: A's result doesn't contain B's data
      expect(resultA?.custom_greeting).not.toContain('Beta');
      expect(resultB?.custom_greeting).not.toContain('Alpha');

      // DB queries were correctly scoped by tenant_id
      const calls = (prisma.tenant_voice_ai_settings.findUnique as jest.Mock).mock.calls;
      expect(calls[0][0].where.tenant_id).toBe(TENANT_A_ID);
      expect(calls[1][0].where.tenant_id).toBe(TENANT_B_ID);
    });
  });

  // ─── Test 2 ──────────────────────────────────────────────────────────────────

  describe('Test 2: Tenant A cannot get Tenant B call logs', () => {
    it('findAll(TENANT_A_ID) returns only Tenant A call logs — no Tenant B data', async () => {
      const prisma = buildIsolatedPrisma();
      const mockVoiceUsageService = {
        createUsageRecords: jest.fn(),
        getQuota: jest.fn(),
        checkAndReserveMinute: jest.fn(),
        getUsageSummary: jest.fn(),
        getAdminUsageReport: jest.fn(),
      } as unknown as jest.Mocked<VoiceUsageService>;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VoiceCallLogService,
          { provide: PrismaService, useValue: prisma },
          { provide: VoiceUsageService, useValue: mockVoiceUsageService },
        ],
      }).compile();

      const callLogService = module.get<VoiceCallLogService>(VoiceCallLogService);

      // Query call logs as Tenant A
      const { data: logsA } = await callLogService.findByTenantId(TENANT_A_ID, {});

      // Tenant A receives only their own call logs
      expect(logsA).toHaveLength(1);
      expect(logsA[0].tenant_id).toBe(TENANT_A_ID);
      expect(logsA[0].call_sid).toBe('CA111aaa');
      expect(logsA[0].transcript_summary).toBe('Alpha call transcript');

      // Tenant B's data is NOT present
      const tenantBData = logsA.find((l) => l.tenant_id === TENANT_B_ID);
      expect(tenantBData).toBeUndefined();

      // Verify the DB query was scoped to Tenant A
      const findManyCall = (prisma.voice_call_log.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.tenant_id).toBe(TENANT_A_ID);
    });
  });

  // ─── Test 3 ──────────────────────────────────────────────────────────────────

  describe('Test 3: Internal context endpoint scoped to tenantId param', () => {
    it('buildContext(TENANT_A_ID) returns Tenant A data only while Tenant B exists in DB', async () => {
      const prisma = buildIsolatedPrisma();
      const mockCredentialsService = {
        getDecryptedKey: jest.fn().mockResolvedValue(null),
      } as unknown as jest.Mocked<VoiceAiCredentialsService>;

      const globalConfig = {
        id: 'default',
        default_stt_provider_id: null,
        default_llm_provider_id: null,
        default_tts_provider_id: null,
        default_stt_config: null,
        default_llm_config: null,
        default_tts_config: null,
        default_voice_id: null,
        default_language: 'en',
        default_languages: '["en"]',
        default_greeting_template: 'Hello, thank you for calling {business_name}!',
        default_system_prompt: 'You are a helpful phone assistant.',
        default_max_call_duration_seconds: 600,
        default_transfer_behavior: 'end_call',
        default_tools_enabled: '{}',
        livekit_sip_trunk_url: null,
        livekit_api_key: null,
        livekit_api_secret: null,
        agent_api_key_hash: null,
        agent_api_key_preview: null,
        max_concurrent_calls: 100,
        updated_at: new Date(),
        updated_by: null,
      };

      const mockGlobalConfigService = {
        getRawConfig: jest.fn().mockResolvedValue(globalConfig),
      } as unknown as jest.Mocked<VoiceAiGlobalConfigService>;

      const mockTransferNumbersService = {
        findAll: jest.fn().mockResolvedValue([]),
      } as unknown as jest.Mocked<VoiceTransferNumbersService>;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VoiceAiContextBuilderService,
          { provide: PrismaService, useValue: prisma },
          { provide: VoiceAiCredentialsService, useValue: mockCredentialsService },
          { provide: VoiceAiGlobalConfigService, useValue: mockGlobalConfigService },
          { provide: VoiceTransferNumbersService, useValue: mockTransferNumbersService },
        ],
      }).compile();

      const contextBuilder = module.get<VoiceAiContextBuilderService>(VoiceAiContextBuilderService);

      // Agent requests context for Tenant A using their tenantId URL param
      const contextA = await contextBuilder.buildContext(TENANT_A_ID);

      // Context contains only Tenant A data
      expect(contextA.tenant.id).toBe(TENANT_A_ID);
      expect(contextA.tenant.company_name).toBe('Alpha Plumbing');
      expect(contextA.behavior.greeting).toBe('Hello from Alpha Plumbing!');   // custom greeting
      expect(contextA.behavior.language).toBe('en');

      // Tenant B's data is NOT present
      expect(contextA.tenant.id).not.toBe(TENANT_B_ID);
      expect(contextA.tenant.company_name).not.toContain('Beta');

      // Verify tenant lookup was strictly scoped to TENANT_A_ID
      const tenantLookupCall = (prisma.tenant.findUnique as jest.Mock).mock.calls[0][0];
      expect(tenantLookupCall.where.id).toBe(TENANT_A_ID);

      // Verify STT usage aggregation was scoped to TENANT_A_ID
      const aggCall = (prisma.voice_usage_record.aggregate as jest.Mock).mock.calls[0][0];
      expect(aggCall.where.tenant_id).toBe(TENANT_A_ID);
    });
  });
});
