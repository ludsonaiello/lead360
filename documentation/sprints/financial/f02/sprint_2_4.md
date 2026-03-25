# Sprint 2.4 — Service Layer: SupplierService

**Module:** Financial
**File:** `./documentation/sprints/financial/f02/sprint_2_4.md`
**Type:** Backend — Service
**Depends On:** Sprint 2.1 (Schema), Sprint 2.2 (DTOs), Sprint 2.3 (SupplierCategoryService)
**Gate:** STOP — All service methods must compile. The service file must have no TypeScript errors.
**Estimated Complexity:** High

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

Create the `SupplierService` — the core service for the Supplier Registry. This is the most complex service in F-02, handling:
- Full CRUD with Google Places address resolution
- Category assignment with replace semantics
- Map data endpoint
- Supplier statistics with financial_entry aggregation
- Spend totals management (updateSpendTotals)

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/quotes/services/vendor.service.ts` in full — understand the Google Places integration pattern. **Critical:** The existing vendor service uses `GoogleMapsService.validateAddress()` from the leads module. This is the pattern to replicate.
- [ ] Read `/var/www/lead360.app/api/src/modules/leads/services/google-maps.service.ts` in full — understand the `PartialAddress` and `ValidatedAddress` interfaces, and the `validateAddress()` method
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand the financial_entry data model for statistics queries
- [ ] Read the `supplier-category.service.ts` created in Sprint 2.3
- [ ] Read the DTOs created in Sprint 2.2: `create-supplier.dto.ts`, `update-supplier.dto.ts`, `list-suppliers.dto.ts`

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

### Task 1 — Create `SupplierService` File with Imports and Constructor

**File:** `api/src/modules/financial/services/supplier.service.ts`

**Imports:**

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  GoogleMapsService,
  PartialAddress,
  ValidatedAddress,
} from '../../leads/services/google-maps.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { ListSuppliersDto, SupplierSortBy, SortOrder } from '../dto/list-suppliers.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
```

**Constructor:**

```typescript
@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}
```

**Critical note on `GoogleMapsService`:**
- `GoogleMapsService` is provided by `LeadsModule` and exported from it
- The `QuotesModule` already imports `LeadsModule` to get `GoogleMapsService`
- The `FinancialModule` must also import `LeadsModule` to access `GoogleMapsService` — this happens in Sprint 2.6 (Module Registration)
- For now, write the service assuming the import will be available

---

### Task 2 — Implement `create` Method

**Signature:** `async create(tenantId: string, userId: string, dto: CreateSupplierDto)`

**Business logic (in exact order):**

1. **Case-insensitive name uniqueness:**
   ```typescript
   const existing = await this.prisma.supplier.findFirst({
     where: {
       tenant_id: tenantId,
       name: dto.name, // MySQL ci collation handles case-insensitive
     },
   });
   if (existing) {
     throw new ConflictException(
       `Supplier "${dto.name}" already exists for this tenant.`,
     );
   }
   ```

2. **Validate category_ids if provided:**
   ```typescript
   if (dto.category_ids && dto.category_ids.length > 0) {
     const categories = await this.prisma.supplier_category.findMany({
       where: {
         id: { in: dto.category_ids },
         tenant_id: tenantId,
       },
     });
     if (categories.length !== dto.category_ids.length) {
       throw new BadRequestException(
         'One or more category IDs are invalid or do not belong to this tenant.',
       );
     }
   }
   ```

3. **Google Places / Address resolution:**
   The existing `VendorService` pattern uses `GoogleMapsService.validateAddress()` which takes a `PartialAddress` object with address fields + optional lat/lng.

   For supplier, address fields are all optional. Only call Google Maps if the client provided address data:

   ```typescript
   let resolvedAddress: ValidatedAddress | null = null;

   // Only validate address if enough address info is provided
   const hasAddressInfo = dto.address_line1 || dto.zip_code || (dto.latitude != null && dto.longitude != null);

   if (hasAddressInfo) {
     try {
       const partialAddress: PartialAddress = {
         address_line1: dto.address_line1 || '',
         address_line2: dto.address_line2,
         city: dto.city,
         state: dto.state,
         zip_code: dto.zip_code || '',
         latitude: dto.latitude,
         longitude: dto.longitude,
       };
       resolvedAddress = await this.googleMapsService.validateAddress(partialAddress);
     } catch (error) {
       // If Google Maps fails, log but don't block supplier creation
       // Only throw if explicitly requested via google_place_id
       if (dto.google_place_id) {
         throw new UnprocessableEntityException(
           `Address resolution failed: ${error.message}`,
         );
       }
       this.logger.warn(`Address validation failed for supplier "${dto.name}": ${error.message}`);
     }
   }
   ```

