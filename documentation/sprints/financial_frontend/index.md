# Sprints — Financial Module Frontend

**Total: 28 sprints | 109 API endpoints — 100% API client coverage + 100% UI coverage**
**Working Directory:** `/var/www/lead360.app/app/`
**API Documentation:** `/var/www/lead360.app/api/documentation/financial_REST_API.md`

---

## Sprint Dependency Graph

```
Sprint 1a (Types Part 1: Enums + Core)
  └── Sprint 1b (Types Part 2: Extended)
        └── Sprint 1c (API Client: All 109 functions)
              │
              ├── Sprint 2 (Navigation & Hub)
              │     ├── Sprint 3 (Categories Settings)        ← parallel with 4, 5
              │     ├── Sprint 4 (Payment Methods Settings)   ← parallel with 3, 5
              │     ├── Sprint 5 (Supplier Categories)        ← parallel with 3, 4
              │     │     └── Sprint 6 (Suppliers CRUD)
              │     │           └── Sprint 7 (Supplier Products)
              │     ├── Sprint 8 (Entries List)               ← parallel with 5, 13, 15, 19, 23
              │     │     ├── Sprint 9 (Entry Create/Edit Form)
              │     │     │     ├── Sprint 12 (Receipt OCR)
              │     │     │     └── Sprint 26 (Task-Level Ops) ← after 9 + 12
              │     │     ├── Sprint 10 (Approval Workflow)
              │     │     └── Sprint 11 (CSV Export)
              │     ├── Sprint 13 (Recurring Rules)           ← parallel with 8
              │     │     └── Sprint 14 (Recurring Actions)
              │     ├── Sprint 15 (Draw Milestones)           ← parallel with 8, 13
              │     │     └── Sprint 16 (Project Invoices)
              │     │           └── Sprint 17 (Invoice Payments)
              │     ├── Sprint 18 (Project Financial Intel)   ← parallel with 8, 13, 15
              │     ├── Sprint 19 (Dashboard P&L)             ← parallel with 8, 21
              │     │     └── Sprint 20 (Dashboard AR/AP/Forecast)
              │     ├── Sprint 21 (Account Mappings)          ← parallel with 19
              │     │     └── Sprint 22 (Accounting Exports)
              │     ├── Sprint 23 (Crew Hours & Payments)     ← parallel with 8, 13, 24
              │     ├── Sprint 24 (Subcontractor Invoices)    ← parallel with 23, 25
              │     └── Sprint 25 (Subcontractor Payments)    ← parallel with 24
```

---

## Sprint Index

| Sprint | Title | Depends On | Parallel With | Endpoints |
|--------|-------|------------|---------------|-----------|
| 1a | **Types — Core (Enums, Categories, Entries, Receipts, Pay Methods, Suppliers, Products)** | NONE | — | Types only |
| 1b | **Types — Extended (Recurring, Milestones, Invoices, Summary, Dashboard, Exports)** | 1a | — | Types only |
| 1c | **API Client Functions (All 109 Endpoints)** | 1a, 1b | — | All 109 |
| 2 | **Sidebar Navigation & Financial Hub Page** | 1c | — | 7 (dashboard) |
| 3 | **Financial Categories Settings Page** | 1c, 2 | 4, 5 | 4 |
| 4 | **Payment Methods Registry Settings Page** | 1c, 2 | 3, 5 | 6 |
| 5 | **Supplier Categories Management** | 1c, 2 | 3, 4 | 4 |
| 6 | **Suppliers List & Detail Page** | 1c, 2, 5 | — | 7 |
| 7 | **Supplier Products & Price History** | 1c, 6 | — | 5 |
| 8 | **Financial Entries List with Advanced Filters** | 1c, 2 | 5, 13, 15, 19, 23 | 3 |
| 9 | **Financial Entry Create/Edit Form** | 1c, 8 | — | 3 |
| 10 | **Expense Approval Workflow** | 1c, 2, 8 | — | 4 |
| 11 | **Financial Entry CSV Export** | 1c, 8 | 10 | 1 |
| 12 | **Receipt OCR Enhancement** | 1c, 9 | — | 8 |
| 13 | **Recurring Expense Rules List & Create** | 1c, 2 | 8, 15, 19, 23 | 5 |
| 14 | **Recurring Rules Actions & History** | 1c, 13 | — | 6 |
| 15 | **Draw Milestones Management** | 1c | 8, 13, 18 | 5 |
| 16 | **Project Invoices CRUD** | 1c, 15 | — | 8 |
| 17 | **Invoice Payments Recording** | 1c, 16 | — | 2 |
| 18 | **Project Financial Intelligence (F-07)** | 1c | 8, 13, 15, 19 | 5 |
| 19 | **Financial Dashboard — Overview & P&L** | 1c, 2 | 8, 21 | 4 |
| 20 | **Dashboard — AR, AP, Forecast & Alerts** | 1c, 19 | — | 4 |
| 21 | **Account Mappings Configuration** | 1c, 2 | 19 | 4 |
| 22 | **Accounting Exports (QuickBooks & Xero)** | 1c, 21 | — | 6 |
| 23 | **Crew Hours & Payments Management** | 1c, 2 | 8, 13, 24 | 6 |
| 24 | **Subcontractor Invoices CRUD** | 1c, 2 | 23, 25 | 4 |
| 25 | **Subcontractor Payments Recording** | 1c, 2 | 24 | 4 |
| 26 | **Task-Level Financial Operations** | 1c, 9, 12 | — | 5 |

