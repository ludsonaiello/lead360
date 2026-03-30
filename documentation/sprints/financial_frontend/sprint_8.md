# Sprint 8 — Financial Entries List with Advanced Filters
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_8.md
**Type:** Frontend — List Page
**Depends On:** Sprint 1, Sprint 2
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Build the main Financial Entries list page at `/financial/entries`. This is the central expense/income management screen with advanced filtering, search, sorting, and summary aggregation. It replaces any basic entry list that may exist in the project financial tab.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 6 (Financial Entries).
- **Always use action buttons and proper views, cardview, mobile first approach.**
- **Always include icons, masked-inputs, auto-fill, select with search.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# List entries with filters
curl -s "http://localhost:8000/api/v1/financial/entries?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Note the response has data[], meta{}, and summary{}
```

---

## Tasks

### Task 1 — Financial Entries List Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/entries/page.tsx`

**API Endpoints:**
- `GET /financial/entries` → Paginated with summary
- `GET /financial/entries/:id` → Single entry detail
- `DELETE /financial/entries/:id` → Delete entry

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Financial Entries              [+ New Entry] [Export]│
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Expenses │ │ Income   │ │ Tax Paid │ │ Entries  ││
│  │ $25,420  │ │ $0       │ │ $1,250   │ │ 42       ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│                                                       │
│  ┌─ Filters ────────────────────────────────────────┐│
│  │ [🔍 Search...               ]                    ││
│  │ [Project ▼] [Category ▼] [Type ▼] [Status ▼]    ││
│  │ [Supplier ▼] [Payment ▼] [Date From] [Date To]  ││
│  │ [Has Receipt ▼] [Recurring ▼]    [Clear Filters] ││
│  └──────────────────────────────────────────────────┘│
│  Sort: [Entry Date ▼] [Desc ▼]                       │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │ 📋 Mar 17 | Miscellaneous | $542.00          │    │
│  │ Project: Teste | Task: Retirar Driveway      │    │
│  │ Status: ✅ Confirmed | 📎 No receipt          │    │
│  │ Created by: Ludson Menezes                    │    │
│  │                    [View] [Edit] [Delete]     │    │
│  ├──────────────────────────────────────────────┤    │
│  │ 📋 Mar 16 | Labor - General | $1,500.00      │    │
│  │ Project: Teste | Supplier: Home Depot         │    │
│  │ Status: ⏳ Pending Review | 📎 Has receipt    │    │
│  │ Payment: Chase Visa •••• 4521                 │    │
│  │                    [View] [Edit] [Delete]     │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  [← Previous]  Page 1 of 3  [Next →]                │
└──────────────────────────────────────────────────────┘
```

**Summary cards at top:** Display the `summary` object from the API response:
- Total Expenses (formatted as currency)
- Total Income (formatted as currency)
- Total Tax (formatted as currency)
- Entry Count

**These cards update when filters change** — the API recalculates the summary based on active filters.

---

### Task 2 — Advanced Filters

**Filter controls (collapsible panel — default collapsed on mobile, expanded on desktop):**

| Filter | Component | API Param | Options Source |
|--------|-----------|-----------|----------------|
| Search | Input with search icon | `search` | Free text — searches vendor, notes, category |
| Project | Select with search | `project_id` | Fetch from `/projects` API |
| Category | Select with search | `category_id` | Fetch from `/settings/financial-categories` |
| Category Type | Select | `category_type` | 12 enum types |
| Classification | Select | `classification` | COGS / OpEx |
| Entry Type | Select | `entry_type` | Expense / Income |
| Supplier | Select with search | `supplier_id` | Fetch from `/financial/suppliers` |
| Payment Method | Select | `payment_method` | 8 enum types |
| Submission Status | Select | `submission_status` | Pending Review / Confirmed |
| Date From | DatePicker | `date_from` | Calendar |
| Date To | DatePicker | `date_to` | Calendar |
| Has Receipt | Select | `has_receipt` | Yes / No / All |
| Is Recurring Instance | Select | `is_recurring_instance` | Yes / No / All |
| Purchased By (User) | Select with search | `purchased_by_user_id` | From team members API |
| Purchased By (Crew) | Select with search | `purchased_by_crew_member_id` | From crew members API |

**Sorting:**
| Sort Field | API Value |
|-----------|-----------|
| Entry Date | `entry_date` |
| Amount | `amount` |
| Created At | `created_at` |

Sort order: `asc` or `desc` toggle.

**Filter behavior:**
- Debounce search by 300ms
- All filter changes reset to page 1
- "Clear Filters" button resets all filters
- Show active filter count badge on the filter toggle button
- Filters are applied server-side via query params

---

### Task 3 — Entry Card View

Each entry card displays:
1. **Date** — formatted as "Mar 17, 2026"
2. **Category** with type badge (color-coded)
3. **Amount** — formatted as currency, red for expense, green for income
4. **Project name** (if linked) — as a link to the project
5. **Task title** (if linked)
6. **Supplier/Vendor** — supplier_name or vendor_name
7. **Payment method** with nickname (if registered) or type
8. **Submission status badge:**
   - `confirmed` → green badge "Confirmed"
   - `pending_review` → yellow badge "Pending Review"
   - If `rejection_reason` exists → red badge "Rejected" with tooltip showing reason
9. **Receipt indicator:** 📎 icon if `has_receipt: true`
10. **Recurring indicator:** 🔄 icon if `is_recurring_instance: true`
11. **Purchased by** (user name or crew member name)
12. **Created by** name

**Action buttons:**
- **View** → Opens detail modal (full entry info)
- **Edit** → Opens create/edit form (Sprint 9)
- **Delete** → ConfirmModal

**Delete RBAC rules:**
- Owner/Admin: Can delete any entry
- Manager/Bookkeeper: CANNOT delete (hide button)
- Employee: Can only delete own pending entries

---

### Task 4 — Entry Detail Modal

When clicking "View", show a read-only modal with ALL entry fields:
- All enriched fields displayed in organized sections
- Receipt preview (if has_receipt)
- Rejection history (if rejected_at exists)
- Created/updated timestamps
- Close button

---

### Task 5 — Load Supporting Data for Filters

On page mount, fetch in parallel:
1. Projects list (for project filter select) — use existing projects API
2. Financial categories (for category filter)
3. Suppliers (for supplier filter — first page with limit=100)

Cache these in state for the duration of the page.

---

## Acceptance Criteria
- [ ] Entry list loads with pagination
- [ ] Summary cards show totals from API
- [ ] Summary updates when filters change
- [ ] All 14 filters work correctly (search, project, category, category_type, classification, entry_type, supplier, payment_method, submission_status, date_from, date_to, has_receipt, is_recurring_instance, purchased_by)
- [ ] Search debounce at 300ms
- [ ] Sort by 3 fields + asc/desc
- [ ] Clear filters button works
- [ ] Entry cards show all relevant info
- [ ] Submission status badges (confirmed/pending/rejected)
- [ ] Receipt and recurring indicators
- [ ] View detail modal with full info
- [ ] Delete with RBAC-appropriate visibility
- [ ] Pagination controls work
- [ ] Mobile responsive (filters collapse)
- [ ] Dark mode support
- [ ] No backend code modified

---

## Handoff Notes
- Amount is returned as string — `parseFloat()` for display
- Summary object comes WITH the paginated response (same API call)
- Enriched fields include `_name` suffixes for human-readable labels
- Employee can only see own entries (API handles this server-side)
- Rejection is indicated by `rejection_reason` + `rejected_at` being non-null, NOT by a separate status value
