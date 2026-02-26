# Voice AI Frontend - Sprint 3: Global Configuration (ADMIN)

**Sprint Type**: Admin Interface
**Route**: `/admin/voice-ai/config`
**Permission**: Platform Admin
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 464-625)

---

## 🎯 MASTERPIECE DEVELOPER

### ⚠️ CRITICAL RULES

1. NO GUESSING - Review Prisma, REST API, existing patterns
2. ENDPOINT VERIFICATION FIRST - Test before coding
3. SERVER: localhost:8000 (npm run start:dev)
4. ASK HUMAN if server not running
5. NEVER edit backend - STOP if issues found
6. ALL FIELDS - No shortcuts
7. COMPLETE ERROR HANDLING

---

## 📋 Test Credentials

Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## 🔍 Endpoint Verification (MANDATORY)

```bash
# GET global config
curl -X GET http://localhost:8000/api/v1/system/voice-ai/config \
  -H "Authorization: Bearer <token>"

# PATCH global config
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/config \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"agent_enabled": true}'

# POST regenerate agent key
curl -X POST http://localhost:8000/api/v1/system/voice-ai/config/regenerate-key \
  -H "Authorization: Bearer <token>"
```

**Verify**: Response schemas match API docs exactly. If not: STOP + ASK HUMAN.

---

## 📦 Data Model

```typescript
interface GlobalConfig {
  id: 'default';
  agent_enabled: boolean;
  default_stt_provider: Provider | null;
  default_llm_provider: Provider | null;
  default_tts_provider: Provider | null;
  default_stt_config: string | null;      // JSON string
  default_llm_config: string | null;      // JSON string
  default_tts_config: string | null;      // JSON string
  default_voice_id: string;
  default_language: string;
  default_languages: string;              // JSON array string
  default_greeting_template: string;
  default_system_prompt: string;
  default_max_call_duration_seconds: number;
  default_transfer_behavior: string;
  default_tools_enabled: string;          // JSON object string
  livekit_url: string;
  livekit_sip_trunk_url: string | null;
  livekit_api_key_set: boolean;           // True if key exists (encrypted)
  livekit_api_secret_set: boolean;        // True if secret exists (encrypted)
  agent_api_key_preview: string;          // Masked preview
  max_concurrent_calls: number;
  updated_at: Date;
  updated_by: string;
}
```

---

## 🏗️ Implementation

### File Structure

```
admin/voice-ai/
├── config/
│   └── page.tsx                    # Main config page
```

### Components

```
voice-ai/admin/
├── config/
│   ├── GlobalConfigForm.tsx        # Main config form (sections)
│   ├── ProviderSelector.tsx        # Provider dropdowns
│   ├── JSONEditor.tsx              # JSON config editor component
│   ├── RegenerateKeyModal.tsx      # Agent key regeneration
│   └── LiveKitConfig.tsx           # LiveKit section
```

---

## 📋 Implementation Tasks

### 1. Global Config Page

**Layout**: Tabbed or accordion interface with these sections:

#### Section 1: Agent Status
- [ ] **agent_enabled** (Toggle switch)
- [ ] Current status display (enabled/disabled)

#### Section 2: Default Providers
- [ ] **default_stt_provider_id** (Dropdown, populated from providers where type='STT')
- [ ] **default_stt_config** (JSON editor, optional)
- [ ] **default_llm_provider_id** (Dropdown, type='LLM')
- [ ] **default_llm_config** (JSON editor)
- [ ] **default_tts_provider_id** (Dropdown, type='TTS')
- [ ] **default_tts_config** (JSON editor)

#### Section 3: Voice & Language
- [ ] **default_voice_id** (Input, text)
- [ ] **default_language** (Select, e.g., 'en', 'pt', 'es')
- [ ] **default_languages** (MultiSelect, JSON array string)

#### Section 4: Agent Behavior
- [ ] **default_greeting_template** (Textarea, max 500 chars)
  - Supports `{business_name}` placeholder
- [ ] **default_system_prompt** (Textarea, max 2000 chars)