4. **Create supplier in a transaction (with category assignments):**
   ```typescript
   const supplierId = randomUUID();

   const supplier = await this.prisma.$transaction(async (tx) => {
     // Create the supplier
     const newSupplier = await tx.supplier.create({
       data: {
         id: supplierId,
         tenant_id: tenantId,
         name: dto.name,
         legal_name: dto.legal_name || null,
         website: dto.website || null,
         phone: dto.phone || null,
         email: dto.email || null,
         contact_name: dto.contact_name || null,
         address_line1: resolvedAddress?.address_line1 || dto.address_line1 || null,
         address_line2: resolvedAddress?.address_line2 || dto.address_line2 || null,
         city: resolvedAddress?.city || dto.city || null,
         state: resolvedAddress?.state || dto.state || null,
         zip_code: resolvedAddress?.zip_code || dto.zip_code || null,
         country: resolvedAddress?.country || dto.country || 'US',
         latitude: resolvedAddress ? new Decimal(resolvedAddress.latitude) : (dto.latitude != null ? new Decimal(dto.latitude) : null),
         longitude: resolvedAddress ? new Decimal(resolvedAddress.longitude) : (dto.longitude != null ? new Decimal(dto.longitude) : null),
         google_place_id: resolvedAddress?.google_place_id || dto.google_place_id || null,
         notes: dto.notes || null,
         is_preferred: dto.is_preferred || false,
         created_by_user_id: userId,
       },
     });

     // Create category assignments if provided
     if (dto.category_ids && dto.category_ids.length > 0) {
       await tx.supplier_category_assignment.createMany({
         data: dto.category_ids.map((catId) => ({
           id: randomUUID(),
           supplier_id: supplierId,
           supplier_category_id: catId,
           tenant_id: tenantId,
         })),
       });
     }

     return newSupplier;
   });
   ```

5. **Fetch the full supplier with relations for response:**
   ```typescript
   const fullSupplier = await this.findOne(tenantId, supplierId);
   ```

6. **Audit log:**
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'created',
     entityType: 'supplier',
     entityId: supplierId,
     tenantId,
     actorUserId: userId,
     after: fullSupplier,
     description: `Supplier created: ${supplier.name}`,
   });
   ```

7. **Return `fullSupplier`.**

---

### Task 3 — Implement `findAll` Method

**Signature:** `async findAll(tenantId: string, query: ListSuppliersDto)`

**Business logic:**

```typescript
const {
  search,
  category_id,
  is_active = true,
  is_preferred,
  page = 1,
  limit = 20,
  sort_by = SupplierSortBy.NAME,
  sort_order = SortOrder.ASC,
} = query;

const skip = (page - 1) * limit;

// Build where clause
const where: any = {
  tenant_id: tenantId,
  is_active,
};

if (is_preferred !== undefined) {
  where.is_preferred = is_preferred;
}

if (search) {
  where.OR = [
    { name: { contains: search } },
    { contact_name: { contains: search } },
    { email: { contains: search } },
  ];
}

if (category_id) {
  where.category_assignments = {
    some: { supplier_category_id: category_id },
  };
}

// Build orderBy
const orderBy: any = {};
orderBy[sort_by] = sort_order;

const [suppliers, total] = await Promise.all([
  this.prisma.supplier.findMany({
    where,
    skip,
    take: limit,
    orderBy,
    include: {
      category_assignments: {
        include: {
          supplier_category: {
            select: { id: true, name: true, color: true },
          },
        },
      },
      _count: {
        select: { products: true },
      },
    },
  }),
  this.prisma.supplier.count({ where }),
]);

