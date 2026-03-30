# Sprint 9 — Financial Entry Create/Edit Form
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_9.md
**Type:** Frontend — Form (Modal)
**Depends On:** Sprint 1, Sprint 8
**Gate:** NONE
**Estimated Complexity:** High

---

## Objective

Build the comprehensive Financial Entry create and edit form as a modal. This is the main expense/income entry form with all fields including the new F-04 enhancements: suppliers, payment methods, submission status, purchased-by tracking.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 6.1 (Create), 6.5 (Update).
- **This is a short-medium form → use a large modal (xl size).**
- **Always use icons, masked-inputs, auto-fill, select with search.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Get categories for the form
curl -s http://localhost:8000/api/v1/settings/financial-categories \
  -H "Authorization: Bearer $TOKEN" | jq '.[0:3]'

# Get payment methods
curl -s http://localhost:8000/api/v1/financial/payment-methods \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Get suppliers for select
curl -s "http://localhost:8000/api/v1/financial/suppliers?limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0:3]'

# Get projects for select
curl -s "http://localhost:8000/api/v1/projects?limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0:3]'

# Test create entry
curl -s -X POST http://localhost:8000/api/v1/financial/entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category_id":"CATEGORY_UUID","entry_type":"expense","amount":100,"entry_date":"2026-03-25"}' | jq '.'
```

---

## Tasks

### Task 1 — Create/Edit Entry Modal Component

**Component:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/entries/components/EntryFormModal.tsx`

Or place it in a shared location if it will be reused in project financial tabs.

**Props:**
```typescript
interface EntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry?: FinancialEntry | null; // null = create mode
  defaultProjectId?: string; // pre-fill when opened from project context
  defaultTaskId?: string;
}
```

---

### Task 2 — Form Fields Layout

**Modal size:** `xl` (extra large)

**Section 1 — Core (Required):**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Entry Type | Toggle buttons (Expense / Income) | Yes | Default: expense. Two styled buttons, not a dropdown |
| Category | Select with search | Yes | Grouped by type (Labor, Material, etc.) |
| Amount | MoneyInput | Yes | Min $0.01 |
| Tax Amount | MoneyInput | No | Must be < amount |
| Entry Date | DatePicker | Yes | Default: today |
| Entry Time | Input (HH:MM:SS) | No | Time mask, max 8 chars. Accept HH:MM or HH:MM:SS |

**Section 2 — Project Link (Optional):**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Project | Select with search | No | Load from projects API |
| Task | Select with search | No | Load tasks from project when project selected |

**Task auto-populate:** When a project is selected, fetch its tasks and populate the task dropdown. If no project, task is disabled.

**Section 3 — Vendor/Supplier (Optional):**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Supplier | Select with search | No | From suppliers API. When selected, fills vendor_name |
| Vendor Name | Input | No | Free text. Auto-filled from supplier but editable |

**Auto-fill behavior:** When a supplier is selected from the dropdown:
1. Set `supplier_id` to the selected supplier's ID
2. Auto-fill `vendor_name` with the supplier's name
3. User can still manually edit the vendor name

**Section 4 — Payment (Optional):**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Payment Method (type) | Select | No | 8 enum types |
| Payment Account | Select with search | No | From payment methods API. Shows nickname + last four |

**Auto-fill behavior:** When a payment account is selected:
1. Set `payment_method_registry_id` to the selected method's ID
2. Auto-fill the payment method type from the registry record's type
3. Show the selected account info: "Chase Visa •••• 4521"

**Section 5 — Purchased By (Optional):**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Purchased By | Radio: "Team Member" / "Crew Member" / "None" | No | Mutually exclusive |
| User | Select with search | Conditional | Show only if "Team Member" selected |
| Crew Member | Select with search | Conditional | Show only if "Crew Member" selected |

**Mutual exclusivity:** `purchased_by_user_id` and `purchased_by_crew_member_id` cannot both be set. The radio group ensures only one is active.

Load users from existing user/team API. Load crew members from `/crew` API.

**Section 6 — Notes:**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Notes | Textarea | No | Max 2000 chars |

**Section 7 — Submission Status (for non-Employee roles):**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Submit as Pending | Checkbox | No | Default: unchecked (= confirmed) |

Show this only for Owner/Admin/Manager/Bookkeeper. When checked, sets `submission_status: "pending_review"`.
For Employee role, this is forced and hidden — all entries go to pending.

---

### Task 3 — Form Validation

**Client-side validation before submit:**
1. Category is required
2. Entry type is required
3. Amount > 0
4. Entry date is required and valid
5. Tax amount (if provided) must be < amount
6. If task_id is set, project_id must also be set
7. purchased_by_user_id and purchased_by_crew_member_id cannot both be set

**Show field-level errors** under each invalid field.

---

### Task 4 — Submission Logic

**Create mode:**
1. Build `CreateFinancialEntryDto` from form state
2. Call `createFinancialEntry(dto)`
3. On success: `toast.success('Entry created successfully')`, call `onSuccess()`, close modal
4. On error: `toast.error(message)`, keep modal open

**Edit mode:**
1. Build `UpdateFinancialEntryDto` with only changed fields
2. Call `updateFinancialEntry(id, dto)`
3. On success: `toast.success('Entry updated successfully')`, call `onSuccess()`, close modal
4. On error: `toast.error(message)`, keep modal open

**Loading states:** Disable submit button and show spinner during API call.

---

### Task 5 — Load Form Data on Mount

When modal opens, load in parallel:
1. Financial categories → for category select
2. Payment methods → for payment account select
3. Suppliers (first 100) → for supplier select
4. Projects (first 100) → for project select
5. Users/team members → for purchased-by select
6. Crew members → for purchased-by select

If editing, also load the entry detail (if not already passed as prop).

Show a small loading indicator inside the modal while data loads.

---

### Task 6 — Integrate with Entry List Page

Wire the form modal into the Sprint 8 entries list page:
- "New Entry" button → opens modal in create mode
- "Edit" button on entry card → opens modal in edit mode with entry data
- On success (create or edit) → refresh the entry list

---

## Acceptance Criteria
- [ ] Modal opens for both create and edit modes
- [ ] All form fields render correctly
- [ ] Category select grouped by type
- [ ] MoneyInput for amount and tax
- [ ] Project → Task cascading selects work
- [ ] Supplier selection auto-fills vendor name
- [ ] Payment account auto-fills payment method type
- [ ] Purchased-by radio group with conditional fields
- [ ] Submission status checkbox for non-Employee roles
- [ ] Client-side validation with field-level errors
- [ ] Create and update API calls work
- [ ] Toast notifications on success/error
- [ ] Loading states during submission
- [ ] Form data loads in parallel on mount
- [ ] Edit mode pre-populates all fields
- [ ] Mobile responsive (scrollable modal)
- [ ] Dark mode support
- [ ] No backend code modified

---

## Handoff Notes
- Entry type toggle (expense/income) affects what categories are relevant
- Amount from API is string — convert to number for MoneyInput default value
- `purchased_by_user_id` and `purchased_by_crew_member_id` are mutually exclusive
- Employee role always gets `pending_review` status — hide the checkbox for them
- When editing, send only changed fields to avoid unnecessary validation errors
