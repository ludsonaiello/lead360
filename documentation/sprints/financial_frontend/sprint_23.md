# Sprint 23 — Crew Hours & Payments Management
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_23.md
**Type:** Frontend — CRUD Pages
**Depends On:** Sprint 1a, Sprint 1b, Sprint 1c, Sprint 2
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Build the Crew Hours logging and Crew Payments recording UI. Crew hours track time spent by crew members on projects/tasks. Crew payments record compensation paid to crew members. These are accessed from the Financial module and also integrated into project financial views.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Sections 17 (Crew Hour Logs) and 18 (Crew Payments).
- **Short/medium forms use modals.**
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

# List crew hours
curl -s "http://localhost:8000/api/v1/financial/crew-hours?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# List crew payments
curl -s "http://localhost:8000/api/v1/financial/crew-payments?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Get crew member payment history (use a real crew member ID)
curl -s "http://localhost:8000/api/v1/crew/CREW_MEMBER_ID/payment-history" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Crew Hours List Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/crew-hours/page.tsx`

Or integrate as a sub-section within an existing workforce/crew page if one exists. Check existing routes first.

**API Endpoint:** `GET /api/v1/financial/crew-hours`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| project_id | UUID | - | Filter by project |
| crew_member_id | UUID | - | Filter by crew member |
| date_from | string | - | Start date filter |
| date_to | string | - | End date filter |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Pagination:** Uses `pages` (NOT `total_pages` or `totalPages`) in meta.

**Response fields per hour log:**
- `id`, `tenant_id`
- `crew_member_id` + nested `crew_member: { id, first_name, last_name }`
- `project_id` + nested `project: { id, name, project_number }`
- `task_id` + nested `task: { id, title }` (nullable)
- `log_date` — ISO 8601 string
- `hours_regular` — **STRING** (decimal) — must `parseFloat()`
- `hours_overtime` — **STRING** (decimal) — must `parseFloat()`
- `source` — `"manual"` or `"clockin"`
- `clockin_event_id` — nullable (for time-clock entries)
- `notes` — nullable string
- `created_by_user_id`, `created_at`, `updated_at`

**Layout:**
```
+------------------------------------------------------+
|  Crew Hours                         [+ Log Hours]     |
|                                                        |
|  Filters: [Crew Member v] [Project v]                 |
|           [Date From] [Date To]                       |
|                                                        |
|  +--------------------------------------------------+ |
|  | Andre Porto | Teste (PRJ-2026-0004)               | |
|  | Mar 17, 2026 | Regular: 8.0h | OT: 1.5h          | |
|  | Task: Retirar Driveway | Source: Manual           | |
|  |                              [Edit] [View]        | |
|  +--------------------------------------------------+ |
|  | John Smith | Kitchen Remodel (PRJ-2026-0005)      | |
|  | Mar 18, 2026 | Regular: 6.5h | OT: 0h            | |
|  | Source: Manual                                     | |
|  |                              [Edit] [View]        | |
|  +--------------------------------------------------+ |
|                                                        |
|  [<- Previous]  Page 1 of 2  [Next ->]               |
+------------------------------------------------------+
```

**Features:**
1. Paginated card list with crew member, project, task, hours, date
2. Filter by crew member (select with search)
3. Filter by project (select with search)
4. Date range filter
5. Hours displayed as "Regular: Xh | OT: Yh" — parse from strings
6. Source badge: "Manual" (blue) or "Clock-In" (green)
7. Edit button (only for `source: "manual"` entries)
8. "+ Log Hours" button opens create modal

**RBAC:**
- Log hours (POST): Owner, Admin, Manager
- List hours (GET): Owner, Admin, Manager, Bookkeeper
- Update hours (PATCH): Owner, Admin, Manager

---

### Task 2 — Log Crew Hours Modal (Create)

**API Endpoint:** `POST /api/v1/financial/crew-hours`

**Modal size:** `lg`

**Form fields:**
| Field | Component | Required | Validation | API Field |
|-------|-----------|----------|------------|-----------|
| Crew Member | Select with search | Yes | Must exist | `crew_member_id` |
| Project | Select with search | Yes | Must exist | `project_id` |
| Task | Select with search | No | Must exist, conditional on project | `task_id` |
| Date | DatePicker | Yes | ISO 8601 | `log_date` |
| Regular Hours | Number input | Yes | Min 0.01, max 2 decimal places | `hours_regular` |
| Overtime Hours | Number input | No | Min 0, max 2 decimal places, default 0 | `hours_overtime` |
| Notes | Textarea | No | Free text | `notes` |

**Cascading select:** When project is selected, fetch its tasks and populate task dropdown. If no project selected, task is disabled.

**On submit:**
- Call `logCrewHours({ crew_member_id, project_id, task_id, log_date, hours_regular, hours_overtime, notes })`
- Toast: "Hours logged for {crew_member_name}"
- Refresh list
- Close modal

---

### Task 3 — Edit Crew Hours Modal

**API Endpoint:** `PATCH /api/v1/financial/crew-hours/:id`

Same modal as create, but pre-populated. Only modifiable fields:

| Field | API Field | Notes |
|-------|-----------|-------|
| Task | `task_id` | Can change task within same project |
| Date | `log_date` | ISO 8601 |
| Regular Hours | `hours_regular` | Min 0.01 |
| Overtime Hours | `hours_overtime` | Min 0 |
| Notes | `notes` | Free text |

**Note:** `crew_member_id` and `project_id` are NOT editable after creation. Show them as read-only labels.

**Only edit manual entries** — if `source` is `"clockin"`, show as read-only with message: "Clock-in entries cannot be edited from here."

---

### Task 4 — Crew Payments List Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/crew-payments/page.tsx`

