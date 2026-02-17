YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B14 — LiveKit Webhook Handler

**Module**: Voice AI
**Sprint**: B14
**Depends on**: B06, B07

---

## Objective

Handle inbound webhook events from LiveKit (room created, participant joined/left, call ended). This provides a server-side safety net to finalize call records even if the Python agent crashes before sending a `/calls/:callSid/complete` request. It also enables future real-time monitoring.

---

## Pre-Coding Checklist

- [ ] B06, B07 are complete — call log service and internal API exist
- [ ] Read LiveKit webhook documentation: https://docs.livekit.io/home/server/webhooks/
- [ ] Read `/api/src/modules/communication/controllers/ivr.controller.ts` — webhook controller pattern
- [ ] Read `voice_ai_global_config` model — `livekit_api_key` and `livekit_api_secret` fields
- [ ] Understand that LiveKit signs webhooks with HMAC-SHA256 using the API secret

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Webhook Signature Verifier

`voice-ai-webhook.guard.ts`:

```typescript
@Injectable()
export class LiveKitWebhookGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-livekit-signature'] as string;

    if (!signature) {
      throw new UnauthorizedException('Missing LiveKit webhook signature');
    }

    const config = await this.prisma.voice_ai_global_config.findUnique({
      where: { id: 'default' },
      select: { livekit_api_secret: true },
    });

    if (!config?.livekit_api_secret) {
      throw new UnauthorizedException('LiveKit not configured');
    }

    // Decrypt the stored secret
    const secret = await this.encryptionService.decrypt(config.livekit_api_secret);

    // Get raw body (must use rawBody middleware — see Task 2)
    const rawBody = (request as any).rawBody as Buffer;
    if (!rawBody) {
      throw new UnauthorizedException('Raw body unavailable for signature verification');
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

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
```

---

## Task 2: Raw Body Middleware

LiveKit webhook signature verification requires the raw (unparsed) request body. Configure NestJS to capture it:

In `main.ts`, add:
```typescript
import * as express from 'express';

// Before app.use(json()), add:
app.use('/api/webhooks/voice-ai/livekit', express.raw({ type: '*/*' }), (req, res, next) => {
  (req as any).rawBody = req.body;
  req.body = JSON.parse(req.body.toString());
  next();
});
```

OR use a NestJS `RawBodyMiddleware`. Check how existing Twilio/Stripe webhook routes handle this in the codebase and follow the same pattern.

---

## Task 3: Webhook Event Types

LiveKit sends JSON webhook events. The events we care about:

```typescript
// Supported LiveKit webhook event types
export const LIVEKIT_EVENTS = {
  ROOM_STARTED: 'room_started',
  ROOM_FINISHED: 'room_finished',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
} as const;

export interface LiveKitWebhookEvent {
  event: string;
  room?: {
    name: string;
    sid: string;
    creation_time: number;
    empty_timeout: number;
    departure_timeout: number;
    num_participants: number;
    metadata?: string; // JSON: { tenantId, callSid }
  };
  participant?: {
    sid: string;
    identity: string;
    name: string;
    joined_at: number;
    left_at?: number;
    metadata?: string;
  };
  id: string;            // unique event ID
  created_at: number;    // unix timestamp
}
```

---

## Task 4: Webhook Service

`voice-ai-webhook.service.ts`:

