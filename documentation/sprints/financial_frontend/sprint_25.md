# Sprint 25 — Subcontractor Payments Recording
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_25.md
**Type:** Frontend — CRUD Page
**Depends On:** Sprint 1a, Sprint 1b, Sprint 1c, Sprint 2
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Build the Subcontractor Payments recording UI. Users record direct payments made to subcontractors for their work. Includes list view, create modal, per-subcontractor payment history, and payment summary.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 20 (Subcontractor Payments).
- **Short forms use modals.**
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

# List subcontractor payments
curl -s "http://localhost:8000/api/v1/financial/subcontractor-payments?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Payment history for a specific subcontractor
curl -s "http://localhost:8000/api/v1/subcontractors/SUBCONTRACTOR_ID/payment-history" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Payment summary for a subcontractor
curl -s "http://localhost:8000/api/v1/subcontractors/SUBCONTRACTOR_ID/payment-summary" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Subcontractor Payments List Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/subcontractor-payments/page.tsx`

Or integrate as a tab alongside subcontractor invoices (Sprint 24).

**API Endpoint:** `GET /api/v1/financial/subcontractor-payments`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| project_id | UUID | - | Filter by project |
| subcontractor_id | UUID | - | Filter by subcontractor |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Pagination:** Uses `pages` in meta.

**Response fields per payment:**
- `id`, `tenant_id`
- `subcontractor_id` + nested `subcontractor: { id, business_name, trade_specialty }`
- `project_id` + nested `project: { id, name, project_number }` (nullable)
- `amount` — **STRING** (decimal) — must `parseFloat()`
- `payment_date` — ISO 8601
- `payment_method` — one of 8 enum types
- `reference_number` — nullable string
- `notes` — nullable
- `created_by_user_id`, `created_at`

**Layout:**
```
+------------------------------------------------------+
|  Subcontractor Payments          [+ Record Payment]   |
|                                                        |
|  Filters: [Subcontractor v] [Project v]               |
|                                                        |
|  +--------------------------------------------------+ |
|  | Ludson Developer (IT) | $15,000.00                | |
|  | Mar 17, 2026 | Check | Ref: PT22330-             | |
|  | Project: Teste                                     | |
|  | Notes: Final payment for driveway work            | |
|  |                                         [View]    | |
|  +--------------------------------------------------+ |
|                                                        |
|  [<- Previous]  Page 1 of 1  [Next ->]               |
+------------------------------------------------------+
```

**Features:**
1. Paginated card list
2. Filter by subcontractor (select with search)
3. Filter by project (select with search)
4. Amount formatted as currency (parse from string)
5. Payment method badge with icon
6. Reference number displayed if present
7. View detail (read-only modal)

**RBAC:**
- Create payment (POST): Owner, Admin, Bookkeeper
- List payments (GET): Owner, Admin, Bookkeeper
- Payment history per sub (GET): Owner, Admin, Manager, Bookkeeper

---

### Task 2 — Record Subcontractor Payment Modal (Create)

**API Endpoint:** `POST /api/v1/financial/subcontractor-payments`

**Modal size:** `lg`

**Form fields:**
| Field | Component | Required | Validation | API Field |
|-------|-----------|----------|------------|-----------|
| Subcontractor | Select with search | Yes | Must exist | `subcontractor_id` |
| Amount | MoneyInput | Yes | Min $0.01, max 2 decimal places | `amount` |
| Payment Date | DatePicker | Yes | ISO 8601, cannot be future | `payment_date` |
| Payment Method | Select | Yes | One of 8 types (see Sprint 23 Task 5 for icon mapping) | `payment_method` |
| Project | Select with search | No | Must exist | `project_id` |
| Reference Number | Input | No | Max 200 chars (check #, transaction ID) | `reference_number` |
| Notes | Textarea | No | Free text | `notes` |

**On submit:**
- Call `createSubcontractorPayment(dto)`
- Toast: "Payment of $X,XXX recorded for {subcontractor_name}"
- Refresh list
- Close modal

---

### Task 3 — Subcontractor Payment History View

**API Endpoint:** `GET /api/v1/subcontractors/:subcontractorId/payment-history`

Accessible from:
- "View History" link when filtering by subcontractor
- Or from subcontractor profile page

Same response shape as the main list. Paginated with `pages` field.

**Additional query params:**
| Param | Type | Description |
|-------|------|-------------|
| project_id | UUID | Filter by project |
| page | number | Page number |
| limit | number | Max 100 |

---

### Task 4 — Subcontractor Payment Summary Card

**API Endpoint:** `GET /api/v1/subcontractors/:id/payment-summary`

**Response:**
```json
{
  "subcontractor_id": "uuid",
  "total_invoiced": 2500,      // number (NOT string for this endpoint)
  "total_paid": 15000,
  "total_pending": 0,
  "total_approved": 0,
  "invoices_count": 1,
  "payments_count": 1
}
```

Display as a summary card at the top when viewing a specific subcontractor's payment history:

```
+----------------------------------------------+
| Payment Summary — Ludson Developer            |
|                                                |
| +----------+ +----------+ +----------+        |
| | Invoiced | | Paid     | | Pending  |        |
| | $2,500   | | $15,000  | | $0       |        |
| +----------+ +----------+ +----------+        |
| Invoices: 1 | Payments: 1                     |
+----------------------------------------------+
```

---

### Task 5 — Navigation Integration

Add "Subcontractor Payments" to the financial sidebar navigation, near "Subcontractor Invoices" (Sprint 24).

Consider grouping both under a "Subcontractors" or "AP" submenu:
- Subcontractor Invoices
- Subcontractor Payments

---

## Acceptance Criteria
- [ ] Payment list loads with pagination
- [ ] Filters (subcontractor, project) work
- [ ] Record payment modal creates payment
- [ ] Payment date cannot be future
- [ ] Payment method select with all 8 types
- [ ] Amount formatted as currency (parsed from string)
- [ ] Payment method badge with icon
- [ ] Reference number displayed when present
- [ ] Per-subcontractor payment history view
- [ ] Payment summary card with totals
- [ ] RBAC enforced per endpoint
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- `amount` is returned as **string** — `parseFloat()`
- Pagination uses `pages` field (NOT `total_pages`)
- Payment date cannot be in the future (API validates this)
- The payment summary endpoint returns **numbers** (not strings) for totals — different from other endpoints
- The subcontractor nested object has `business_name` (not `name`) and `trade_specialty`
- Subcontractors are loaded from existing subcontractor API (`/subcontractors` or similar)
- No edit or delete endpoints exist for subcontractor payments — once recorded, they are permanent
