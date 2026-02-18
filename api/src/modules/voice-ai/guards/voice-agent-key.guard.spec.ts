import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { VoiceAgentKeyGuard } from './voice-agent-key.guard';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * VoiceAgentKeyGuard Unit Tests — Sprint B13
 *
 * Test coverage (5 cases):
 *   1. Missing header → throws UnauthorizedException
 *   2. Invalid key → throws UnauthorizedException
 *   3. Correct key → returns true
 *   4. Timing-safe comparison: correct key with different capitalization → fails (SHA-256 hex is lowercase)
 *   5. No key configured in DB → throws UnauthorizedException
 */
describe('VoiceAgentKeyGuard', () => {
  let guard: VoiceAgentKeyGuard;
  let mockPrisma: jest.Mocked<PrismaService>;

  // The "correct" plain-text key and its SHA-256 hash stored in DB
  const PLAIN_KEY = 'super-secret-agent-key-12345';
  const STORED_HASH = crypto.createHash('sha256').update(PLAIN_KEY).digest('hex');

  function buildContext(headers: Record<string, string | undefined>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    mockPrisma = {
      voice_ai_global_config: {
        findUnique: jest.fn().mockResolvedValue({ agent_api_key_hash: STORED_HASH }),
      },
    } as unknown as jest.Mocked<PrismaService>;

    guard = new VoiceAgentKeyGuard(mockPrisma);
  });

  // ─── Test 1 ──────────────────────────────────────────────────────────────────

  it('1. missing X-Voice-Agent-Key header → throws UnauthorizedException', async () => {
    const ctx = buildContext({});  // No header present

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('X-Voice-Agent-Key header required');

    // Should not even reach the DB if header is missing
    expect(mockPrisma.voice_ai_global_config.findUnique).not.toHaveBeenCalled();
  });

  // ─── Test 2 ──────────────────────────────────────────────────────────────────

  it('2. invalid key in header → throws UnauthorizedException', async () => {
    const ctx = buildContext({ 'x-voice-agent-key': 'wrong-key-value' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid agent key');

    // DB was queried to get the stored hash
    expect(mockPrisma.voice_ai_global_config.findUnique).toHaveBeenCalledWith({
      where: { id: 'default' },
      select: { agent_api_key_hash: true },
    });
  });

  // ─── Test 3 ──────────────────────────────────────────────────────────────────

  it('3. correct key → returns true', async () => {
    const ctx = buildContext({ 'x-voice-agent-key': PLAIN_KEY });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockPrisma.voice_ai_global_config.findUnique).toHaveBeenCalledTimes(1);
  });

  // ─── Test 4 ──────────────────────────────────────────────────────────────────

  it('4. timing-safe: correct key with different capitalization → fails (SHA-256 is case-sensitive)', async () => {
    // SHA-256 of 'SUPER-SECRET-AGENT-KEY-12345' differs from lowercase version
    const uppercaseKey = PLAIN_KEY.toUpperCase();

    const ctx = buildContext({ 'x-voice-agent-key': uppercaseKey });

    // The stored hash was computed from PLAIN_KEY (lowercase).
    // Hash of uppercaseKey will differ → invalid.
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);

    // Verify the stored hash and the hash of the uppercase key are indeed different
    const uppercaseHash = crypto.createHash('sha256').update(uppercaseKey).digest('hex');
    expect(uppercaseHash).not.toBe(STORED_HASH);
  });

  // ─── Test 5 ──────────────────────────────────────────────────────────────────

  it('5. no key configured in DB (agent_api_key_hash is null) → throws UnauthorizedException', async () => {
    // Override Prisma to always return a config row with null hash for this test
    (mockPrisma.voice_ai_global_config.findUnique as jest.Mock).mockResolvedValue({
      agent_api_key_hash: null,
    });

    const ctx = buildContext({ 'x-voice-agent-key': PLAIN_KEY });

    const error = await guard.canActivate(ctx).catch((e: Error) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).message).toBe('Voice AI agent key not configured');
  });

  it('5b. no config row in DB at all → throws UnauthorizedException', async () => {
    // findUnique returns null (row doesn't exist)
    (mockPrisma.voice_ai_global_config.findUnique as jest.Mock).mockResolvedValue(null);

    const ctx = buildContext({ 'x-voice-agent-key': PLAIN_KEY });

    const error = await guard.canActivate(ctx).catch((e: Error) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).message).toBe('Voice AI agent key not configured');
  });
});
