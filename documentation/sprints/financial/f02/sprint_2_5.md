# Sprint 2.5 — Service Layer: SupplierProductService

**Module:** Financial
**File:** `./documentation/sprints/financial/f02/sprint_2_5.md`
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

Create the `SupplierProductService` — handles CRUD operations for products/services offered by a supplier, with automatic price history tracking. When a product's `unit_price` changes, a `supplier_product_price_history` record is automatically created.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand the existing service pattern
- [ ] Read the DTOs created in Sprint 2.2: `create-supplier-product.dto.ts`, `update-supplier-product.dto.ts`
- [ ] Verify the `supplier_product` and `supplier_product_price_history` tables exist in the Prisma client (from Sprint 2.1)

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

### Task 1 — Create `SupplierProductService`

**File:** `api/src/modules/financial/services/supplier-product.service.ts`

**Imports:**

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateSupplierProductDto } from '../dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from '../dto/update-supplier-product.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
```

**Constructor:**

```typescript
@Injectable()
export class SupplierProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}
```

---

### Task 2 — Implement Private Helper: `verifySupplierExists`

**Signature:** `private async verifySupplierExists(tenantId: string, supplierId: string)`

**Business logic:**

```typescript
const supplier = await this.prisma.supplier.findFirst({
  where: { id: supplierId, tenant_id: tenantId },
});
if (!supplier) {
  throw new NotFoundException('Supplier not found.');
}
return supplier;
```

---

### Task 3 — Implement `create` Method

**Signature:** `async create(tenantId: string, supplierId: string, userId: string, dto: CreateSupplierProductDto)`

**Business logic (in exact order):**

1. **Verify supplier exists:**
   ```typescript
   await this.verifySupplierExists(tenantId, supplierId);
   ```

2. **Case-insensitive name uniqueness within supplier:**
   ```typescript
   const existing = await this.prisma.supplier_product.findFirst({
     where: {
       supplier_id: supplierId,
       tenant_id: tenantId,
       name: dto.name, // MySQL ci collation handles case-insensitive
     },
   });
   if (existing) {
     throw new ConflictException(
       `Product "${dto.name}" already exists for this supplier.`,
     );
   }
   ```

3. **Create product and initial price history in a transaction:**
   ```typescript
   const productId = randomUUID();
   const now = new Date();

   const product = await this.prisma.$transaction(async (tx) => {
     const newProduct = await tx.supplier_product.create({
       data: {
         id: productId,
         tenant_id: tenantId,
         supplier_id: supplierId,
         name: dto.name,
         description: dto.description || null,
         unit_of_measure: dto.unit_of_measure,
         unit_price: dto.unit_price !== undefined ? new Decimal(dto.unit_price) : null,
         price_last_updated_at: dto.unit_price !== undefined ? now : null,
         price_last_updated_by_user_id: dto.unit_price !== undefined ? userId : null,
         sku: dto.sku || null,
         created_by_user_id: userId,
       },
     });

     // If unit_price is provided, create the first price history record
     if (dto.unit_price !== undefined) {
       await tx.supplier_product_price_history.create({
         data: {
           id: randomUUID(),
           tenant_id: tenantId,
           supplier_product_id: productId,
           supplier_id: supplierId,
           previous_price: null, // First price ever set
           new_price: new Decimal(dto.unit_price),
           changed_by_user_id: userId,
           notes: 'Initial price set on product creation',
         },
       });
     }

     return newProduct;
   });
   ```

4. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'created',
     entityType: 'supplier_product',
     entityId: productId,
     tenantId,
     actorUserId: userId,
     after: product,
     description: `Supplier product created: ${product.name}`,
   });
   ```

5. **Return the product.**

---

### Task 4 — Implement `findAll` Method

**Signature:** `async findAll(tenantId: string, supplierId: string, isActive?: boolean)`

**Business logic:**

```typescript
await this.verifySupplierExists(tenantId, supplierId);

const where: any = {
  tenant_id: tenantId,
  supplier_id: supplierId,
};

if (isActive !== undefined) {
  where.is_active = isActive;
} else {
  where.is_active = true; // Default to active only
}

const products = await this.prisma.supplier_product.findMany({
  where,
  orderBy: { name: 'asc' },
  select: {
    id: true,
    name: true,
    description: true,
    unit_of_measure: true,
    unit_price: true,
    price_last_updated_at: true,
    sku: true,
    is_active: true,
    created_at: true,
  },
});

return products;
```

---

### Task 5 — Implement `update` Method

**Signature:** `async update(tenantId: string, supplierId: string, productId: string, userId: string, dto: UpdateSupplierProductDto)`

**Business logic (in exact order):**

1. **Verify supplier and product exist:**
   ```typescript
   await this.verifySupplierExists(tenantId, supplierId);

   const existing = await this.prisma.supplier_product.findFirst({
     where: {
       id: productId,
       supplier_id: supplierId,
       tenant_id: tenantId,
     },
   });
   if (!existing) {
     throw new NotFoundException('Supplier product not found.');
   }
   ```

2. **Name uniqueness check (if name is changing):**
   ```typescript
   if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
     const duplicate = await this.prisma.supplier_product.findFirst({
       where: {
         supplier_id: supplierId,
         tenant_id: tenantId,
         name: dto.name,
         id: { not: productId },
       },
     });
     if (duplicate) {
       throw new ConflictException(
         `Product "${dto.name}" already exists for this supplier.`,
       );
     }
   }
   ```

