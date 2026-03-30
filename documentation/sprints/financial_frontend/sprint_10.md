# Sprint 10 — Expense Approval Workflow
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_10.md
**Type:** Frontend — Workflow Page
**Depends On:** Sprint 1, Sprint 2, Sprint 8
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Build the Expense Approvals page at `/financial/approvals`. This page shows the pending approval queue where managers/admins can approve or reject submitted expenses. Also includes the resubmit flow for rejected entries.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Sections 6.7, 6.8, 6.9, 6.10.
- **Always use modal prompts, never system prompts.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# List pending entries
curl -s "http://localhost:8000/api/v1/financial/entries/pending" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test approve
curl -s -X POST "http://localhost:8000/api/v1/financial/entries/ENTRY_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Approved"}' | jq '.'
```

---

## Tasks

### Task 1 — Approvals Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/approvals/page.tsx`

**API Endpoints:**
- `GET /financial/entries/pending` → Pending entries (paginated with summary)
- `POST /financial/entries/:id/approve` → Approve
- `POST /financial/entries/:id/reject` → Reject
- `POST /financial/entries/:id/resubmit` → Resubmit

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Expense Approvals                               │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Pending  │ │ Total    │ │ Submitted│         │
│  │ 5        │ │ $2,450   │ │ By 3 users│         │
│  └──────────┘ └──────────┘ └──────────┘         │
│                                                   │
│  Filters: [Submitted By ▼] [Date From] [Date To] │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │ ⏳ Mar 22 | Materials - General | $350   │    │
│  │ Project: Kitchen Remodel                  │    │
│  │ Submitted by: John Smith                  │    │
│  │ Vendor: Home Depot                        │    │
│  │ ⚠️ REJECTED — reason shown below         │    │
│  │ "Receipt amount doesn't match entry"      │    │
│  │                                            │    │
│  │        [✅ Approve] [❌ Reject] [View]     │    │
│  ├──────────────────────────────────────────┤    │
│  │ ⏳ Mar 21 | Equipment Rental | $1,200    │    │
│  │ Project: Driveway Replacement             │    │
│  │ Submitted by: Jane Doe                    │    │
│  │                                            │    │
│  │        [✅ Approve] [❌ Reject] [View]     │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  [← Previous]  Page 1 of 2  [Next →]            │
└──────────────────────────────────────────────────┘
```

**Features:**
1. **Summary cards:** Pending count, total pending amount, unique submitters
2. **Filter by submitter:** Select with search populated from team members
3. **Date range filters**
4. **Entry cards** showing entry details + rejection info if previously rejected
5. **Visual indicator for rejected entries** — if `rejection_reason` is set, show a warning with the reason
6. **Approve button** → Approve confirmation modal
7. **Reject button** → Reject modal with required reason
8. **View button** → Full entry detail modal
9. **Pagination**
10. **Empty state:** "No pending entries for review" with checkmark icon

---

### Task 2 — Approve Modal

Simple confirmation modal:
- Title: "Approve Expense"
- Show entry summary (date, category, amount, submitter)
- Optional notes field (textarea, max 500 chars)
- Approve button (green/primary)
- Cancel button

**On confirm:**
- Call `approveEntry(id, { notes })` if notes provided, else `approveEntry(id)`
- Toast: "Expense approved successfully"
- Refresh list
- On error: toast.error

---

### Task 3 — Reject Modal

Modal with required reason:
- Title: "Reject Expense"
- Show entry summary
- **Rejection Reason** textarea (required, max 500 chars) — cannot be empty
- Reject button (red/danger)
- Cancel button

**Validation:** Rejection reason is required. Show error if empty.

**On confirm:**
- Call `rejectEntry(id, { rejection_reason })`
- Toast: "Expense rejected. The submitter will be notified."
- Refresh list
- On error: toast.error

---

### Task 4 — Rejection Display on Entry Cards

For entries that have been previously rejected (have `rejection_reason` set):
- Show a yellow/orange warning banner within the card
- Display the rejection reason text
- Show who rejected it (`rejected_by_name`) and when (`rejected_at`)
- These entries can be re-approved or re-rejected

---

### Task 5 — Resubmit Flow (for Employee/Submitter View)

On the main entries list page (Sprint 8), for entries that belong to the current user and have been rejected:
- Show a "Resubmit" button
- Clicking opens the EntryFormModal (Sprint 9) pre-populated with the entry data
- The form allows corrections
- On submit, call `resubmitEntry(id, dto)` instead of `updateFinancialEntry`
- Toast: "Expense resubmitted for review"

This is an enhancement to the Sprint 8 entries list — add the resubmit button for rejected entries owned by the current user.

---

## Acceptance Criteria
- [ ] Approvals page loads at `/financial/approvals`
- [ ] Pending entries listed with pagination
- [ ] Summary cards show correct counts
- [ ] Filter by submitter works
- [ ] Date range filter works
- [ ] Approve modal with optional notes
- [ ] Reject modal with required reason
- [ ] Previously rejected entries show rejection info
- [ ] Resubmit button on entries list for own rejected entries
- [ ] Resubmit opens edit form and calls resubmit API
- [ ] Toast notifications for all actions
- [ ] RBAC: Owner, Admin, Manager, Bookkeeper can access page
- [ ] Empty state when no pending entries
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Pending entries use same enriched format as regular entries
- `rejection_reason` being non-null indicates the entry was rejected
- `submission_status` stays `"pending_review"` even after rejection — the rejection fields indicate rejection state
- Resubmit clears rejection fields and keeps status as `pending_review`
- The summary in the response includes total_expenses, total_income, total_tax, entry_count for the pending queue