Or integrate as a tab alongside crew hours.

**API Endpoint:** `GET /api/v1/financial/crew-payments`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| project_id | UUID | - | Filter by project |
| crew_member_id | UUID | - | Filter by crew member |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Pagination:** Uses `pages` in meta.

**Response fields per payment:**
- `id`, `tenant_id`
- `crew_member_id` + nested `crew_member: { id, first_name, last_name }`
- `project_id` + nested `project: { id, name, project_number }` (nullable)
- `amount` — **STRING** (decimal) — must `parseFloat()`
- `payment_date` — ISO 8601
- `payment_method` — one of 8 enum types
- `reference_number` — nullable
- `period_start_date`, `period_end_date` — nullable ISO 8601
- `hours_paid` — nullable number
- `notes` — nullable
- `created_by_user_id`, `created_at`

**Layout:**
```
+------------------------------------------------------+
|  Crew Payments                     [+ Record Payment] |
|                                                        |
|  Filters: [Crew Member v] [Project v]                 |
|                                                        |
|  +--------------------------------------------------+ |
|  | Andre Porto | $2,500.00 | Cash                    | |
|  | Mar 16, 2026 | Project: Teste                     | |
|  | Period: Mar 11 - Mar 15 | Hours: 40               | |
|  |                                         [View]    | |
|  +--------------------------------------------------+ |
|                                                        |
|  [<- Previous]  Page 1 of 1  [Next ->]               |
+------------------------------------------------------+
```

**Features:**
1. Paginated card list
2. Filter by crew member, project
3. Amount formatted as currency (parse from string)
4. Payment method badge
5. Period and hours display (if present)
6. View detail (read-only modal)

**RBAC:**
- Create payment (POST): Owner, Admin, Bookkeeper
- List payments (GET): Owner, Admin, Bookkeeper
- Payment history per member (GET): Owner, Admin, Manager, Bookkeeper

---

### Task 5 — Record Crew Payment Modal (Create)

**API Endpoint:** `POST /api/v1/financial/crew-payments`

**Modal size:** `lg`

**Form fields:**
| Field | Component | Required | Validation | API Field |
|-------|-----------|----------|------------|-----------|
| Crew Member | Select with search | Yes | Must exist | `crew_member_id` |
| Amount | MoneyInput | Yes | Min $0.01, max 2 decimal places | `amount` |
| Payment Date | DatePicker | Yes | ISO 8601, cannot be future | `payment_date` |
| Payment Method | Select | Yes | One of 8 types: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH | `payment_method` |
| Project | Select with search | No | Must exist | `project_id` |
| Reference Number | Input | No | Max 200 chars (check #, transaction ID) | `reference_number` |
| Period Start | DatePicker | No | ISO 8601 | `period_start_date` |
| Period End | DatePicker | No | ISO 8601, must be >= period_start | `period_end_date` |
| Hours Paid | Number input | No | Min 0, max 2 decimal places | `hours_paid` |
| Notes | Textarea | No | Free text | `notes` |

**Payment method options with icons:**
| Type | Icon (lucide) | Label |
|------|---------------|-------|
| cash | Banknote | Cash |
| check | FileCheck | Check |
| bank_transfer | Building2 | Bank Transfer |
| venmo | Smartphone | Venmo |
| zelle | Zap | Zelle |
| credit_card | CreditCard | Credit Card |
| debit_card | CreditCard | Debit Card |
| ACH | ArrowLeftRight | ACH |

**On submit:**
- Call `createCrewPayment(dto)`
- Toast: "Payment of $X,XXX recorded for {crew_member_name}"
- Refresh list
- Close modal

---

### Task 6 — Crew Member Payment History View

**API Endpoint:** `GET /api/v1/crew/:crewMemberId/payment-history`

This can be accessed from:
- A "View History" button on crew payment cards when filtered by crew member
- Or a dedicated route/modal showing all payments for a specific crew member

**Features:**
- Same card layout as payment list but scoped to one member
- Filter by project (optional)
- Pagination
- Show total paid across all visible payments

---

### Task 7 — Navigation Integration

Add links to the financial sidebar navigation (Sprint 2 enhancement):
- "Crew Hours" → `/financial/crew-hours`
- "Crew Payments" → `/financial/crew-payments`

Or combine as "Workforce" → `/financial/workforce` with tabs.

---

## Acceptance Criteria
- [ ] Crew hours list loads with pagination
- [ ] Crew hours filters (crew member, project, date range) work
- [ ] Log hours modal creates hour entry
- [ ] Edit hours modal (manual entries only)
- [ ] Hours displayed correctly (parsed from string)
- [ ] Source badge (manual/clockin)
- [ ] Crew payments list loads with pagination
- [ ] Record payment modal creates payment
- [ ] Payment date cannot be in the future
- [ ] Payment method select with all 8 types
- [ ] Crew member payment history view
- [ ] Amount formatted as currency
- [ ] RBAC enforced per endpoint
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- `hours_regular` and `hours_overtime` are returned as **strings** — always `parseFloat()`
- `amount` in crew payments is also a **string** — `parseFloat()`
- Pagination uses `pages` field (NOT `total_pages`)
- Payment date validation: API rejects future dates
- `source: "clockin"` entries should be read-only (edited through time clock module)
- Crew member and project selects need to fetch from existing APIs (`/crew` and `/projects`)
- Period dates (`period_start_date`, `period_end_date`) are optional pay period tracking
