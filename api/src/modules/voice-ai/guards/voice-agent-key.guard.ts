import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * VoiceAgentKeyGuard
 *
 * Guards internal voice AI endpoints (Sprint B06a) that are called by the Python agent.
 * These endpoints use X-Voice-Agent-Key header authentication — no JWT.
 *
 * Validation flow:
 *   1. Extract X-Voice-Agent-Key header
 *   2. Hash the provided key with SHA-256
 *   3. Compare to agent_api_key_hash stored in voice_ai_global_config using timing-safe comparison
 *   4. Reject with 401 if missing, not configured, or invalid
 *
 * Security:
 *   - Timing-safe comparison (crypto.timingSafeEqual) prevents timing-based enumeration
 *   - Key is hashed before comparison — plain key never stored in DB
 *   - No JWT required — these routes must be decorated with @Public() to skip JwtAuthGuard
 */
@Injectable()
export class VoiceAgentKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const providedKey = request.headers['x-voice-agent-key'];

    if (!providedKey || typeof providedKey !== 'string') {
      throw new UnauthorizedException('X-Voice-Agent-Key header required');
    }

    const config = await this.prisma.voice_ai_global_config.findUnique({
      where: { id: 'default' },
      select: { agent_api_key_hash: true },
    });

    if (!config?.agent_api_key_hash) {
      throw new UnauthorizedException('Voice AI agent key not configured');
    }

    const providedHash = crypto
      .createHash('sha256')
      .update(providedKey)
      .digest('hex');
    const storedHash = config.agent_api_key_hash;

    // CRITICAL: Timing-safe comparison to prevent timing attacks on key validation.
    // Both hashes are hex strings of the same length (64 chars each).
    // We compare Buffer representations to use crypto.timingSafeEqual.
    if (providedHash.length !== storedHash.length) {
      throw new UnauthorizedException('Invalid agent key');
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid agent key');
    }

    return true;
  }
}
