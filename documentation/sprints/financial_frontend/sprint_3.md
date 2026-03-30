# Sprint 3 — Financial Categories Settings Page
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_3.md
**Type:** Frontend — Settings CRUD Page
**Depends On:** Sprint 1, Sprint 2
**Gate:** NONE
**Estimated Complexity:** Low

---

## Objective

Build the Financial Categories management page in Settings. This allows owners/admins/managers to view, create, edit, and deactivate expense/income categories. Categories are used throughout the financial module for organizing entries.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation at `/var/www/lead360.app/api/documentation/financial_REST_API.md` — Section 5.
- **Follow the exact same patterns** already used in the codebase. Read existing files first.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Pre-Sprint Checklist
- [ ] Read existing settings pages for pattern reference (e.g., `/settings/` directory)
- [ ] Read `/var/www/lead360.app/app/src/components/ui/Modal.tsx`
- [ ] Read `/var/www/lead360.app/app/src/components/ui/ConfirmModal.tsx`
- [ ] Read `/var/www/lead360.app/app/src/components/ui/Badge.tsx`
- [ ] Sprint 1 complete — types and API client available

---

## Dev Server

```
Ensure backend is running on port 8000.
Hit the categories endpoint to see real data:

TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

curl -s http://localhost:8000/api/v1/settings/financial-categories \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Create Financial Categories Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/settings/financial-categories/page.tsx`

**API Endpoints Used:**
- `GET /settings/financial-categories` → List all categories (flat array, not paginated)
- `POST /settings/financial-categories` → Create category
- `PATCH /settings/financial-categories/:id` → Update category
- `DELETE /settings/financial-categories/:id` → Soft-delete (deactivate)

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Financial Categories    [+ Add Category]    │
│                                              │
│  Filter: [All Types ▼] [Search...        ]  │
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │ 🏷️ Labor - General                   │   │
│  │ Type: labor | COGS | System Default   │   │
│  │                          [Edit]       │   │
│  ├───────────────────────────────────────┤   │
│  │ 🏷️ Materials - General               │   │
│  │ Type: material | COGS | System Default│   │
│  │                          [Edit]       │   │
│  ├───────────────────────────────────────┤   │
│  │ 🏷️ Custom Category                   │   │
│  │ Type: fuel | OpEx | Custom            │   │
│  │              [Edit] [Deactivate]      │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Features:**
1. **List view:** Card-style list of all categories
2. **Filter by type:** Dropdown with all 12 category types + "All"
3. **Search:** Filter by name (client-side since array is flat, not paginated)
4. **Badge for type:** Color-coded badge for each category type
5. **Badge for classification:** "COGS" or "OpEx"
6. **System default indicator:** Badge showing "System Default" or "Custom"
7. **Add button:** Opens create modal (RBAC: Owner, Admin, Manager)
8. **Edit button:** Opens edit modal
9. **Deactivate button:** ConfirmModal → soft delete (only for custom categories, NOT system defaults)
10. **System defaults cannot be deleted** — hide the deactivate button for `is_system_default: true`
11. **System defaults cannot change classification** — disable classification field in edit modal for system defaults
12. **Toast notifications** for all CRUD operations
13. **Loading spinner** while fetching
14. **Empty state** if no categories match filter

---

### Task 2 — Create/Edit Category Modal

**Component:** Can be inline in the page or a separate component file.

**Create form fields:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Name | Input | Yes | Max 200 chars |
| Type | Select (searchable) | Yes | 12 enum options |
| Classification | Select | No (default: cost_of_goods_sold) | 2 options |
| Description | Textarea | No | Free text |

**Type options for Select:**
```
labor → "Labor"
material → "Material"
subcontractor → "Subcontractor"
equipment → "Equipment"
insurance → "Insurance"
fuel → "Fuel"
utilities → "Utilities"
office → "Office"
marketing → "Marketing"
taxes → "Taxes"
tools → "Tools"
other → "Other"
```

**Classification options:**
```
cost_of_goods_sold → "Cost of Goods Sold (COGS)"
operating_expense → "Operating Expense (OpEx)"
```

**Edit mode:**
- Pre-populate all fields from the category object
- If `is_system_default: true`, disable the Classification field and show a helper text: "Classification cannot be changed for system default categories"
- Name and Description are always editable

**Validation:**
- Name is required and cannot be empty
- Type is required
- Show field-level errors

**On submit:**
- Show loading state on save button
- Call `createFinancialCategory()` or `updateFinancialCategory()`
- On success: toast.success, close modal, refresh list
- On error: toast.error with API error message

---

### Task 3 — Deactivate Category Confirmation

Use `ConfirmModal` (or equivalent pattern from codebase):
- Title: "Deactivate Category"
- Message: "Are you sure you want to deactivate '{category name}'? It will no longer be available for new entries."
- Variant: "danger"
- Confirm button: "Deactivate"
- On confirm: Call `deleteFinancialCategory(id)`, toast.success, refresh list
- On error: toast.error

---

## Category Type Badge Colors

Map each type to a badge color variant:
```
labor → blue
material → green
subcontractor → purple
equipment → orange
insurance → indigo
fuel → red
utilities → cyan/teal
office → gray
marketing → pink
taxes → yellow
tools → amber
other → slate/default
```

---

## Acceptance Criteria
- [ ] Page loads at `/settings/financial-categories`
- [ ] Shows all categories from the API
- [ ] Filter by type works
- [ ] Search by name works
- [ ] Create modal opens and creates a new category
- [ ] Edit modal opens with pre-populated data
- [ ] System defaults show "System Default" badge
- [ ] System defaults cannot be deactivated (button hidden)
- [ ] System defaults cannot change classification (field disabled in edit)
- [ ] Deactivate works with confirmation modal
- [ ] Toast notifications on success and error
- [ ] RBAC: Only Owner, Admin, Manager can access
- [ ] Mobile responsive
- [ ] Dark mode support
- [ ] No backend code modified

---

## Handoff Notes
- Categories are flat array (not paginated) — client-side filtering is fine
- 12 category types, 2 classifications — match enums from API doc
- System defaults have `is_system_default: true` — restrict edit/delete accordingly
