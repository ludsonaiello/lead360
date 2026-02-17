YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FTA06 — Tenant IVR Integration UI

**Module**: Voice AI - Frontend Tenant
**Sprint**: FTA06
**Depends on**: FTA01, FTA05

---

## Objective

Build the tenant UI for connecting Voice AI to inbound phone calls via the IVR (Interactive Voice Response) system. Tenants configure which IVR menu option triggers the AI agent. This is the "last mile" connection: calls come in via Twilio → IVR routes to → Voice AI agent via SIP.

---

## Mandatory Pre-Coding Steps

1. Read API docs for IVR endpoints
2. **HIT ENDPOINTS** and verify shapes:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"contato@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

   # Get IVR configurations
   curl http://localhost:8000/api/v1/communications/ivr \
     -H "Authorization: Bearer $TOKEN" | jq .

   # Look for voice_ai action type in the IVR options
   # IVR menu items have: { dtmf_digit, action_type, action_value, description }
   # action_type 'voice_ai' means "route to Voice AI agent"
   ```
3. Read reference: `/app/src/app/(dashboard)/settings/communications/ivr/` — existing IVR management pages
4. Read FTA01 — voice AI must be enabled before IVR integration can be configured

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Tenant: `contato@honeydo4you.com` / `978@F32c`

---

## Route

`/settings/voice-ai/ivr-integration` → `/app/src/app/(dashboard)/settings/voice-ai/ivr-integration/page.tsx`

---

## Page Structure

### Plan Check (same as FTA01)

If plan doesn't include Voice AI: show upgrade CTA, no IVR config.

If Voice AI not enabled: show "Enable Voice AI first" prompt with link to `/settings/voice-ai`.

---

### When Voice AI Is Active

**Header**: "IVR Integration" with subtitle "Connect your phone menu to the Voice AI agent"

---

### Section 1: Current IVR Status

Show a read-only card summarizing IVR configurations that currently route to Voice AI:

```
Your IVR Menu Connections
┌─────────────────────────────────────────────────────┐
│  Press 1  →  [Voice AI Agent] "Book an appointment" │
│  Press 2  →  [Transfer] Main office                  │
│  Press 3  →  [Voicemail]                             │
└─────────────────────────────────────────────────────┘

[ Manage Full IVR Menu → ]
```

If no IVR configuration exists: "No phone menu configured. Set up your IVR to route calls to the Voice AI agent."

---

### Section 2: Quick Setup Wizard (if no voice_ai IVR entries exist)

A simple 3-step wizard to help tenants add a Voice AI option to their IVR:

**Step 1 — Choose a Key**
```
Which key should callers press to reach the AI agent?

  [1]  [2]  [3]  [4]  [5]  [6]  [7]  [8]  [9]

(Keys already in use are disabled)
```

**Step 2 — Greeting Message**
```
What should the AI agent say when a caller presses this key?

  [________________________________]
  Hint: e.g., "Connecting you to our AI assistant..."
```

**Step 3 — Confirm**
```
Summary:
  Press [1] → AI agent says "Connecting you to our AI assistant..."

[ Add to IVR ] button
```

Calls: `POST /api/v1/communications/ivr/menu-items` with:
```json
{
  "dtmf_digit": "1",
  "action_type": "voice_ai",
  "action_value": null,
  "description": "Connecting you to our AI assistant..."
}
```

---

### Section 3: IVR Connection Details (Read-only Info Panel)

For tenants who want to understand what's happening:

```
How Voice AI Calls Work

1. Customer calls your number
2. IVR menu plays → customer presses [key]
3. Call routes to Voice AI agent via SIP
4. AI agent answers: greets caller, understands intent
5. AI can: book appointments, create leads, transfer call

[ View call logs → ]   [ View AI settings → ]
```

---

### Section 4: Quota Warning (if near limit)

If `minutes_remaining < 60` or `quota_exceeded`:
Show the same `VoiceAiUsageMeter` component from FTA04 inline.

---

## Navigation Link

Add to Voice AI sidebar section:
- Label: "IVR Setup"
- Route: `/settings/voice-ai/ivr-integration`
- Icon: phone-arrow-up (or similar)
- Show badge "Setup needed" if Voice AI is enabled but no `voice_ai` IVR entries exist

---

## API Integration

- `getIvrConfigurations()` — fetch existing IVR menus (from communications module)
- `createIvrMenuItem(data)` — add Voice AI option to IVR menu
- `getVoiceAiSettings()` — check if enabled + quota (from FTA05 client)

---

## Acceptance Criteria

- [ ] Page shows upgrade CTA if plan doesn't include Voice AI
- [ ] Page shows "Enable Voice AI first" prompt if disabled
- [ ] Shows current IVR connections (entries with `action_type='voice_ai'`)
- [ ] "Manage Full IVR Menu" link goes to existing IVR management page
- [ ] 3-step wizard creates a `voice_ai` IVR menu item
- [ ] Keys already in use are disabled in wizard step 1
- [ ] Wizard validates: key required, description optional
- [ ] Success feedback after adding IVR entry
- [ ] Info panel shows how calls flow (static educational content)
- [ ] `VoiceAiUsageMeter` shown if near/at quota
- [ ] Sidebar badge "Setup needed" shown when applicable
- [ ] Mobile responsive
- [ ] `npm run build` passes