// Transform response
const data = suppliers.map((s) => ({
  id: s.id,
  name: s.name,
  legal_name: s.legal_name,
  phone: s.phone,
  email: s.email,
  contact_name: s.contact_name,
  city: s.city,
  state: s.state,
  is_preferred: s.is_preferred,
  is_active: s.is_active,
  total_spend: s.total_spend,
  last_purchase_date: s.last_purchase_date,
  categories: s.category_assignments.map((a) => ({
    id: a.supplier_category.id,
    name: a.supplier_category.name,
    color: a.supplier_category.color,
  })),
  product_count: s._count.products,
  created_at: s.created_at,
}));

return {
  data,
  meta: {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  },
};
```

---

### Task 4 — Implement `findOne` Method

**Signature:** `async findOne(tenantId: string, supplierId: string)`

**Business logic:**

```typescript
const supplier = await this.prisma.supplier.findFirst({
  where: { id: supplierId, tenant_id: tenantId },
  include: {
    category_assignments: {
      include: {
        supplier_category: {
          select: { id: true, name: true, color: true },
        },
      },
    },
    products: {
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        unit_of_measure: true,
        unit_price: true,
        price_last_updated_at: true,
        is_active: true,
      },
      orderBy: { name: 'asc' },
    },
    created_by: {
      select: { id: true, first_name: true, last_name: true },
    },
  },
});

if (!supplier) {
  throw new NotFoundException('Supplier not found.');
}

