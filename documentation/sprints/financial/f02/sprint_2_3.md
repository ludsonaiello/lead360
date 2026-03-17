# Sprint 2.3 — Service Layer: SupplierCategoryService

**Module:** Financial
**File:** `./documentation/sprints/financial/f02/sprint_2_3.md`
**Type:** Backend — Service
**Depends On:** Sprint 2.1 (Schema), Sprint 2.2 (DTOs)
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Developer Standard

You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is deliberate, precise, and production-grade.

---

## Critical Warnings

- **This platform is 85% production-ready.** Never break existing code. Never leave the server running in the background.
- **Read the codebase before touching anything.** Implement with surgical precision — not a single comma may break existing business logic.
- **MySQL credentials are in the `.env` file** at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.
- **Never use `pkill -f`.** Always use `lsof -i :8000` + `kill {PID}`.
- **Never use PM2.** This project does NOT use PM2.

---

## Objective

Create the `SupplierCategoryService` with full CRUD operations for tenant-managed supplier categories. This service handles dynamic category creation, deactivation, and deletion with business rule enforcement (uniqueness, 50-category limit, delete blocking).

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts` — understand the existing category service pattern (imports, constructor, method signatures, audit logging)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-supplier-category.dto.ts` — confirm DTO exists from Sprint 2.2
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/update-supplier-category.dto.ts` — confirm DTO exists from Sprint 2.2
- [ ] Verify the `supplier_category` table exists in the Prisma client (from Sprint 2.1)

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

### Task 1 — Create `SupplierCategoryService`

**File:** `api/src/modules/financial/services/supplier-category.service.ts`

**Imports required:**

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateSupplierCategoryDto } from '../dto/create-supplier-category.dto';
import { UpdateSupplierCategoryDto } from '../dto/update-supplier-category.dto';
import { randomUUID } from 'crypto';
```

**Constructor:**

```typescript
@Injectable()
export class SupplierCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}
```

---

### Task 2 — Implement `create` Method

**Signature:** `async create(tenantId: string, userId: string, dto: CreateSupplierCategoryDto)`

**Business logic (in exact order):**

1. **Check 50-category limit.** Count active categories for this tenant:
   ```typescript
   const activeCount = await this.prisma.supplier_category.count({
     where: { tenant_id: tenantId, is_active: true },
   });
   if (activeCount >= 50) {
     throw new BadRequestException(
       'Maximum of 50 active supplier categories per tenant. Deactivate unused categories before creating new ones.',
     );
   }
   ```

2. **Case-insensitive uniqueness check.** Find any category with the same name (case-insensitive) for this tenant:
   ```typescript
   const existing = await this.prisma.supplier_category.findFirst({
     where: {
       tenant_id: tenantId,
       name: { equals: dto.name, mode: 'insensitive' },
     },
   });
   if (existing) {
     throw new ConflictException(
       `Supplier category "${dto.name}" already exists for this tenant.`,
     );
   }
   ```
   **Note on MySQL:** Prisma's `mode: 'insensitive'` may not work on MySQL/MariaDB. If MySQL, the default collation (`utf8mb4_unicode_ci`) is already case-insensitive. Check the existing `financial-category.service.ts` to see how case-insensitive checks are done there and replicate the same pattern. If the existing service doesn't use `mode: 'insensitive'`, use a raw query or rely on the collation:
   ```typescript
   const existing = await this.prisma.supplier_category.findFirst({
     where: {
       tenant_id: tenantId,
       name: dto.name, // MySQL ci collation handles case-insensitive matching
     },
   });
   ```

3. **Create the category:**
   ```typescript
   const categoryId = randomUUID();
   const category = await this.prisma.supplier_category.create({
     data: {
       id: categoryId,
       tenant_id: tenantId,
       name: dto.name,
       description: dto.description || null,
       color: dto.color || null,
       created_by_user_id: userId,
     },
   });
   ```

4. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'created',
     entityType: 'supplier_category',
     entityId: category.id,
     tenantId,
     actorUserId: userId,
     after: category,
     description: `Supplier category created: ${category.name}`,
   });
   ```

5. **Return the created category.**

---

### Task 3 — Implement `findAll` Method

**Signature:** `async findAll(tenantId: string, isActive?: boolean)`

**Business logic:**

1. Build the where clause:
   ```typescript
   const where: any = { tenant_id: tenantId };
   if (isActive !== undefined) {
     where.is_active = isActive;
   }
   ```

2. Query categories with supplier count:
   ```typescript
   const categories = await this.prisma.supplier_category.findMany({
     where,
     orderBy: { name: 'asc' },
     include: {
       _count: {
         select: {
           assignments: {
             where: {
               supplier: { is_active: true },
             },
           },
         },
       },
     },
   });
   ```

   **Note:** The `_count` with a nested `where` on the related supplier's `is_active` may require a different approach in Prisma. If the nested where on `_count` is not supported, use a raw count or a subquery. An alternative approach:

   ```typescript
   const categories = await this.prisma.supplier_category.findMany({
     where,
     orderBy: { name: 'asc' },
   });

   // Get supplier counts for each category
   const categoriesWithCounts = await Promise.all(
     categories.map(async (cat) => {
       const supplierCount = await this.prisma.supplier_category_assignment.count({
         where: {
           supplier_category_id: cat.id,
           tenant_id: tenantId,
           supplier: { is_active: true },
         },
       });
       return { ...cat, supplier_count: supplierCount };
     }),
   );
   ```

   **Performance note:** If performance is a concern with many categories, use a single grouped query instead. But since max is 50 categories, the above approach is acceptable.

3. **Return the array** with `supplier_count` added to each category:
   ```typescript
   return categoriesWithCounts;
   ```

---

### Task 4 — Implement `findOne` Method

**Signature:** `async findOne(tenantId: string, categoryId: string)`

**Business logic:**

```typescript
const category = await this.prisma.supplier_category.findFirst({
  where: { id: categoryId, tenant_id: tenantId },
});

