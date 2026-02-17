YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FTA01 — Tenant Voice AI Settings Page

**Module**: Voice AI - Frontend Tenant  
**Sprint**: FTA01  
**Depends on**: FTA05 (API client must exist first)

---

## Objective

Build the tenant Voice AI settings page where business owners can enable/disable Voice AI, set their greeting message, configure supported languages, and add agent instructions.

---

## Mandatory Pre-Coding Steps

1. Read API docs: `GET /voice-ai/settings` and `PUT /voice-ai/settings`
2. **HIT ENDPOINT**: `curl http://localhost:8000/api/v1/voice-ai/settings -H "Authorization: Bearer TENANT_TOKEN" | jq .`
3. Read reference: `/app/src/app/(dashboard)/settings/business/page.tsx` — settings form pattern
4. Check `ToggleSwitch`, `MaskedInput`, `Modal` components

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Tenant: `contato@honeydo4you.com` / `978@F32c`

---

## Route

`/settings/voice-ai` → `/app/src/app/(dashboard)/settings/voice-ai/page.tsx`

---

## Page Logic (Plan Awareness)

```typescript
const settings = await getTenantVoiceSettings();

if (!settings?.voice_ai_included_in_plan) {
  // Show UPGRADE CTA — not the settings form
  return <VoiceAiUpgradeCTA />;
}

// Show settings form
return <VoiceAiSettingsForm settings={settings} />;
```

### Upgrade CTA Component

Show when plan does not include Voice AI:
- Icon: microphone SVG
- Title: "Voice AI is not available on your plan"
- Description: "Upgrade to Professional or Enterprise to get AI-powered phone answering."
- Button: "View Plans" (link to subscription page)

---

## Settings Form Structure

**At top of form**: `VoiceAiUsageMeter` component (from FTA04 — if not built yet, leave a placeholder div)

**Section 1: Enable**
- Enable Voice AI: `<ToggleSwitch>` labeled "Active" — if turning off, show confirm modal: "Disabling Voice AI will stop the agent from answering calls."

**Section 2: Language**
- Supported Languages: multi-select checkboxes for: English (en), Spanish (es), Portuguese (pt), French (fr)

**Section 3: Greeting**
- Custom Greeting: `<Textarea>` max 500 chars, character counter
- Placeholder: "Hello, thank you for calling {business_name}! How can I help you today?"
- Helper text: "Use {business_name} to insert your business name automatically"

**Section 4: Agent Instructions**
- Agent Instructions: `<Textarea>` max 2000 chars, character counter
- Placeholder: "e.g., Always ask if this is an emergency. We serve the Miami area."
- Helper text: "These instructions are added to the agent's system prompt."

**Section 5: Advanced**
- Max Call Duration: `<Select>` — 5 min, 10 min (default), 15 min, 30 min
- Fallback Phone Number: `<MaskedInput>` with +1 (000) 000-0000 mask (E.164)
- Helper text: "If Voice AI is unavailable, calls will be transferred here."

**Save button** — shows loading spinner during save.

---

## Form Validation (Zod)

```typescript
const schema = z.object({
  custom_greeting: z.string().max(500).optional().nullable(),
  custom_instructions: z.string().max(2000).optional().nullable(),
  enabled_languages: z.array(z.string()).min(1, 'Select at least one language'),
  max_call_duration_seconds: z.number().int().optional().nullable(),
  default_transfer_number: z.string().regex(/^\+[1-9]\d{1,14}$/).optional().nullable(),
});
```

---

## API Integration

- On mount: `getTenantVoiceSettings()`
- On save: `updateTenantVoiceSettings(formData)`
- Show success toast on save

---

## Acceptance Criteria

- [ ] Upgrade CTA shown when plan doesn't include Voice AI
- [ ] Settings form shown when plan includes Voice AI
- [ ] Enable/disable toggle works with confirm modal on disable
- [ ] Character counters on greeting and instructions textareas
- [ ] Fallback phone uses MaskedInput with E.164 format
- [ ] Form pre-filled with saved settings on load
- [ ] Save works and shows success feedback
- [ ] Mobile responsive (375px)
- [ ] `npm run build` passes
