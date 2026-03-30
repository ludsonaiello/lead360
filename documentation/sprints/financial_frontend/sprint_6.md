# Sprint 6 — Suppliers List & Detail Page
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_6.md
**Type:** Frontend — CRUD Page (Long Form)
**Depends On:** Sprint 1, Sprint 2, Sprint 5 (for category assignment)
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Build the complete Suppliers management page with list view, detail view, create/edit forms. Suppliers are vendors/companies you buy from — they track spend totals, have addresses, and can be organized into categories. This is a full single-page form (not modal) since it has many fields.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 9 (Suppliers).
- **Long forms must be single page, NOT modal.** Short forms (e.g., quick edits) can use modals.
- **Always use modal prompts, never system prompts (alert/confirm).**
- **Always include icons, masked inputs, auto-fill, select with search.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# List suppliers
curl -s "http://localhost:8000/api/v1/financial/suppliers?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Get supplier detail (use a real ID from list)
curl -s "http://localhost:8000/api/v1/financial/suppliers/SUPPLIER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Supplier statistics
curl -s "http://localhost:8000/api/v1/financial/suppliers/SUPPLIER_ID/statistics" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Suppliers List Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/suppliers/page.tsx`

**API Endpoints:**
- `GET /financial/suppliers` → Paginated list
- `DELETE /financial/suppliers/:id` → Soft-delete

**Layout:**
```
┌────────────────────────────────────────────────┐
│  Suppliers                        [+ Add New]   │
│                                                  │
│  [Search...          ] [Category ▼] [Preferred ▼]│
│  [Sort: Name ▼] [Active Only ☑]                  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ 🏢 Home Depot                     ⭐ Pref │   │
│  │ 📍 Boston, MA | 📧 contact@hd.com       │   │
│  │ 💰 Total Spend: $12,450 | Products: 15  │   │
│  │ 🏷️ [Roofing] [Lumber]                   │   │
│  │                    [View] [Edit] [Delete] │   │
│  ├──────────────────────────────────────────┤   │
│  │ 🏢 Lowes                                │   │
│  │ 📍 Worcester, MA | 📧 info@lowes.com    │   │
│  │ 💰 Total Spend: $8,200 | Products: 8    │   │
│  │                    [View] [Edit] [Delete] │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  [← Previous]  Page 1 of 3  [Next →]           │
└────────────────────────────────────────────────┘
```

**Features:**
1. **Card-style list** with supplier info
2. **Search** with debounce (300ms) — searches name, legal_name, contact_name
3. **Filter by category** — Select with search, populated from supplier categories API
4. **Filter by preferred** — Toggle/dropdown
5. **Sort by:** name, total_spend, last_purchase_date, created_at
6. **Active/Inactive toggle**
7. **Pagination** using PaginationControls
8. **Each card shows:** name, location (city, state), email, total spend (formatted as currency), product count, category badges
9. **Preferred badge** with star icon for `is_preferred: true`
10. **View button** → navigates to detail page `/financial/suppliers/[id]`
11. **Edit button** → navigates to edit page `/financial/suppliers/[id]/edit`
12. **Delete button** → ConfirmModal → soft delete
13. **Add button** → navigates to `/financial/suppliers/new`
14. **Empty state** when no suppliers match filters

---

### Task 2 — Supplier Create/Edit Page (Single Page Form)

**Create Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/suppliers/new/page.tsx`
**Edit Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/suppliers/[id]/edit/page.tsx`

Both use the same form component. The edit page fetches the supplier first.

**Form sections (single scrollable page):**

**Section 1 — Basic Information:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Name | Input | Yes | 1-200 chars |
| Legal Name | Input | No | Max 200 chars |
| Website | Input (with globe icon) | No | Max 500 chars |
| Is Preferred | Toggle switch | No | Default: false |

**Section 2 — Contact Information:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Contact Name | Input (with User icon) | No | Max 150 chars |
| Phone | Input (masked: (XXX) XXX-XXXX) | No | Max 20 chars |
| Email | Input (with Mail icon) | No | Valid email |

**Section 3 — Address:**

> **API field names:** `address_line1`, `address_line2`, `city`, `state`, `zip_code`, `country`. Note: `address_line1` has NO underscore before the `1` — it is `address_line1` NOT `address_line_1`.

| Field | API Field | Component | Required | Validation |
|-------|-----------|-----------|----------|------------|
| Address Line 1 | `address_line1` | Input | No | Max 255 chars |
| Address Line 2 | `address_line2` | Input | No | Max 255 chars |
| City | `city` | Input | No | Max 100 chars |
| State | `state` | Select (searchable, all 50 US states + DC) | No | 2 uppercase letters |
| ZIP Code | `zip_code` | Input (masked: XXXXX or XXXXX-XXXX) | No | 5 or 9 digits |

**Section 4 — Categories:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Categories | Multi-select with search | No | Valid category IDs |

Load supplier categories from `getSupplierCategories()` for the options. Show color dots next to each option.

**Section 5 — Location Coordinates (hidden from form, auto-resolved by backend):**

The API supports `latitude`, `longitude`, `google_place_id`, and `country` fields. These are auto-resolved by the backend when address fields are provided (Google Maps geocoding). Do NOT add visible form fields for these. Instead:
- `country` defaults to `"US"` — no need to show unless international support is needed later
- `latitude`/`longitude`/`google_place_id` are auto-populated by the backend from the address

**Section 6 — Notes:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Notes | Textarea | No | Free text |

**Form actions:**
- **Save** button → Create or update
- **Cancel** button → Navigate back to list
- Loading state on save button
- Toast success → navigate to supplier detail page
- Toast error → stay on form, show errors

**State autocomplete options (US states):**
Include all 50 states + DC in the state select, e.g.: `{ value: 'MA', label: 'Massachusetts' }`, `{ value: 'CA', label: 'California' }`, etc.

**Phone mask:** `(XXX) XXX-XXXX` — send clean digits to API

---

### Task 3 — Supplier Detail Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/suppliers/[id]/page.tsx`

