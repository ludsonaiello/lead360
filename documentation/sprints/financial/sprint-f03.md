# Sprint F-03 — Payment Method Registry

**Module**: Financial  
**Sprint**: F-03  
**Status**: Ready for Development  
**Type**: New Feature — New Table + Full CRUD API  
**Estimated Complexity**: Low–Medium  
**Prerequisite**: Sprint F-01 must be complete and merged before this sprint begins.

---

## Purpose

The `payment_method` field on financial records currently stores a raw enum value — `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`. This tells you *how* something was paid but not *which account* paid it.

A roofing company with three vehicles might have a Chase Business Visa assigned to vehicle 1, a petty cash envelope for field purchases, and a Zelle account for subcontractor payments. When the owner reviews expenses at month end, "credit_card" tells them nothing. "Chase Business Visa — Vehicle 1" tells them exactly where the money came from.

The Payment Method Registry is a tenant-managed catalog of named payment instruments. Each record has a human-readable nickname, a type drawn from the `payment_method` enum, and optional identifying details (last four digits, bank name). When recording any expense or payment, users select from their registered accounts rather than picking a raw enum value.

This registry is the reference table that Sprint F-04 (General Expense Entry Engine) wires into the `financial_entry` form. It is also the reference for crew payment records and subcontractor payment records in the existing Gate 3 implementation.

---

## Scope

### In Scope

- New `payment_method_registry` table — tenant-scoped named payment accounts
- Full CRUD endpoints
- Endpoint to set a default payment method per tenant
- `payment_method_registry_id` FK wired onto `financial_entry` (the field stub already exists from F-01 — this sprint adds the Prisma relation)
- Existing `crew_payment_record.payment_method` and `subcontractor_payment_record.payment_method` remain as-is (enum only) — those are out of scope for migration in this sprint. Document the inconsistency as a known technical debt item to resolve in a future cleanup sprint.
- 100% API documentation
- Full test coverage including tenant isolation

### Out of Scope

- No changes to `crew_payment_record` or `subcontractor_payment_record` — those tables keep their raw enum field
- No frontend implementation
- No external bank account validation or Plaid integration
- No encryption of payment details — these are reference labels only (last four digits, not full card numbers)
- No payment processing — this module records which account was used, it does not initiate transactions

---

## Platform Architecture Patterns (Mandatory)

- **Tenant isolation**: Every query must include `tenant_id`. A payment method from tenant A is never visible to tenant B.
- **TenantId decorator**: All controller methods use `@TenantId()` to extract `tenant_id` from JWT. Never from request body.
- **AuditLoggerService**: All create, update, and delete operations must be audit logged.
- **EncryptionService**: Not required — no full account numbers or sensitive data is stored. `last_four` is a display label, not a financial credential.
- **FilesService**: Not applicable.
- **Migrations**: Run `npx prisma migrate dev --name payment_method_registry` after schema changes. Commit schema and migration. Run `npx prisma generate`.

---

## Data Model

### Table: `payment_method_registry`

**Purpose:** Tenant-owned catalog of named payment instruments. Each record represents one specific account, card, or cash source the business uses.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | auto | Primary key |
| `tenant_id` | `String @db.VarChar(36)` | Yes | — | Tenant owner |
| `nickname` | `String @db.VarChar(100)` | Yes | — | Human-readable name, e.g. "Chase Business Visa", "Petty Cash", "Zelle — Sub Payments" |
| `type` | `payment_method` | Yes | — | References the `payment_method` enum expanded in F-01: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH |
| `bank_name` | `String? @db.VarChar(100)` | No | null | Optional bank or institution name, e.g. "Chase", "Bank of America", "Wells Fargo" |
| `last_four` | `String? @db.VarChar(4)` | No | null | Last 4 digits of card or account number — display label only, not a credential |
| `notes` | `String? @db.Text` | No | null | Internal notes about this payment method |
| `is_default` | `Boolean @default(false)` | Yes | false | Whether this is the default payment method for new expense entries |
| `is_active` | `Boolean @default(true)` | Yes | true | Soft disable without deletion |
| `created_by_user_id` | `String @db.VarChar(36)` | Yes | — | User who created |
| `updated_by_user_id` | `String? @db.VarChar(36)` | No | null | User who last updated |
| `created_at` | `DateTime @default(now())` | Yes | auto | — |
| `updated_at` | `DateTime @updatedAt` | Yes | auto | — |

**Indexes:**
- `@@index([tenant_id, is_active])`
- `@@index([tenant_id, type])`
- `@@index([tenant_id, is_default])`
- `@@index([tenant_id, created_at])`

