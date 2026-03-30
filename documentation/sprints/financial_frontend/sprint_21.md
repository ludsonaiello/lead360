# Sprint 21 — Account Mappings Configuration
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_21.md
**Type:** Frontend — Settings Page
**Depends On:** Sprint 1, Sprint 2
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Build the Account Mappings configuration page within the Exports section. Users map their Lead360 financial categories to their accounting software's chart of accounts (QuickBooks or Xero) for cleaner CSV exports.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 22 (Account Mappings).
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

# List account mappings
curl -s "http://localhost:8000/api/v1/financial/export/account-mappings" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Get default mappings preview for QuickBooks
curl -s "http://localhost:8000/api/v1/financial/export/account-mappings/defaults?platform=quickbooks" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Account Mappings Page

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/exports/mappings/page.tsx`

Or as a section/tab within the exports page.

**API Endpoints:**
- `GET /financial/export/account-mappings` → List all custom mappings
- `GET /financial/export/account-mappings/defaults?platform=X` → Preview all categories with mapping status
- `POST /financial/export/account-mappings` → Create or update (upsert)
- `DELETE /financial/export/account-mappings/:id` → Delete mapping

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Account Mappings                                     │
│                                                       │
│  Platform: [QuickBooks ▼]                             │
│                                                       │
│  Map your Lead360 categories to your accounting       │
│  software accounts for cleaner exports.               │
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ Lead360 Category    │ Account Name │ Code │ ✏️ 🗑️│ │
│  ├─────────────────────┼──────────────┼──────┼──────┤│
│  │ Labor - General     │ Labor - Gen* │ —    │   ✏️ ││
│  │ (labor, COGS)       │ (default)    │      │      ││
│  ├─────────────────────┼──────────────┼──────┼──────┤│
│  │ Materials - General │ Job Materials│ 5100 │ ✏️ 🗑️││
│  │ (material, COGS)    │ (custom)     │      │      ││
│  ├─────────────────────┼──────────────┼──────┼──────┤│
│  │ Insurance           │ Insurance*   │ —    │   ✏️ ││
│  │ (insurance, OpEx)   │ (default)    │      │      ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  * Default = category name used as account name       │
│  Custom mappings shown in bold                        │
└──────────────────────────────────────────────────────┘
```

**Features:**
1. **Platform selector:** QuickBooks or Xero toggle/dropdown
2. **Defaults preview:** Shows ALL categories with their mapping status
3. **Custom vs default indicator:** Bold/badge for custom mappings
4. **Edit button** on every row — opens mapping modal
5. **Delete button** only on custom mappings — removes custom, reverts to default
6. **Table view** with columns: Category (name + type + classification), Account Name, Account Code, Actions

When platform changes, reload defaults preview.

---

### Task 2 — Create/Edit Mapping Modal

**Form fields:**
| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Category | Read-only (pre-selected) | — | Shows the category being mapped |
| Platform | Read-only (pre-selected) | — | Shows current platform |
| Account Name | Input | Yes | Max 200 chars |
| Account Code | Input | No | Max 50 chars |

**On submit:**
- Call `createAccountMapping({ category_id, platform, account_name, account_code })`
- This is an upsert — creates or updates the mapping
- Toast: "Account mapping saved for {category_name}"
- Refresh the defaults list

**Edit mode:** Pre-populate with existing custom mapping values.

---

### Task 3 — Delete Mapping

**RBAC: Owner, Admin ONLY** — Bookkeeper can create/read/update mappings but CANNOT delete them (per API Section 22.4). Hide the delete button for Bookkeeper role.

**ConfirmModal:**
- Title: "Remove Custom Mapping"
- Message: "Remove the custom mapping for '{category_name}'? Exports will use the category name as the account name."
- On confirm: `deleteAccountMapping(id)` → 204 No Content
- Refresh list

---

## Acceptance Criteria
- [ ] Platform selector switches between QuickBooks and Xero
- [ ] All categories shown with mapping status
- [ ] Custom mappings visually distinct from defaults
- [ ] Edit modal creates/updates mappings (upsert)
- [ ] Delete removes custom mapping, reverts to default
- [ ] Category type and classification shown
- [ ] RBAC: Owner, Admin, Bookkeeper
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Defaults endpoint shows ALL categories — custom mappings have `has_custom_mapping: true`
- Creating a mapping for a category+platform that already exists updates it (upsert)
- Without a custom mapping, exports use the category name as the account name
- Account codes are optional — some accounting software doesn't use them
