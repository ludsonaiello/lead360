# Sprint 3_3 — Service Layer: PaymentMethodRegistryService

**Module:** Financial
**File:** ./documentation/sprints/financial/f03/sprint_3_3.md
**Type:** Backend
**Depends On:** Sprint 3_1 (Schema), Sprint 3_2 (DTOs)
**Gate:** STOP — All 7 service methods must compile and the server must start without errors before Sprint 3_4.
**Estimated Complexity:** Medium–High

> **You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality.** Every line you write must reflect that standard.

> **WARNING:** This platform is 85% production-ready. Never leave the dev server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

---

## Objective

Implement `PaymentMethodRegistryService` with 7 methods: `create`, `findAll`, `findOne`, `update`, `softDelete`, `setDefault`, and `findDefault`. This service contains all business logic for the Payment Method Registry: tenant-scoped CRUD, case-insensitive nickname uniqueness, atomic default management, computed usage metrics, and soft-delete with automatic default reassignment.

---

## Pre-Sprint Checklist

- [ ] Sprint 3_1 complete — `payment_method_registry` model exists in Prisma schema
- [ ] Sprint 3_2 complete — all 3 DTO files exist and compile
- [ ] Read the following files for patterns:
  - `/var/www/lead360.app/api/src/modules/quotes/services/vendor.service.ts` — for `setDefault()` pattern
  - `/var/www/lead360.app/api/src/modules/financial/services/crew-payment.service.ts` — for service structure
  - `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts` — for list and soft-delete patterns
- [ ] Verify DTOs exist:
  - `/var/www/lead360.app/api/src/modules/financial/dto/create-payment-method-registry.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/update-payment-method-registry.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/list-payment-methods.dto.ts`

---

## Dev Server

> This project does NOT use PM2. Do not reference or run PM2 commands.
> Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   <- must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   <- must return nothing
```

**MySQL credentials** are in `/var/www/lead360.app/api/.env` — do not hardcode any database credentials.

---

## Tasks

### Task 1 — Read Existing Service Patterns

**What:** Read these files completely before writing any code:

1. `/var/www/lead360.app/api/src/modules/quotes/services/vendor.service.ts` — especially the `setDefault()` method (around lines 379–408) and the create method's default handling (around lines 84–89)
2. `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts` — for list pattern and soft-delete
3. `/var/www/lead360.app/api/src/modules/financial/services/crew-payment.service.ts` — for service constructor pattern

**Why:** The service must follow established patterns exactly.

**Do NOT:** Skip reading these files. The `setDefault()` pattern from vendor.service.ts is the reference implementation.

---

### Task 2 — Create `PaymentMethodRegistryService`

**What:** Create the file at:
```
/var/www/lead360.app/api/src/modules/financial/services/payment-method-registry.service.ts
```

**Service skeleton:**

```typescript
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreatePaymentMethodRegistryDto } from '../dto/create-payment-method-registry.dto';
import { UpdatePaymentMethodRegistryDto } from '../dto/update-payment-method-registry.dto';
import { ListPaymentMethodsDto } from '../dto/list-payment-methods.dto';

