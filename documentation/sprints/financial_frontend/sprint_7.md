# Sprint 7 — Supplier Products & Price History
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_7.md
**Type:** Frontend — Nested CRUD
**Depends On:** Sprint 1, Sprint 6
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Build the Supplier Products management within the supplier detail page. Products are materials/items tracked per supplier with pricing and automatic price history tracking.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 11 (Supplier Products).
- **Short forms use modals.** Product create/edit is a short form → use modal.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# List products for a supplier
curl -s "http://localhost:8000/api/v1/financial/suppliers/SUPPLIER_ID/products" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Products Tab in Supplier Detail

Add the Products tab content to the supplier detail page (Sprint 6's `[id]/page.tsx`).

**API Endpoints:**
- `GET /financial/suppliers/:supplierId/products` → Flat array
- `POST /financial/suppliers/:supplierId/products` → Create
- `PATCH /financial/suppliers/:supplierId/products/:productId` → Update
- `DELETE /financial/suppliers/:supplierId/products/:productId` → Soft-delete
- `GET /financial/suppliers/:supplierId/products/:productId/price-history` → Array

**Product List Layout:**
```
┌─────────────────────────────────────────────┐
│  Products                    [+ Add Product] │
│                                               │
│  ┌─────────────────────────────────────┐     │
│  │ 📦 2x4 Lumber 8ft                  │     │
│  │ SKU: LBR-2x4-8 | Unit: each        │     │
│  │ Price: $5.99 | Updated: Mar 20      │     │
│  │        [Price History] [Edit] [🗑️]  │     │
│  ├─────────────────────────────────────┤     │
│  │ 📦 Roofing Nails 1lb               │     │
│  │ SKU: RF-NAIL-1 | Unit: bag          │     │
│  │ Price: $8.49 | Updated: Mar 18      │     │
│  │        [Price History] [Edit] [🗑️]  │     │
│  └─────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

---

### Task 2 — Create/Edit Product Modal

**Form fields:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Name | Input | Yes | 1-200 chars |
| Description | Textarea | No | Free text |
| Unit of Measure | Input with suggestions | Yes | 1-50 chars |
| Unit Price | MoneyInput (4 decimal places) | No | Min 0 |
| SKU | Input | No | Max 100 chars |

**Unit of Measure suggestions:** Provide common options as placeholder text or datalist: "each", "bag", "box", "lb", "sq ft", "gallon", "roll", "bundle", "linear ft", "yard"

**Price note:** When updating price, a price history record is auto-created by the backend. Show a note in the edit modal: "Changing the price will create a price history record."

**Product name uniqueness:** Product name must be unique per supplier (case-insensitive). Show validation error if duplicate name.

---

### Task 3 — Price History Modal

When clicking "Price History" on a product, open a modal showing the price change timeline.

**API:** `GET /financial/suppliers/:supplierId/products/:productId/price-history`

**Layout:**
```
┌──────────────────────────────────────┐
│  Price History — 2x4 Lumber 8ft      │
│                                      │
│  📅 Mar 20, 2026                     │
│     $5.99 → $6.49                    │
│     Changed by: Ludson Menezes       │
│                                      │
│  📅 Mar 15, 2026                     │
│     $5.49 → $5.99                    │
│     Changed by: Ludson Menezes       │
│                                      │
│  📅 Mar 10, 2026 (Initial)           │
│     — → $5.49                        │
│     Changed by: Ludson Menezes       │
│                              [Close] │
└──────────────────────────────────────┘
```

- Show timeline-style list with date, old price → new price, who changed it, optional notes
- Each entry has fields: `id`, `previous_price` (string), `new_price` (string), `changed_by` (object with `id`, `first_name`, `last_name`), `changed_at` (ISO date), `notes` (string | null)
- Prices are strings — format as currency
- Show notes if present
- Empty state: "No price changes recorded"

---

## Acceptance Criteria
- [ ] Products tab shows in supplier detail page
- [ ] Product list with name, SKU, unit, price displayed
- [ ] Create product modal works
- [ ] Edit product modal with pre-populated data
- [ ] MoneyInput for price with 4 decimal places
- [ ] Delete with confirmation
- [ ] Price history modal shows timeline
- [ ] Unit price displayed as currency ($X.XXXX)
- [ ] RBAC: Owner/Admin/Manager/Bookkeeper for create/update/read; **Owner/Admin/Bookkeeper for delete (Manager CANNOT delete)**
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Products are flat array (not paginated), ordered by name
- `unit_price` is a string (decimal) — parse to number for display
- Price history is ordered by `changed_at` descending
- Product names must be unique per supplier (case-insensitive)