// Transform to flatten categories
return {
  ...supplier,
  categories: supplier.category_assignments.map((a) => ({
    id: a.supplier_category.id,
    name: a.supplier_category.name,
    color: a.supplier_category.color,
  })),
  category_assignments: undefined, // Remove raw junction data
};
```

---

### Task 5 — Implement `update` Method

**Signature:** `async update(tenantId: string, supplierId: string, userId: string, dto: UpdateSupplierDto)`

**Business logic (in exact order):**

1. **Find existing supplier:**
   ```typescript
   const existing = await this.prisma.supplier.findFirst({
     where: { id: supplierId, tenant_id: tenantId },
   });
   if (!existing) {
     throw new NotFoundException('Supplier not found.');
   }
   ```

2. **Name uniqueness check (if name is changing):**
   ```typescript
   if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
     const duplicate = await this.prisma.supplier.findFirst({
       where: {
         tenant_id: tenantId,
         name: dto.name,
         id: { not: supplierId },
       },
     });
     if (duplicate) {
       throw new ConflictException(
         `Supplier "${dto.name}" already exists for this tenant.`,
       );
     }
   }
   ```

3. **Validate category_ids if provided:**
   ```typescript
   if (dto.category_ids !== undefined) {
     if (dto.category_ids && dto.category_ids.length > 0) {
       const categories = await this.prisma.supplier_category.findMany({
         where: {
           id: { in: dto.category_ids },
           tenant_id: tenantId,
         },
       });
       if (categories.length !== dto.category_ids.length) {
         throw new BadRequestException(
           'One or more category IDs are invalid or do not belong to this tenant.',
         );
       }
     }
   }
   ```

4. **Address re-resolution (if address fields or google_place_id changed):**
   ```typescript
   let resolvedAddress: ValidatedAddress | null = null;
   const addressFieldsChanged = dto.address_line1 || dto.city || dto.state || dto.zip_code || dto.latitude !== undefined || dto.longitude !== undefined;
   const placeIdChanged = dto.google_place_id && dto.google_place_id !== existing.google_place_id;

   if (addressFieldsChanged || placeIdChanged) {
     try {
       const partialAddress: PartialAddress = {
         address_line1: dto.address_line1 || existing.address_line1 || '',
         address_line2: dto.address_line2 !== undefined ? dto.address_line2 : existing.address_line2 || undefined,
         city: dto.city || existing.city || undefined,
         state: dto.state || existing.state || undefined,
         zip_code: dto.zip_code || existing.zip_code || '',
         latitude: dto.latitude !== undefined ? dto.latitude : (existing.latitude ? Number(existing.latitude) : undefined),
         longitude: dto.longitude !== undefined ? dto.longitude : (existing.longitude ? Number(existing.longitude) : undefined),
       };
       resolvedAddress = await this.googleMapsService.validateAddress(partialAddress);
     } catch (error) {
       this.logger.warn(`Address re-validation failed for supplier "${existing.name}": ${error.message}`);
       // Don't block update if address resolution fails — allow manual address
     }
   }
   ```

5. **Build update data:**
   ```typescript
   const updateData: any = {};

   if (dto.name !== undefined) updateData.name = dto.name;
   if (dto.legal_name !== undefined) updateData.legal_name = dto.legal_name;
   if (dto.website !== undefined) updateData.website = dto.website;
   if (dto.phone !== undefined) updateData.phone = dto.phone;
   if (dto.email !== undefined) updateData.email = dto.email;
   if (dto.contact_name !== undefined) updateData.contact_name = dto.contact_name;
   if (dto.notes !== undefined) updateData.notes = dto.notes;
   if (dto.is_preferred !== undefined) updateData.is_preferred = dto.is_preferred;
   if (dto.country !== undefined) updateData.country = dto.country;

   if (resolvedAddress) {
     updateData.address_line1 = resolvedAddress.address_line1;
     updateData.address_line2 = resolvedAddress.address_line2;
     updateData.city = resolvedAddress.city;
     updateData.state = resolvedAddress.state;
     updateData.zip_code = resolvedAddress.zip_code;
     updateData.latitude = new Decimal(resolvedAddress.latitude);
     updateData.longitude = new Decimal(resolvedAddress.longitude);
     updateData.google_place_id = resolvedAddress.google_place_id;
   } else {
     // Manual address fields (no Google resolution)
     if (dto.address_line1 !== undefined) updateData.address_line1 = dto.address_line1;
     if (dto.address_line2 !== undefined) updateData.address_line2 = dto.address_line2;
     if (dto.city !== undefined) updateData.city = dto.city;
     if (dto.state !== undefined) updateData.state = dto.state;
     if (dto.zip_code !== undefined) updateData.zip_code = dto.zip_code;
     if (dto.latitude !== undefined) updateData.latitude = dto.latitude != null ? new Decimal(dto.latitude) : null;
     if (dto.longitude !== undefined) updateData.longitude = dto.longitude != null ? new Decimal(dto.longitude) : null;
     if (dto.google_place_id !== undefined) updateData.google_place_id = dto.google_place_id;
   }

   updateData.updated_by_user_id = userId;
   ```

6. **Update supplier + replace category assignments in transaction:**
   ```typescript
   await this.prisma.$transaction(async (tx) => {
     await tx.supplier.update({
       where: { id: supplierId },
       data: updateData,
     });

     // Replace category assignments if category_ids provided
     if (dto.category_ids !== undefined) {
       // Delete all existing assignments
       await tx.supplier_category_assignment.deleteMany({
         where: { supplier_id: supplierId, tenant_id: tenantId },
       });

       // Create new assignments
       if (dto.category_ids && dto.category_ids.length > 0) {
         await tx.supplier_category_assignment.createMany({
           data: dto.category_ids.map((catId) => ({
             id: randomUUID(),
             supplier_id: supplierId,
             supplier_category_id: catId,
             tenant_id: tenantId,
           })),
         });
       }
     }
   });
   ```

7. **Fetch and return full supplier:**
   ```typescript
   const updatedSupplier = await this.findOne(tenantId, supplierId);

   await this.auditLogger.logTenantChange({
     action: 'updated',
     entityType: 'supplier',
     entityId: supplierId,
     tenantId,
     actorUserId: userId,
     before: existing,
     after: updatedSupplier,
     description: `Supplier updated: ${updatedSupplier.name}`,
   });

   return updatedSupplier;
   ```

---

### Task 6 — Implement `softDelete` Method

**Signature:** `async softDelete(tenantId: string, supplierId: string, userId: string)`

**Business logic:**

```typescript
const supplier = await this.prisma.supplier.findFirst({
  where: { id: supplierId, tenant_id: tenantId },
});

