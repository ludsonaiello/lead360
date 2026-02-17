YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FSA03 — Admin Global Config Page

**Module**: Voice AI - Frontend Admin
**Sprint**: FSA03
**Depends on**: FSA02, FSA06

---

## Objective

Build the admin page to configure platform-wide Voice AI defaults. This is the master control panel for the entire Voice AI system: providers, LiveKit infrastructure, default behavior, language support, enabled tools, and fallback behaviors.

---

## Mandatory Pre-Coding Steps

1. Read API docs: `GET /api/v1/system/voice-ai/config` and `PATCH /api/v1/system/voice-ai/config`
2. **HIT ENDPOINTS** and verify exact response shapes:
   ```bash
   # Get current config
   TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

   curl http://localhost:8000/api/v1/system/voice-ai/config \
     -H "Authorization: Bearer $TOKEN" | jq .

   # Also get providers for dropdowns
   curl http://localhost:8000/api/v1/system/voice-ai/providers \
     -H "Authorization: Bearer $TOKEN" | jq .
   ```
3. Read reference: `/app/src/app/(dashboard)/admin/communications/email-config/page.tsx` — single config form pattern

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## Route

`/admin/voice-ai/config` → `/app/src/app/(dashboard)/admin/voice-ai/config/page.tsx`

---

## Page Structure

Single page with 6 grouped sections. Save button at bottom calls `PATCH /api/v1/system/voice-ai/config`.

---

### Section 1: AI Providers

- **Default STT Provider**: `<Select>` — populated with active STT providers (filter by `provider_type='STT'`)
- **Default LLM Provider**: `<Select>` — populated with active LLM providers
- **Default TTS Provider**: `<Select>` — populated with active TTS providers
- **Default Voice ID**: `<Input>` text — Cartesia voice UUID or provider-specific voice ID
  - Hint: "Voice ID from your TTS provider. For Cartesia: find UUIDs at cartesia.ai/voices"

---

### Section 2: Default Provider Config

Show per-provider config editors that update when the selected provider changes.

For each active STT/LLM/TTS provider, show a **dynamic form** driven by `provider.config_schema` (JSON Schema):

```
STT Config (Deepgram):
  Model:        [nova-2 ▾]
  Punctuate:    [✓ Enabled]

LLM Config (OpenAI):
  Model:        [gpt-4o-mini ▾]
  Temperature:  [0.7        ]
  Max Tokens:   [500        ]

TTS Config (Cartesia):
  Model:        [sonic-english ▾]
  Speed:        [1.0           ]
```

- Parse `config_schema.properties` to render inputs dynamically
- `type: string` with `enum` → `<Select>`
- `type: boolean` → `<ToggleSwitch>`
- `type: number` → `<Input type="number">` with min/max from schema
- `type: integer` → `<Input type="number" step="1">` with min/max

---

### Section 3: LiveKit Infrastructure

- **LiveKit SIP Trunk URL**: `<Input>` — e.g., `sip.livekit.cloud`
  - Hint: "The SIP address where inbound calls are routed to the AI agent"
- **LiveKit API Key**: `<Input type="password">` — shows "✓ Configured" placeholder if set; empty = keep existing
- **LiveKit API Secret**: `<Input type="password">` — same pattern
- Note text: "Leave password fields empty to keep existing values. Enter a new value to update."

---

### Section 4: Default Behavior

- **Default Language**: `<Select>` — en (English), es (Spanish), pt (Portuguese), fr (French), de (German), it (Italian), ja (Japanese), zh (Chinese)
- **Supported Languages**: `<MultiSelect>` or checkbox group — "Languages tenants can enable"
  - Shows all available language options; admin selects which are enabled platform-wide
  - Stored as `default_languages` JSON array
- **Default Greeting Template**: `<Textarea>` max 500 chars
  - Hint: "Use {business_name} as a placeholder for the tenant's business name"
- **Default System Prompt**: `<Textarea>` max 2000 chars
  - Hint: "Base instructions for the AI agent. Tenants can add their own instructions on top."
