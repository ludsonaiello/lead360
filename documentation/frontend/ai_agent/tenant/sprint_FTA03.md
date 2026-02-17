YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FTA03 — Tenant Call Logs Page

**Module**: Voice AI - Frontend Tenant  
**Sprint**: FTA03  
**Depends on**: FTA05

---

## Objective

Build the tenant call logs page showing the history of all AI-handled calls with filtering, outcome badges, and a detail view.

---

## Mandatory Pre-Coding Steps

1. Read API docs: `GET /voice-ai/call-logs` and `GET /voice-ai/call-logs/:id`
2. **HIT ENDPOINTS**: verify response shapes
3. Read reference: `/app/src/app/(dashboard)/communications/twilio/calls/page.tsx` — call list pattern

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Tenant: `contato@honeydo4you.com` / `978@F32c`

---

## Route

`/communications/voice-ai` → `/app/src/app/(dashboard)/communications/voice-ai/page.tsx`

---

## Page Structure

**Header**: "AI Call Logs"

**Filter bar**:
- Date range (`DateRangePicker`)
- Outcome filter (`<Select>`: All, Completed, Transferred, Voicemail, Abandoned, Error)
- Phone search (`<Input>` with debounce 300ms)

**Table**:

| Column | Notes |
|--------|-------|
| Date/Time | Formatted as "Feb 17, 2026 2:34 PM" |
| From | Phone number |
| Duration | `m:ss` format, or "—" if null |
| Outcome | Colored badge |
| Lead | Link icon if lead_id exists → navigates to `/leads/:id` |
| Overage | Small orange badge "Overage" if is_overage |
| Actions | View (eye icon) → opens detail modal |

**Outcome badge colors**: completed=green, transferred=blue, voicemail=yellow, abandoned=gray, error=red

**Empty state**: "No AI calls yet. Once you enable Voice AI and it handles calls, they'll appear here."

---

## Call Detail Modal

Opens on "View" click:
- Title: "Call Detail"
- Fields: Date/time, From, Duration, Outcome, Status
- Transcript Summary (if available) — in a `<pre>` or styled text block
- Lead Link: "View Lead" button if lead_id exists
- Overage indicator if is_overage

---

## Pagination

20 items per page, `PaginationControls` component.

---

## API Integration

- On mount + filter change: `getTenantCallLogs({ from, to, outcome, page: 1, limit: 20 })`
- On "View": `getTenantCallLog(id)` → populate modal
- Link to lead: navigate to `/leads/${log.lead_id}`

---

## Acceptance Criteria

- [ ] Call logs table loads from API
- [ ] Filters work: date range, outcome, phone search
- [ ] Duration shown as `m:ss` format
- [ ] Outcome badges colored correctly
- [ ] Lead link navigates to correct lead
- [ ] Detail modal shows transcript summary
- [ ] Pagination works
- [ ] Overage badge shown for overage calls
- [ ] Empty state shown when no calls
- [ ] `npm run build` passes