**Relations:**
- Has many: `financial_entry` (reverse — entries that reference this payment method via `payment_method_registry_id`)

**Business rules:**
- `nickname` must be unique per tenant (case-insensitive check at service level). Duplicate throws `ConflictException`.
- `last_four` must be exactly 4 numeric characters if provided. Validate with regex `/^\d{4}$/`. Reject anything else.
- Only one payment method per tenant can have `is_default = true`. When a new record is set as default (`is_default = true`), all other records for that tenant are set to `is_default = false` within the same transaction.
- A payment method with linked `financial_entry` records cannot be hard-deleted. Service throws `ConflictException`: "Payment method has expense records. Deactivate it instead."
- `is_default` cannot be set to `false` directly via PATCH if it is the only active payment method — it must remain the default until another is set as default. This prevents a state where no default exists when the tenant has entries. **Exception:** If the tenant has zero payment methods after deletion, this rule does not apply.
- There is no system-default payment method — these are fully tenant-specific.
- Maximum 50 active payment methods per tenant. Enforce at service level on create.

---

### Schema Relation: `financial_entry.payment_method_registry_id` FK

Sprint F-01 added `payment_method_registry_id` as a plain `String?` field on `financial_entry` with no Prisma relation. This sprint adds the relation definition:

```
payment_method_registry   payment_method_registry?   @relation(fields: [payment_method_registry_id], references: [id], onDelete: SetNull)
```

And the reverse on `payment_method_registry`:
```
financial_entries   financial_entry[]
```

**Important:** The existing `payment_method` enum field on `financial_entry` is **not removed** in this sprint. Both fields coexist:
- `payment_method` (enum) — the raw type, populated from the registry record's `type` field when an entry is created with a `payment_method_registry_id`. Also still usable standalone for quick entry without a registry record.
- `payment_method_registry_id` (FK) — points to the named account record.

When an entry is created with a `payment_method_registry_id`, the service automatically copies the registry record's `type` value into `financial_entry.payment_method`. This keeps the enum field accurate for queries that filter by payment type without joining the registry table.

---

## API Specification

### Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/financial/payment-methods` | List payment methods for tenant | All |
| `POST` | `/financial/payment-methods` | Create payment method | Owner, Admin, Bookkeeper |
| `GET` | `/financial/payment-methods/:id` | Get single payment method | All |
| `PATCH` | `/financial/payment-methods/:id` | Update payment method | Owner, Admin, Bookkeeper |
| `DELETE` | `/financial/payment-methods/:id` | Soft delete | Owner, Admin |
| `POST` | `/financial/payment-methods/:id/set-default` | Set as default | Owner, Admin, Bookkeeper |

---

#### `GET /financial/payment-methods`

**Query parameters:**
- `is_active` — boolean, optional. Default: `true`. Pass `false` to include inactive.
- `type` — `payment_method` enum value, optional. Filter by payment type.

**Response:** Array ordered by `is_default DESC`, then `nickname ASC`.

```
[
  {
    id
    nickname
    type
    bank_name       string | null
    last_four       string | null
    notes           string | null
    is_default      boolean
    is_active       boolean
    usage_count     integer   — number of financial_entry records linked to this payment method
    last_used_date  date | null   — date of most recent financial_entry using this method
    created_at
    updated_at
  }
]
```

**Note on `usage_count` and `last_used_date`:** These are computed at query time via Prisma aggregate — not stored fields. They give the user visibility into which accounts are actively used.

---

#### `POST /financial/payment-methods`

**Request body:**
```
nickname      string    required    max 100 chars
type          enum      required    one of: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH
bank_name     string    optional    max 100 chars
last_four     string    optional    exactly 4 digits — validated with /^\d{4}$/
notes         string    optional
is_default    boolean   optional    default false
```

**Behavior when `is_default = true`:**
Within a single Prisma transaction:
1. Set all existing payment methods for this tenant to `is_default = false`.
2. Create the new record with `is_default = true`.

**Response:** 201 Created — full payment method object including computed `usage_count` and `last_used_date`.

**Errors:**
- 409 Conflict — nickname already exists for this tenant
- 400 Bad Request — `last_four` is not exactly 4 digits
- 400 Bad Request — tenant has reached 50 active payment method limit
- 400 Bad Request — `type` is not a valid `payment_method` enum value

---

#### `GET /financial/payment-methods/:id`

**Response:** Single payment method object — same shape as list item.

**Errors:**
- 404 Not Found — not found or not in this tenant

---

#### `PATCH /financial/payment-methods/:id`