@Injectable()
export class PaymentMethodRegistryService {
  private readonly logger = new Logger(PaymentMethodRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // Methods defined in Tasks 3–9 below
}
```

**Do NOT:**
- Add any constructor dependencies beyond `PrismaService` and `AuditLoggerService`
- Import from any module not listed above

---

### Task 3 — Implement `create()` Method

**Signature:**
```typescript
async create(tenantId: string, userId: string, dto: CreatePaymentMethodRegistryDto)
```

**Implementation requirements:**

1. **Check the 50-active-method limit:**
   ```typescript
   const activeCount = await this.prisma.payment_method_registry.count({
     where: { tenant_id: tenantId, is_active: true },
   });
   if (activeCount >= 50) {
     throw new BadRequestException('Maximum 50 active payment methods per tenant');
   }
   ```

2. **Check nickname uniqueness (case-insensitive):**
   ```typescript
   const existing = await this.prisma.payment_method_registry.findFirst({
     where: {
       tenant_id: tenantId,
       nickname: { equals: dto.nickname, mode: 'insensitive' },
     },
   });
   if (existing) {
     throw new ConflictException('A payment method with this nickname already exists');
   }
   ```

3. **Handle `is_default` atomically within a Prisma transaction:**
   ```typescript
   const record = await this.prisma.$transaction(async (tx) => {
     // If is_default=true, unset all other defaults first
     if (dto.is_default) {
       await tx.payment_method_registry.updateMany({
         where: { tenant_id: tenantId, is_default: true },
         data: { is_default: false },
       });
     }

     return tx.payment_method_registry.create({
       data: {
         tenant_id: tenantId,
         nickname: dto.nickname,
         type: dto.type as any,
         bank_name: dto.bank_name ?? null,
         last_four: dto.last_four ?? null,
         notes: dto.notes ?? null,
         is_default: dto.is_default ?? false,
         is_active: true,
         created_by_user_id: userId,
       },
     });
   });
   ```

4. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'created',
     entityType: 'payment_method_registry',
     entityId: record.id,
     tenantId,
     actorUserId: userId,
     after: record,
     description: `Created payment method: ${dto.nickname}`,
   });
   ```

5. **Return the record with computed fields:**
   Call `this.enrichWithUsageData(record)` (defined in Task 9) to add `usage_count` and `last_used_date`.

**Do NOT:**
- Use `updateMany` without a transaction when setting defaults — atomicity is required
- Skip the 50-method limit check
- Skip the case-insensitive nickname check

---

### Task 4 — Implement `findAll()` Method

**Signature:**
```typescript
async findAll(tenantId: string, query: ListPaymentMethodsDto)
```

**Implementation requirements:**

1. **Build the where clause:**
   ```typescript
   const where: any = { tenant_id: tenantId };

   // Default to is_active=true if not specified
   if (query.is_active === undefined || query.is_active === true) {
     where.is_active = true;
   } else if (query.is_active === false) {
     // Do not filter by is_active — show all
   }

   if (query.type) {
     where.type = query.type;
   }
   ```

2. **Query with usage data:**
   ```typescript
   const records = await this.prisma.payment_method_registry.findMany({
     where,
     orderBy: [
       { is_default: 'desc' },
       { nickname: 'asc' },
     ],
   });
   ```

3. **Enrich each record with computed usage data using the `enrichWithUsageData` helper (Task 9):**
   ```typescript
   const enrichedRecords = await Promise.all(
     records.map((record) => this.enrichWithUsageData(record)),
   );
   ```

4. **Return the enriched flat array** (NOT paginated envelope):
   ```typescript
   return enrichedRecords;
   ```

**Performance note:** With a max of 50 records per tenant, the N+1 queries for usage data are acceptable. If performance becomes a concern in the future, this can be optimized with a raw SQL query.

**Do NOT:**
- Wrap in `{ data: [...], meta: {...} }` — this endpoint returns a flat array per contract
- Add pagination — max 50 records makes it unnecessary
- Return records without `usage_count` and `last_used_date`

---

### Task 5 — Implement `findOne()` Method

**Signature:**
```typescript
async findOne(tenantId: string, id: string)
```

**Implementation:**

1. Find the record:
   ```typescript
   const record = await this.prisma.payment_method_registry.findFirst({
     where: { id, tenant_id: tenantId },
   });

   if (!record) {
     throw new NotFoundException('Payment method not found');
   }
   ```

2. Return enriched with usage data:
   ```typescript
   return this.enrichWithUsageData(record);
   ```

**Do NOT:** Use `findUnique` — always use `findFirst` with `tenant_id` for multi-tenant safety.

---

### Task 6 — Implement `update()` Method

**Signature:**
```typescript
async update(tenantId: string, id: string, userId: string, dto: UpdatePaymentMethodRegistryDto)
```

**Implementation requirements:**

1. **Find existing record** (throws 404 if not found):
   ```typescript
   const existing = await this.findOne(tenantId, id);
   ```

2. **If nickname is changing, check uniqueness (case-insensitive, exclude self):**
   ```typescript
   if (dto.nickname) {
     const duplicate = await this.prisma.payment_method_registry.findFirst({
       where: {
         tenant_id: tenantId,
         nickname: { equals: dto.nickname, mode: 'insensitive' },
         id: { not: id },
       },
     });
     if (duplicate) {
       throw new ConflictException('A payment method with this nickname already exists');
     }
   }
   ```

3. **Build update data object** (only include provided fields):
   ```typescript
   const data: any = { updated_by_user_id: userId };

   if (dto.nickname !== undefined) data.nickname = dto.nickname;
   if (dto.type !== undefined) data.type = dto.type;
   if (dto.bank_name !== undefined) data.bank_name = dto.bank_name;
   if (dto.last_four !== undefined) data.last_four = dto.last_four;
   if (dto.notes !== undefined) data.notes = dto.notes;
   if (dto.is_active !== undefined) data.is_active = dto.is_active;
   ```

4. **Update the record:**
   ```typescript
   const updated = await this.prisma.payment_method_registry.update({
     where: { id },
     data,
   });
   ```

5. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'updated',
     entityType: 'payment_method_registry',
     entityId: id,
     tenantId,
     actorUserId: userId,
     before: existing,
     after: updated,
     description: `Updated payment method: ${updated.nickname}`,
   });
   ```

6. **Return enriched record:**
   ```typescript
   return this.enrichWithUsageData(updated);
   ```

**Do NOT:**
- Allow `is_default` to be updated through this method — it's not in the DTO
- Skip the duplicate nickname check when nickname changes
- Set `updated_by_user_id` to null — always set it to the current user on update

---

### Task 7 — Implement `softDelete()` Method

**Signature:**
```typescript
async softDelete(tenantId: string, id: string, userId: string)
```

**Implementation requirements:**

1. **Find existing record** (throws 404 if not found):
   ```typescript
   const existing = await this.findOne(tenantId, id);
   ```

2. **Soft-delete by setting `is_active = false`:**
   ```typescript
   const deactivated = await this.prisma.payment_method_registry.update({
     where: { id },
     data: {
       is_active: false,
       updated_by_user_id: userId,
     },
   });
   ```

3. **If the deleted record was the default, reassign default:**
   ```typescript
   if (existing.is_default) {
     // Find the most recently created active payment method
     const newDefault = await this.prisma.payment_method_registry.findFirst({
       where: {
         tenant_id: tenantId,
         is_active: true,
         id: { not: id },
       },
       orderBy: { created_at: 'desc' },
     });

     if (newDefault) {
       await this.prisma.payment_method_registry.update({
         where: { id: newDefault.id },
         data: { is_default: true },
       });
     }
   }
   ```

4. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'deleted',
     entityType: 'payment_method_registry',
     entityId: id,
     tenantId,
     actorUserId: userId,
     before: existing,
     after: deactivated,
     description: `Deactivated payment method: ${existing.nickname}`,
   });
   ```

