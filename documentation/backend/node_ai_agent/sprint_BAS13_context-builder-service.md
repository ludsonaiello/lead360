# Sprint BAS13 — Context Builder Service

**Module**: Voice AI
**Sprint**: BAS13
**Depends on**: BAS12 (all settings services complete)
**Estimated size**: 1–2 files, ~200 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-context-builder.service.ts` completely — understand every merge step
- Understand the three-layer merge: Global Config → Plan → Tenant Settings
- Read the Prisma schema for all 3 tables involved
- This service is what the LiveKit agent calls to get its complete operating context
- NEVER return raw encrypted secrets to the agent
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceAiContextBuilderService` — builds the complete `VoiceAiContext` object that the agent worker uses at call-time. Merges global defaults with plan entitlements and tenant customizations. Also provides the LiveKit connection config for the agent worker startup (BAS19).

---

## Pre-Coding Checklist

- [ ] BAS12 complete (all settings services verified)
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts` completely
- [ ] Read `api/prisma/schema.prisma` — `voice_ai_global_config`, `tenant_voice_ai_settings`, `subscription_plan`
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-global-config.service.ts` — `getLiveKitConfig()` method
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-credentials.service.ts` — `getDecryptedKey()` method

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts` | Existing service — understand the merge logic |
| `api/src/modules/voice-ai/services/voice-ai-global-config.service.ts` | `getLiveKitConfig()` and `getConfig()` |
| `api/src/modules/voice-ai/services/voice-ai-credentials.service.ts` | `getDecryptedKey()` |
| `api/src/modules/voice-ai/services/voice-ai-settings.service.ts` | `getSettings()` |
| `api/prisma/schema.prisma` | All 3 config tables |

---

## Task 1: Verify the VoiceAiContext Shape

The agent worker (BAS19) calls `buildContext(tenantId, callSid)` to get everything it needs. The returned object must include:

```typescript
interface VoiceAiContext {
  // Call identification
  tenant_id: string;
  call_sid: string;

  // Provider API keys (decrypted — only for internal agent use)
  stt: {
    provider_key: string;         // 'deepgram'
    api_key: string;              // Decrypted
    config: Record<string, any>;  // Provider-specific config
  };
  llm: {
    provider_key: string;         // 'openai'
    api_key: string;              // Decrypted
    config: Record<string, any>;
  };
  tts: {
    provider_key: string;         // 'cartesia'
    api_key: string;              // Decrypted
    config: Record<string, any>;
  };

  // Agent behavior
  voice_id: string;
  language: string;
  enabled_languages: string[];
  greeting: string;              // Merged: tenant custom OR global template with {business_name} substituted
  system_prompt: string;         // Merged: global + tenant custom_instructions appended
  max_call_seconds: number;      // Tenant override OR global default
  booking_enabled: boolean;
  lead_creation_enabled: boolean;
  transfer_enabled: boolean;

  // Transfer destinations
  transfer_numbers: {
    id: string;
    label: string;
    phone_number: string;
    is_default: boolean;
  }[];

  // Business info (for prompt)
  business_name: string;
  business_phone: string;
}
```

---

## Task 2: Verify Merge Logic

The merge priority (highest wins):
1. **Tenant override** (from `tenant_voice_ai_settings`)
2. **Global default** (from `voice_ai_global_config`)

For `greeting`:
- If `tenant.custom_greeting` is set: use it
- Otherwise: use `global.default_greeting_template`, replace `{business_name}` with tenant's business name

For `system_prompt`:
- Start with `global.default_system_prompt`
- Append `\n\nAdditional Instructions:\n` + `tenant.custom_instructions` (if set)

For `max_call_seconds`:
- Use `tenant.max_call_duration_seconds` if set
- Otherwise use `global.default_max_call_seconds`

---

## Task 3: Verify buildContext() Fetches Business Name

Business name comes from the `tenant` table. Check the `tenant` model in `api/prisma/schema.prisma` for the business name column name — do NOT guess it. Use `this.prisma.tenant.findUnique({ where: { id: tenantId } })`.

---

## Task 4: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts` | VERIFY/MODIFY | Complete merge logic |
| `api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts` | VERIFY/CREATE | VoiceAiContext TypeScript interface |

---

## Acceptance Criteria

- [ ] `buildContext(tenantId, callSid)` returns complete `VoiceAiContext` object
- [ ] Decrypted API keys included (for agent use only — not exposed via HTTP)
- [ ] `{business_name}` substituted in greeting template
- [ ] Tenant `custom_instructions` appended to global `system_prompt`
- [ ] `max_call_seconds` uses tenant override if set, otherwise global
- [ ] Transfer numbers included and ordered
- [ ] `npm run build` passes with 0 errors

---

## Testing

```bash
# Unit test the context builder manually (no HTTP endpoint — used internally by agent)
# Test by checking the agent startup in BAS19 which calls this service
cd /var/www/lead360.app/api && npm run test -- --testPathPattern=voice-ai-context
```