All fields optional. Only provided fields are updated.

```
nickname      string    optional
type          enum      optional
bank_name     string    optional
last_four     string    optional    4 digits or null to clear
notes         string    optional
is_active     boolean   optional
```

**Note:** `is_default` is NOT patchable via PATCH. Use the dedicated `POST /:id/set-default` endpoint. This prevents accidental unsetting of the default.

**Behavior when `type` changes:** The service must check if there are any `financial_entry` records linked to this payment method. If yes, warn but allow — the type change applies going forward; historical entries retain their existing `payment_method` enum value.

**Errors:**
- 404 Not Found
- 409 Conflict — nickname change conflicts with existing name
- 400 Bad Request — `last_four` format invalid

---

#### `DELETE /financial/payment-methods/:id`

Soft delete — sets `is_active = false`.

**Behavior:**
- If the deleted record was `is_default = true` AND other active payment methods exist, the service sets `is_default = true` on the most recently created active payment method automatically. This ensures a default always exists when active methods remain.
- If it was the last active payment method, `is_default` state is irrelevant — no assignment needed.

**Response:** 200 OK with the updated (deactivated) payment method object.

**Errors:**
- 404 Not Found
- 409 Conflict — if a hard-delete is ever attempted against a method with linked entries (documents future safety guard)

---

#### `POST /financial/payment-methods/:id/set-default`

**No request body.**

**Behavior:** Within a single Prisma transaction:
1. Set all payment methods for this tenant to `is_default = false`.
2. Set the specified record to `is_default = true`.

**Response:** 200 OK with the updated payment method object.

**Errors:**
- 404 Not Found
- 400 Bad Request — payment method is inactive. Cannot set an inactive record as default.

---

## Service Architecture

### `PaymentMethodRegistryService`

| Method | Signature | Notes |
|--------|-----------|-------|
| `create` | `(tenantId, userId, dto)` | Handles is_default transaction |
| `findAll` | `(tenantId, query)` | With usage_count and last_used_date computed |
| `findOne` | `(tenantId, id)` | Throws 404 if not found |
| `update` | `(tenantId, id, userId, dto)` | Partial update, validates last_four format |
| `softDelete` | `(tenantId, id, userId)` | Handles is_default reassignment if needed |
| `setDefault` | `(tenantId, id, userId)` | Atomic transaction |
| `findDefault` | `(tenantId)` | Returns current default or null — used by F-04 expense entry to pre-select |

**`findDefault`** is a utility method used by downstream services (F-04 expense entry form pre-population). It must be exported from the module.

---

## Module Registration

`PaymentMethodRegistryService` and `PaymentMethodRegistryController` are registered in `FinancialModule`. The service is exported from `FinancialModule` so that Sprint F-04's expense entry service can call `findDefault()` when pre-populating new entries.

---

## Business Rules Summary

1. Nickname is unique per tenant (case-insensitive).
2. `last_four` must be exactly 4 numeric digits if provided — no letters, no spaces, no dashes.
3. Only one payment method per tenant can be `is_default = true` at any time.
4. Setting a new default is atomic — no intermediate state where zero or two defaults exist.
5. A payment method with linked financial entries cannot be hard-deleted (soft-delete only).
6. Inactive payment methods cannot be set as default.
7. When the default payment method is deactivated, the most recently created active method automatically becomes the new default (if any active methods remain).
8. Maximum 50 active payment methods per tenant.
9. When a `financial_entry` is created with a `payment_method_registry_id`, the service copies the registry record's `type` into `financial_entry.payment_method` automatically. The client does not need to provide both fields.
10. The raw `payment_method` enum on `financial_entry` remains valid for entries created without a registry reference (quick entry flow). Both coexist.

---

## Acceptance Criteria

**Schema:**
- [ ] `payment_method_registry` table exists in schema and database
- [ ] `financial_entry.payment_method_registry_id` Prisma relation is wired to `payment_method_registry`
- [ ] Migration runs cleanly from scratch
- [ ] `npx prisma generate` runs without errors

**CRUD:**
- [ ] `POST /financial/payment-methods` creates a payment method
- [ ] Duplicate nickname returns 409
- [ ] Invalid `last_four` format returns 400
- [ ] 51st active payment method returns 400
- [ ] `GET /financial/payment-methods` returns ordered list with `usage_count` and `last_used_date`
- [ ] `PATCH /financial/payment-methods/:id` updates correctly
- [ ] `DELETE /financial/payment-methods/:id` soft-deletes (is_active = false)

