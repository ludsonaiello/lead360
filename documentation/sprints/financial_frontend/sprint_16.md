# Sprint 16 — Project Invoices CRUD
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_16.md
**Type:** Frontend — Project Sub-Tab
**Depends On:** Sprint 1, Sprint 15
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Build the Project Invoices management as part of the project financial tab. Invoices are sent to clients for project work. They can be standalone or generated from milestones. Includes full lifecycle: create → send → record payments → paid/void.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 14 (Project Invoices).
- **Short forms use modals.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# List invoices for a project
curl -s "http://localhost:8000/api/v1/projects/PROJECT_ID/invoices" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Project Invoices Sub-Tab

Add or enhance the "Invoices" sub-tab in the project financial tab.

**Component:** `ProjectInvoicesSection.tsx` in the financial components directory.

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Project Invoices                    [+ New Invoice]  │
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Total    │ │ Collected│ │ Outstand-│ │ Invoice  ││
│  │ Invoiced │ │          │ │ ing      │ │ Count    ││
│  │ $55,000  │ │ $27,500  │ │ $27,500  │ │ 2        ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│                                                       │
│  Filter: [Status ▼] [Date From] [Date To]            │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │ 📄 INV-0001                    ● Sent        │    │
│  │ 50% at framing complete                      │    │
│  │ Amount: $27,500 | Due: Apr 15, 2026         │    │
│  │ Paid: $15,000 | Remaining: $12,500          │    │
│  │ Milestone: Draw #1                           │    │
│  │                                               │    │
│  │ [💰 Record Payment] [📤 Mark Sent] [View]    │    │
│  ├──────────────────────────────────────────────┤    │
│  │ 📄 INV-0002                    📝 Draft       │    │
│  │ Progress billing - Phase 2                    │    │
│  │ Amount: $15,000 | Due: May 30, 2026          │    │
│  │ Paid: $0 | Remaining: $15,000               │    │
│  │                                               │    │
│  │ [✏️ Edit] [📤 Send] [🚫 Void] [View]        │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  [← Previous]  Page 1 of 1  [Next →]                │
└──────────────────────────────────────────────────────┘
```

**Features:**
1. Summary cards: total invoiced, collected, outstanding, count
2. Status filter, date range filter
3. Pagination (uses `totalPages` camelCase!) — use `getPageCount(meta)` helper
3b. RBAC: Owner/Admin/Manager for create/edit/send/void; Owner/Admin/Manager/**Bookkeeper** for list/read/payment recording
4. Card view with invoice details
5. Status badges with colors
6. Action buttons based on status

**Invoice status badges:**
- `draft` → gray "Draft"
- `sent` → blue "Sent"
- `partial` → orange "Partial"
- `paid` → green "Paid"
- `voided` → red/strikethrough "Voided"

**Action buttons per status:**
| Status | Actions |
|--------|---------|
| draft | Edit, Send, Void, View |
| sent | Record Payment, Void, View |
| partial | Record Payment, View |
| paid | View |
| voided | View |

---

### Task 2 — Create Invoice Modal

**Form fields:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Description | Input | Yes | 1-500 chars |
| Amount | MoneyInput | Yes | Min $0.01 |
| Tax Amount | MoneyInput | No | Min $0 |
| Due Date | DatePicker | No | Date |
| Notes | Textarea | No | Max 5000 chars |

Auto-generates invoice number (done by backend). Starts in `draft` status.

---

### Task 3 — Edit Invoice Modal

Same fields as create. Only for `draft` status. Pre-populate from invoice data.

If not draft, show error: "Only draft invoices can be edited."

---

### Task 4 — Send Invoice Action

**ConfirmModal:**
- Title: "Mark Invoice as Sent"
- Message: "Mark INV-XXXX as sent? This indicates the invoice has been delivered to the client."
- Note: "Invoice total: $XX,XXX"
- Confirm button: "Mark as Sent"

**On confirm:**
- Call `sendInvoice(projectId, invoiceId)`
- Toast: "Invoice INV-XXXX marked as sent"
- Refresh list

---

### Task 5 — Void Invoice Action

**RBAC:** Owner, Admin only

**ConfirmModal (danger):**
- Title: "Void Invoice"
- **Required field:** Reason for voiding (textarea, 1-500 chars)
- Warning: "This action cannot be undone. The invoice will be permanently voided."
- Only for `draft` or `sent` status (not partial/paid)

**On confirm:**
- Call `voidInvoice(projectId, invoiceId, { voided_reason })`
- Toast: "Invoice INV-XXXX voided"
- Refresh list

---

### Task 6 — Invoice Detail Modal

When clicking "View", show full invoice details:
- All invoice fields
- Milestone link (if from milestone)
- Payment history table
- Status timeline (created → sent → payments → paid)
- Voided info (if voided)

---

## Acceptance Criteria
- [ ] Invoices sub-tab in project financial
- [ ] Summary cards with totals
- [ ] Status filter and date filter
- [ ] Pagination with `totalPages` (camelCase)
- [ ] Create invoice modal
- [ ] Edit invoice (draft only)
- [ ] Send action with confirmation
- [ ] Void action with required reason (Owner/Admin, draft/sent only)
- [ ] Status badges correctly colored
- [ ] Action buttons match invoice status
- [ ] Invoice detail modal
- [ ] Amounts formatted as currency
- [ ] RBAC enforced
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Invoice numbers are auto-generated (INV-0001, etc.)
- This endpoint uses `totalPages` (camelCase) in pagination meta!
- `amount_paid` and `amount_due` are strings — parse to numbers
- When `amount_due` reaches 0, status auto-changes to `paid`
- Voided invoices have `voided_at` and `voided_reason`
- Milestone link shows which draw schedule milestone generated this invoice
