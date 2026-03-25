# Sprint 10_3 — AccountMappingService

**Module:** Financial
**File:** ./documentation/sprints/financial/f10/sprint_10_3.md
**Type:** Backend — Service Layer
**Depends On:** Sprint 10_1 (schema), Sprint 10_2 (DTOs)
**Gate:** STOP — All 5 service methods must work correctly. Verified via manual curl tests before proceeding.
**Estimated Complexity:** Medium

> **You are a masterclass-level engineer who makes Google, Amazon, and Apple engineers jealous of the quality of your work.**

> ⚠️ **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> ⚠️ **MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — do NOT hardcode database credentials anywhere.**

---

## Objective

Build the `AccountMappingService` — the CRUD service for tenant-configurable mappings from Lead360 financial categories to QuickBooks/Xero chart of accounts names. This service is used by the export service to resolve account names during CSV generation.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — confirm `financial_category_account_mapping` table exists with unique constraint `@@unique([tenant_id, category_id, platform])`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-account-mapping.dto.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/account-mapping-query.dto.ts`
- [ ] Read an existing service for patterns: `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts`
- [ ] Read the audit logger: `/var/www/lead360.app/api/src/modules/audit/services/audit-logger.service.ts` (just the `logTenantChange` method signature)

---

## Dev Server

> ⚠️ This project does NOT use PM2. Do not reference or run PM2 commands.
> ⚠️ Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   ← must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing
```

---

## Tasks