**Default Logic:**
- [ ] Creating with `is_default = true` unsets all other defaults atomically
- [ ] `POST /:id/set-default` is atomic — no state with two defaults
- [ ] Deleting the default method auto-assigns default to most recent active method
- [ ] Setting inactive method as default returns 400

**Integration:**
- [ ] Creating `financial_entry` with `payment_method_registry_id` auto-copies `type` to `financial_entry.payment_method`
- [ ] `financial_entry` without `payment_method_registry_id` still accepts raw `payment_method` enum value

**Tests:**
- [ ] Unit tests for all service methods
- [ ] Unit test: default atomicity — cannot have two defaults after concurrent creates
- [ ] Tenant isolation test: payment method from tenant A not visible to tenant B
- [ ] RBAC test: Employee cannot create or update payment methods
- [ ] RBAC test: Employee can list payment methods (read access for expense entry form)
- [ ] Integration test: soft-delete with auto-default-reassignment

**Documentation:**
- [ ] `api/documentation/financial_REST_API.md` updated with all payment method endpoints
- [ ] Default auto-copy behavior documented
- [ ] Technical debt note documented: `crew_payment_record` and `subcontractor_payment_record` still use raw enum — registry adoption deferred

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Race condition on `is_default` atomicity under concurrent requests | Low — two records could briefly both be default | Low — service businesses rarely have concurrent users updating payment settings | Use Prisma transaction for all is_default operations. Document the pattern for F-04 usage. |
| Confusion between `payment_method` (enum on entry) and `payment_method_registry_id` (FK) | Medium — agent may implement only one | Medium | Contract explicitly documents both fields coexist, both serve a purpose, and the auto-copy behavior bridges them. |
| `crew_payment_record` and `subcontractor_payment_record` inconsistency | Low — functional but architecturally inconsistent | Confirmed | Documented as known tech debt. No action in this sprint. |

---

## Dependencies

### Requires (must be complete before this sprint)
- Sprint F-01 — `payment_method_registry_id` stub field must exist on `financial_entry`, and `payment_method` enum must include the 3 new values added in F-01

### Blocks
- Sprint F-04 — expense entry form uses `findDefault()` for pre-population and `payment_method_registry_id` for entry creation

### Runs in parallel with
- Sprint F-02 (Supplier Registry) — F-02 and F-03 have no dependency on each other and can be developed simultaneously if resources allow

---

## File Change Summary

### Files Created
- `api/src/modules/financial/services/payment-method-registry.service.ts`
- `api/src/modules/financial/controllers/payment-method-registry.controller.ts`
- `api/src/modules/financial/dto/create-payment-method-registry.dto.ts`
- `api/src/modules/financial/dto/update-payment-method-registry.dto.ts`
- `api/src/modules/financial/dto/list-payment-methods.dto.ts`
- `api/prisma/migrations/[timestamp]_payment_method_registry/migration.sql`

### Files Modified
- `api/prisma/schema.prisma` — new table, FK relation on `financial_entry`
- `api/src/modules/financial/financial.module.ts` — register new service and controller, export `PaymentMethodRegistryService`
- `api/documentation/financial_REST_API.md` — add all payment method endpoints

### Files That Must NOT Be Modified
- `api/src/modules/quotes/` — do not touch
- `api/src/modules/projects/` — do not touch
- `api/src/modules/financial/services/crew-payment.service.ts` — do not touch
- `api/src/modules/financial/services/subcontractor-payment.service.ts` — do not touch
- Any frontend file

---

## Notes for Executing Agent

1. The `is_default` atomicity pattern (unset all, then set one) is already used in `vendor.service.ts` via the `setDefault()` method. Read that implementation before writing `PaymentMethodRegistryService.setDefault()` to replicate the same Prisma transaction pattern.
2. `usage_count` and `last_used_date` in the list response are computed at query time using Prisma's `_count` and aggregate queries on `financial_entry`. Do not add stored fields for these — they are derived.
3. The `findDefault()` method will be called from F-04's expense entry service to pre-populate new entries. Export it from the module now even though F-04 does not exist yet.
4. Do not remove or rename the `payment_method` enum field on `financial_entry`. It must coexist with `payment_method_registry_id`. The auto-copy behavior (registry type → entry enum) must be implemented in `FinancialEntryService.createEntry()`, not in the registry service itself.
5. Document the technical debt item explicitly in the API documentation: "Note: `crew_payment_record` and `subcontractor_payment_record` currently use a raw `payment_method` enum value. Migration to reference `payment_method_registry` is deferred to a future sprint."
6. Produce 100% API documentation before marking the sprint complete.