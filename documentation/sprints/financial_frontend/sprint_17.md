# Sprint 17 — Invoice Payments Recording
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_17.md
**Type:** Frontend — Feature Enhancement
**Depends On:** Sprint 1, Sprint 16
**Gate:** NONE
**Estimated Complexity:** Low

---

## Objective

Build the payment recording flow for project invoices. When a client pays (full or partial), users record the payment which updates the invoice balance and status automatically.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Sections 14.7, 14.8.
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

# List payments for an invoice
curl -s "http://localhost:8000/api/v1/projects/PROJECT_ID/invoices/INVOICE_ID/payments" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Record Payment Modal

Wire the "Record Payment" button from Sprint 16's invoice cards.

**Modal:**
- Title: "Record Payment — INV-XXXX"
- Show invoice summary: Amount: $27,500 | Paid: $15,000 | Remaining: $12,500

**Form fields:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Amount | MoneyInput | Yes | Min $0.01. Pre-fill with `amount_due` |
| Payment Date | DatePicker | Yes | Default: today |
| Payment Method | Select | Yes | 8 payment method types |
| Payment Account | Select with search | No | From payment methods registry |
| Reference Number | Input | No | Max 200 chars (check #, transaction ID) |
| Notes | Textarea | No | Max 5000 chars |

**Quick-fill button:** "Pay Full Balance" → sets amount to `amount_due`

**On submit:**
- Call `recordInvoicePayment(projectId, invoiceId, dto)`
- Toast: "Payment of $XX,XXX recorded for INV-XXXX"
- If invoice is now fully paid, show additional toast: "Invoice INV-XXXX marked as paid!"
- Refresh invoice list
- Close modal

---

### Task 2 — Payment History in Invoice Detail

In the invoice detail modal (Sprint 16 Task 6), add a payments section:

**API:** `getInvoicePayments(projectId, invoiceId)` → Array

**Layout:**
```
── Payment History ──
┌──────────────────────────────────────────┐
│ Apr 10, 2026 | $15,000 | Check #4521    │
│ Recorded by: Ludson Menezes              │
├──────────────────────────────────────────┤
│ Apr 25, 2026 | $12,500 | ACH            │
│ Ref: TXN-889922 | Notes: Final payment  │
│ Recorded by: Ludson Menezes              │
└──────────────────────────────────────────┘

Total Payments: 2 | Total Paid: $27,500
```

Show each payment with: date, amount, method, reference number, notes, recorded by.

If no payments: "No payments recorded yet."

---

### Task 3 — Payment Progress Bar

On each invoice card in the list (Sprint 16), add a visual progress bar showing payment progress:

```
[$27,500 total]
████████████░░░░░░░  $15,000 paid (54.5%)
```

- Green fill for percentage paid
- Show dollar amount and percentage
- Full green when 100% paid

---

## Acceptance Criteria
- [ ] Record Payment modal opens from invoice list
- [ ] Pre-fills amount with remaining balance
- [ ] "Pay Full Balance" quick-fill button
- [ ] Payment method select with 8 options
- [ ] Payment account select (from registry)
- [ ] Reference number input
- [ ] Payment recorded successfully via API
- [ ] Invoice status auto-updates (partial → paid)
- [ ] Payment history in invoice detail
- [ ] Progress bar on invoice cards
- [ ] RBAC: Owner, Admin, Manager, Bookkeeper
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- `amount` from API is a string — parse with parseFloat()
- When `amount_due` reaches 0, backend auto-sets status to `paid`
- If payment makes `amount_due` > 0 but < total, status goes to `partial`
- `payment_method` uses the same 8-value enum
- Payments array is not paginated — flat array
