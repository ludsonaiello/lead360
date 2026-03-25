# Financial Entry Engine (F-04) Architecture — Lead360

**Status**: Active
**Last Updated**: 2026-03-20
**Sprint Coverage**: F-01 (foundation) through F-04 (general expense engine)
**Verified Against**: Live running code and HTTP responses

---

## Overview

The Financial Entry Engine is the core expense/income recording system for Lead360. It supports both **project-scoped entries** (linked to a project/task) and **business-level overhead entries** (no project). It implements a two-tier submit/post workflow where Employee-created entries require approval from privileged roles before being confirmed.

This module was rebuilt in F-04 from the simpler Gate 1 implementation to support the full general expense engine with role-based access control, pending workflow, CSV export, and enriched response shapes.

---

## Data Model

### financial_entry

| Field | Type | Required | Description | Notes |
|-------|------|----------|-------------|-------|
| id | VARCHAR(36) UUID | yes | Primary key | Auto-generated |
| tenant_id | VARCHAR(36) UUID | yes | Tenant isolation | Never from client — JWT only |
| project_id | VARCHAR(36) UUID | no | Linked project | null = business-level overhead |
| task_id | VARCHAR(36) UUID | no | Linked task | Requires project_id |
| category_id | VARCHAR(36) UUID | yes | Financial category FK | Must be active, same tenant |
| entry_type | enum | yes | `expense` or `income` | Default: expense |
| amount | DECIMAL(12,2) | yes | Entry amount | Must be > 0 |
| tax_amount | DECIMAL(10,2) | no | Tax amount | Must be < amount when present |
| entry_date | DATE | yes | Date of entry | Cannot be future |
| entry_time | TIME | no | Time of entry | Stored as TIME(0) |
| vendor_name | VARCHAR(200) | no | Free-text vendor name | Fallback when no supplier |
| supplier_id | VARCHAR(36) UUID | no | Supplier FK | Must be active, same tenant |
| payment_method | enum | no | Payment type | Auto-populated from registry if registry_id provided |
| payment_method_registry_id | VARCHAR(36) UUID | no | Payment method registry FK | Must be active, same tenant |
| purchased_by_user_id | VARCHAR(36) UUID | no | Purchasing user FK | Mutually exclusive with crew member |
| purchased_by_crew_member_id | VARCHAR(36) UUID | no | Purchasing crew member FK | Mutually exclusive with user |
| submission_status | enum | yes | `pending_review` or `confirmed` | Default: confirmed |
| rejection_reason | VARCHAR(500) | no | Why entry was rejected | Set by reject, cleared by resubmit |
| rejected_by_user_id | VARCHAR(36) UUID | no | Who rejected | Set by reject, cleared by resubmit |
| rejected_at | DATETIME | no | When rejected | Set by reject, cleared by resubmit |
| is_recurring_instance | BOOLEAN | yes | Is recurring entry | Default: false (F-04 does not implement recurring) |
| recurring_rule_id | VARCHAR(36) UUID | no | Recurring rule FK | Reserved for future use |
| has_receipt | BOOLEAN | yes | Has attached receipt | Default: false |
| notes | TEXT | no | Additional notes | Max 2000 chars enforced in DTO |
| crew_member_id | VARCHAR(36) UUID | no | Legacy crew member FK | From Gate 1 — not used in F-04 DTOs |
| subcontractor_id | VARCHAR(36) UUID | no | Legacy subcontractor FK | From Gate 1 — not used in F-04 DTOs |
| created_by_user_id | VARCHAR(36) UUID | yes | Entry creator | From JWT |
| updated_by_user_id | VARCHAR(36) UUID | no | Last updater | Set on update/approve/reject/resubmit |
| created_at | DATETIME | yes | Created timestamp | Auto |
| updated_at | DATETIME | yes | Updated timestamp | Auto |

### Relationships

```
financial_entry → tenant (CASCADE)
financial_entry → financial_category (RESTRICT)
financial_entry → project (RESTRICT, optional)
financial_entry → project_task (SET NULL, optional)
financial_entry → user (created_by: RESTRICT, updated_by: SET NULL, purchased_by: SET NULL, rejected_by: SET NULL)
financial_entry → crew_member (purchased_by: SET NULL, legacy: SET NULL)
financial_entry → subcontractor (legacy: SET NULL)
financial_entry → supplier (SET NULL)
financial_entry → payment_method_registry (SET NULL)
financial_entry ← receipt[] (reverse relation)
```

### Indexes

| Index | Columns |
|-------|---------|
| Primary | id |
| Tenant + Project | tenant_id, project_id |
| Tenant + Task | tenant_id, task_id |
| Tenant + Project + Category | tenant_id, project_id, category_id |
| Tenant + Date | tenant_id, entry_date |
| Tenant + Crew Member | tenant_id, crew_member_id |
| Tenant + Subcontractor | tenant_id, subcontractor_id |
| Tenant + Supplier | tenant_id, supplier_id |
| Tenant + Payment Registry | tenant_id, payment_method_registry_id |
| Tenant + Rejected At | tenant_id, rejected_at |

