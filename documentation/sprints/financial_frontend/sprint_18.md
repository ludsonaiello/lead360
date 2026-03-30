# Sprint 18 — Project Financial Intelligence (F-07)
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_18.md
**Type:** Frontend — Project Sub-Tab Enhancement
**Depends On:** Sprint 1
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Enhance the project financial Overview tab with comprehensive financial intelligence: full summary with margin analysis, task-level cost breakdown, monthly timeline, and workforce costs. This replaces any basic summary that exists.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 15 (Project Financial Summary), Section 16 (Task-Level).
- **Use cardview, proper data visualization.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Full financial summary
curl -s "http://localhost:8000/api/v1/projects/PROJECT_ID/financial/summary" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Task breakdown
curl -s "http://localhost:8000/api/v1/projects/PROJECT_ID/financial/tasks" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Timeline
curl -s "http://localhost:8000/api/v1/projects/PROJECT_ID/financial/timeline" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Workforce
curl -s "http://localhost:8000/api/v1/projects/PROJECT_ID/financial/workforce" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Enhanced Financial Overview Sub-Tab

Replace/enhance the existing Overview sub-tab in the project financial section.

**API Endpoints:**
- `GET /projects/:projectId/financial/summary`
- `GET /projects/:projectId/financial/tasks`
- `GET /projects/:projectId/financial/timeline`
- `GET /projects/:projectId/financial/workforce`

Load all 4 endpoints in parallel on tab mount.

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Financial Overview           [Date From] [Date To]   │
│                                                       │
│  ── Budget & Margin ──                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │Contract  │ │Estimated │ │ Actual   │ │ Budget   ││
│  │Value     │ │Cost      │ │ Cost     │ │ Remaining││
│  │$55,000   │ │$45,000   │ │$12,450   │ │$32,550   ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│                                                       │
│  Budget Usage: ████████░░░░░░░░░  27.7%              │
│  Gross Margin: $42,550 (77.4%)                       │
│                                                       │
│  ── Cost Breakdown by Category ──                     │
│  ┌─────────────────────────────────────────────┐     │
│  │ Labor - General        ████████  $8,200 (66%)│     │
│  │ Materials - General    ████      $2,500 (20%)│     │
│  │ Equipment              ██        $1,200 (10%)│     │
│  │ Miscellaneous          █          $550  (4%) │     │
│  └─────────────────────────────────────────────┘     │
│                                                       │
│  ── Cost Breakdown by Classification ──               │
│  COGS: $10,450 | Operating Expense: $2,000           │
│                                                       │
│  ── Revenue Summary ──                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │Invoiced  │ │Collected │ │Outstand- │             │
│  │$27,500   │ │$15,000   │ │$12,500   │             │
│  └──────────┘ └──────────┘ └──────────┘             │
│                                                       │
│  ── Subcontractor Summary ──                          │
│  Invoiced: $5,000 | Paid: $15,000 | Outstanding: -$10K│
│                                                       │
│  ── Crew Summary ──                                   │
│  Hours: 48.5 (regular) + 4.5 (OT) = 53 total        │
│  Payments: $8,500 | Members: 3                       │
│                                                       │
│  ── Receipts ──                                       │
│  Total: 12 | Categorized: 8 | Uncategorized: 4      │
└──────────────────────────────────────────────────────┘
```

**Summary source:** All data from `ProjectFinancialSummary` response.

---

### Task 2 — Task Cost Breakdown Section

Below the overview, show per-task cost breakdown.

**API:** `getTaskBreakdown(projectId)`

**Layout:**
```
── Per-Task Cost Breakdown ──          Sort: [Cost ▼]

