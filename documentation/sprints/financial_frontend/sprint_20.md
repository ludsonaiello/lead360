# Sprint 20 — Dashboard — AR, AP, Forecast & Alerts
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_20.md
**Type:** Frontend — Dashboard Tabs
**Depends On:** Sprint 1, Sprint 19
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Complete the Financial Dashboard with Accounts Receivable, Accounts Payable, Cash Flow Forecast, and Alerts tabs.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Sections 21.4-21.7.
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

curl -s "http://localhost:8000/api/v1/financial/dashboard/ar" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

curl -s "http://localhost:8000/api/v1/financial/dashboard/ap" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

curl -s "http://localhost:8000/api/v1/financial/dashboard/forecast?days=30" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

curl -s "http://localhost:8000/api/v1/financial/dashboard/alerts" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Accounts Receivable Tab

**API:** `getDashboardAR({ status?, overdue_only? })`

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Accounts Receivable                              │
│                                                    │
│  Filters: [Status ▼] [☐ Overdue Only]             │
│                                                    │
│  ── Summary ──                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐│
│  │ Invoiced │ │ Collected│ │ Outstand-│ │Overdue││
│  │ $55,000  │ │ $27,500  │ │ $27,500  │ │$12,500││
│  │          │ │          │ │ ing      │ │ 2 inv ││
│  └──────────┘ └──────────┘ └──────────┘ └───────┘│
│  Avg Days Outstanding: 15                         │
│                                                    │
│  ── Aging Buckets ──                               │
│  ┌──────────────────────────────────────────────┐ │
│  │ Current     ████████████  $15,000            │ │
│  │ 1-30 days   ████████      $10,000            │ │
│  │ 31-60 days  ███            $2,500            │ │
│  │ 61-90 days                  $0               │ │
│  │ 90+ days                    $0               │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ── Outstanding Invoices ──                        │
│  ┌──────────────────────────────────────────────┐ │
│  │ 📄 INV-0001 | Teste | $27,500               │ │
│  │ Sent Mar 20 | Due Apr 15 | 5 days outstanding│ │
│  │ Paid: $15,000 | Due: $12,500                 │ │
│  │ ⚠️ 0 days to due date         [View Project] │ │
│  ├──────────────────────────────────────────────┤ │
│  │ 📄 INV-0002 | Kitchen | $15,000  🔴 Overdue │ │
│  │ Sent Feb 10 | Due Mar 10 | 15 days OVERDUE  │ │
│  │ Paid: $0 | Due: $15,000                      │ │
│  │                                [View Project] │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Features:**
- Summary cards
- Aging buckets with horizontal bars
- Invoice list with overdue highlighting (red for overdue)
- Status filter, overdue-only toggle
- Link to project page for each invoice
- Days outstanding / days overdue display

---

### Task 2 — Accounts Payable Tab

**API:** `getDashboardAP({ days_ahead? })`

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Accounts Payable          Look-ahead: [30 ▼] days│
│                                                    │
│  ── Summary ──                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐│
│  │ Sub      │ │ Crew     │ │ Recurring│ │ Total ││
│  │ Outstand.│ │ Unpaid   │ │ Upcoming │ │ AP Est││
│  │ $5,000   │ │ $3,200   │ │ $7,500   │ │$15,700││
│  └──────────┘ └──────────┘ └──────────┘ └───────┘│
│                                                    │
│  ── Subcontractor Outstanding ──                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ ABC Roofing | Pending: $2,000 | Approved: $3K│ │
│  │ DEF Electric | Pending: $0 | Approved: $0    │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ── Upcoming Recurring Expenses ──                 │
│  ┌──────────────────────────────────────────────┐ │
│  │ Apr 1  | Office Rent    | $2,500 | Monthly   │ │
│  │ Apr 15 | Vehicle Ins.   | $2,750 | Quarterly │ │
│  │ Apr 20 | Internet       | $200   | Monthly   │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ── Crew Hours This Month ──                       │
│  Regular: 48h | Overtime: 4.5h | Members: 3      │
│  Note: Configure hourly rates for cost estimates  │
└──────────────────────────────────────────────────┘
```

**Features:**
- Days-ahead selector (30, 60, 90)
- Summary cards
- Subcontractor outstanding list
- Upcoming recurring expenses
- Crew hours summary with note about hourly rates

---

### Task 3 — Cash Flow Forecast Tab

**API:** `getDashboardForecast({ days: 30 | 60 | 90 })`

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Cash Flow Forecast         Period: [30 ▼] days   │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │               NET FORECAST                    │ │
│  │                                                │ │
│  │     +$25,000                                  │ │
│  │     ● Positive                                │ │
│  │                                                │ │
│  │  Inflows: $27,500   |   Outflows: $2,500     │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ── Expected Inflows ($27,500) ──                  │
│  ┌──────────────────────────────────────────────┐ │
│  │ 📄 Invoice INV-0001 | Teste | $27,500        │ │
│  │ Due: Apr 15, 2026                             │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ── Expected Outflows ($2,500) ──                  │
│  ┌──────────────────────────────────────────────┐ │
│  │ 🔄 Office Rent | $2,500 | Due: Apr 1         │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Features:**
- Period selector (30/60/90 days)
- Large net forecast display with color (green positive, red negative, gray breakeven)
- Inflows list (invoices due)
- Outflows list (recurring rules due)
- Net forecast label (Positive/Negative/Breakeven)

---

### Task 4 — Alerts Section (Standalone)

The alerts are shown on the Overview tab (Sprint 19) and also accessible as a dedicated view.

**API:** `getDashboardAlerts()`

**Alert card design:**
```
┌──────────────────────────────────────────────┐
│ ⚠️ WARNING                                   │
│ Project 'Teste' has exceeded 90% of budget   │
│ Estimated: $55,000 | Actual: $52,000 (94.5%) │
│ Project: Teste                     [View →]  │
├──────────────────────────────────────────────┤
│ 🔴 ERROR                                     │
│ Invoice INV-0001 is 15 days overdue          │
│ Amount Due: $27,500                          │
│                                    [View →]  │
└──────────────────────────────────────────────┘
```

**Alert severity colors:**
- `error` → red border + red icon
- `warning` → yellow/orange border + yellow icon
- `info` → blue border + blue icon

**Alert types and actions:**
- `cost_overrun` → Link to project financial tab
- `overdue_invoice` → Link to project invoice
- `upcoming_obligation` → Link to recurring rules
- `budget_warning` → Link to project

---

## Acceptance Criteria
- [ ] AR tab shows summary, aging buckets, invoice list
- [ ] AR filters (status, overdue only) work
- [ ] Overdue invoices highlighted in red
- [ ] AP tab shows summary with 4 sections
- [ ] AP days-ahead selector (30/60/90) works
- [ ] Forecast tab shows net forecast with color
- [ ] Forecast inflows and outflows listed
- [ ] Period selector changes forecast
- [ ] Alerts shown with severity styling
- [ ] Alert action links navigate to relevant pages
- [ ] All tabs load data from respective endpoints
- [ ] RBAC enforced per tab
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- AR aging_buckets use fixed keys: current, days_1_30, days_31_60, days_61_90, days_over_90
- AP `crew_unpaid_estimate` may be 0 if hourly rates aren't configured
- Forecast `net_forecast_label` is one of: "Positive", "Negative", "Breakeven"
- Alerts `details` is a generic object — use the `type` to determine which fields to display
- Manager role can access AR and AP but not P&L, Forecast, or Exports
