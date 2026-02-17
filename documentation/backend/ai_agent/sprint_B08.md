YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B08 — IVR Extension (voice_ai Action Type)

**Module**: Voice AI  
**Sprint**: B08  
**Depends on**: B01, B04, B06, B07  
**Estimated scope**: ~2 hours

---

## Objective

Surgically extend the existing IVR system to support a `voice_ai` action type. When a caller presses the digit mapped to voice_ai, the system checks if the tenant has Voice AI enabled with remaining quota, then generates TwiML to transfer the call via SIP to the LiveKit server.

---

## Pre-Coding Checklist

- [ ] B07 is complete
- [ ] Read `/api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts` — find `IVR_ACTION_TYPES` constant
- [ ] Read `/api/src/modules/communication/services/ivr-configuration.service.ts` — find `generateDtmfTwiML()` method and the switch/case logic
- [ ] Read existing IVR action types to understand the pattern
- [ ] CRITICAL: Do NOT modify any existing IVR logic — only ADD the new case

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- Tenant: `contato@honeydo4you.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Add voice_ai to IVR Action Types

In `/api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts`:

Find `IVR_ACTION_TYPES` (or similar constant/enum) and add `'voice_ai'` to the array.

Example — the existing code probably looks like:
```typescript
export const IVR_ACTION_TYPES = ['dial', 'voicemail', 'play_message', 'transfer'] as const;
```

Change to:
```typescript
export const IVR_ACTION_TYPES = ['dial', 'voicemail', 'play_message', 'transfer', 'voice_ai'] as const;
```

(Adapt to whatever the actual types are called in the file.)

---

## Task 2: Create VoiceAiSipService

Create `/api/src/modules/voice-ai/services/voice-ai-sip.service.ts`:

```typescript
@Injectable()
export class VoiceAiSipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: VoiceAiSettingsService,
    private readonly usageService: VoiceUsageService,
  ) {}

  async canHandleCall(tenantId: string): Promise<{ allowed: boolean; reason?: string }>
  // Check 1: tenant has voice_ai_settings with is_enabled = true
  // Check 2: tenant's subscription plan has voice_ai_enabled = true
  // Check 3: quota not exceeded OR overage_rate is not null
  // Returns { allowed: true } or { allowed: false, reason: 'disabled'|'quota_exceeded'|'plan_not_included' }

  async buildSipTwiml(tenantId: string, callSid: string): Promise<string>
  // Loads global config to get livekit_sip_trunk_url
  // Returns TwiML string:
  // <Response>
  //   <Dial>
  //     <Sip>sip:voice-ai@{livekit_sip_trunk_url}?tenantId={tenantId}&callSid={callSid}</Sip>
  //   </Dial>
  // </Response>

  async buildFallbackTwiml(transferNumber: string, message?: string): Promise<string>
  // Returns TwiML string that plays a message and transfers to a phone number:
  // <Response>
  //   <Say>{message}</Say>
  //   <Dial>{transferNumber}</Dial>
  // </Response>
}
```

---

## Task 3: Extend IvrConfigurationService

In `/api/src/modules/communication/services/ivr-configuration.service.ts`:

Find `generateDtmfTwiML()` (or the method that generates TwiML for a menu action) and add the `voice_ai` case.

**IMPORTANT**: Inject `VoiceAiSipService` into the communication module carefully to avoid circular dependencies. Options:
1. Pass context (tenantId, callSid) to the method that handles the action
2. Use NestJS `ModuleRef` for lazy injection if circular dependency occurs
3. Create a separate webhook handler that processes voice_ai differently

The `voice_ai` case logic:
```typescript
case 'voice_ai':
  const canHandle = await this.voiceAiSipService.canHandleCall(tenantId);
  if (canHandle.allowed) {
    return this.voiceAiSipService.buildSipTwiml(tenantId, callSid);
  } else {
    // Fallback: play message and transfer to default number
    const settings = await this.prisma.tenant_voice_ai_settings.findUnique({
      where: { tenant_id: tenantId }
    });
    const fallbackNumber = settings?.default_transfer_number || action.phone_number;
    const message = canHandle.reason === 'quota_exceeded' 
      ? 'Our AI assistant has reached its limit for this month. Transferring you now.'
      : 'Our AI assistant is not available. Transferring you now.';
    return this.voiceAiSipService.buildFallbackTwiml(fallbackNumber, message);
  }
```

**Circular dependency handling**: If adding VoiceAiSipService to CommunicationModule causes circular dependency with VoiceAiModule, use `forwardRef()` pattern:
```typescript
// In CommunicationModule
imports: [forwardRef(() => VoiceAiModule)]

// In VoiceAiModule  
imports: [forwardRef(() => CommunicationModule)]
```

---

## Task 4: Update VoiceAiModule

Export `VoiceAiSipService` from `VoiceAiModule` so it can be imported by `CommunicationModule`.

---

## Acceptance Criteria

- [ ] `voice_ai` is a valid IVR action type (DTO validation accepts it)
- [ ] When tenant has Voice AI enabled + quota available: IVR generates SIP TwiML
- [ ] When tenant's Voice AI is disabled or quota exceeded: IVR generates fallback TwiML with message
- [ ] Existing IVR action types still work exactly as before (regression test manually)
- [ ] No TypeScript circular dependency errors
- [ ] `npm run build` passes
