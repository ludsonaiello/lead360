# Sprint BAS17 — IVR Extension (voice_ai action type)

**Module**: Voice AI + Communication
**Sprint**: BAS17
**Depends on**: BAS16 (call log controller complete)
**Estimated size**: 2–3 files modified, ~80 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `create-ivr-config.dto.ts` completely — understand `IVR_ACTION_TYPES` array
- Read `ivr-configuration.service.ts` — understand `executeIvrAction()` flow
- Read `voice-ai-sip.service.ts` — understand `canHandleCall()` and `buildSipTwiml()`
- These are EXISTING files in the communication module — DO NOT recreate them, MODIFY them
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Add the `voice_ai` action type to the existing IVR system. When a caller selects the `voice_ai` action, the IVR checks quota/entitlement and routes the call to LiveKit via SIP. This integrates the two existing modules: `communication` and `voice-ai`.

---

## Pre-Coding Checklist

- [ ] BAS16 complete (call log controller verified)
- [ ] Read `api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts` — find `IVR_ACTION_TYPES`
- [ ] Read `api/src/modules/communication/services/ivr-configuration.service.ts` — `executeIvrAction()` method
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-sip.service.ts` — `canHandleCall()` and `buildSipTwiml()`
- [ ] Verify `VoiceAiSipService` is exported from `voice-ai.module.ts` and importable in `communication.module.ts`

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts` | `IVR_ACTION_TYPES` constant location |
| `api/src/modules/communication/services/ivr-configuration.service.ts` | `executeIvrAction()` switch/if logic |
| `api/src/modules/voice-ai/services/voice-ai-sip.service.ts` | `canHandleCall()` and `buildSipTwiml()` signatures |
| `api/src/modules/voice-ai/voice-ai.module.ts` | Verify `VoiceAiSipService` is exported |
| `api/src/modules/communication/communication.module.ts` | Verify VoiceAiModule is imported |

---

## Task 1: Add `voice_ai` to IVR_ACTION_TYPES

In `api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts`:

```typescript
export const IVR_ACTION_TYPES = [
  'route_to_number',
  'route_to_default',
  'trigger_webhook',
  'voicemail',
  'voice_ai',    // ADD THIS — routes call to LiveKit SIP trunk
] as const;
```

---

## Task 2: Add voice_ai Handler in IvrConfigurationService

In `ivr-configuration.service.ts`, find the `executeIvrAction()` method. It likely has a switch/if block for each action type. Add the `voice_ai` case:

```typescript
// In executeIvrAction(), after finding the action type:
case 'voice_ai': {
  // 1. Check entitlement
  const result = await this.voiceAiSipService.canHandleCall(tenantId);
  if (!result.allowed) {
    // Build fallback TwiML — transfer to default number with message
    const settings = await this.prisma.tenant_voice_ai_settings.findUnique({
      where: { tenant_id: tenantId },
      include: { default_transfer_number: true }
    });
    const fallbackNumber = settings?.default_transfer_number?.phone_number;
    return this.voiceAiSipService.buildFallbackTwiml(
      fallbackNumber,
      result.reason === 'quota_exceeded'
        ? 'Our AI assistant has reached its limit for this month. Transferring you now.'
        : 'Our AI assistant is not available. Transferring you now.'
    );
  }
  // 2. Build SIP transfer TwiML
  return await this.voiceAiSipService.buildSipTwiml(tenantId, callSid);
}
```

**Important**: Read the ACTUAL method signature of `executeIvrAction()` before modifying. Understand what `tenantId` and `callSid` are available in that context.

---

## Task 3: Inject VoiceAiSipService into IvrConfigurationService

If `IvrConfigurationService` doesn't already have `VoiceAiSipService` injected:

1. Add to constructor: `private readonly voiceAiSipService: VoiceAiSipService`
2. Import `VoiceAiModule` in `communication.module.ts` (add to imports array)
3. Ensure `VoiceAiSipService` is in the `exports` array of `voice-ai.module.ts`

**Check for circular dependency**: If `VoiceAiModule` already imports `CommunicationModule`, you'll have a circular dep. Use `forwardRef()` if needed. Read both module files first.

---

## Task 4: Validate IVR Config with voice_ai action

The `validateActionConfig()` method in `IvrConfigurationService` may need updating — `voice_ai` action requires no extra config (no phone number, no webhook URL needed). Make sure validation doesn't reject it.

---

## Task 5: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts` | MODIFY | Add `'voice_ai'` to IVR_ACTION_TYPES |
| `api/src/modules/communication/services/ivr-configuration.service.ts` | MODIFY | Add voice_ai case to executeIvrAction() |
| `api/src/modules/communication/communication.module.ts` | MODIFY (if needed) | Import VoiceAiModule |
| `api/src/modules/voice-ai/voice-ai.module.ts` | MODIFY (if needed) | Export VoiceAiSipService |

---

## Acceptance Criteria

- [ ] `IVR_ACTION_TYPES` array includes `'voice_ai'`
- [ ] IVR config can be created with `action: 'voice_ai'` — no validation error
- [ ] `executeIvrAction()` handles `voice_ai` case — calls `canHandleCall()` then `buildSipTwiml()`
- [ ] Fallback TwiML generated when quota exceeded
- [ ] SIP TwiML generated when quota available
- [ ] No circular dependency errors
- [ ] `npm run build` passes with 0 errors

---

## Testing

```bash
TENANT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contato@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Create IVR config with voice_ai action
curl -X POST http://localhost:3000/api/v1/communication/twilio/ivr \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ivr_enabled": true,
    "greeting_message": "Thank you for calling. Press 1 for our AI assistant.",
    "menu_options": [
      {
        "digit": "1",
        "action": "voice_ai",
        "label": "AI Assistant",
        "config": {}
      }
    ],
    "default_action": { "action": "voicemail", "config": { "max_duration_seconds": 120 } },
    "timeout_seconds": 10,
    "max_retries": 2
  }'
# Expected: 201 Created
```