#### Section 5: Tool Toggles
- [ ] **default_tools_enabled** (JSON editor or toggle switches)
  - Parse JSON: `{"booking":true,"lead_creation":true,"call_transfer":true}`
  - Display as toggle switches for each tool

#### Section 6: Call Handling
- [ ] **default_max_call_duration_seconds** (Number input, 60-3600)
- [ ] **default_transfer_behavior** (Select: end_call, voicemail, hold)
- [ ] **max_concurrent_calls** (Number input, 1-100)

#### Section 7: LiveKit Configuration
- [ ] **livekit_url** (Input, URL validation, wss://...)
- [ ] **livekit_sip_trunk_url** (Input, optional)
- [ ] **livekit_api_key** (Password input, show if set/not set)
- [ ] **livekit_api_secret** (Password input, show if set/not set)
- [ ] Display: "API Key Set: ✅" or "❌ Not Set"

#### Section 8: Agent API Key
- [ ] **agent_api_key_preview** (Display masked preview, e.g., "...e86a")
- [ ] "Regenerate Agent API Key" button
  - Opens warning modal
  - Calls POST /config/regenerate-key
  - Shows plain key ONCE (with copy button)
  - Warning: "Save this key now. It will not be shown again."

---

## 🎨 Form Validation (Zod)

```typescript
const globalConfigSchema = z.object({
  agent_enabled: z.boolean(),
  default_stt_provider_id: z.string().uuid().optional().nullable(),
  default_llm_provider_id: z.string().uuid().optional().nullable(),
  default_tts_provider_id: z.string().uuid().optional().nullable(),
  default_voice_id: z.string().optional().nullable(),
  default_language: z.string().min(2).max(10).optional().nullable(),
  default_languages: z.string().refine(isValidJSON, 'Must be valid JSON').optional().nullable(),
  default_greeting_template: z.string().max(500).optional().nullable(),
  default_system_prompt: z.string().max(2000).optional().nullable(),
  default_max_call_duration_seconds: z.number().min(60).max(3600).optional().nullable(),
  default_transfer_behavior: z.string().optional().nullable(),
  default_tools_enabled: z.string().refine(isValidJSON).optional().nullable(),
  livekit_url: z.string().url().optional().nullable(),
  livekit_sip_trunk_url: z.string().optional().nullable(),
  livekit_api_key: z.string().optional().nullable(),
  livekit_api_secret: z.string().optional().nullable(),
  max_concurrent_calls: z.number().min(1).max(100).optional().nullable(),
});
```

---

## 🔄 Form Submission

```typescript
const onSubmit = async (data) => {
  setSubmitting(true);
  try {
    const response = await fetch('/api/v1/system/voice-ai/config', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Failed to update config');

    const result = await response.json();
    // Show success modal
  } catch (error) {
    // Show error modal
  } finally {
    setSubmitting(false);
  }
};
```

---

## 🔑 Regenerate Agent API Key Flow

1. User clicks "Regenerate Agent API Key" button
2. Warning modal opens:
   - "This will invalidate the current key. All agents using the old key will stop working."
   - "Are you sure?"
3. User confirms
4. POST /config/regenerate-key
5. Response: `{ plain_key: "xxx-xxx", preview: "...xxx", warning: "..." }`
6. Display plain key ONCE in modal with:
   - Large text display
   - Copy to clipboard button
   - "This key will not be shown again" warning
7. User must copy key before closing modal

---

## ⚠️ Error Handling

- 400: Validation errors (display field-specific)
- 401/403: Unauthorized
- All LiveKit URL validation errors

---

## ✅ Acceptance Criteria

- ✅ Endpoints verified before implementation
- ✅ All config fields editable
- ✅ Provider dropdowns populated from providers API
- ✅ JSON editors validate JSON syntax
- ✅ LiveKit keys shown as set/not set (never plain text)
- ✅ Regenerate key works with one-time display
- ✅ All fields save correctly
- ✅ RBAC protection works
- ✅ Mobile responsive
- ✅ Dark mode supported

---

**If backend issues found: STOP + ASK HUMAN. DO NOT edit backend.**

---

**End of Sprint 3**
