import { Test, TestingModule } from '@nestjs/testing';
import { VoiceUsageService, UsageRecordData } from './voice-usage.service';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * VoiceUsageService Unit Tests — Sprint B13
 *
 * Test coverage (6 cases):
 *   1. checkAndReserveMinute: minutes available → { allowed: true, is_overage: false }
 *   2. checkAndReserveMinute: quota exceeded, no overage rate → { allowed: false, reason: 'quota_exceeded' }
 *   3. checkAndReserveMinute: quota exceeded, overage rate set → { allowed: true, is_overage: true }
 *   4. createUsageRecords: creates one row per provider entry (STT, LLM, TTS each get their own record)
 *   5. createUsageRecords: sets correct year/month on each record
 *   6. getQuota: aggregates STT seconds from per-call records for current month correctly
 */
describe('VoiceUsageService', () => {
  let service: VoiceUsageService;
  let prisma: jest.Mocked<PrismaService>;

  const TENANT_ID = 'tenant-uuid-xyz';
  const STT_PROVIDER_ID = 'stt-provider-uuid';
  const LLM_PROVIDER_ID = 'llm-provider-uuid';
  const TTS_PROVIDER_ID = 'tts-provider-uuid';

  const baseTenant = {
    id: TENANT_ID,
    company_name: 'Test Co',
    subscription_plan: {
      voice_ai_enabled: true,
      voice_ai_minutes_included: 500,
      voice_ai_overage_rate: null,
    },
  };

  const baseSettings = {
    tenant_id: TENANT_ID,
    monthly_minutes_override: null,
  };

  function makeMockPrisma(overrides: {
    tenant?: object | null;
    settings?: object | null;
    sttAggSeconds?: number;
  } = {}) {
    return {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(
          overrides.tenant !== undefined ? overrides.tenant : baseTenant,
        ),
      },
      tenant_voice_ai_settings: {
        findUnique: jest.fn().mockResolvedValue(
          overrides.settings !== undefined ? overrides.settings : baseSettings,
        ),
      },
      voice_usage_record: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            usage_quantity: overrides.sttAggSeconds !== undefined ? overrides.sttAggSeconds : 0,
          },
        }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    } as unknown as jest.Mocked<PrismaService>;
  }

  async function buildService(prismaMock: jest.Mocked<PrismaService>): Promise<VoiceUsageService> {
    prisma = prismaMock;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceUsageService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    return module.get<VoiceUsageService>(VoiceUsageService);
  }

  // ─── Test 1 ──────────────────────────────────────────────────────────────────

  it('1. checkAndReserveMinute: minutes available → { allowed: true, is_overage: false }', async () => {
    // 300 minutes used out of 500 → still within quota
    const sttSeconds = 300 * 60; // 18000 seconds
    service = await buildService(makeMockPrisma({ sttAggSeconds: sttSeconds }));

    const result = await service.checkAndReserveMinute(TENANT_ID);

    expect(result.allowed).toBe(true);
    expect(result.is_overage).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  // ─── Test 2 ──────────────────────────────────────────────────────────────────

  it('2. checkAndReserveMinute: quota exceeded, no overage rate → { allowed: false, reason: "quota_exceeded" }', async () => {
    // 500 minutes used, limit = 500, no overage rate → blocked
    const sttSeconds = 500 * 60; // 30000 seconds
    service = await buildService(makeMockPrisma({ sttAggSeconds: sttSeconds }));

    const result = await service.checkAndReserveMinute(TENANT_ID);

    expect(result.allowed).toBe(false);
    expect(result.is_overage).toBe(false);
    expect(result.reason).toBe('quota_exceeded');
  });

  // ─── Test 3 ──────────────────────────────────────────────────────────────────

  it('3. checkAndReserveMinute: quota exceeded, overage rate set → { allowed: true, is_overage: true }', async () => {
    // 600 minutes used (over 500), but overage_rate = 0.05 → allowed as overage
    const tenantWithOverage = {
      ...baseTenant,
      subscription_plan: {
        ...baseTenant.subscription_plan,
        voice_ai_overage_rate: 0.05, // $0.05 per minute overage
      },
    };
    const sttSeconds = 600 * 60; // 36000 seconds
    service = await buildService(makeMockPrisma({ tenant: tenantWithOverage, sttAggSeconds: sttSeconds }));

    const result = await service.checkAndReserveMinute(TENANT_ID);

    expect(result.allowed).toBe(true);
    expect(result.is_overage).toBe(true);
  });

  // ─── Test 4 ──────────────────────────────────────────────────────────────────

  it('4. createUsageRecords: creates one row per provider entry (STT, LLM, TTS each get their own record)', async () => {
    service = await buildService(makeMockPrisma());

    const mockTx = {
      voice_usage_record: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    } as unknown as Parameters<typeof service.createUsageRecords>[0];

    const records: UsageRecordData[] = [
      { provider_id: STT_PROVIDER_ID, provider_type: 'STT', usage_quantity: 120, usage_unit: 'seconds' },
      { provider_id: LLM_PROVIDER_ID, provider_type: 'LLM', usage_quantity: 850, usage_unit: 'tokens' },
      { provider_id: TTS_PROVIDER_ID, provider_type: 'TTS', usage_quantity: 200, usage_unit: 'characters' },
    ];

    await service.createUsageRecords(mockTx, TENANT_ID, 'call-log-uuid', records);

    expect(mockTx.voice_usage_record.createMany).toHaveBeenCalledTimes(1);

    const callArg = (mockTx.voice_usage_record.createMany as jest.Mock).mock.calls[0][0];
    // Should have created exactly 3 rows — one per provider
    expect(callArg.data).toHaveLength(3);
    expect(callArg.data[0].provider_type).toBe('STT');
    expect(callArg.data[1].provider_type).toBe('LLM');
    expect(callArg.data[2].provider_type).toBe('TTS');
  });

  // ─── Test 5 ──────────────────────────────────────────────────────────────────

  it('5. createUsageRecords: sets correct year/month on each record', async () => {
    service = await buildService(makeMockPrisma());

    const mockTx = {
      voice_usage_record: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    } as unknown as Parameters<typeof service.createUsageRecords>[0];

    const records: UsageRecordData[] = [
      { provider_id: STT_PROVIDER_ID, provider_type: 'STT', usage_quantity: 90, usage_unit: 'seconds' },
      { provider_id: LLM_PROVIDER_ID, provider_type: 'LLM', usage_quantity: 500, usage_unit: 'tokens' },
    ];

    const now = new Date();
    const expectedYear = now.getFullYear();
    const expectedMonth = now.getMonth() + 1;

    await service.createUsageRecords(mockTx, TENANT_ID, 'call-log-uuid-2', records);

    const callArg = (mockTx.voice_usage_record.createMany as jest.Mock).mock.calls[0][0];
    for (const row of callArg.data as Array<{ year: number; month: number }>) {
      expect(row.year).toBe(expectedYear);
      expect(row.month).toBe(expectedMonth);
    }
  });

  // ─── Test 6 ──────────────────────────────────────────────────────────────────

  it('6. getQuota: aggregates STT seconds from per-call records for current month correctly', async () => {
    // 27000 seconds = 450 minutes (Math.ceil(27000/60) = 450)
    const sttSeconds = 27000;
    service = await buildService(makeMockPrisma({ sttAggSeconds: sttSeconds }));

    const quota = await service.getQuota(TENANT_ID);

    expect(quota.minutes_included).toBe(500);
    expect(quota.minutes_used).toBe(450);       // Math.ceil(27000 / 60)
    expect(quota.minutes_remaining).toBe(50);
    expect(quota.quota_exceeded).toBe(false);
    expect(quota.overage_rate).toBeNull();

    // Verify the aggregate query was scoped to current month and STT type only
    const aggregateCall = (prisma.voice_usage_record.aggregate as jest.Mock).mock.calls[0][0];
    const now = new Date();
    expect(aggregateCall.where.provider_type).toBe('STT');
    expect(aggregateCall.where.year).toBe(now.getFullYear());
    expect(aggregateCall.where.month).toBe(now.getMonth() + 1);
    expect(aggregateCall.where.tenant_id).toBe(TENANT_ID);
  });

  // ─── Extra edge case ─────────────────────────────────────────────────────────

  it('createUsageRecords: returns early without DB call when records array is empty', async () => {
    service = await buildService(makeMockPrisma());

    const mockTx = {
      voice_usage_record: {
        createMany: jest.fn(),
      },
    } as unknown as Parameters<typeof service.createUsageRecords>[0];

    await service.createUsageRecords(mockTx, TENANT_ID, 'call-log-uuid-3', []);

    // No DB call made for empty array
    expect(mockTx.voice_usage_record.createMany).not.toHaveBeenCalled();
  });
});