3. **Detect price change and create history record:**
   ```typescript
   const priceChanged = dto.unit_price !== undefined &&
     (existing.unit_price === null || Number(existing.unit_price) !== dto.unit_price);

   const now = new Date();

   const updated = await this.prisma.$transaction(async (tx) => {
     // If price changed, create price history record BEFORE updating
     if (priceChanged) {
       await tx.supplier_product_price_history.create({
         data: {
           id: randomUUID(),
           tenant_id: tenantId,
           supplier_product_id: productId,
           supplier_id: supplierId,
           previous_price: existing.unit_price,
           new_price: new Decimal(dto.unit_price!),
           changed_by_user_id: userId,
         },
       });
     }

     // Update the product
     return tx.supplier_product.update({
       where: { id: productId },
       data: {
         ...(dto.name !== undefined && { name: dto.name }),
         ...(dto.description !== undefined && { description: dto.description }),
         ...(dto.unit_of_measure !== undefined && { unit_of_measure: dto.unit_of_measure }),
         ...(dto.unit_price !== undefined && { unit_price: new Decimal(dto.unit_price) }),
         ...(dto.sku !== undefined && { sku: dto.sku }),
         // Auto-update price tracking fields when price changes
         ...(priceChanged && {
           price_last_updated_at: now,
           price_last_updated_by_user_id: userId,
         }),
       },
     });
   });
   ```

4. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'updated',
     entityType: 'supplier_product',
     entityId: productId,
     tenantId,
     actorUserId: userId,
     before: existing,
     after: updated,
     description: `Supplier product updated: ${updated.name}${priceChanged ? ' (price changed)' : ''}`,
   });
   ```

5. **Return the updated product.**

---

### Task 6 — Implement `softDelete` Method

**Signature:** `async softDelete(tenantId: string, supplierId: string, productId: string, userId: string)`

**Business logic:**

```typescript
await this.verifySupplierExists(tenantId, supplierId);

const product = await this.prisma.supplier_product.findFirst({
  where: {
    id: productId,
    supplier_id: supplierId,
    tenant_id: tenantId,
  },
});
if (!product) {
  throw new NotFoundException('Supplier product not found.');
}

const updated = await this.prisma.supplier_product.update({
  where: { id: productId },
  data: { is_active: false },
});

await this.auditLogger.logTenantChange({
  action: 'deleted',
  entityType: 'supplier_product',
  entityId: productId,
  tenantId,
  actorUserId: userId,
  before: product,
  after: updated,
  description: `Supplier product soft-deleted: ${product.name}`,
});

return updated;
```

---

### Task 7 — Implement `getPriceHistory` Method

**Signature:** `async getPriceHistory(tenantId: string, supplierId: string, productId: string)`

**Business logic:**

```typescript
await this.verifySupplierExists(tenantId, supplierId);

// Verify product exists
const product = await this.prisma.supplier_product.findFirst({
  where: {
    id: productId,
    supplier_id: supplierId,
    tenant_id: tenantId,
  },
});
if (!product) {
  throw new NotFoundException('Supplier product not found.');
}

const history = await this.prisma.supplier_product_price_history.findMany({
  where: {
    tenant_id: tenantId,
    supplier_product_id: productId,
  },
  orderBy: { changed_at: 'desc' },
  include: {
    changed_by: {
      select: { id: true, first_name: true, last_name: true },
    },
  },
});

return history.map((h) => ({
  id: h.id,
  previous_price: h.previous_price,
  new_price: h.new_price,
  changed_at: h.changed_at,
  changed_by: h.changed_by,
  notes: h.notes,
}));
```

---

## Integration Points

| Service | Import Path | Usage |
|---------|-------------|-------|
| `PrismaService` | `../../../core/database/prisma.service` | Database operations |
| `AuditLoggerService` | `../../audit/services/audit-logger.service` | Audit logging |

---

## Business Rules Enforced in This Sprint

- BR-01: Product name is unique per supplier (case-insensitive)
- BR-02: Creating a product with `unit_price` auto-creates the first price history record with `previous_price = null`
- BR-03: Updating `unit_price` auto-creates a price history record before saving the update
- BR-04: `price_last_updated_at` is set automatically when `unit_price` changes — not sent by client
- BR-05: `price_last_updated_by_user_id` is set automatically when `unit_price` changes
- BR-06: Price history records are immutable — no update or delete via API
- BR-07: Soft delete sets `is_active = false` — no hard delete
- BR-08: Price history is ordered by `changed_at DESC` (most recent first)
- BR-09: All queries include `tenant_id` for multi-tenant isolation

---

## Acceptance Criteria

- [ ] `SupplierProductService` created at `api/src/modules/financial/services/supplier-product.service.ts`
- [ ] `create()` validates name uniqueness, creates product, creates initial price history when unit_price provided
- [ ] `findAll()` returns active products sorted by name, with all specified select fields
- [ ] `update()` detects price changes, creates price history record BEFORE updating, auto-sets price tracking fields
- [ ] `softDelete()` sets is_active = false with audit log
- [ ] `getPriceHistory()` returns ordered history with changed_by user info
- [ ] All methods have audit logging (except findAll and getPriceHistory)
- [ ] All queries include `tenant_id` filtering
- [ ] No existing files modified
- [ ] Dev server shut down before marking sprint complete

---

## Gate Marker

**NONE** — Proceed to Sprint 2.6.

---

## Handoff Notes

**For Sprint 2.6 (Controllers + Module Registration):**
- `SupplierProductService` is available at: `import { SupplierProductService } from './supplier-product.service';`
- All 3 services (SupplierCategoryService, SupplierService, SupplierProductService) are now ready for controller wiring
- None of the 3 services are registered in `financial.module.ts` yet — Sprint 2.6 handles all registrations
