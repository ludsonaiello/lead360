YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FSA05 — Admin Call Logs + Usage Dashboard

**Module**: Voice AI - Frontend Admin  
**Sprint**: FSA05  
**Depends on**: FSA04, FSA06

---

## Objective

Build the admin call logs page (cross-tenant) and the aggregate usage dashboard.

---

## Mandatory Pre-Coding Steps

1. Read API docs: `GET /system/voice-ai/call-logs` and `GET /system/voice-ai/usage-report`
2. **HIT ENDPOINTS** to verify response shapes
3. Read reference: `/app/src/app/(dashboard)/admin/communications/twilio/monitoring/page.tsx`
4. Check `DateRangePicker` component: `/app/src/components/ui/DateRangePicker.tsx`

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## Routes

- `/admin/voice-ai/logs` → `/app/src/app/(dashboard)/admin/voice-ai/logs/page.tsx`
- `/admin/voice-ai/usage` → `/app/src/app/(dashboard)/admin/voice-ai/usage/page.tsx`

---

## Call Logs Page (`/admin/voice-ai/logs`)

**Filters bar**:
- Tenant selector (dropdown from tenants list)
- Date range picker (`DateRangePicker`)
- Outcome filter (`<Select>`: All, completed, transferred, voicemail, abandoned, error)
- Search by phone number

**Table**:

| Column |
|--------|
| Date/Time |
| Tenant |
| From Number |
| Duration (m:ss format) |
| Outcome badge (colored) |
| Overage badge (if is_overage=true, show "Overage" badge in orange) |
| Lead Linked (checkmark icon if lead_id exists) |
| Actions: View (opens detail modal) |

**Detail Modal**:
- All call log fields
- Transcript summary (if available)
- Link to lead if `lead_id` set

**Outcome badge colors**: completed=green, transferred=blue, voicemail=yellow, abandoned=gray, error=red

---

## Usage Dashboard Page (`/admin/voice-ai/usage`)

**Month selector**: Previous/next month navigation, defaults to current month

**Summary cards row**:
- Total Calls this month
- Total Minutes Used
- Overage Minutes
- Estimated Cost (formatted as $X.XX)

**Per-tenant breakdown table**:
| Column |
|--------|
| Tenant |
| Calls |
| Minutes Used |
| Overage Minutes |
| Estimated Cost |

---

## API Integration

Call logs:
- `getAdminCallLogs({ tenantId, from, to, outcome, page, limit })`
- Pagination with 20 items per page

Usage:
- `getAdminUsageReport(year, month)` on month change

---

## Acceptance Criteria

- [ ] Call logs filter by tenant, date range, outcome
- [ ] Duration shown as `m:ss` format (e.g. "2:34")
- [ ] Outcome badges colored correctly
- [ ] Overage calls marked with orange badge
- [ ] Detail modal shows transcript summary
- [ ] Usage dashboard month navigation works
- [ ] Summary cards show correct totals
- [ ] Per-tenant breakdown table renders
- [ ] `npm run build` passes
