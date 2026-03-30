# Sprint 15 — Draw Milestones Management
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_15.md
**Type:** Frontend — Project Sub-Tab
**Depends On:** Sprint 1
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Build the Draw Milestones management as part of the project financial tab. Milestones represent billing stages (e.g., "50% at framing complete") that can generate invoices. They are typically seeded from the quote's draw schedule.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 13 (Draw Milestones).
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

# List milestones for a project
curl -s "http://localhost:8000/api/v1/projects/PROJECT_ID/milestones" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Milestones Sub-Tab in Project Financial

Add a "Milestones" sub-tab to the project financial tab. Read the existing financial tab structure:
- `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/components/financial/FinancialTab.tsx`

Add the Milestones tab alongside existing tabs (Overview, Costs, Receipts, etc.)

**Component:** `MilestonesSection.tsx` in the financial components directory.

**API Endpoints:**
- `GET /projects/:projectId/milestones` → Array (not paginated)
- `POST /projects/:projectId/milestones` → Create
- `PATCH /projects/:projectId/milestones/:id` → Update
- `DELETE /projects/:projectId/milestones/:id` → Delete
- `POST /projects/:projectId/milestones/:id/invoice` → Generate invoice

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Draw Schedule                  [+ Add Milestone] │
│                                                    │
│  Contract Value: $55,000                           │
│  Total Milestone Value: $55,000 (100%)             │
│                                                    │
│  ┌────┬────────────────────┬───────┬──────┬──────┐│
│  │ #  │ Description        │ Type  │Amount│Status││
│  ├────┼────────────────────┼───────┼──────┼──────┤│
│  │ 1  │ 50% at framing     │ 50%   │$27.5K│ ○    ││
│  │    │                    │       │      │Pending││
│  │    │              [Generate Invoice] [Edit] [🗑️]││
│  ├────┼────────────────────┼───────┼──────┼──────┤│
│  │ 2  │ 50% at completion  │ 50%   │$27.5K│ ●    ││
│  │    │                    │       │      │Invoiced│
│  │    │              INV-0001 →    [View Invoice]  ││
│  └────┴────────────────────┴───────┴──────┴──────┘│
└──────────────────────────────────────────────────┘
```

**Features:**
1. List all milestones ordered by `draw_number`
2. Show progress indicator (pending → invoiced → paid)
3. Total milestone value vs contract value comparison
4. Warning if total exceeds or doesn't equal contract value
5. Create button for adding new milestones
6. Edit button (only for `pending` status)
7. Delete button (only for `pending` status, Owner/Admin only)
8. "Generate Invoice" button (only for `pending` status)
9. Link to invoice (for `invoiced`/`paid` status)

**Status display:**
- `pending` → hollow circle, gray "Pending"
- `invoiced` → filled circle, blue "Invoiced" + invoice link
- `paid` → checkmark circle, green "Paid"

---

### Task 2 — Create/Edit Milestone Modal

**Form fields:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Draw Number | Number input | Yes | Integer, min 1, unique per project |
| Description | Input | Yes | 1-255 chars |
| Calculation Type | Toggle: Percentage / Fixed Amount | Yes | |
| Value | Number input | Yes | Min 0.01 (max 100 for %) |
| Calculated Amount | MoneyInput (read-only or editable) | Conditional | Auto-calculated for % |
| Notes | Textarea | No | Max 5000 chars |

**Calculation logic (client-side preview):**
- If `percentage`: `calculated_amount = (value / 100) * contract_value`
- If `fixed_amount`: `calculated_amount = value`
- Show the calculated amount as a read-only preview
- Allow override with `calculated_amount` field

**Edit restrictions:**
- `calculated_amount` BLOCKED if status is `invoiced` or `paid`

---

### Task 3 — Generate Invoice from Milestone Modal

When clicking "Generate Invoice" on a pending milestone:

**Modal:**
- Title: "Generate Invoice from Milestone"
- Show: Draw #1 — "50% at framing complete" — $27,500
- Fields:
  | Field | Component | Required | Default |
  |-------|-----------|----------|---------|
  | Description | Input | No | Milestone description |
  | Due Date | DatePicker | No | None |
  | Tax Amount | MoneyInput | No | $0 |
  | Notes | Textarea | No | None |
- Generate button

**On confirm:**
- Call `generateMilestoneInvoice(projectId, milestoneId, dto)`
- Toast: "Invoice INV-XXXX generated from milestone"
- Milestone status changes to `invoiced`
- Refresh milestones list

---

## Acceptance Criteria
- [ ] Milestones sub-tab appears in project financial
- [ ] Milestones listed by draw_number
- [ ] Contract value and total comparison shown
- [ ] Create milestone modal works
- [ ] Percentage/fixed calculation preview
- [ ] Edit modal (pending only)
- [ ] Delete with confirmation (pending only)
- [ ] Generate Invoice modal creates invoice
- [ ] Status badges (pending/invoiced/paid)
- [ ] Invoice link for invoiced/paid milestones
- [ ] RBAC: Owner/Admin/Manager for CRUD
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Milestones are not paginated — flat array ordered by draw_number
- `value` and `calculated_amount` are strings (decimal) — parse to number
- `quote_draw_entry_id` indicates it was seeded from a quote — show "From Quote" badge
- Generate invoice creates a project invoice (Sprint 16) and updates milestone status