### Enums

**financial_entry_type**: `expense`, `income`
**expense_submission_status**: `pending_review`, `confirmed`
**payment_method**: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`
**financial_category_type**: `labor`, `material`, `subcontractor`, `equipment`, `insurance`, `fuel`, `utilities`, `office`, `marketing`, `taxes`, `tools`, `other`
**financial_category_classification**: `cost_of_goods_sold`, `operating_expense`

---

## Business Rules (Verified Against Running Code)

### Role-Based Entry Creation
- **BR-06**: Employee creates always forced to `pending_review` — value in request body is ignored
- **BR-07**: Owner/Admin/Manager/Bookkeeper default to `confirmed`, can explicitly opt for `pending_review`

### Role-Based Access
- Employee: sees only own entries (silent filter on `created_by_user_id`)
- Privileged roles: see all tenant entries
- Employee: can only edit/delete own entries in `pending_review` status
- Manager/Bookkeeper: cannot delete entries (403 always)
- Employee: cannot access pending queue or export (403)

### Pending Workflow
- **BR-17**: Only `pending_review` entries can be approved
- **BR-18**: Only `pending_review` entries can be rejected
- **BR-19**: Rejected entry STAYS `pending_review` — status not changed
- **BR-20**: Only entries with `rejected_at` populated can be resubmitted
- **BR-21**: Resubmit clears `rejection_reason`, `rejected_by_user_id`, `rejected_at`
- **BR-22**: After resubmit, status stays `pending_review`
- **BR-23**: On approval, rejection fields are preserved (audit trail)

### Field Validation
- `tax_amount >= amount` → 400
- `purchased_by_user_id` + `purchased_by_crew_member_id` both provided → 400
- `entry_date` in the future → 400
- `payment_method_registry_id` → auto-copies `type` into `payment_method` (overrides client value)

### Supplier Integration
- Creating entry with `supplier_id` → triggers `supplier.total_spend` recalculation
- Deleting entry with `supplier_id` → triggers `supplier.total_spend` recalculation
- Updating entry with supplier change → recalculates both old and new supplier

### Export
- **BR-24**: Maximum 10,000 rows — exceeding returns 400
- **BR-25**: Full result set exported (no pagination)

---

## Integration Points

| Module | Relationship | Direction |
|--------|-------------|-----------|
| `financial_category` | Category FK | Entry → Category |
| `supplier` | Supplier FK + spend tracking | Entry ↔ Supplier |
| `payment_method_registry` | Payment method FK + auto-copy | Entry → Registry |
| `project` | Project FK | Entry → Project |
| `project_task` | Task FK | Entry → Task |
| `user` | Created by, purchased by, rejected by | Entry → User |
| `crew_member` | Purchased by | Entry → Crew Member |
| `receipt` | Reverse relation | Receipt → Entry |
| `task-financial` (projects module) | Creates entries via `createEntry()` | Projects → Financial |
| `audit_log` | All CUD operations logged | Entry → Audit |

---

## Gate Dependencies

| Gate | Description | Status |
|------|-------------|--------|
| F-01 | Financial foundation (categories + basic entries) | Complete |
| F-02 | Supplier Registry (supplier CRUD + categories + products) | Complete |
| F-03 | Payment Method Registry | Complete |
| F-04 | General Expense Entry Engine (this module) | Complete |

---

## Known Limitations

- **Recurring entries**: Fields exist (`is_recurring_instance`, `recurring_rule_id`) but recurring engine not implemented — reserved for future sprint
- **Receipt linking**: `has_receipt` field exists but receipt attachment is handled by the Receipt module (Gate 2), not F-04
- **Legacy fields**: `crew_member_id` and `subcontractor_id` exist from Gate 1 but are not exposed in F-04 DTOs
- **Export format**: CSV only — no Excel/PDF export

---

## API Surface Summary

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /financial/entries | All | Create entry |
| GET | /financial/entries | All | List entries (paginated, filtered, with summary) |
| GET | /financial/entries/pending | Owner, Admin, Manager, Bookkeeper | List pending entries |
| GET | /financial/entries/export | Owner, Admin, Bookkeeper | Export CSV |
| GET | /financial/entries/:id | All | Get single entry |
| PATCH | /financial/entries/:id | All | Update entry |
| DELETE | /financial/entries/:id | Owner, Admin, Employee (own pending only) | Delete entry |
| POST | /financial/entries/:id/approve | Owner, Admin, Manager, Bookkeeper | Approve pending |
| POST | /financial/entries/:id/reject | Owner, Admin, Manager, Bookkeeper | Reject pending |
| POST | /financial/entries/:id/resubmit | All | Resubmit rejected |

**Note**: All paths are relative to `/api/v1/`. Full URL example: `https://api.lead360.app/api/v1/financial/entries`
