import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';

/**
 * LiveKitWebhookGuard
 *
 * Guards the LiveKit webhook endpoint (Sprint B14) using HMAC-SHA256 signature
 * verification. No JWT is required — authentication is purely via signature.
 *
 * Validation flow:
 *   1. Extract X-LiveKit-Signature header
 *   2. Fetch livekit_api_secret from voice_ai_global_config (singleton row)
 *   3. Decrypt the stored AES-256-GCM encrypted secret
 *   4. Compute HMAC-SHA256 over the raw request body
 *   5. Timing-safe comparison of computed vs provided signature
 *   6. Reject with 401 on any failure
 *
 * Requires:
 *   - Raw body stored on request as `rawBody: Buffer` (configured in main.ts)
 *   - Route decorated with @Public() to bypass global JwtAuthGuard
 *   - livekit_api_secret stored encrypted in voice_ai_global_config
 *
 * Security:
 *   - crypto.timingSafeEqual prevents timing-based enumeration
 *   - Decrypted secret never logged or cached
 */
@Injectable()
export class LiveKitWebhookGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      rawBody?: Buffer;
    }>();

    // 1. Validate signature header presence
    const signature = request.headers['x-livekit-signature'];
    if (!signature || typeof signature !== 'string') {
      throw new UnauthorizedException('Missing LiveKit webhook signature');
    }

    // 2. Fetch global config for encrypted LiveKit API secret
    const config = await this.prisma.voice_ai_global_config.findUnique({
      where: { id: 'default' },
      select: { livekit_api_secret: true },
    });

    if (!config?.livekit_api_secret) {
      throw new UnauthorizedException('LiveKit not configured');
    }

    // 3. Decrypt the stored secret (synchronous, AES-256-GCM)
    let secret: string;
    try {
      secret = this.encryptionService.decrypt(config.livekit_api_secret);
    } catch {
      throw new UnauthorizedException('LiveKit not configured');
    }

    // 4. Require raw body for signature computation
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException(
        'Raw body unavailable for signature verification',
      );
    }

    // 5. Compute expected HMAC-SHA256 signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // 6. Timing-safe comparison — both HMAC-SHA256 hex outputs are always 64 chars
    //    If lengths differ (invalid header format), reject immediately
    if (signature.length !== expectedSig.length) {
      throw new UnauthorizedException('Invalid LiveKit webhook signature');
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig),
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid LiveKit webhook signature');
    }

    return true;
  }
}
