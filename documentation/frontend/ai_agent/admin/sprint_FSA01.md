YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FSA01 — Admin Providers Page

**Module**: Voice AI - Frontend Admin  
**Sprint**: FSA01  
**Depends on**: FSA06 (API client must exist first)

---

## Objective

Build the admin page for managing the AI provider catalog (Deepgram, OpenAI, Cartesia). Admins can view, create, edit, and toggle providers.

---

## Mandatory Pre-Coding Steps

> **STOP — NUMBERING IS MISLEADING**: The admin frontend sprints are numbered by feature area (providers, credentials, config...), NOT execution order. **FSA06 must be done before FSA01–FSA05.** If you haven't completed FSA06 (API client + types at `/app/src/lib/types/voice-ai-admin.ts` and `/app/src/lib/api/voice-ai-admin.ts`), stop and do that sprint first. FSA06 is the foundation — nothing here compiles without it.

1. Read `/api/documentation/voice_ai_REST_API.md` (Admin Infrastructure section)
2. **HIT ENDPOINTS** first: `curl http://localhost:8000/api/v1/system/voice-ai/providers -H "Authorization: Bearer TOKEN" | jq .`
3. Read reference page: `/app/src/app/(dashboard)/admin/communications/providers/page.tsx` — replicate table + modal pattern
4. Check shared components: Modal, ToggleSwitch, Badge, ConfirmModal, ErrorModal, LoadingSpinner

**DO NOT USE PM2** — `npm run dev` on both frontend (port 7000) and backend (port 8000)

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## Route

`/admin/voice-ai/providers` → `/app/src/app/(dashboard)/admin/voice-ai/providers/page.tsx`

---

## Page Structure

**Header**: "AI Providers" title + "Add Provider" button (opens create modal)

**Table columns**:
- Name (display_name)
- Type badge (STT=blue, LLM=green, TTS=purple) using existing `Badge` component
- Provider Key (monospace text, e.g. `deepgram`)
- Status toggle (ToggleSwitch, calls PATCH on change)
- Actions: Edit (pencil icon), Delete (trash icon)

**Empty state**: "No providers configured. Add your first provider."

---

## Modals

### Create/Edit Provider Modal

Uses shared `Modal` component. Fields:
- Provider Key: `<Input>` — text, required, disabled on edit
- Provider Type: `<Select>` — options: STT, LLM, TTS — required
- Display Name: `<Input>` — text, required
- Description: `<Textarea>` — optional
- Active: `<ToggleSwitch>` — default true

Validation (Zod):
- provider_key: string, min 2, max 50, lowercase alphanumeric + hyphens
- provider_type: one of STT, LLM, TTS
- display_name: string, min 2, max 100

### Delete Confirmation

Use `ConfirmModal` — "Are you sure you want to delete {provider_name}? This cannot be undone."

---

## State Management

```typescript
const [providers, setProviders] = useState<VoiceAiProvider[]>([]);
const [loading, setLoading] = useState(true);
const [showCreateModal, setShowCreateModal] = useState(false);
const [editingProvider, setEditingProvider] = useState<VoiceAiProvider | null>(null);
const [deletingProvider, setDeletingProvider] = useState<VoiceAiProvider | null>(null);
const [error, setError] = useState<string | null>(null);
```

---

## API Integration

- On mount: `getVoiceAiProviders()` → populate table
- Status toggle: `updateVoiceAiProvider(id, { is_active: newValue })`
- Create/Edit save: `createVoiceAiProvider(data)` or `updateVoiceAiProvider(id, data)`
- Delete: `deleteVoiceAiProvider(id)` then refetch

---

## Error Handling

- API errors: show `ErrorModal` with message
- 409 Conflict (duplicate provider_key): show specific "Provider key already exists" message

---

## Acceptance Criteria

- [ ] Table renders all providers from API
- [ ] Type badges colored correctly (STT=blue, LLM=green, TTS=purple)
- [ ] ToggleSwitch updates provider status inline
- [ ] Create modal creates provider and refreshes table
- [ ] Edit modal pre-fills with current data
- [ ] Delete modal confirms before deleting
- [ ] Loading spinner shown during fetch
- [ ] ErrorModal shown on API errors
- [ ] Mobile responsive (cards at 375px)
- [ ] `npm run build` passes
