# Sprint 2 — Sidebar Navigation & Financial Hub Page
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_2.md
**Type:** Frontend — Navigation & Layout
**Depends On:** Sprint 1
**Gate:** STOP — Navigation must work before building any financial page
**Estimated Complexity:** Medium

---

## Objective

Add a "Financial" section to the sidebar navigation with sub-items, and create the main Financial Hub page at `/financial` that serves as the entry point to the financial module. This page will later host the dashboard, but for now provides navigation cards to all financial sub-sections.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation at `/var/www/lead360.app/api/documentation/` as much as you need.
- **Follow the exact same patterns** already used in the codebase. Read existing files first.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Pre-Sprint Checklist
- [ ] Read `/var/www/lead360.app/app/src/app/(dashboard)/layout.tsx` — sidebar/navigation layout
- [ ] Read `/var/www/lead360.app/app/src/contexts/RBACContext.tsx` — permission checks
- [ ] Read any existing financial pages in `(dashboard)/` to understand patterns
- [ ] Read `/var/www/lead360.app/app/src/components/ui/Card.tsx` — card component
- [ ] Sprint 1 complete — types and API client compiled

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

The backend must be running for auth. If not:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT for health check:
  curl -s http://localhost:8000/health

Login to verify auth works:
  curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}'
```

---

## Tasks

### Task 1 — Read Existing Navigation Structure

Read the dashboard layout to understand how the sidebar is built:
- Where navigation items are defined
- How icons are used (lucide-react)
- How sub-navigation/dropdowns work (if any)
- How RBAC gates navigation items
- How active route highlighting works

---

### Task 2 — Add Financial Section to Sidebar

Add a "Financial" section to the sidebar navigation. It should appear after "Projects" (or wherever makes sense in the flow).

**Main item:** Financial (icon: `DollarSign` from lucide-react)

**Sub-items (when expanded):**
| Label | Route | Icon | Roles |
|-------|-------|------|-------|
| Dashboard | `/financial` | `LayoutDashboard` | Owner, Admin, Bookkeeper |
| Expenses | `/financial/entries` | `Receipt` | Owner, Admin, Manager, Bookkeeper, Employee |
| Approvals | `/financial/approvals` | `CheckSquare` | Owner, Admin, Manager, Bookkeeper |
| Suppliers | `/financial/suppliers` | `Building2` | Owner, Admin, Manager, Bookkeeper |
| Recurring | `/financial/recurring` | `RefreshCw` | Owner, Admin, Manager, Bookkeeper |
| Exports | `/financial/exports` | `Download` | Owner, Admin, Bookkeeper |

**RBAC:** The "Financial" parent item should show for anyone with at least one sub-item visible. Each sub-item checks `hasRole()`.

**Pattern:** Follow the exact same expand/collapse pattern used by other sidebar sections. If the sidebar uses a flat list, make it a flat list. Match the existing UX.

---

### Task 3 — Create Financial Hub Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/page.tsx`

This is the main `/financial` route. It displays a grid of navigation cards linking to each sub-section, plus quick stats from the dashboard API.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Financial Overview              [period ▼]  │
├──────────┬──────────┬──────────┬────────────┤
│ Revenue  │ Expenses │ Profit   │ Outstanding│
│ $XX,XXX  │ $XX,XXX  │ $XX,XXX  │ $XX,XXX    │
│ invoiced │ confirmed│ net      │ AR balance │
├──────────┴──────────┴──────────┴────────────┤
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ 📊 Expenses  │  │ ✅ Approvals │         │
│  │ View & manage│  │ Pending queue│         │
│  │ all entries  │  │ X pending    │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ 🏢 Suppliers │  │ 🔄 Recurring │         │
│  │ Vendor       │  │ Auto expenses│         │
│  │ registry     │  │ X rules      │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ 💳 Pay Methods│  │ 📤 Exports  │         │
│  │ Payment      │  │ QB & Xero   │         │
│  │ accounts     │  │ exports     │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  ⚠️ Alerts (if any)                         │
│  ┌──────────────────────────────────┐       │
│  │ Warning: Project X at 90% budget │       │
│  │ Error: INV-0001 15 days overdue  │       │
│  └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

