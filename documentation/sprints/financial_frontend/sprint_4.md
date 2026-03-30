# Sprint 4 — Payment Methods Registry Settings Page
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_4.md
**Type:** Frontend — Settings CRUD Page
**Depends On:** Sprint 1, Sprint 2
**Gate:** NONE
**Estimated Complexity:** Low

---

## Objective

Build the Payment Methods management page in Settings. This allows users to register their payment accounts (credit cards, bank accounts, etc.) which can be linked to financial entries for tracking which account was used for each purchase.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 8 (Payment Method Registry).
- **Follow the exact same patterns** already used in the codebase.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Pre-Sprint Checklist
- [ ] Read Section 8 of financial_REST_API.md
- [ ] Sprint 1 types include `PaymentMethodRegistry`, `CreatePaymentMethodDto`, etc.
- [ ] Sprint 1 API client includes `getPaymentMethods`, `createPaymentMethod`, etc.

---

## Dev Server

```
Ensure backend is running on port 8000.

TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

curl -s http://localhost:8000/api/v1/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Create Payment Methods Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/settings/payment-methods/page.tsx`

**API Endpoints Used:**
- `GET /financial/payment-methods` → List all methods (flat array, not paginated)
- `POST /financial/payment-methods` → Create
- `GET /financial/payment-methods/:id` → Get single
- `PATCH /financial/payment-methods/:id` → Update
- `DELETE /financial/payment-methods/:id` → Soft-delete
- `POST /financial/payment-methods/:id/set-default` → Set as default

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Payment Methods                [+ Add Method]   │
│                                                   │
│  ┌─────────────────────────────────────────┐     │
│  │ 💳 Chase Business Visa        ⭐ Default │     │
│  │ Type: Credit Card | Bank: Chase          │     │
│  │ Last 4: •••• 4521 | Used: 15 times      │     │
│  │ Last used: Mar 15, 2026                  │     │
│  │              [Set Default] [Edit] [Delete]│     │
│  ├─────────────────────────────────────────┤     │
│  │ 🏦 Business Checking                    │     │
│  │ Type: Bank Transfer | Bank: BOA          │     │
│  │ Last 4: •••• 7890 | Used: 3 times       │     │
│  │              [Set Default] [Edit] [Delete]│     │
│  └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

**Features:**
1. Card-style list of payment methods
2. Each card shows: icon (based on type), nickname, type badge, bank name, last 4 (masked), usage count, last used date
3. Default method has a star badge
4. "Set Default" button (hidden on current default)
5. Edit button opens modal
6. Delete button with ConfirmModal
7. Create button opens modal
8. Filter by type (optional, dropdown)
9. Show inactive toggle (to see deactivated methods)
10. RBAC: Owner, Admin, Bookkeeper for create/edit; Owner, Admin ONLY for delete; others read-only
11. Max 50 active methods per tenant — show count "X/50 active"

---

### Task 2 — Create/Edit Payment Method Modal

**Form fields:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Nickname | Input | Yes | Max 100 chars, unique |
| Type | Select | Yes | 8 payment method types |
| Bank Name | Input | No | Max 100 chars |
| Last Four | Input (masked) | No | Exactly 4 digits |
| Notes | Textarea | No | Free text |
| Set as Default | Checkbox/Toggle | No | Default: false |

**Type options:**
```
cash → "Cash"
check → "Check"
bank_transfer → "Bank Transfer"
venmo → "Venmo"
zelle → "Zelle"
credit_card → "Credit Card"
debit_card → "Debit Card"
ACH → "ACH"
```

**Last Four field:** Use a masked input that only accepts 4 digits. Display as `•••• XXXX` in the card view.

**Validation:**
- Nickname required, not empty, **unique within tenant (case-insensitive)**
- Type required
- Last four: if provided, must be exactly 4 digits (`/^\d{4}$/`)

**On submit:**
- `createPaymentMethod()` or `updatePaymentMethod()`
- Toast success/error
- Refresh list

---

### Task 3 — Set Default Action

When clicking "Set Default":
- Call `setDefaultPaymentMethod(id)`
- Toast: "✓ {nickname} set as default payment method"
- Refresh list (the old default will lose its default status)
- No confirmation modal needed — it's non-destructive

---

### Task 4 — Delete Confirmation

ConfirmModal:
- Title: "Deactivate Payment Method"
- Message: "Are you sure you want to deactivate '{nickname}'? It will no longer be available for new entries. Existing entries using this method will not be affected."
- Variant: "danger"
- If it's the default method, add warning: "This is your default payment method. The default will be cleared."
- Call `deletePaymentMethod(id)` on confirm

---

### Task 5 — Payment Method Type Icons

Map types to icons:
```
cash → Banknote
check → FileCheck
bank_transfer → Building2
venmo → Smartphone
zelle → Zap
credit_card → CreditCard
debit_card → CreditCard
ACH → ArrowLeftRight
```

---

## Acceptance Criteria
- [ ] Page loads at `/settings/payment-methods`
- [ ] Shows all payment methods from API
- [ ] Create modal creates new method
- [ ] Edit modal updates existing method
- [ ] Last four digits masked input works
- [ ] Set Default action works
- [ ] Default method shows star indicator
- [ ] Delete with confirmation works
- [ ] Usage count and last used date displayed
- [ ] Type-specific icons shown
- [ ] "X/50 active" counter displayed
- [ ] RBAC enforced
- [ ] Mobile responsive, dark mode
- [ ] Toast notifications for all actions
- [ ] No backend code modified

---

## Handoff Notes
- Payment methods list is flat array (not paginated)
- `is_default: true` indicates the default — only one can be default at a time
- `usage_count` and `last_used_date` are computed by the backend
- Payment methods are referenced in financial entries via `payment_method_registry_id`