```typescript
@Injectable()
export class VoiceAiWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly callLogService: VoiceCallLogService,
    private readonly logger: Logger,
  ) {}

  async handleEvent(event: LiveKitWebhookEvent): Promise<void> {
    switch (event.event) {
      case 'room_started':
        await this.handleRoomStarted(event);
        break;
      case 'room_finished':
        await this.handleRoomFinished(event);
        break;
      case 'participant_left':
        await this.handleParticipantLeft(event);
        break;
      default:
        this.logger.debug(`Unhandled LiveKit event: ${event.event}`);
    }
  }

  private async handleRoomStarted(event: LiveKitWebhookEvent): Promise<void> {
    // Parse metadata: { tenantId, callSid }
    const meta = this.parseRoomMetadata(event.room?.metadata);
    if (!meta?.callSid) return;

    // Check if call_log already exists (created by Python agent's /calls/start)
    const existing = await this.prisma.voice_call_log.findUnique({
      where: { call_sid: meta.callSid },
    });

    if (!existing) {
      // Create a call log entry as fallback (agent may have crashed)
      this.logger.warn(`Creating call log from webhook (agent did not call /start): ${meta.callSid}`);
      await this.callLogService.startCall({
        tenantId: meta.tenantId,
        callSid: meta.callSid,
        fromNumber: meta.fromNumber ?? 'unknown',
        toNumber: meta.toNumber ?? 'unknown',
        direction: 'inbound',
      });
    }
  }

  private async handleRoomFinished(event: LiveKitWebhookEvent): Promise<void> {
    const meta = this.parseRoomMetadata(event.room?.metadata);
    if (!meta?.callSid) return;

    // Find call log
    const callLog = await this.prisma.voice_call_log.findUnique({
      where: { call_sid: meta.callSid },
    });

    if (!callLog) {
      this.logger.warn(`Room finished but no call log found: ${meta.callSid}`);
      return;
    }

    // Only finalize if still in_progress (agent may have already completed it)
    if (callLog.status === 'in_progress') {
      this.logger.warn(`Finalizing call via webhook (agent did not call /complete): ${meta.callSid}`);
      const now = new Date();
      const durationSeconds = callLog.started_at
        ? Math.floor((now.getTime() - callLog.started_at.getTime()) / 1000)
        : 0;

      await this.prisma.voice_call_log.update({
        where: { id: callLog.id },
        data: {
          status: 'completed',
          outcome: 'abandoned',  // fallback — agent should have set this
          duration_seconds: durationSeconds,
          ended_at: now,
        },
      });
    }
  }

  private async handleParticipantLeft(event: LiveKitWebhookEvent): Promise<void> {
    // Optional: log participant departure for debugging
    // Not critical for billing
  }

  private parseRoomMetadata(metadata?: string): {
    tenantId: string;
    callSid: string;
    fromNumber?: string;
    toNumber?: string;
  } | null {
    if (!metadata) return null;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }
}
```

---

## Task 5: Webhook Controller

`controllers/voice-ai-webhook.controller.ts`:

```typescript
@Controller('webhooks/voice-ai')
export class VoiceAiWebhookController {
  constructor(private readonly webhookService: VoiceAiWebhookService) {}

  // API-031: LiveKit webhook endpoint
  // Path: POST /api/webhooks/voice-ai/livekit
  // No JWT, no agent key — authenticated via HMAC signature
  @Post('livekit')
  @HttpCode(200)
  @UseGuards(LiveKitWebhookGuard)
  async handleLiveKitWebhook(@Body() event: LiveKitWebhookEvent) {
    await this.webhookService.handleEvent(event);
    return { received: true };
  }
}
```

**IMPORTANT**: Apply `@Public()` to this controller or route to skip the global JWT guard.

---

## Task 6: Configure LiveKit Webhook URL

After deploying, configure the LiveKit webhook URL in the LiveKit dashboard:
- URL: `https://your-api-domain.com/api/webhooks/voice-ai/livekit`
- Events: room_started, room_finished, participant_joined, participant_left

In the admin panel (sprint FSA03), the LiveKit API secret is saved — this must match what LiveKit uses to sign webhooks.

---

## Task 7: Update Module

Add to `voice-ai.module.ts`:
- `LiveKitWebhookGuard`
- `VoiceAiWebhookService`
- `VoiceAiWebhookController`

---

## Acceptance Criteria

- [ ] `POST /api/webhooks/voice-ai/livekit` receives events and returns 200
- [ ] Invalid signature → 401
- [ ] Missing signature → 401
- [ ] `room_finished` event finalizes call log if still `in_progress` (agent crash safety net)
- [ ] `room_started` event creates call log if agent never called `/calls/start`
- [ ] Events already completed by agent are idempotent (no duplicate finalization)
- [ ] Raw body preserved for signature verification
- [ ] `npm run build` passes
