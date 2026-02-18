YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B06a — Internal API: Guard + Context Endpoints

**Module**: Voice AI
**Sprint**: B06a
**Depends on**: B01, B04, B05
**Next**: B06b (Call start/complete), B06c (Tool actions)

---

## Objective

Build the `VoiceAgentKeyGuard` and the two context endpoints (`/access` and `/context`) that the Python agent calls when receiving a call. These are the first two internal endpoints the agent hits before any audio processing begins.

---

## Pre-Coding Checklist

- [ ] B04 is complete — `VoiceAiContextBuilderService` exists
- [ ] Read `/api/src/modules/communication/services/webhook-verification.service.ts` — timing-safe comparison pattern
- [ ] Read `/api/src/main.ts` — understand global prefix; internal routes need `@Public()` to bypass JWT guard
- [ ] Check how `@Public()` decorator works for bypassing global JWT guard in existing webhook controllers
- [ ] **HIT THE ENDPOINT** after implementing:
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

  # First set an agent key from admin panel, then:
  curl http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/context \
    -H "X-Voice-Agent-Key: YOUR_KEY" | jq .
  ```

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: VoiceAgentKeyGuard

Create `/api/src/modules/voice-ai/guards/voice-agent-key.guard.ts`:

```typescript
import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class VoiceAgentKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
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

    const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');
    const storedHash = config.agent_api_key_hash;

    // CRITICAL: Timing-safe comparison to prevent timing attacks
    if (providedHash.length !== storedHash.length) {
      throw new UnauthorizedException('Invalid agent key');
    }
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
    if (!isValid) throw new UnauthorizedException('Invalid agent key');

    return true;
  }
}
```

---

## Task 2: Internal Service (context methods only)

Create `services/voice-ai-internal.service.ts` with just the context methods for now (call + tool methods added in B06b and B06c):

```typescript
@Injectable()
export class VoiceAiInternalService {
  constructor(
    private readonly contextBuilder: VoiceAiContextBuilderService,
    // NOTE: VoiceCallLogService and VoiceUsageService are added in B06b
    // when startCall() and completeCall() are implemented.
  ) {}

  async checkAccess(tenantId: string): Promise<{
    has_access: boolean;
    reason?: string;
    minutes_remaining?: number;
    overage_rate?: number | null;
  }> {
    // 1. Build context (includes quota)
    let context: FullVoiceAiContext;
    try {
      context = await this.contextBuilder.buildContext(tenantId);
    } catch {
      return { has_access: false, reason: 'tenant_not_found' };
    }

    if (!context.behavior.is_enabled) {
      return { has_access: false, reason: 'not_enabled' };
    }

    if (context.quota.quota_exceeded && context.quota.overage_rate === null) {
      return {
        has_access: false,
        reason: 'quota_exceeded',
        minutes_remaining: 0,
        overage_rate: null,
      };
    }

    return {
      has_access: true,
      minutes_remaining: context.quota.minutes_remaining,
      overage_rate: context.quota.overage_rate,
    };
  }

  async getContext(tenantId: string): Promise<FullVoiceAiContext> {
    return this.contextBuilder.buildContext(tenantId);
  }
}
```

---

## Task 3: Internal Controller (context endpoints only)

`controllers/internal/voice-ai-internal.controller.ts`:

```typescript
// Route prefix: internal/voice-ai → /api/v1/internal/voice-ai/
// IMPORTANT: @Public() skips the global JWT guard. This controller uses VoiceAgentKeyGuard instead.

@Public()                          // REQUIRED: bypasses global JwtAuthGuard — agent has no JWT
@Controller('internal/voice-ai')
@UseGuards(VoiceAgentKeyGuard)
export class VoiceAiInternalController {
  constructor(private readonly internalService: VoiceAiInternalService) {}

  // API-026: Pre-flight access check
  // Called BEFORE agent accepts the call job — cheap quota check
  @Get('tenant/:tenantId/access')
  checkAccess(@Param('tenantId') tenantId: string) {
    return this.internalService.checkAccess(tenantId);
  }

  // API-022: Full context fetch
  // Called once per call to get all config, decrypted keys, quota
  @Get('tenant/:tenantId/context')
  getContext(@Param('tenantId') tenantId: string) {
    return this.internalService.getContext(tenantId);
  }
}
```

Apply `@Public()` at class level to bypass the global JWT guard. The `VoiceAgentKeyGuard` provides authentication for these routes.

---

## Task 4: Update Module

Update `voice-ai.module.ts`:

```typescript
@Module({
  imports: [PrismaModule, EncryptionModule],
  controllers: [
    VoiceAiProvidersController,
    VoiceAiCredentialsController,
    VoiceAiInternalController,  // add this
  ],
  providers: [
    VoiceAiProvidersService,
    VoiceAiCredentialsService,
    VoiceAgentKeyGuard,         // add this
    VoiceAiInternalService,     // add this
  ],
  exports: [
    VoiceAiProvidersService,
    VoiceAiCredentialsService,
    VoiceAgentKeyGuard,         // exported for B06b and B06c
  ],
})
export class VoiceAiModule {}
```

---

## Acceptance Criteria

- [ ] `GET /api/v1/internal/voice-ai/tenant/:tenantId/access` returns `{ has_access, reason, minutes_remaining }` with `X-Voice-Agent-Key`
- [ ] `GET /api/v1/internal/voice-ai/tenant/:tenantId/context` returns full `FullVoiceAiContext` with decrypted provider keys
- [ ] Request without `X-Voice-Agent-Key` → 401
- [ ] Request with invalid key → 401
- [ ] JWT-authenticated requests CANNOT access these endpoints (different auth mechanism)
- [ ] Timing-safe comparison prevents timing attacks on key validation
- [ ] `npm run build` passes