### Task 1 — Create `AccountMappingService`

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/services/account-mapping.service.ts`

**Required imports:**
```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateAccountMappingDto } from '../dto/create-account-mapping.dto';
```

**Class structure:**
```typescript
@Injectable()
export class AccountMappingService {
  private readonly logger = new Logger(AccountMappingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // Methods defined below
}
```

---

### Task 2 — Implement `findAll()`

**Method signature:**
```typescript
async findAll(tenantId: string, platform?: string): Promise<any[]>
```

**What:** List all account mappings for a tenant, optionally filtered by platform.

**Implementation:**
```typescript
async findAll(tenantId: string, platform?: string) {
  const where: any = { tenant_id: tenantId };
  if (platform) {
    where.platform = platform;
  }

  return this.prisma.financial_category_account_mapping.findMany({
    where,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          classification: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}
```

**Response shape per item:**
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "category_id": "uuid",
  "platform": "quickbooks",
  "account_name": "Office Supplies",
  "account_code": "6100",
  "created_by_user_id": "uuid",
  "updated_by_user_id": null,
  "created_at": "2026-03-17T...",
  "updated_at": "2026-03-17T...",
  "category": {
    "id": "uuid",
    "name": "Materials - General",
    "type": "material",
    "classification": "cost_of_goods_sold"
  }
}
```

**CRITICAL:** The `include.category.select` must include `classification` — this field comes from F-01. If F-01 is complete, it will exist on the `financial_category` model. If it does NOT exist, remove `classification` from the select and add a comment noting it depends on F-01.

**Acceptance:** Returns array of mappings with nested category. Filtered by tenant_id. Optional platform filter works.

---

### Task 3 — Implement `upsert()`

**Method signature:**
```typescript
async upsert(tenantId: string, userId: string, dto: CreateAccountMappingDto)
```

**What:** Create or update an account mapping. If a mapping already exists for the given `category_id + platform + tenant_id`, update it. Otherwise, create a new one.

**Implementation logic:**
1. Validate that `dto.category_id` belongs to the tenant:
   ```typescript
   const category = await this.prisma.financial_category.findFirst({
     where: { id: dto.category_id, tenant_id: tenantId },
   });
   if (!category) {
     throw new NotFoundException(`Category ${dto.category_id} not found for this tenant`);
   }
   ```

2. Check for existing mapping:
   ```typescript
   const existing = await this.prisma.financial_category_account_mapping.findFirst({
     where: {
       tenant_id: tenantId,
       category_id: dto.category_id,
       platform: dto.platform as any,
     },
   });
   ```

3. If existing — update:
   ```typescript
   if (existing) {
     const updated = await this.prisma.financial_category_account_mapping.update({
       where: { id: existing.id },
       data: {
         account_name: dto.account_name,
         account_code: dto.account_code || null,
         updated_by_user_id: userId,
       },
     });

     await this.auditLogger.logTenantChange({
       action: 'updated',
       entityType: 'financial_category_account_mapping',
       entityId: updated.id,
       tenantId,
       actorUserId: userId,
       before: existing,
       after: updated,
       description: `Updated ${dto.platform} account mapping for category "${category.name}" to "${dto.account_name}"`,
     });

     return { ...updated, statusCode: 200 };
   }
   ```

4. If not existing — create:
   ```typescript
   const created = await this.prisma.financial_category_account_mapping.create({
     data: {
       tenant_id: tenantId,
       category_id: dto.category_id,
       platform: dto.platform as any,
       account_name: dto.account_name,
       account_code: dto.account_code || null,
       created_by_user_id: userId,
     },
   });

   await this.auditLogger.logTenantChange({
     action: 'created',
     entityType: 'financial_category_account_mapping',
     entityId: created.id,
     tenantId,
     actorUserId: userId,
     after: created,
     description: `Created ${dto.platform} account mapping for category "${category.name}" → "${dto.account_name}"`,
   });

   return { ...created, statusCode: 201 };
   ```

**Why the `statusCode` field:** The controller checks this to return either `200 OK` (updated) or `201 Created` (new). This is the upsert behavior specified in the contract.

**Acceptance:** Upsert works: creates new mapping if none exists, updates existing if one exists. Audit logged in both cases. Category validated to belong to tenant.

---

### Task 4 — Implement `delete()`

**Method signature:**
```typescript
async delete(tenantId: string, mappingId: string, userId: string): Promise<void>
```

**What:** Delete a single account mapping by ID, scoped to tenant.

**Implementation:**
```typescript
async delete(tenantId: string, mappingId: string, userId: string): Promise<void> {
  const mapping = await this.prisma.financial_category_account_mapping.findFirst({
    where: { id: mappingId, tenant_id: tenantId },
  });

  if (!mapping) {
    throw new NotFoundException(`Account mapping ${mappingId} not found`);
  }

  await this.prisma.financial_category_account_mapping.delete({
    where: { id: mappingId },
  });

  await this.auditLogger.logTenantChange({
    action: 'deleted',
    entityType: 'financial_category_account_mapping',
    entityId: mappingId,
    tenantId,
    actorUserId: userId,
    before: mapping,
    description: `Deleted ${mapping.platform} account mapping for category ${mapping.category_id}`,
  });
}
```

**Acceptance:** Deletes mapping. Scoped to tenant. 404 if not found. Audit logged.

---

### Task 5 — Implement `getDefaults()`

**Method signature:**
```typescript
async getDefaults(tenantId: string, platform: string)
```

**What:** Returns a preview of what account name will be used for each category in exports — either the custom mapped name or the Lead360 category name as fallback.

**Implementation:**
```typescript
async getDefaults(tenantId: string, platform: string) {
  // 1. Get all active categories for the tenant
  const categories = await this.prisma.financial_category.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  // 2. Get all mappings for this tenant + platform
  const mappings = await this.prisma.financial_category_account_mapping.findMany({
    where: { tenant_id: tenantId, platform: platform as any },
  });

  // 3. Build a Map for fast lookup
  const mappingMap = new Map<string, { account_name: string; account_code: string | null }>();
  for (const m of mappings) {
    mappingMap.set(m.category_id, {
      account_name: m.account_name,
      account_code: m.account_code,
    });
  }

  // 4. Build response
  return categories.map((cat) => {
    const custom = mappingMap.get(cat.id);
    return {
      category_id: cat.id,
      category_name: cat.name,
      category_type: cat.type,
      classification: (cat as any).classification || null,
      has_custom_mapping: !!custom,
      account_name: custom ? custom.account_name : cat.name,
      account_code: custom ? custom.account_code : null,
    };
  });
}
```

**NOTE on `classification`:** The `classification` field comes from F-01. If F-01 is complete, access it directly as `cat.classification`. If the field does not exist yet on the Prisma type, use `(cat as any).classification || null` to prevent compilation errors — this will resolve when F-01 is applied.

**Acceptance:** Returns all active categories with resolved account names. Custom mappings override category names. No custom mapping = category name used as fallback.

---

### Task 6 — Implement `resolveAccountName()`

**Method signature:**
```typescript
async resolveAccountName(tenantId: string, categoryId: string, platform: string): Promise<{ account_name: string; account_code: string | null }>
```

**What:** Returns the account name for a single category — either custom mapping or category name fallback. This method is NOT called per-row during export (the export uses a bulk-loaded Map instead). This is for individual lookups.

**Implementation:**
```typescript
async resolveAccountName(tenantId: string, categoryId: string, platform: string) {
  const mapping = await this.prisma.financial_category_account_mapping.findFirst({
    where: {
      tenant_id: tenantId,
      category_id: categoryId,
      platform: platform as any,
    },
  });

  if (mapping) {
    return { account_name: mapping.account_name, account_code: mapping.account_code };
  }

  // Fallback: use category name
  const category = await this.prisma.financial_category.findFirst({
    where: { id: categoryId, tenant_id: tenantId },
    select: { name: true },
  });

  return {
    account_name: category?.name || 'Uncategorized',
    account_code: null,
  };
}
```

**Acceptance:** Returns custom mapping if exists, category name if not, "Uncategorized" if category not found.

---

### Task 7 — Verify Compilation

**What:** Start the dev server and confirm the new service compiles without errors.

**Note:** The service is NOT yet registered in the module — that happens in Sprint 10_7. For now, just verify the file compiles (TypeScript checks). If the server compilation complains about the service not being registered, that's expected — just verify there are no TypeScript errors in the service file itself.

**Actually** — to verify cleanly, you can temporarily add the service to the module. But it is better to just check for TypeScript errors by running:
```bash
cd /var/www/lead360.app/api && npx tsc --noEmit 2>&1 | grep -i "account-mapping"
```

If no errors referencing `account-mapping.service.ts`, the file is clean.

**Acceptance:** No TypeScript errors in the service file.

---

## Patterns to Apply

### Multi-Tenant Enforcement
Every Prisma query MUST include `where: { tenant_id: tenantId }`:
```typescript
await this.prisma.financial_category_account_mapping.findMany({
  where: { tenant_id: tenantId },
});
```

### AuditLoggerService
```typescript
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

await this.auditLogger.logTenantChange({
  action: 'created' | 'updated' | 'deleted',
  entityType: 'financial_category_account_mapping',
  entityId: string,
  tenantId: string,
  actorUserId: string,
  before?: object,
  after?: object,
  description: string,
});
```

### Existing Service Pattern (from financial-category.service.ts)
```typescript
@Injectable()
export class SomeService {
  private readonly logger = new Logger(SomeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}
}
```

### Import Paths
```typescript
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
```

---

## Business Rules Enforced in This Sprint

- BR-06: If no mapping exists for a category, the export uses the Lead360 `financial_category.name` as the QB/Xero account name. This is a valid fallback.
- BR-02: One mapping per category per platform per tenant — enforced by unique constraint `@@unique([tenant_id, category_id, platform])`.
- BR-07: All operations audit logged via `AuditLoggerService.logTenantChange()`.

---

## Integration Points

| Module | Import Path | What It Provides |
|--------|-------------|------------------|
| `core/database` | `../../../core/database/prisma.service` | `PrismaService` — database access |
| `audit` | `../../audit/services/audit-logger.service` | `AuditLoggerService.logTenantChange()` |

---

## Acceptance Criteria

- [ ] `account-mapping.service.ts` created at correct path
- [ ] `findAll()` returns mappings with nested category, filtered by tenant_id, optional platform filter
- [ ] `upsert()` creates new mapping or updates existing, returns statusCode 200 or 201
- [ ] `upsert()` validates category belongs to tenant (throws 404 if not)
- [ ] `delete()` removes mapping, scoped to tenant, throws 404 if not found
- [ ] `getDefaults()` returns all active categories with resolved account names (custom or fallback)
- [ ] `resolveAccountName()` returns custom mapping or category name fallback
- [ ] All methods filter by `tenant_id`
- [ ] All write operations audit logged
- [ ] No existing financial services modified
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — All 5 public service methods (`findAll`, `upsert`, `delete`, `getDefaults`, `resolveAccountName`) must be implemented and compile without errors. The service is the foundation for the export functionality — Sprint 10_4 through 10_6 depend on it.

---

## Handoff Notes

- `AccountMappingService` is at: `/var/www/lead360.app/api/src/modules/financial/services/account-mapping.service.ts`
- Public methods: `findAll(tenantId, platform?)`, `upsert(tenantId, userId, dto)`, `delete(tenantId, mappingId, userId)`, `getDefaults(tenantId, platform)`, `resolveAccountName(tenantId, categoryId, platform)`
- The `upsert()` method returns `{ ...record, statusCode: 200 | 201 }` — the controller uses `statusCode` to set the HTTP status code
- Module registration happens in Sprint 10_7
