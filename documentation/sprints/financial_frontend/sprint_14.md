# Sprint 14 — Recurring Rules Actions & History
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_14.md
**Type:** Frontend — Feature Enhancement
**Depends On:** Sprint 1, Sprint 13
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Add all action buttons and history view for recurring expense rules: pause, resume, trigger, skip, cancel, and view generated entry history. Also build the rule detail view.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Sections 12.3-12.10.
- **Always use modal prompts for all confirmations.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Get single rule with preview
curl -s "http://localhost:8000/api/v1/financial/recurring-rules/RULE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Rule history
curl -s "http://localhost:8000/api/v1/financial/recurring-rules/RULE_ID/history" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Pause/Resume Actions

On the recurring rules list (Sprint 13), wire the action buttons:

**Pause (for active rules):**
- **RBAC:** Owner, Admin, Manager, Bookkeeper
- ConfirmModal: "Pause '{rule_name}'? No entries will be generated while paused."
- Call `pauseRecurringRule(id)` → `POST /financial/recurring-rules/:id/pause`
- Toast: "Rule paused"
- Refresh list
- Only show for `active` status

**Resume (for paused rules):**
- **RBAC:** Owner, Admin, Manager, Bookkeeper
- ConfirmModal: "Resume '{rule_name}'? Entry generation will restart."
- Call `resumeRecurringRule(id)` → `POST /financial/recurring-rules/:id/resume`
- Toast: "Rule resumed"
- Refresh list
- Only show for `paused` status

---

### Task 2 — Trigger Now Action

**RBAC:** Owner, Admin only

Button on rule card: "Trigger Now" (with `Zap` icon)

**Confirmation modal:**
- Title: "Generate Entry Now"
- Message: "This will immediately generate the next entry for '{rule_name}' ($X,XXX). Continue?"
- Show what entry will be created (amount, category, vendor)
- Confirm button

**On confirm:**
- Call `triggerRecurringRule(id)` → returns 202 Accepted
- Toast: "Entry generation queued. It will appear shortly."
- Refresh list after 3 seconds (to allow background processing)

---

### Task 3 — Skip Next Occurrence

**RBAC:** Owner, Admin, Manager, Bookkeeper

Button on rule card: "Skip Next" (with `SkipForward` icon)

**Modal:**
- Title: "Skip Next Occurrence"
- Message: "Skip the next occurrence of '{rule_name}' scheduled for {next_due_date}?"
- Optional reason textarea (max 500 chars)
- Skip button (secondary variant)

**On confirm:**
- Call `skipRecurringRule(id, { reason })`
- Toast: "Next occurrence skipped. New next due: {new_date}"
- Refresh list

---

### Task 4 — Cancel Rule

**RBAC:** Owner, Admin only

Button on rule card: "Cancel" (with `X` icon, danger variant)

**ConfirmModal:**
- Title: "Cancel Recurring Rule"
- Message: "Are you sure you want to cancel '{rule_name}'? No more entries will be generated. Previously generated entries will NOT be deleted."
- Variant: danger

**On confirm:**
- Call `cancelRecurringRule(id)` (DELETE endpoint)
- Toast: "Rule cancelled"
- Refresh list

---

### Task 5 — Rule Detail View

When clicking on a rule name (make it a link), navigate to a detail page or open a detail modal.

**Path option:** `/financial/recurring/[id]` or modal on the list page.

**API:** `getRecurringRule(id)` → Returns `RecurringRuleDetail` with:
- All rule fields
- `last_generated_entry` object
- `next_occurrence_preview` array (next 3 dates)

**Detail layout:**
```
┌──────────────────────────────────────────────┐
│  Office Rent                    ● Active     │
│                                               │
│  Amount: $2,500.00/month                     │
│  Category: Office & Admin                     │
│  Vendor: ABC Properties                       │
│  Payment: Chase Business Checking             │
│                                               │
│  Schedule:                                    │
│  Every 1 month on the 1st                    │
│  Started: Apr 1, 2026                        │
│  No end date                                 │
│  Auto-confirm: ✅ Yes                         │
│                                               │
│  Progress:                                    │
│  Generated: 3 entries                         │
│  Next due: Jul 1, 2026                       │
│                                               │
│  Upcoming:                                    │
│  • Jul 1, 2026                               │
│  • Aug 1, 2026                               │
│  • Sep 1, 2026                               │
│                                               │
│  Last Generated Entry:                        │
│  Jun 1, 2026 — $2,500 — Confirmed            │
│                                               │
│  [⏸ Pause] [⏭ Skip] [⚡ Trigger] [✏️ Edit]  │
│                                               │
│  ── Entry History ──                          │
│  (See Task 6)                                 │
└──────────────────────────────────────────────┘
```

---

### Task 6 — Rule Entry History

Show all entries generated by this rule.

**API:** `getRecurringRuleHistory(id, { page, limit, date_from, date_to })`

Display as a paginated table/card list:
| Date | Amount | Status | Category |
|------|--------|--------|----------|

With optional date range filter.

---

## Acceptance Criteria
- [ ] Pause action works for active rules
- [ ] Resume action works for paused rules
- [ ] Trigger Now queues entry generation (Owner/Admin only)
- [ ] Skip Next with optional reason works
- [ ] Cancel with danger confirmation works
- [ ] Rule detail view shows all info
- [ ] Next occurrence preview displayed
- [ ] Last generated entry shown
- [ ] Entry history with pagination
- [ ] All actions use modal confirmations
- [ ] Action buttons show/hide based on rule status and RBAC
- [ ] Toast notifications for all actions
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Trigger returns 202 Accepted — entry appears after background processing
- Skip advances `next_due_date` — show the new date in the toast
- Cancel is a soft operation — no entries are deleted
- Status transitions: active ↔ paused, active → completed (auto), active/paused → cancelled
- `next_occurrence_preview` is an array of 3 future date strings
