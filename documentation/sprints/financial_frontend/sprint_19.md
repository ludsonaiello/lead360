# Sprint 19 — Financial Dashboard — Overview & P&L
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_19.md
**Type:** Frontend — Dashboard Page
**Depends On:** Sprint 1, Sprint 2
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Build the main Financial Dashboard page at `/financial` (replacing the hub page from Sprint 2 or enhancing it). This sprint covers the Overview and Profit & Loss sections — the business-wide financial intelligence view.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 21 (Financial Dashboard).
- **Use cardview, proper data visualization, mobile first.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Dashboard overview (all-in-one)
curl -s "http://localhost:8000/api/v1/financial/dashboard/overview" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# P&L report
curl -s "http://localhost:8000/api/v1/financial/dashboard/pl?year=2026" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# P&L for specific month
curl -s "http://localhost:8000/api/v1/financial/dashboard/pl?year=2026&month=3" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Dashboard Page with Tabs

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/page.tsx`

Enhance the hub page (Sprint 2) or rebuild it as a tabbed dashboard:

**Tabs:**
| Tab | Icon | Content |
|-----|------|---------|
| Overview | LayoutDashboard | Quick stats + navigation cards + alerts |
| Profit & Loss | TrendingUp | P&L report |
| Receivable | ArrowDownCircle | AR summary (Sprint 20) |
| Payable | ArrowUpCircle | AP summary (Sprint 20) |
| Forecast | LineChart | Cash flow forecast (Sprint 20) |

**RBAC:**
- Owner, Admin, Bookkeeper: All tabs
- Manager: Only AR and AP tabs

---

### Task 2 — Overview Tab

Load `getDashboardOverview()` which returns all 5 sections in one call.

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Financial Dashboard          As of Mar 25, 2026  │
│                                                    │
│  [Overview] [P&L] [Receivable] [Payable] [Forecast]│
│                                                    │
│  ── Key Metrics ──                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │ Revenue  │ │ Expenses │ │ Net      │ │ AR     ││
│  │ $45,000  │ │ $28,500  │ │ $16,500  │ │$12,500 ││
│  │ collected│ │ this mo  │ │ profit   │ │outstand││
│  └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │ AP Total │ │ Forecast │ │ Pending  │ │ Alerts ││
│  │ $8,200   │ │ +$25K    │ │ 3 entries│ │ 2      ││
│  │ estimate │ │ net 30d  │ │ to review│ │warnings││
│  └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                                                    │
│  ── Quick Navigation ──                            │
│  [Grid of cards linking to sub-sections]           │
│                                                    │
│  ── Alerts ──                                      │
│  ⚠️ Project 'Kitchen Remodel' at 94.5% budget     │
│  🔴 Invoice INV-0001 is 15 days overdue            │
└──────────────────────────────────────────────────┘
```

**Metrics cards sourced from overview response:**
- Revenue: `pl_summary.totals.total_income` or `ar_summary.summary.total_collected`
- Expenses: `pl_summary.totals.total_expenses`
- Net Profit: `pl_summary.totals.total_gross_profit`
- AR Outstanding: `ar_summary.summary.total_outstanding`
- AP Estimate: `ap_summary.summary.total_ap_estimate`
- Forecast: `forecast.net_forecast` with `net_forecast_label`
- Pending: count from pending entries API
- Alerts: `alerts.length`

**Alerts section:**
Display all alerts with severity-based styling:
- `error` → red left border + AlertTriangle icon
- `warning` → yellow/orange left border + AlertTriangle icon
- `info` → blue left border + Info icon

---

### Task 3 — Profit & Loss Tab

**API:** `getDashboardPL({ year, month?, include_pending? })`

**Controls:**
- Year selector (dropdown: 2024-2027)
- Month selector (dropdown: All Year, Jan-Dec)
- Include pending toggle (checkbox)
- Export P&L button (downloads CSV via `exportPL()`)

**Layout — Full Year View:**
```
┌──────────────────────────────────────────────────┐
│  Profit & Loss — 2026                             │
│  [Year: 2026 ▼] [Month: All Year ▼] [☐ Pending]  │
│                                        [Export CSV]│
│                                                    │
│  ── Annual Summary ──                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐│
│  │ Revenue  │ │ Expenses │ │ Gross    │ │ Net   ││
│  │ $125,000 │ │ $82,000  │ │ Profit   │ │Profit ││
│  │          │ │          │ │ $43,000  │ │$43,000││
│  └──────────┘ └──────────┘ └──────────┘ └───────┘│
│                                                    │
│  Avg Monthly: Income $10.4K | Expense $6.8K       │
│  Best Month: Jun 2026 (+$8,200)                   │
│  Worst Month: Jan 2026 (-$2,500)                  │
│                                                    │
│  ── Monthly Breakdown ──                           │
│  ┌─────────┬─────────┬─────────┬─────────┬───────┐│
│  │ Month   │ Income  │ Expense │ COGS    │ Profit││
│  ├─────────┼─────────┼─────────┼─────────┼───────┤│
│  │ Jan     │ $5,000  │ $7,500  │ $6,000  │-$2,500││
│  │ Feb     │ $12,000 │ $8,200  │ $6,800  │+$3,800││
│  │ Mar     │ $0      │ $2,542  │ $2,542  │-$2,542││
│  └─────────┴─────────┴─────────┴─────────┴───────┘│
│                                                    │
│  ── Expense Categories ──                          │
│  Labor - General          ████████  $1,500 (59%)  │
│  Miscellaneous            ████      $542 (21%)    │
│  Labor - Crew Overtime    ███       $400 (16%)    │
│  Equipment                █          $100 (4%)    │
│                                                    │
│  ── Tax Summary ──                                 │
│  Collected: $0 | Paid: $0 | Net: $0              │
└──────────────────────────────────────────────────┘
```

**Single Month View (when month is selected):**
Show one month's detailed breakdown:
- Income by project
- Expenses by category
- Top suppliers
- COGS vs Operating Expense breakdown
- Tax summary

**P&L CSV Export:**
- "Export CSV" button
- Calls `exportPL({ year, month? })` → Blob download
- Download with filename `pl-2026.csv` or `pl-2026-03.csv`

---

## Acceptance Criteria
- [ ] Dashboard page with 5 tabs
- [ ] Overview tab shows key metrics from overview API
- [ ] Navigation cards link to sub-sections
- [ ] Alerts displayed with severity styling
- [ ] P&L tab with year/month selectors
- [ ] Annual summary cards
- [ ] Monthly breakdown table
- [ ] Expense category bars
- [ ] Tax summary section
- [ ] Include pending toggle works
- [ ] P&L CSV export downloads file
- [ ] Best/worst month displayed
- [ ] Single month detail view
- [ ] RBAC: Owner/Admin/Bookkeeper for P&L; Manager for limited tabs
- [ ] Mobile responsive (tables scroll horizontally)
- [ ] Dark mode support
- [ ] No backend code modified

---

## Handoff Notes
- `getDashboardOverview()` returns ALL sections in one call — efficient for the overview tab
- P&L endpoint requires `year` parameter
- P&L `months` array may have 1 or 12 entries depending on whether month is specified
- `gross_margin_percent` can be null if no income
- CSV export uses `responseType: 'blob'`
- P&L data includes `by_classification` for COGS vs OpEx split
