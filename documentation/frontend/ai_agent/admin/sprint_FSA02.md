YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FSA02 — Admin Credentials Page

**Module**: Voice AI - Frontend Admin  
**Sprint**: FSA02  
**Depends on**: FSA01, FSA06

---

## Objective

Build the admin page for securely managing API keys for each AI provider. API keys are never displayed in full — only masked. The page also has the "Regenerate Agent API Key" action.

---

## Mandatory Pre-Coding Steps

1. Read API docs: `GET /system/voice-ai/credentials` and `PUT /system/voice-ai/credentials/:providerId`
2. **HIT THE ENDPOINT**: verify what `masked_api_key` and `is_configured` look like in the real response
3. Read reference page: `/app/src/app/(dashboard)/admin/communications/email-config/page.tsx` or any page with sensitive credential management

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## Route

`/admin/voice-ai/credentials` → `/app/src/app/(dashboard)/admin/voice-ai/credentials/page.tsx`

---

## Page Structure

**Header**: "AI Provider Credentials" + description: "Manage encrypted API keys for AI providers. Keys are stored encrypted and are never displayed."

**Warning Banner**: If any active provider is missing credentials, show yellow warning: "⚠️ {N} active provider(s) missing credentials. The agent cannot function without credentials."

**Provider Cards** (one per provider from providers list):

Each card shows:
- Provider name + type badge
- Status indicator: "✓ Key configured (sk-...xxxx)" or "✗ No key set"
- "Set API Key" button (opens modal)
- If configured: "Remove Key" link (with confirm modal)

---

## Set API Key Modal

Uses shared `Modal` component:
- Title: "Set API Key — {provider_name}"
- Field: `<input type="password" name="api_key">` — NEVER type="text"
- Placeholder: "Paste your API key here"
- Helper text: "Your key will be encrypted before storage. You cannot retrieve it after saving."
- Buttons: Cancel, Save Key

---

## Regenerate Agent Key Section

Separate card at the bottom of the page:
- Title: "Voice Agent API Key"
- Description: "This key is used by the Python Voice AI agent to authenticate with Lead360's internal API."
- Current key preview: "Current key: ...{preview}" or "Not generated yet"
- Button: "Regenerate Key" — opens confirm modal

**Regenerate Confirm Modal**:
- Warning: "Regenerating the key will immediately invalidate the current key. The Python agent will stop working until it is updated with the new key."
- Confirm button: "Regenerate"

**After Regenerate — One-Time Display Modal**:
- Shows full plain key in a read-only textarea
- Warning: "⚠️ Copy this key now. It will NOT be shown again."
- "I have copied the key" button (closes modal)

---

## API Integration

- On mount: fetch `getVoiceAiProviders()` + `getVoiceAiCredentials()` in parallel
- Set key: `setVoiceAiCredential(providerId, api_key)` → refresh credentials
- Remove key: `deleteVoiceAiCredential(providerId)` → refresh
- Regenerate: `regenerateAgentKey()` → show one-time modal with returned `plain_key`

---

## Acceptance Criteria

- [ ] Provider cards show correct configured/not-configured status
- [ ] Warning banner shown when active providers lack credentials
- [ ] Set API Key uses password input type (key never visible)
- [ ] After setting key, status updates to "configured" with new masked preview
- [ ] Delete key has confirmation modal
- [ ] Regenerate key shows the one-time display modal with copy warning
- [ ] Agent key preview shown in "Current key: ...xxxx" format
- [ ] ErrorModal on all API failures
- [ ] `npm run build` passes