┌──────────────────────────────────────────────┐
│ 📋 Retirar Driveway (done)         $8,042   │
│   Labor: $5,500 | Material: $2,000 | Other: $542│
│   Sub Invoices: $2,500 | Crew Hours: 24h    │
├──────────────────────────────────────────────┤
│ 📋 Install New Surface (in progress) $4,408  │
│   Labor: $2,700 | Equipment: $1,200 | Mat: $508│
│   Sub Invoices: $0 | Crew Hours: 16h        │
└──────────────────────────────────────────────┘

Total across all tasks: $12,450
```

Each task card shows:
- Task title + status badge
- Expense total with category breakdown
- Subcontractor invoice total
- Crew hours total
- Expandable for detailed by_category breakdown

Sort options: total_cost (desc/asc), task_title

---

### Task 3 — Monthly Timeline Section

**API:** `getFinancialTimeline(projectId)`

**Layout:**
```
── Monthly Cost Timeline ──

┌─────────┬──────────┬────────────────────────────┐
│ Month   │ Total    │ Breakdown                  │
├─────────┼──────────┼────────────────────────────┤
│ Jan 2026│ $2,500   │ Labor: $1,500, Mat: $1,000 │
│ Feb 2026│ $5,200   │ Labor: $3,200, Equip: $2K  │
│ Mar 2026│ $4,750   │ Labor: $3,500, Other: $1.2K│
└─────────┴──────────┴────────────────────────────┘

Cumulative Total: $12,450
```

Show a simple horizontal bar chart per month, with category colors.
Table fallback for mobile.

---

### Task 4 — Workforce Section Enhancement

**API:** `getWorkforceSummary(projectId)`

**Layout:**
```
── Workforce ──

Crew Hours:
┌─────────────────┬────────┬──────┬───────┐
│ Crew Member     │ Regular│ OT   │ Total │
├─────────────────┼────────┼──────┼───────┤
│ Andre Porto     │ 32.0   │ 4.5  │ 36.5  │
│ John Smith      │ 16.0   │ 0.0  │ 16.0  │
└─────────────────┴────────┴──────┴───────┘
Total: 48.0 regular + 4.5 OT = 52.5 hours

Crew Payments:
┌─────────────────┬─────────┬─────────┬───────────┐
│ Crew Member     │ Total   │ Payments│ Last Paid │
├─────────────────┼─────────┼─────────┼───────────┤
│ Andre Porto     │ $5,000  │ 2       │ Mar 16    │
│ John Smith      │ $3,500  │ 1       │ Mar 20    │
└─────────────────┴─────────┴─────────┴───────────┘

Subcontractors:
┌────────────────┬──────────┬──────┬───────────┐
│ Subcontractor  │ Invoiced │ Paid │Outstanding│
├────────────────┼──────────┼──────┼───────────┤
│ ABC Roofing    │ $5,000   │ $5K  │ $0        │
│ DEF Plumbing   │ $2,500   │ $0   │ $2,500    │
└────────────────┴──────────┴──────┴───────────┘
```

---

### Task 5 — Date Range Filter

Add optional date_from/date_to filters at the top of the overview. When changed, re-fetch all 4 endpoints with the date params.

---

## Acceptance Criteria
- [ ] Full financial summary loads from API
- [ ] Budget/margin analysis displayed with progress bar
- [ ] Cost breakdown by category with horizontal bars
- [ ] Cost breakdown by classification
- [ ] Revenue summary cards
- [ ] Subcontractor and crew summaries
- [ ] Receipt summary
- [ ] Task cost breakdown with sortable list
- [ ] Monthly timeline with cumulative total
- [ ] Workforce section (crew hours, payments, subcontractors)
- [ ] Date range filter works across all sections
- [ ] All amounts formatted as currency
- [ ] Loading states for each section
- [ ] RBAC: Owner, Admin, Manager, Bookkeeper
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- All 4 API calls should load in parallel
- `contract_value` and `estimated_cost` can be null — handle gracefully
- `budget_used_percent` and `gross_margin_percent` can be null if no contract_value
- Task breakdown tasks are ordered by task_order_index
- Hours are decimal strings — parse to numbers
