# Sprint 13 — Recurring Expense Rules List & Create
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_13.md
**Type:** Frontend — CRUD Page
**Depends On:** Sprint 1, Sprint 2
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Build the Recurring Expense Rules management page at `/financial/recurring`. Users can view, create, and manage automated recurring expenses (rent, insurance, subscriptions, etc.). Rules automatically generate financial entries on a schedule.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 12 (Recurring Expense Rules).
- **Long forms must be single page. This form has many fields → use a large modal (xl).**
- **Always use icons, masked-inputs, select with search.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# List rules
curl -s "http://localhost:8000/api/v1/financial/recurring-rules" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Preview upcoming obligations
curl -s "http://localhost:8000/api/v1/financial/recurring-rules/preview?days=30" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Recurring Rules List Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/recurring/page.tsx`

**API Endpoints:**
- `GET /financial/recurring-rules` → Paginated with summary
- `GET /financial/recurring-rules/preview?days=30|60|90` → Upcoming preview

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Recurring Expenses               [+ Create Rule]    │
│                                                       │
│  ┌──────────┐ ┌───────────────┐ ┌──────────────────┐│
│  │ Active   │ │ Monthly       │ │ Next 30 Days     ││
│  │ Rules: 5 │ │ Obligation:   │ │ Total: $8,250    ││
│  │          │ │ $5,200/mo     │ │ 7 occurrences    ││
│  └──────────┘ └───────────────┘ └──────────────────┘│
│                                                       │
│  [Status: Active ▼] [Category ▼] [Frequency ▼]       │
│  Sort: [Next Due ▼] [Asc ▼]                          │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │ 🔄 Office Rent                   ● Active    │    │
│  │ $2,500/mo | Monthly on the 1st              │    │
│  │ Category: Office & Admin | Vendor: ABC Props │    │
│  │ Next due: Apr 1, 2026 | Generated: 3 so far │    │
│  │ Auto-confirm: ✅                              │    │
│  │                                                │    │
│  │  [⏸ Pause] [⏭ Skip] [✏️ Edit] [🗑️ Cancel]  │    │
│  ├──────────────────────────────────────────────┤    │
│  │ 🔄 Vehicle Insurance             ⏸ Paused    │    │
│  │ $2,750/qtr | Quarterly on the 15th          │    │
│  │ Category: Insurance | Supplier: State Farm    │    │
│  │ Next due: Apr 15, 2026 | Generated: 1       │    │
│  │                                                │    │
│  │  [▶️ Resume] [✏️ Edit] [🗑️ Cancel]           │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  [← Previous]  Page 1 of 1  [Next →]                │
│                                                       │
│  ── Upcoming Obligations Preview ──                   │
│  Period: [30 days ▼]  Total: $5,250                  │
│  ┌──────────────────────────────────────────────┐    │
│  │ Apr 1  | Office Rent     | $2,500 | Monthly  │    │
│  │ Apr 15 | Vehicle Ins     | $2,750 | Quarterly│    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Summary cards (TWO separate API calls needed):**
- Active Rules count → from list response `summary.total_active_rules`
- Monthly Obligation → from list response `summary.monthly_obligation`
- Next 30 Days preview total → from SEPARATE API call `getRecurringPreview(30)` → `total_obligations`

**IMPORTANT:** The preview data comes from `GET /financial/recurring-rules/preview?days=30` which is a SEPARATE endpoint from the list. Do NOT confuse the list's `summary` object with the preview response. Make two independent API calls on page mount.

**Filters:**
| Filter | Component | Options |
|--------|-----------|---------|
| Status | Select | Active, Paused, Completed, Cancelled |
| Category | Select with search | From categories API |
| Frequency | Select | Daily, Weekly, Monthly, Quarterly, Annual |

**Sort:** next_due_date, amount, name, created_at + asc/desc

**Status badges:**
- `active` → green
- `paused` → yellow
- `completed` → blue
- `cancelled` → gray

**Frequency display:** Format as human-readable: "Monthly on the 1st", "Weekly on Tuesdays", "Quarterly", "Annual", "Daily"

---

### Task 2 — Create/Edit Rule Modal (XL)

**Form fields:**

**Section 1 — Basic:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Rule Name | Input | Yes | Max 200 chars |
| Description | Textarea | No | Free text |
| Category | Select with search | Yes | Active categories |
| Amount | MoneyInput | Yes | Min $0.01 |
| Tax Amount | MoneyInput | No | Must be < amount |

**Section 2 — Schedule:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Frequency | Select | Yes | 5 options |
| Interval | Number input | No | 1-12, default: 1 |
| Day of Month | Number input | Conditional | 1-28, shown for monthly/quarterly/annual |
| Day of Week | Select | Conditional | Sun-Sat, shown for weekly |
| Start Date | DatePicker | Yes | Must be today or future |
| End Date | DatePicker | No | Must be after start date |
| Max Occurrences | Number input | No | Min 1 |

**Conditional schedule fields:**
- If frequency = `weekly`: show Day of Week select
- If frequency = `monthly` or `quarterly` or `annual`: show Day of Month input

**Auto-populate business rule:** If day_of_month or day_of_week is not specified by the user, the backend will auto-populate them from the start_date. Show a helper text under the field: "Leave empty to use the start date's day."
- If frequency = `daily`: hide both day fields

**Interval explanation:** "Every {interval} {frequency}" → "Every 2 months", "Every 1 week"

**Section 3 — Vendor/Payment:**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Supplier | Select with search | No | From suppliers API |
| Vendor Name | Input | No | Free text |
| Payment Account | Select with search | No | From payment methods API |

**Section 4 — Options:**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Auto-Confirm | Toggle | No | Default: on. When off, entries go to pending_review |
| Notes | Textarea | No | Free text |

**On submit:** `createRecurringRule(dto)` or `updateRecurringRule(id, dto)`

**Edit restrictions:** `start_date` cannot be changed after creation. Show it as read-only in edit mode.

---

### Task 3 — Upcoming Obligations Preview

Below the rules list, show the preview of upcoming obligations:

**API:** `getRecurringPreview(days)` with days selector (30, 60, 90)

Display as a simple table:
| Due Date | Rule Name | Amount | Category | Frequency |
|----------|-----------|--------|----------|-----------|

Show total at the top: "Total obligations in next {days} days: $X,XXX"

**Period selector:** 3 buttons or dropdown: 30 days / 60 days / 90 days

---

## Acceptance Criteria
- [ ] Rules list page with pagination
- [ ] Summary cards with real data
- [ ] Status filter, category filter, frequency filter
- [ ] Sorting by 4 fields
- [ ] Status badges color-coded
- [ ] Frequency displayed human-readable
- [ ] Create modal with all fields
- [ ] Conditional day-of-month/day-of-week
- [ ] Start date must be today or future
- [ ] Edit modal (start_date read-only)
- [ ] Preview section with 30/60/90 day toggle
- [ ] Preview shows total and list of obligations
- [ ] RBAC: Owner, Admin, Manager, Bookkeeper
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Summary object comes with the list response (same API call)
- Amount returned as string — parse to number
- `next_due_date` indicates when the next entry will be generated
- `occurrences_generated` shows how many entries were auto-created
- Rules run at 2:00 AM server time via BullMQ scheduler
- Max 100 active rules per tenant