if (!supplier) {
  throw new NotFoundException('Supplier not found.');
}

const updated = await this.prisma.supplier.update({
  where: { id: supplierId },
  data: {
    is_active: false,
    updated_by_user_id: userId,
  },
});

await this.auditLogger.logTenantChange({
  action: 'deleted',
  entityType: 'supplier',
  entityId: supplierId,
  tenantId,
  actorUserId: userId,
  before: supplier,
  after: updated,
  description: `Supplier soft-deleted: ${supplier.name}`,
});

return updated;
```

---

### Task 7 — Implement `findForMap` Method

**Signature:** `async findForMap(tenantId: string)`

**Business logic:**

```typescript
const suppliers = await this.prisma.supplier.findMany({
  where: {
    tenant_id: tenantId,
    is_active: true,
    latitude: { not: null },
    longitude: { not: null },
  },
  select: {
    id: true,
    name: true,
    latitude: true,
    longitude: true,
    city: true,
    state: true,
    is_preferred: true,
    total_spend: true,
    category_assignments: {
      include: {
        supplier_category: {
          select: { id: true, name: true, color: true },
        },
      },
    },
  },
});

return suppliers.map((s) => ({
  id: s.id,
  name: s.name,
  latitude: s.latitude,
  longitude: s.longitude,
  city: s.city,
  state: s.state,
  is_preferred: s.is_preferred,
  total_spend: s.total_spend,
  categories: s.category_assignments.map((a) => ({
    id: a.supplier_category.id,
    name: a.supplier_category.name,
    color: a.supplier_category.color,
  })),
}));
```

---

### Task 8 — Implement `getStatistics` Method

**Signature:** `async getStatistics(tenantId: string, supplierId: string)`

**Business logic:**

```typescript
// Verify supplier exists
const supplier = await this.prisma.supplier.findFirst({
  where: { id: supplierId, tenant_id: tenantId },
});
if (!supplier) {
  throw new NotFoundException('Supplier not found.');
}

// Aggregate from financial_entry (source of truth)
const [totalSpendResult, transactionCount, dateRange, spendByCategory, spendByMonth] = await Promise.all([
  // Total spend
  this.prisma.financial_entry.aggregate({
    where: { tenant_id: tenantId, supplier_id: supplierId },
    _sum: { amount: true },
  }),

  // Transaction count
  this.prisma.financial_entry.count({
    where: { tenant_id: tenantId, supplier_id: supplierId },
  }),

  // Date range
  this.prisma.financial_entry.aggregate({
    where: { tenant_id: tenantId, supplier_id: supplierId },
    _min: { entry_date: true },
    _max: { entry_date: true },
  }),

  // Spend by financial category
  this.prisma.financial_entry.groupBy({
    by: ['category_id'],
    where: { tenant_id: tenantId, supplier_id: supplierId },
    _sum: { amount: true },
  }),

  // Spend by month (last 12 months) — use raw query for date grouping
  this.prisma.$queryRaw`
    SELECT
      YEAR(entry_date) as year,
      MONTH(entry_date) as month,
      SUM(amount) as total_spend
    FROM financial_entry
    WHERE tenant_id = ${tenantId}
      AND supplier_id = ${supplierId}
      AND entry_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    GROUP BY YEAR(entry_date), MONTH(entry_date)
    ORDER BY year DESC, month DESC
  `,
]);

// Resolve category names for spend_by_category
let spendByCategoryResolved: any[] = [];
if (spendByCategory.length > 0) {
  const categoryIds = spendByCategory.map((s) => s.category_id);
  const categories = await this.prisma.financial_category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  spendByCategoryResolved = spendByCategory.map((s) => ({
    category_name: categoryMap.get(s.category_id) || 'Unknown',
    total_spend: s._sum.amount || 0,
  }));
}