5. **Return the deactivated record** with usage data:
   ```typescript
   return this.enrichWithUsageData(deactivated);
   ```

**Contract rule:** The DELETE endpoint returns HTTP 200 with the updated (deactivated) object — NOT 204 No Content.

**Do NOT:**
- Hard-delete the record — always soft-delete
- Skip the default reassignment logic
- Return 204 — return 200 with the deactivated object

---

### Task 8 — Implement `setDefault()` and `findDefault()` Methods

**`setDefault()` Signature:**
```typescript
async setDefault(tenantId: string, id: string, userId: string)
```

**Implementation:**

1. **Find the record** (throws 404 if not found):
   ```typescript
   const record = await this.findOne(tenantId, id);
   ```

2. **Check if inactive:**
   ```typescript
   if (!record.is_active) {
     throw new BadRequestException('Cannot set an inactive payment method as default');
   }
   ```

3. **Atomic transaction — unset all, then set this one:**
   ```typescript
   const updated = await this.prisma.$transaction(async (tx) => {
     await tx.payment_method_registry.updateMany({
       where: { tenant_id: tenantId, is_default: true },
       data: { is_default: false },
     });

     return tx.payment_method_registry.update({
       where: { id },
       data: {
         is_default: true,
         updated_by_user_id: userId,
       },
     });
   });
   ```

4. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'updated',
     entityType: 'payment_method_registry',
     entityId: id,
     tenantId,
     actorUserId: userId,
     before: record,
     after: updated,
     description: `Set payment method as default: ${record.nickname}`,
   });
   ```

5. **Return enriched:**
   ```typescript
   return this.enrichWithUsageData(updated);
   ```

---

**`findDefault()` Signature:**
```typescript
async findDefault(tenantId: string)
```

**Implementation:**

```typescript
const record = await this.prisma.payment_method_registry.findFirst({
  where: {
    tenant_id: tenantId,
    is_default: true,
    is_active: true,
  },
});

if (!record) {
  return null;
}

return this.enrichWithUsageData(record);
```

**Note:** This method returns `null` if no default exists. It does NOT throw. It is designed to be called by Sprint F-04's expense entry service for pre-populating new entries.

**Do NOT:**
- Throw an error when no default exists — return `null`
- Skip the `is_active: true` check — inactive records cannot be default

---

### Task 9 — Implement `enrichWithUsageData()` Private Helper

**What:** Add a private helper method that computes `usage_count` and `last_used_date` for a payment method record:

```typescript
private async enrichWithUsageData(record: any) {
  const [usageCount, lastUsed] = await Promise.all([
    this.prisma.financial_entry.count({
      where: { payment_method_registry_id: record.id },
    }),
    this.prisma.financial_entry.findFirst({
      where: { payment_method_registry_id: record.id },
      orderBy: { entry_date: 'desc' },
      select: { entry_date: true },
    }),
  ]);

  return {
    ...record,
    usage_count: usageCount,
    last_used_date: lastUsed?.entry_date ?? null,
  };
}
```

**Why:** Both the list and single-record responses include these computed fields. Centralizing the logic avoids duplication.

**Do NOT:**
- Store `usage_count` or `last_used_date` in the database — they are always computed at query time
- Skip the parallel query pattern (`Promise.all`) — it's more efficient

---

### Task 10 — Verify Compilation

**What:** Start the dev server and confirm the service file compiles without errors.

**Note:** The service is NOT yet registered in `FinancialModule` — that happens in Sprint 3_4. It may or may not produce a warning about being unused, but it should NOT produce any TypeScript compilation errors.

**Acceptance:**
- No TypeScript errors
- Health check returns 200

---

## Patterns to Apply

### Service Constructor Pattern

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
) {}
```

### Tenant Isolation Pattern

Every query MUST include `tenant_id`:
```typescript
where: { tenant_id: tenantId, ... }
```

### Audit Logging Pattern

```typescript
await this.auditLogger.logTenantChange({
  action: 'created' | 'updated' | 'deleted',
  entityType: 'payment_method_registry',
  entityId: string,
  tenantId: string,
  actorUserId: string,
  before?: object,  // for updates and deletes
  after?: object,   // for creates and updates
  description: string,
});
```

### Default Atomicity Pattern (from `vendor.service.ts`)

```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Unset all defaults for this tenant
  await tx.payment_method_registry.updateMany({
    where: { tenant_id: tenantId, is_default: true },
    data: { is_default: false },
  });
  // 2. Set the new default
  return tx.payment_method_registry.update({
    where: { id },
    data: { is_default: true },
  });
});
```