**Implementation:**
1. Use `'use client'` directive
2. Import `useAuth`, `useRBAC` hooks
3. Fetch dashboard overview on mount: `getDashboardOverview()`
4. Display 4 summary stat cards at top (Revenue, Expenses, Profit, Outstanding)
5. Grid of navigation cards (2-3 columns on desktop, 1 on mobile)
6. Each card is a `<Link>` (not a button) to the sub-section
7. Each card shows an icon, title, description, and optionally a live count
8. Alerts section at the bottom if there are any alerts
9. Loading spinner while data loads
10. Error card if API fails
11. RBAC: Only show cards the user has access to
12. Mobile-first responsive layout
13. Dark mode support

**Icons to use (from lucide-react):**
- Dashboard: `LayoutDashboard`
- Expenses: `Receipt`
- Approvals: `CheckSquare`
- Suppliers: `Building2`
- Recurring: `RefreshCw`
- Payment Methods: `CreditCard`
- Exports: `Download`
- Alerts: `AlertTriangle`

**Money formatting:** Use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` or a helper.

---

### Task 4 — Create Financial Layout (Optional)

If the codebase uses shared layouts per section, create:
**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/layout.tsx`

This layout can optionally wrap all `/financial/*` pages with a consistent header or breadcrumb. Only create if the pattern exists in other sections (e.g., `/settings/layout.tsx`).

---

### Task 5 — Add Settings Sub-Routes

Create placeholder pages so navigation links don't 404:

1. `/var/www/lead360.app/app/src/app/(dashboard)/financial/entries/page.tsx` — placeholder "Coming Soon"
2. `/var/www/lead360.app/app/src/app/(dashboard)/financial/approvals/page.tsx` — placeholder
3. `/var/www/lead360.app/app/src/app/(dashboard)/financial/suppliers/page.tsx` — placeholder
4. `/var/www/lead360.app/app/src/app/(dashboard)/financial/recurring/page.tsx` — placeholder
5. `/var/www/lead360.app/app/src/app/(dashboard)/financial/exports/page.tsx` — placeholder

Each placeholder should:
- Show the page title and a "This page will be built in a future sprint" message
- Have proper RBAC check
- Use the LoadingSpinner for auth check
- Match existing page structure

---

### Task 6 — Also add Financial Categories and Payment Methods to Settings

If there is a Settings section in the sidebar, add:
- **Financial Categories** → `/settings/financial-categories`
- **Payment Methods** → `/settings/payment-methods`

These are configuration pages that belong in Settings. Create placeholder pages for them too.

---

## Acceptance Criteria
- [ ] "Financial" section appears in sidebar with correct icon
- [ ] Sub-items expand/collapse following existing sidebar pattern
- [ ] Each sub-item only visible to authorized roles
- [ ] `/financial` hub page loads and shows dashboard overview data
- [ ] Summary stat cards show real numbers from API
- [ ] Navigation cards link to correct routes
- [ ] Alerts section shows if API returns alerts
- [ ] Mobile-responsive (1 column on mobile, 2-3 on desktop)
- [ ] Dark mode works correctly
- [ ] Loading and error states handled
- [ ] All placeholder pages load without errors
- [ ] No backend code was modified

---

## Gate Marker
**STOP** — Sidebar navigation must be functional and hub page must load real data before building sub-pages.

---

## Handoff Notes
- Financial routes live at `/financial/*`
- Settings routes at `/settings/financial-categories` and `/settings/payment-methods`
- Dashboard API returns all data in one call: `getDashboardOverview()`
- Hub page established — subsequent sprints will build each sub-section