---

## Execution Order (Recommended)

**Phase 1 — Foundation (Sequential, MUST complete in order):**
1. Sprint 1a → GATE STOP (types part 1 must compile)
2. Sprint 1b → GATE STOP (types part 2 must compile)
3. Sprint 1c → GATE STOP (API client must compile)
4. Sprint 2 → GATE STOP (navigation must work)

**Phase 2 — Settings & Registries (Parallel Group A):**
5. Sprint 3 (Categories) ← parallel
6. Sprint 4 (Payment Methods) ← parallel
7. Sprint 5 (Supplier Categories) ← parallel

**Phase 3 — Suppliers (Sequential):**
8. Sprint 6 (Suppliers)
9. Sprint 7 (Products)

**Phase 4 — Core Entries (Parallel Group B):**
10. Sprint 8 (Entries List) ← parallel with Phase 3
11. Sprint 9 (Entry Form) → after Sprint 8
12. Sprint 10 (Approvals) → after Sprint 8
13. Sprint 11 (CSV Export) → after Sprint 8

**Phase 5 — Receipts:**
14. Sprint 12 (Receipt OCR) → after Sprint 9

**Phase 6 — Recurring (Parallel Group C):**
15. Sprint 13 (Recurring List) ← parallel with Phase 4
16. Sprint 14 (Recurring Actions) → after Sprint 13

**Phase 7 — Revenue (Sequential):**
17. Sprint 15 (Milestones) ← parallel with Phase 4, 6
18. Sprint 16 (Invoices) → after Sprint 15
19. Sprint 17 (Payments) → after Sprint 16

**Phase 8 — Intelligence (Parallel Group D):**
20. Sprint 18 (Project Financial) ← parallel with Phase 4, 6, 7
21. Sprint 19 (Dashboard P&L) ← parallel with Phase 4
22. Sprint 20 (Dashboard AR/AP) → after Sprint 19

**Phase 9 — Exports (Sequential):**
23. Sprint 21 (Account Mappings) ← parallel with Sprint 19
24. Sprint 22 (Exports) → after Sprint 21

**Phase 10 — Workforce & AP (Parallel Group E):**
25. Sprint 23 (Crew Hours & Payments) ← parallel with Phase 4, 9
26. Sprint 24 (Subcontractor Invoices) ← parallel with Sprint 23
27. Sprint 25 (Subcontractor Payments) ← parallel with Sprint 24

**Phase 11 — Task Integration:**
28. Sprint 26 (Task-Level Operations) → after Sprint 9 + 12

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin (Platform) | ludsonaiello@gmail.com | 978@F32c |
| Tenant Owner | contact@honeydo4you.com | 978@F32c |

---

## RBAC Quick Reference (Verified Against API Doc Section 24)

| Action | Owner | Admin | Manager | Bookkeeper | Employee | Field |
|--------|-------|-------|---------|------------|----------|-------|
| Financial Categories CRUD | Yes | Yes | Yes | — | — | — |
| Financial Entries CRUD | Yes | Yes | Yes | Yes | Own only* | — |
| Entry Approval/Reject | Yes | Yes | Yes | Yes | — | — |
| Receipts CRUD | Yes | Yes | Yes | Yes | — | Upload+OCR |
| Payment Methods Create/Edit | Yes | Yes | — | Yes | — | — |
| Payment Methods Delete | Yes | Yes | — | — | — | — |
| Suppliers Create/Update | Yes | Yes | Yes | Yes | — | — |
| Suppliers Delete | Yes | Yes | — | Yes | — | — |
| Supplier Categories Delete | Yes | Yes | — | Yes | — | — |
| Recurring Rules CRUD | Yes | Yes | CRU | CRU | — | — |
| Recurring Rules Cancel | Yes | Yes | — | — | — | — |
| Draw Milestones CRUD | Yes | Yes | CRU | Read | — | — |
| Project Invoices CRUD | Yes | Yes | CRU | Read+Pay | — | — |
| Invoice Void | Yes | Yes | — | — | — | — |
| Crew Hours Log/Edit | Yes | Yes | Yes | — | — | — |
| Crew Hours List | Yes | Yes | Yes | Yes | — | — |
| Crew Payments Create | Yes | Yes | — | Yes | — | — |
| Crew Payment History | Yes | Yes | Yes | Yes | — | — |
| Sub Invoices CRUD | Yes | Yes | Yes | Yes | — | — |
| Sub Payments Create | Yes | Yes | — | Yes | — | — |
| Sub Payment History | Yes | Yes | Yes | Yes | — | — |
| Task Financials | Yes | Yes | Yes | Yes | — | Upload |
| Dashboard P&L/Forecast | Yes | Yes | — | Yes | — | — |
| Dashboard AR/AP | Yes | Yes | Yes | Yes | — | — |
| Account Mappings CRU | Yes | Yes | — | Yes | — | — |
| Account Mappings Delete | Yes | Yes | — | — | — | — |
| Exports | Yes | Yes | — | Yes | — | — |