---

## Business Rules Enforced in This Sprint

- BR-01: Nickname must be unique per tenant (case-insensitive). Duplicate throws `ConflictException`.
- BR-02: `last_four` must be exactly 4 numeric digits if provided (validated at DTO level).
- BR-03: Only one payment method per tenant can have `is_default = true` at any time.
- BR-04: Setting a new default is atomic — no intermediate state where zero or two defaults exist.
- BR-05: A payment method with linked financial entries cannot be hard-deleted (soft-delete only). Since all deletes are soft, this is enforced by design.
- BR-06: Inactive payment methods cannot be set as default.
- BR-07: When the default payment method is deactivated, the most recently created active method automatically becomes the new default.
- BR-08: Maximum 50 active payment methods per tenant.
- BR-09: `usage_count` and `last_used_date` are computed at query time from `financial_entry` records — never stored.

---

## Integration Points

| Dependency | Import Path | What It Provides |
|---|---|---|
| `PrismaService` | `'../../../core/database/prisma.service'` | Database access |
| `AuditLoggerService` | `'../../audit/services/audit-logger.service'` | Audit logging for all CUD operations |
| `CreatePaymentMethodRegistryDto` | `'../dto/create-payment-method-registry.dto'` | Create validation |
| `UpdatePaymentMethodRegistryDto` | `'../dto/update-payment-method-registry.dto'` | Update validation |
| `ListPaymentMethodsDto` | `'../dto/list-payment-methods.dto'` | List query validation |

---

## Acceptance Criteria

- [ ] `payment-method-registry.service.ts` exists at `/var/www/lead360.app/api/src/modules/financial/services/payment-method-registry.service.ts`
- [ ] Service has all 7 public methods: `create`, `findAll`, `findOne`, `update`, `softDelete`, `setDefault`, `findDefault`
- [ ] Service has 1 private helper: `enrichWithUsageData`
- [ ] All Prisma queries include `tenant_id` in the where clause
- [ ] `create()` checks 50-active limit and case-insensitive nickname uniqueness
- [ ] `create()` and `setDefault()` use `prisma.$transaction()` for default atomicity
- [ ] `softDelete()` auto-reassigns default to most recent active method when the default is deleted
- [ ] `setDefault()` throws 400 for inactive records
- [ ] `findDefault()` returns `null` when no default exists (does not throw)
- [ ] `enrichWithUsageData()` computes `usage_count` and `last_used_date` from `financial_entry`
- [ ] All CUD operations produce audit log entries via `AuditLoggerService`
- [ ] Dev server compiles without errors
- [ ] No existing code was modified
- [ ] No frontend code was modified
- [ ] Dev server is shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Do not proceed to Sprint 3_4 until:
1. Service file compiles without TypeScript errors
2. All 7 public methods are implemented
3. Dev server starts and health check returns 200

---

## Handoff Notes

**For Sprint 3_4 (Controller + Module Registration):**
- The service is at `./services/payment-method-registry.service.ts`
- Import as: `import { PaymentMethodRegistryService } from '../services/payment-method-registry.service'`
- Method signatures:
  - `create(tenantId: string, userId: string, dto: CreatePaymentMethodRegistryDto)` — returns enriched record
  - `findAll(tenantId: string, query: ListPaymentMethodsDto)` — returns flat array of enriched records
  - `findOne(tenantId: string, id: string)` — returns enriched record or throws 404
  - `update(tenantId: string, id: string, userId: string, dto: UpdatePaymentMethodRegistryDto)` — returns enriched record
  - `softDelete(tenantId: string, id: string, userId: string)` — returns enriched deactivated record
  - `setDefault(tenantId: string, id: string, userId: string)` — returns enriched record
  - `findDefault(tenantId: string)` — returns enriched record or `null`
- The service must be registered as a provider in `FinancialModule` and exported so F-04 can call `findDefault()`