if (!category) {
  throw new NotFoundException('Supplier category not found.');
}

return category;
```

---

### Task 5 — Implement `update` Method

**Signature:** `async update(tenantId: string, categoryId: string, userId: string, dto: UpdateSupplierCategoryDto)`

**Business logic (in exact order):**

1. **Find existing category:**
   ```typescript
   const existing = await this.findOne(tenantId, categoryId);
   ```

2. **If name is being changed, check uniqueness:**
   ```typescript
   if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
     const duplicate = await this.prisma.supplier_category.findFirst({
       where: {
         tenant_id: tenantId,
         name: dto.name, // MySQL ci collation handles case-insensitive
         id: { not: categoryId },
       },
     });
     if (duplicate) {
       throw new ConflictException(
         `Supplier category "${dto.name}" already exists for this tenant.`,
       );
     }
   }
   ```

3. **If activating (is_active: true), check 50-limit:**
   ```typescript
   if (dto.is_active === true && !existing.is_active) {
     const activeCount = await this.prisma.supplier_category.count({
       where: { tenant_id: tenantId, is_active: true },
     });
     if (activeCount >= 50) {
       throw new BadRequestException(
         'Maximum of 50 active supplier categories per tenant.',
       );
     }
   }
   ```

4. **Update:**
   ```typescript
   const updated = await this.prisma.supplier_category.update({
     where: { id: categoryId },
     data: {
       ...(dto.name !== undefined && { name: dto.name }),
       ...(dto.description !== undefined && { description: dto.description }),
       ...(dto.color !== undefined && { color: dto.color }),
       ...(dto.is_active !== undefined && { is_active: dto.is_active }),
     },
   });
   ```

5. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'updated',
     entityType: 'supplier_category',
     entityId: categoryId,
     tenantId,
     actorUserId: userId,
     before: existing,
     after: updated,
     description: `Supplier category updated: ${updated.name}`,
   });
   ```

6. **Return the updated category.**

---

### Task 6 — Implement `delete` Method

**Signature:** `async delete(tenantId: string, categoryId: string, userId: string)`

**Business logic (in exact order):**

1. **Find existing category:**
   ```typescript
   const existing = await this.findOne(tenantId, categoryId);
   ```

2. **Check if category is assigned to any active supplier:**
   ```typescript
   const assignmentCount = await this.prisma.supplier_category_assignment.count({
     where: {
       supplier_category_id: categoryId,
       tenant_id: tenantId,
     },
   });
   if (assignmentCount > 0) {
     throw new ConflictException(
       'Category is assigned to one or more suppliers. Deactivate it instead.',
     );
   }
   ```
   **Note:** The contract says "assigned to any active supplier" but to be safe, block delete if assigned to ANY supplier (active or not). This prevents orphaned junction records.

3. **Hard delete:**
   ```typescript
   await this.prisma.supplier_category.delete({
     where: { id: categoryId },
   });
   ```

4. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'deleted',
     entityType: 'supplier_category',
     entityId: categoryId,
     tenantId,
     actorUserId: userId,
     before: existing,
     description: `Supplier category deleted: ${existing.name}`,
   });
   ```

5. **Return:** `{ message: 'Supplier category deleted successfully' }`

---

## Integration Points

| Service | Import Path | Usage |
|---------|-------------|-------|
| `PrismaService` | `../../../core/database/prisma.service` | Database operations |
| `AuditLoggerService` | `../../audit/services/audit-logger.service` | Audit logging |

---

## Business Rules Enforced in This Sprint

- BR-01: Category name is unique per tenant (case-insensitive comparison, enforced at service level)
- BR-02: Maximum 50 active categories per tenant (enforced on create and on reactivation)
- BR-03: A category cannot be deleted if it is assigned to any supplier (throws ConflictException)
- BR-04: Deactivating a category does not remove its assignments from suppliers
- BR-05: All queries include `tenant_id` for multi-tenant isolation

---

## Acceptance Criteria

- [ ] `SupplierCategoryService` created at `api/src/modules/financial/services/supplier-category.service.ts`
- [ ] `create()` enforces 50-category limit and case-insensitive uniqueness
- [ ] `findAll()` returns categories with `supplier_count` for each
- [ ] `findOne()` throws 404 if not found or wrong tenant
- [ ] `update()` validates uniqueness on name change and 50-limit on reactivation
- [ ] `delete()` blocks when category has supplier assignments, throws ConflictException
- [ ] All 5 methods include proper audit logging
- [ ] All queries include `tenant_id` filtering
- [ ] No existing files modified
- [ ] Dev server shut down before marking sprint complete

---

## Gate Marker

**NONE** — Proceed to Sprint 2.4.

---

## Handoff Notes

**For Sprint 2.4 (SupplierService):**
- `SupplierCategoryService` is available for import at: `import { SupplierCategoryService } from './supplier-category.service';`
- The service is NOT yet registered in `financial.module.ts` — that happens in Sprint 2.6
- The `findOne` method can be used to validate category IDs when assigning categories to suppliers
