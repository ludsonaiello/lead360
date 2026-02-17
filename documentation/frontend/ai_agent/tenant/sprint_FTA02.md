YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FTA02 — Tenant Transfer Numbers Page

**Module**: Voice AI - Frontend Tenant
**Sprint**: FTA02
**Depends on**: FTA01, FTA05

---

## Objective

Build the tenant page for managing call transfer numbers. Supports multiple transfer types (primary, overflow, after-hours, emergency) with optional availability hours scheduling.

---

## Mandatory Pre-Coding Steps

1. Read the backend API docs for transfer numbers endpoints
2. **HIT ENDPOINTS** and verify shapes:
   ```bash
   # Get all transfer numbers
   curl http://localhost:8000/api/v1/voice-ai/transfer-numbers \
     -H "Authorization: Bearer TOKEN" | jq .

   # Check schema: id, label, phone_number, transfer_type, description, is_default, display_order, available_hours
   ```
3. Read reference CRUD page: any simple list+CRUD page in settings (e.g., webhook management)

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Tenant: `contato@honeydo4you.com` / `978@F32c`

---

## Route

`/settings/voice-ai/transfer-numbers` → `/app/src/app/(dashboard)/settings/voice-ai/transfer-numbers/page.tsx`

---

## Page Structure

**Header**: "Transfer Numbers" + "Add Number" button

**Limit notice** (show when count >= 8): "You can add up to 10 transfer numbers."

**Table/List**:

| Column | Notes |
|--------|-------|
| Label + Type badge | Label text + colored badge: primary/overflow/after_hours/emergency |
| Phone Number | Formatted display |
| Availability | "Always available" OR "Scheduled hours" with clock icon |
| Default badge | Star icon + "Default" chip if `is_default=true` |
| Actions | Drag handle (reorder), Edit (pencil), Delete (trash) |

**Drag-to-reorder**: Numbers can be reordered via drag handle. On drop, call `reorderTransferNumbers([{id, display_order}])`.

**Empty state**: "No transfer numbers yet. Add a number so the agent knows where to transfer calls."

---

## Add/Edit Modal

### Tab 1: Basic Info

Fields:
- Label: `<Input>` — e.g., "Sales", "Emergency Dispatch", "Main Office"
- Transfer Type: `<Select>` — options:
  - `primary` — Main transfer destination
  - `overflow` — When primary is busy
  - `after_hours` — Outside business hours
  - `emergency` — Emergency escalation
- Phone Number: `<MaskedInput>` — international phone format (E.164)
- Description: `<Input>` optional — e.g., "Sales team, weekdays 9–5"
- Set as Default: `<ToggleSwitch>` — if true, previous default is automatically unset by API

### Tab 2: Availability Hours (Optional)

Toggle: "Restrict to scheduled hours" (default OFF = always available)

When ON, show a weekly schedule grid:

```
Mon  [✓] 09:00 → 17:00  [+ Add slot]
Tue  [✓] 09:00 → 17:00
Wed  [✓] 09:00 → 17:00
Thu  [✓] 09:00 → 17:00
Fri  [✓] 09:00 → 17:00
Sat  [ ] (no hours — day off)
Sun  [ ] (no hours — day off)
```

- Each day can have a checkbox (enabled/disabled) + time range `<Input type="time">` pairs
- "Add slot" adds a second time range per day (e.g., split shift: 9–12, 14–17)
- `available_hours` JSON format: `{"mon":[["09:00","17:00"]],"tue":[["09:00","17:00"]],...}`
- Days with no hours set (or unchecked) are omitted from JSON
- If `available_hours` is null: "Always available"

**Hint text**: "The AI agent will only transfer to this number during these hours. If unavailable, the agent uses the default fallback behavior."

---

## Validation

- label: required, max 100 chars
- phone_number: valid E.164 regex `^\+[1-9]\d{1,14}$`
- transfer_type: one of primary | overflow | after_hours | emergency
- available_hours time slots: start must be before end, no overlapping slots per day

---

## Delete Modal

Use `ConfirmModal`:
- "Are you sure you want to delete the '{label}' transfer number?"
- If deleting default: warn "This is your default transfer number. Deleting it may affect call handling."
- If only number remaining: warn "This is your only transfer number. The agent will use fallback behavior after deletion."

---

## API Integration

On mount: `getTransferNumbers()` — sort by `display_order ASC`

Create: `createTransferNumber(data)` → refresh
Edit: `updateTransferNumber(id, data)` → refresh
Delete: `deleteTransferNumber(id)` → refresh
Reorder: `reorderTransferNumbers([{id, display_order}])` → optimistic UI update

---

## Type Badges

```tsx
const TRANSFER_TYPE_BADGES = {
  primary:     { label: 'Primary',     color: 'blue'   },
  overflow:    { label: 'Overflow',    color: 'yellow' },
  after_hours: { label: 'After Hours', color: 'purple' },
  emergency:   { label: 'Emergency',  color: 'red'    },
};
```

---

## Acceptance Criteria

- [ ] Table shows all transfer numbers sorted by `display_order`
- [ ] Type badges displayed with correct colors
- [ ] Default number has star badge
- [ ] Drag-to-reorder works and calls reorder API
- [ ] Add/Edit modal has 2 tabs: Basic Info + Availability Hours
- [ ] Transfer type dropdown with 4 options
- [ ] MaskedInput used for phone number field
- [ ] Availability hours toggle — when OFF shows "Always available"
- [ ] Weekly schedule grid shows when availability toggle is ON
- [ ] `available_hours` correctly serialized as JSON on save
- [ ] `is_default` toggle: setting new default removes old default (backend handles, UI refreshes)
- [ ] Delete confirmation modal with extra warning for default/last number
- [ ] Limit notice shown at 8+ numbers
- [ ] `ErrorModal` on API errors (e.g., 400 max limit reached)
- [ ] Mobile responsive — tabs collapse nicely on mobile
- [ ] `npm run build` passes