*Employee: Can only see/edit/delete own entries; all entries forced to `pending_review`

---

## Coverage Summary

| API Section | Endpoints | API Client | UI Sprint(s) |
|-------------|-----------|------------|--------------|
| Financial Categories | 4 | 1a-c | 3 |
| Financial Entries | 10 | 1a-c | 8, 9, 10, 11 |
| Receipts & OCR | 8 | 1a-c | 12 |
| Payment Methods | 6 | 1a-c | 4 |
| Suppliers | 7 | 1a-c | 6 |
| Supplier Categories | 4 | 1a-c | 5 |
| Supplier Products | 5 | 1a-c | 7 |
| Recurring Rules | 11 | 1b-c | 13, 14 |
| Draw Milestones | 5 | 1b-c | 15 |
| Project Invoices | 8 | 1b-c | 16, 17 |
| Project Financial Summary | 5 | 1b-c | 18 |
| Task-Level Operations | 5 | 1a-c | **26** |
| Crew Hours | 3 | 1a-c | **23** |
| Crew Payments | 3 | 1a-c | **23** |
| Subcontractor Invoices | 4 | 1a-c | **24** |
| Subcontractor Payments | 4 | 1a-c | **25** |
| Dashboard | 7 | 1b-c | 19, 20 |
| Account Mappings | 4 | 1b-c | 21 |
| Accounting Exports | 6 | 1b-c | 22 |
| **TOTAL** | **109** | **All 28** | **All 28** |

---

## Review Fixes Applied

### v2 Fixes
| Sprint | Issue | Fix Applied |
|--------|-------|------------|
| 1 | Too large (1532 lines) | Split into 1a (types core), 1b (types extended), 1c (API client) |
| 4 | Delete RBAC: said Bookkeeper can delete | Fixed: Owner, Admin ONLY for delete |
| 5 | Delete RBAC: said Owner/Admin only | Fixed: Owner, Admin, Bookkeeper for delete |
| 6 | Delete RBAC: included Manager | Fixed: Manager CANNOT delete suppliers |
| 12 | Missing required fields for create-entry-from-receipt | Fixed: Added `project_id` (REQUIRED) and `category_id` (REQUIRED) |
| 13 | Preview shown as part of list response | Fixed: Clarified preview is SEPARATE API call |
| 13 | Missing auto-populate rule for day fields | Fixed: Added helper text about day auto-population |
| 16 | Missing Bookkeeper in invoice read access | Fixed: Added Bookkeeper to list/read/payment roles |

### v3 Fixes (Audit Review)
| Sprint | Issue | Fix Applied |
|--------|-------|------------|
| 6 | `address_line_1` vs API's `address_line1` | Fixed: Added explicit API field name column with note about no underscore |
| 1c | `getProjectReceipts` reused `ListReceiptsParams` with `project_id` | Fixed: Inline params type without `project_id`/`task_id` + explanatory comment |
| 8 | Acceptance criteria said "13 filters" | Fixed: Changed to "14 filters" with explicit list |
| 12 | Missing Field role in RBAC | Fixed: Added explicit RBAC section with Field role for upload + OCR status |
| 21 | Delete RBAC not explicit for Bookkeeper | Fixed: Added "Owner, Admin ONLY" note on delete task |
| — | 19 endpoints had API client but NO UI sprints | Fixed: Added Sprints 23 (Crew), 24 (Sub Invoices), 25 (Sub Payments), 26 (Task Ops) |
| — | Index claimed 100% coverage but had UI gaps | Fixed: Updated to 28 sprints with true 100% UI + API coverage |
| — | RBAC table missing Crew/Sub/Task/Field rows | Fixed: Added all missing rows + Field column |
| — | Coverage summary didn't distinguish API vs UI | Fixed: Split into "API Client" and "UI Sprint(s)" columns |
