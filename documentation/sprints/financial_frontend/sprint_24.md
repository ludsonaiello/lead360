# Sprint 24 — Subcontractor Invoices CRUD
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_24.md
**Type:** Frontend — CRUD Page with Status Workflow
**Depends On:** Sprint 1a, Sprint 1b, Sprint 1c, Sprint 2
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Build the Subcontractor Invoices management UI. Subcontractor invoices are invoices received FROM subcontractors for work performed on project tasks. They follow a forward-only status workflow: pending -> approved -> paid. Supports optional file attachment during creation.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 19 (Subcontractor Invoices).
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

# List subcontractor invoices
curl -s "http://localhost:8000/api/v1/financial/subcontractor-invoices?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Get subcontractor's invoices (profile view)
curl -s "http://localhost:8000/api/v1/subcontractors/SUBCONTRACTOR_ID/invoices" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Subcontractor Invoices List Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/subcontractor-invoices/page.tsx`

**API Endpoint:** `GET /api/v1/financial/subcontractor-invoices`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| subcontractor_id | UUID | - | Filter by subcontractor |
| task_id | UUID | - | Filter by task |
| project_id | UUID | - | Filter by project |
| status | string | - | "pending", "approved", "paid" |
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |

**Pagination:** Uses `pages` in meta.

**Response fields per invoice:**
- `id`, `tenant_id`
- `subcontractor_id` + nested `subcontractor: { id, business_name, trade_specialty }`
- `task_id` + nested `task: { id, title }`
- `project_id` + nested `project: { id, name, project_number }`
- `invoice_number` — nullable string (subcontractor's own invoice #)
- `invoice_date` — nullable ISO 8601
- `amount` — **STRING** (decimal) — must `parseFloat()`
- `status` — `"pending"` | `"approved"` | `"paid"`
- `notes` — nullable
- `file_id`, `file_url`, `file_name` — nullable (attached invoice document)
- `created_by_user_id`, `created_at`, `updated_at`

**Layout:**
```
+------------------------------------------------------+
|  Subcontractor Invoices           [+ Create Invoice]  |
|                                                        |
|  Filters: [Subcontractor v] [Project v] [Status v]   |
|                                                        |
|  +--------------------------------------------------+ |
|  | Ludson Developer (IT) | SUB-INV-001               | |
|  | Project: Teste | Task: Retirar Driveway           | |
|  | Amount: $2,500.00 | Date: Mar 16, 2026           | |
|  | Status: O Pending                                  | |
|  | Attachment: invoice.pdf                            | |
|  |            [Approve] [Edit Amount] [View]         | |
|  +--------------------------------------------------+ |
|  | ABC Roofing (Roofing) | INV-2026-045              | |
|  | Project: Kitchen Remodel | Task: Roofing          | |
|  | Amount: $5,000.00 | Date: Mar 10, 2026           | |
|  | Status: * Approved                                 | |
|  |            [Mark Paid] [View]                     | |
|  +--------------------------------------------------+ |
|                                                        |
|  [<- Previous]  Page 1 of 1  [Next ->]               |
+------------------------------------------------------+
```

**Status badges:**
- `pending` — yellow badge "Pending"
- `approved` — blue badge "Approved"
- `paid` — green badge "Paid"

**Action buttons per status:**
| Status | Actions |
|--------|---------|
| pending | Approve, Edit Amount, View |
| approved | Mark Paid, View |
| paid | View only |

**Status transitions are FORWARD-ONLY:**
- `pending` -> `approved` -> `paid`
- Cannot skip statuses (no pending -> paid directly)
- Cannot go backwards

**RBAC:**
- Create/Update/List: Owner, Admin, Manager, Bookkeeper
- No delete endpoint exists for subcontractor invoices

---

### Task 2 — Create Subcontractor Invoice Modal

**API Endpoint:** `POST /api/v1/financial/subcontractor-invoices`
**Content-Type:** `multipart/form-data` (when file attached) or `application/json` (without file)

**Modal size:** `lg`

**Form fields:**
| Field | Component | Required | Validation | API Field |
|-------|-----------|----------|------------|-----------|
| Subcontractor | Select with search | Yes | Must exist | `subcontractor_id` |
| Project | Select with search | Yes | Must exist | `project_id` |
| Task | Select with search | Yes | Must exist (conditional on project) | `task_id` |
| Amount | MoneyInput | Yes | Min $0.01, max 2 decimal places | `amount` |
| Invoice Number | Input | No | Max 100 chars (sub's own invoice #) | `invoice_number` |
| Invoice Date | DatePicker | No | ISO 8601 | `invoice_date` |
| Notes | Textarea | No | Free text | `notes` |
| Attachment | File input | No | Optional invoice document | `file` |

**Cascading select:** When project is selected, fetch tasks. Task is required but conditional on project selection.

**File upload handling:**
- If file is attached, build `FormData` with all fields + `file`
- If no file, send as JSON
- The API client function `createSubcontractorInvoice` accepts both `CreateSubcontractorInvoiceDto | FormData`

**On submit:**
- If file attached:
  ```typescript
  const formData = new FormData();
  formData.append('subcontractor_id', dto.subcontractor_id);
  formData.append('project_id', dto.project_id);
  formData.append('task_id', dto.task_id);
  formData.append('amount', String(dto.amount));
  if (dto.invoice_number) formData.append('invoice_number', dto.invoice_number);
  if (dto.invoice_date) formData.append('invoice_date', dto.invoice_date);
  if (dto.notes) formData.append('notes', dto.notes);
  formData.append('file', fileObject);
  await createSubcontractorInvoice(formData);
  ```
- Toast: "Subcontractor invoice created"
- Refresh list
- Close modal

---

### Task 3 — Status Transition Actions

**Approve Invoice (pending -> approved):**
- Confirm modal: "Approve invoice for $X,XXX from {subcontractor_name}?"
- Call `updateSubcontractorInvoice(id, { status: 'approved' })`
- Toast: "Invoice approved"
- Refresh list

**Mark as Paid (approved -> paid):**
- Confirm modal: "Mark invoice as paid? This confirms payment of $X,XXX to {subcontractor_name}."
- Call `updateSubcontractorInvoice(id, { status: 'paid' })`
- Toast: "Invoice marked as paid"
- Refresh list

**Edit Amount (pending only):**
- Small modal with MoneyInput pre-filled with current amount
- Only available when status is `"pending"` — amount CANNOT be changed after approved
- Call `updateSubcontractorInvoice(id, { amount: newAmount })`
- Toast: "Invoice amount updated"

---

### Task 4 — Invoice Detail Modal

When clicking "View", show full invoice details:
- All fields (subcontractor, project, task, amount, invoice number, date, status, notes)
- File attachment link (if `file_url` exists) — open/download
- Created by user and timestamp
- Status timeline (pending -> approved -> paid) with dates

---

### Task 5 — Per-Subcontractor Invoice View

**API Endpoint:** `GET /api/v1/subcontractors/:id/invoices`

Returns all invoices for a specific subcontractor (array, NOT paginated). Same object shape as list items.

This can be accessed from:
- A "View All Invoices" link when filtering by subcontractor
- Or from the subcontractor profile (if a workforce/subcontractor module exists)

Show as a simple list with status badges and amounts.

---

### Task 6 — Navigation Integration

Add "Subcontractor Invoices" to the financial sidebar navigation under an "AP" or "Workforce" group.

---

## Acceptance Criteria
- [ ] Invoice list loads with pagination
- [ ] Filters (subcontractor, project, status) work
- [ ] Create modal with all fields + file upload
- [ ] FormData correctly built when file attached
- [ ] Status badges (pending/approved/paid) displayed
- [ ] Approve action (pending -> approved) works
- [ ] Mark Paid action (approved -> paid) works
- [ ] Amount edit only available for pending status
- [ ] Forward-only status transitions enforced in UI
- [ ] File attachment link in detail view
- [ ] Per-subcontractor invoice list
- [ ] Amount formatted as currency (parsed from string)
- [ ] RBAC: Owner, Admin, Manager, Bookkeeper
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- `amount` is returned as **string** — `parseFloat()`
- Status transitions are FORWARD-ONLY: pending -> approved -> paid. Never backwards, never skip.
- Amount can only be changed while status is `"pending"`
- File upload uses `multipart/form-data` — same pattern as receipt upload
- `invoice_number` is the subcontractor's own reference number, NOT auto-generated
- The subcontractor nested object has `business_name` (not `name`) and `trade_specialty`
- Pagination uses `pages` field (NOT `total_pages`)