- **Default Max Call Duration**: `<Select>` — 5 min (300s), 10 min (600s), 15 min (900s), 30 min (1800s)
- **Default Transfer Behavior** (when no transfer number available): `<Select>`
  - `end_call` — Politely end the call
  - `voicemail` — Ask caller to leave a message (future feature)
  - `hold` — Place on hold (future feature)

---

### Section 5: Default Enabled Tools

These are the tools available to the AI agent by default. Tenants can override per-settings.

```
[✓] Lead Creation
    Create a lead record when a new caller contacts the business.

[✓] Appointment Booking
    Book appointments or service requests during calls.

[✓] Call Transfer
    Transfer calls to the tenant's specified phone numbers.
```

Each is a `<ToggleSwitch>` with label + description. Stored as `default_tools_enabled` JSON:
```json
{ "lead_creation": true, "booking": true, "call_transfer": true }
```

---

### Section 6: Performance + Agent Auth

- **Max Concurrent Calls**: `<Input type="number">` min 1, max 1000 — platform-wide limit
- **Agent API Key**: Shows last-4 characters + creation date
  - "Regenerate Key" button → opens one-time reveal modal (see below)
  - Hint: "This key is used by the Python agent to authenticate with the API. Store it securely."

**Regenerate Key Modal**:
- Warning: "Regenerating will invalidate the existing key. Update your agent deployment immediately."
- Confirm button: "Regenerate"
- After success: Display full key ONCE in a copyable field
- "Copy Key" button + "I've copied the key" checkbox required before closing
- Never show the key again after modal closes

---

## Form Validation (Zod)

```typescript
const configSchema = z.object({
  default_stt_provider_id: z.string().optional(),
  default_llm_provider_id: z.string().optional(),
  default_tts_provider_id: z.string().optional(),
  default_voice_id: z.string().max(100).optional(),
  default_stt_config: z.record(z.unknown()).optional(),
  default_llm_config: z.record(z.unknown()).optional(),
  default_tts_config: z.record(z.unknown()).optional(),
  livekit_sip_trunk_url: z.string().url().optional().or(z.literal('')),
  livekit_api_key: z.string().optional(),      // empty = keep existing
  livekit_api_secret: z.string().optional(),   // empty = keep existing
  default_language: z.enum(['en','es','pt','fr','de','it','ja','zh']),
  default_languages: z.array(z.string()).min(1),
  default_greeting_template: z.string().max(500),
  default_system_prompt: z.string().max(2000),
  default_max_call_duration_seconds: z.number().int().positive(),
  default_transfer_behavior: z.enum(['end_call','voicemail','hold']),
  default_tools_enabled: z.object({
    lead_creation: z.boolean(),
    booking: z.boolean(),
    call_transfer: z.boolean(),
  }),
  max_concurrent_calls: z.number().int().min(1).max(1000),
});
```

---

## State Management

1. On mount: `getVoiceAiGlobalConfig()` + `getVoiceAiProviders()` in parallel
2. Pre-fill all form fields with current values
3. Provider dropdowns: filter providers by type (STT, LLM, TTS)
4. When provider selection changes: fetch `provider.config_schema` to re-render dynamic config section
5. On save: build diff between original and current values, only send changed fields
6. Empty password fields = omit from PATCH payload (keep existing)

---

## Acceptance Criteria

- [ ] Form pre-filled with current config on load
- [ ] Provider dropdowns only show active providers of correct type
- [ ] Dynamic config editor renders from `config_schema` JSON Schema (select/toggle/number inputs)
- [ ] `default_languages` multi-select works — selects which languages are available
- [ ] Default tools section shows 3 toggles (lead_creation, booking, call_transfer)
- [ ] `default_transfer_behavior` dropdown with 3 options
- [ ] LiveKit password fields show "✓ Configured" placeholder, never show decrypted values
- [ ] Regenerate Key shows key once only in a copy-confirm modal
- [ ] Saving sends PATCH with only changed fields
- [ ] Success toast on save
- [ ] Validation errors shown inline
- [ ] `npm run build` passes