return {
  supplier_id: supplierId,
  total_spend: totalSpendResult._sum.amount || 0,
  transaction_count: transactionCount,
  last_purchase_date: dateRange._max.entry_date || null,
  first_purchase_date: dateRange._min.entry_date || null,
  spend_by_category: spendByCategoryResolved,
  spend_by_month: spendByMonth,
};
```

---

### Task 9 — Implement `updateSpendTotals` Method (Public)

**Signature:** `async updateSpendTotals(tenantId: string, supplierId: string)`

**Purpose:** Called by FinancialEntryService when a financial_entry is created, updated, or deleted with a `supplier_id`. Recomputes the denormalized `total_spend` and `last_purchase_date` fields on the supplier record.

**Business logic:**

```typescript
// Use Prisma aggregate — NOT loading all entries and summing in JavaScript
const [spendResult, lastPurchase] = await Promise.all([
  this.prisma.financial_entry.aggregate({
    where: { tenant_id: tenantId, supplier_id: supplierId },
    _sum: { amount: true },
  }),
  this.prisma.financial_entry.aggregate({
    where: { tenant_id: tenantId, supplier_id: supplierId },
    _max: { entry_date: true },
  }),
]);

await this.prisma.supplier.update({
  where: { id: supplierId },
  data: {
    total_spend: spendResult._sum.amount || new Decimal(0),
    last_purchase_date: lastPurchase._max.entry_date || null,
  },
});
```

**Important:** This method must be `public` so it can be called by `FinancialEntryService` from the same module. It is NOT called by controllers — only by other services.

---

## Integration Points

| Service | Import Path | Usage |
|---------|-------------|-------|
| `PrismaService` | `../../../core/database/prisma.service` | Database operations |
| `AuditLoggerService` | `../../audit/services/audit-logger.service` | Audit logging |
| `GoogleMapsService` | `../../leads/services/google-maps.service` | Address validation/geocoding |

**Note:** `GoogleMapsService` is exported by `LeadsModule`. The `FinancialModule` must import `LeadsModule` — this is wired in Sprint 2.6.

---

## Business Rules Enforced in This Sprint

- BR-01: Supplier name is unique per tenant (case-insensitive)
- BR-02: When `google_place_id` or address fields are provided, resolve via Google Maps
- BR-03: Category assignment on create uses the provided `category_ids` array
- BR-04: Category assignment on update uses REPLACE semantics (not merge)
- BR-05: Soft delete sets `is_active = false` — never hard-deletes
- BR-06: Map endpoint returns only active suppliers with non-null lat/lng
- BR-07: Statistics endpoint recomputes from raw financial_entry data (source of truth)
- BR-08: `total_spend` and `last_purchase_date` are denormalized caches updated via `updateSpendTotals()`
- BR-09: All queries include `tenant_id` for multi-tenant isolation

---

## Acceptance Criteria

- [ ] `SupplierService` created at `api/src/modules/financial/services/supplier.service.ts`
- [ ] `create()` validates name uniqueness, category_ids, resolves address via Google Maps, creates in transaction
- [ ] `findAll()` supports search, category_id filter, pagination, and sorting
- [ ] `findOne()` returns full supplier with categories and products
- [ ] `update()` handles name uniqueness, address re-resolution, category replace semantics
- [ ] `softDelete()` sets is_active = false with audit log
- [ ] `findForMap()` returns only active suppliers with lat/lng
- [ ] `getStatistics()` aggregates from financial_entry with spend_by_category and spend_by_month
- [ ] `updateSpendTotals()` uses Prisma aggregate queries (not JS summation)
- [ ] All methods have audit logging (except findAll, findOne, findForMap, getStatistics, updateSpendTotals)
- [ ] No existing files modified
- [ ] Dev server shut down before marking sprint complete

---

## Gate Marker

**STOP** — The `SupplierService` must compile without TypeScript errors. All 8 public methods must be present. Verify by checking that the file has no red squiggly lines in the editor or no compilation errors in the dev server output. **Do not begin Sprint 2.5 until verified.**

---

## Handoff Notes

**For Sprint 2.5 (SupplierProductService):**
- `SupplierService` is available for import at: `import { SupplierService } from './supplier.service';`
- The `findOne` method can be used to verify supplier existence before creating products
- `updateSpendTotals()` will be called by `FinancialEntryService` (wired in Sprint 2.7)
- The service is NOT yet registered in `financial.module.ts` — that happens in Sprint 2.6
