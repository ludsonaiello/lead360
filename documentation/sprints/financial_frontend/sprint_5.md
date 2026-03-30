# Sprint 5 — Supplier Categories Management
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_5.md
**Type:** Frontend — CRUD Page
**Depends On:** Sprint 1, Sprint 2
**Gate:** NONE
**Estimated Complexity:** Low

---

## Objective

Build the Supplier Categories management page. Supplier categories organize suppliers into groups (e.g., "Roofing Supplies", "Electrical", "Plumbing"). This is a sub-page within the Suppliers section.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 10 (Supplier Categories).
- **Follow the exact same patterns** already used in the codebase.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

curl -s http://localhost:8000/api/v1/financial/supplier-categories \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Supplier Categories Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/suppliers/categories/page.tsx`

Or add as a tab within the suppliers page — follow the pattern of the existing codebase.

**API Endpoints:**
- `GET /financial/supplier-categories` → Flat array
- `POST /financial/supplier-categories` → Create
- `PATCH /financial/supplier-categories/:id` → Update
- `DELETE /financial/supplier-categories/:id` → Soft-delete

**Features:**
1. List all supplier categories with color dot, name, description, supplier count
2. Create button → modal form (name required, description optional, color picker with hex)
3. Edit button → modal with pre-populated data
4. Delete button → ConfirmModal (cannot delete if `supplier_count > 0`)
5. Color indicator: small circle/dot with the category's hex color
6. Supplier count badge showing how many suppliers use this category
7. Max 50 active categories per tenant — show "X/50" counter
8. Client-side search filter

**Create/Edit Modal fields:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Name | Input | Yes | 1-100 chars, unique |
| Description | Textarea | No | Max 2000 chars |
| Color | Color picker or hex input | No | Hex format #RRGGBB |

**Color input:** Use an `<input type="color">` with a preview, or a hex text input with validation regex `/^#[0-9A-Fa-f]{6}$/`. Show the color preview circle next to the input.

**Delete validation:** If `supplier_count > 0`, show the API's error message (cannot delete categories with assigned suppliers). Alternatively, hide delete button for categories with suppliers and show a tooltip explaining why.

---

## Acceptance Criteria
- [ ] Page loads and shows supplier categories
- [ ] Create/edit/delete works with modals
- [ ] Color indicator displayed correctly
- [ ] Supplier count shown per category
- [ ] Cannot delete categories with assigned suppliers
- [ ] Max 50 limit shown
- [ ] RBAC: Owner, Admin, Manager, Bookkeeper for create/update; Owner, Admin, Bookkeeper for delete
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Supplier categories are separate from financial categories
- Used when creating/editing suppliers — users assign category_ids to suppliers
- Color is optional — provide sensible defaults if not set