**API Endpoints:**
- `GET /financial/suppliers/:id` → Full detail
- `GET /financial/suppliers/:id/statistics` → Spending stats

**Layout — tabbed detail view:**
```
┌────────────────────────────────────────────────┐
│  ← Back to Suppliers                            │
│                                                  │
│  🏢 Home Depot                        [Edit]    │
│  📍 123 Main St, Boston, MA 02101              │
│  📧 contact@hd.com | 📞 (555) 123-4567        │
│  🏷️ [Roofing] [Lumber]              ⭐ Preferred│
│                                                  │
│  [Overview] [Products] [Statistics]              │
│                                                  │
│  ── Overview Tab ──                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Total    │ │ Trans-   │ │ Last     │        │
│  │ Spend    │ │ actions  │ │ Purchase │        │
│  │ $12,450  │ │ 28       │ │ Mar 15   │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│                                                  │
│  Contact: John Smith                             │
│  Website: www.homedepot.com                     │
│  Notes: Our primary lumber supplier              │
│                                                  │
│  ── Products Tab ──                              │
│  (Built in Sprint 7)                             │
│                                                  │
│  ── Statistics Tab ──                            │
│  Spend by Category chart                         │
│  Spend by Month chart                            │
└────────────────────────────────────────────────┘
```

**Overview tab:**
- Summary cards: total spend, transaction count, last/first purchase dates
- Contact info, website, full address, notes
- Category badges

**Statistics tab:**
- Spend by category (table or simple bar)
- Spend by month (table or simple bar)
- All data from `getSupplierStatistics(id)`

**Products tab:** Show placeholder — will be built in Sprint 7.

---

## Acceptance Criteria
- [ ] Supplier list loads with pagination
- [ ] Search, category filter, preferred filter, sort, active toggle work
- [ ] Create form (single page) with all fields
- [ ] Edit form with pre-populated data
- [ ] Phone and ZIP masked inputs work
- [ ] State select with search works
- [ ] Multi-select for categories works
- [ ] Supplier detail page with tabs
- [ ] Statistics tab shows spend data
- [ ] Delete with confirmation modal
- [ ] Preferred badge displayed
- [ ] Total spend formatted as currency
- [ ] RBAC enforced (Owner/Admin/Manager/Bookkeeper for create/update; Owner/Admin/Bookkeeper for delete — Manager CANNOT delete)
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Suppliers list is paginated — use server-side filtering, not client-side
- Supplier detail returns full object with `products[]` array (used in Sprint 7)
- Statistics endpoint returns spend_by_category and spend_by_month arrays
- Total spend returned as string — parse with parseFloat()
