# Sprint 2.6 — Controllers + Module Registration + Tenant Isolation

**Module:** Financial
**File:** `./documentation/sprints/financial/f02/sprint_2_6.md`
**Type:** Backend — Controllers + Module Wiring
**Depends On:** Sprint 2.3 (SupplierCategoryService), Sprint 2.4 (SupplierService), Sprint 2.5 (SupplierProductService)
**Gate:** STOP — Server must start. Swagger must show all new endpoints. All routes must be accessible (401 without token is acceptable — proves the route exists).
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

Create 3 NestJS controllers exposing all 16 supplier endpoints. Register all new services and controllers in the financial module. Add new supplier models to the tenant isolation middleware. Wire `LeadsModule` import into `FinancialModule` to provide `GoogleMapsService`.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/financial-category.controller.ts` — understand the existing controller pattern (guards, decorators, request handling)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts` — understand how routes under the `financial` prefix work
- [ ] Read `/var/www/lead360.app/api/src/modules/quotes/controllers/vendor.controller.ts` — understand the vendor controller pattern
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/financial.module.ts` — understand current module registration
- [ ] Read `/var/www/lead360.app/api/src/core/database/prisma.service.ts` — locate the `TENANT_SCOPED_MODELS` array
- [ ] Verify all 3 services exist from Sprints 2.3, 2.4, 2.5

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

### Task 1 — Create `SupplierCategoryController`

**File:** `api/src/modules/financial/controllers/supplier-category.controller.ts`

**Full implementation:**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SupplierCategoryService } from '../services/supplier-category.service';
import { CreateSupplierCategoryDto } from '../dto/create-supplier-category.dto';
import { UpdateSupplierCategoryDto } from '../dto/update-supplier-category.dto';

@ApiTags('Financial - Supplier Categories')
@ApiBearerAuth()
@Controller('financial/supplier-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierCategoryController {
  constructor(
    private readonly supplierCategoryService: SupplierCategoryService,
  ) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List all supplier categories for tenant' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'List of supplier categories with supplier counts' })
  async findAll(
    @Request() req,
    @Query('is_active') isActive?: string,
  ) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.supplierCategoryService.findAll(req.user.tenant_id, isActiveBool);
  }

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Create a new supplier category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or 50-category limit reached' })
  @ApiResponse({ status: 409, description: 'Category name already exists for this tenant' })
  async create(
    @Request() req,
    @Body() dto: CreateSupplierCategoryDto,
  ) {
    return this.supplierCategoryService.create(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a supplier category' })
  @ApiParam({ name: 'id', description: 'Supplier category UUID' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierCategoryDto,
  ) {
    return this.supplierCategoryService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Delete a supplier category (blocked if assigned to suppliers)' })
  @ApiParam({ name: 'id', description: 'Supplier category UUID' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category is assigned to one or more suppliers' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplierCategoryService.delete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
```

**Endpoint summary (4 endpoints):**
| Method | Path | Roles |
|--------|------|-------|
| GET | `/financial/supplier-categories` | All |
| POST | `/financial/supplier-categories` | Owner, Admin, Manager, Bookkeeper |
| PATCH | `/financial/supplier-categories/:id` | Owner, Admin, Manager, Bookkeeper |
| DELETE | `/financial/supplier-categories/:id` | Owner, Admin |

---

### Task 2 — Create `SupplierController`

**File:** `api/src/modules/financial/controllers/supplier.controller.ts`

**⚠️ CRITICAL ROUTING ORDER:** The `GET /financial/suppliers/map` route MUST be defined BEFORE `GET /financial/suppliers/:id`. Otherwise, NestJS will try to match "map" as a UUID `:id` parameter and the map endpoint will never be reached.

**Full implementation:**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SupplierService } from '../services/supplier.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { ListSuppliersDto } from '../dto/list-suppliers.dto';

@ApiTags('Financial - Suppliers')
@ApiBearerAuth()
@Controller('financial/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  // ========== LIST ==========

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List suppliers with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of suppliers' })
  async findAll(
    @Request() req,
    @Query() query: ListSuppliersDto,
  ) {
    return this.supplierService.findAll(req.user.tenant_id, query);
  }

  // ========== CREATE ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({ status: 201, description: 'Supplier created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid category IDs' })
  @ApiResponse({ status: 409, description: 'Supplier name already exists for this tenant' })
  @ApiResponse({ status: 422, description: 'Google Places address resolution failed' })
  async create(
    @Request() req,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.supplierService.create(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  // ========== MAP (MUST be before :id route) ==========

  @Get('map')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get all active suppliers with lat/lng for map rendering' })
  @ApiResponse({ status: 200, description: 'Array of suppliers with coordinates' })
  async findForMap(@Request() req) {
    return this.supplierService.findForMap(req.user.tenant_id);
  }

  // ========== SINGLE SUPPLIER (after map route) ==========

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get a single supplier with full details' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({ status: 200, description: 'Full supplier details with categories and products' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplierService.findOne(req.user.tenant_id, id);
  }

  // ========== UPDATE ==========

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a supplier (partial update)' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({ status: 200, description: 'Supplier updated successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 409, description: 'Supplier name already exists' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ========== SOFT DELETE ==========

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Soft-delete a supplier (set is_active = false)' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({ status: 200, description: 'Supplier deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async softDelete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplierService.softDelete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  // ========== STATISTICS ==========

  @Get(':id/statistics')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get supplier spend statistics' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({ status: 200, description: 'Supplier statistics with spend breakdown' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async getStatistics(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplierService.getStatistics(req.user.tenant_id, id);
  }
}
```

**Endpoint summary (7 endpoints):**
| Method | Path | Roles | Order Note |
|--------|------|-------|------------|
| GET | `/financial/suppliers` | All | — |
| POST | `/financial/suppliers` | Owner, Admin, Manager, Bookkeeper | — |
| GET | `/financial/suppliers/map` | All | **MUST be before :id** |
| GET | `/financial/suppliers/:id` | All | After map |
| PATCH | `/financial/suppliers/:id` | Owner, Admin, Manager, Bookkeeper | — |
| DELETE | `/financial/suppliers/:id` | Owner, Admin | — |
| GET | `/financial/suppliers/:id/statistics` | All | — |

---

### Task 3 — Create `SupplierProductController`

**File:** `api/src/modules/financial/controllers/supplier-product.controller.ts`

**Full implementation:**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SupplierProductService } from '../services/supplier-product.service';
import { CreateSupplierProductDto } from '../dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from '../dto/update-supplier-product.dto';

@ApiTags('Financial - Supplier Products')
@ApiBearerAuth()
@Controller('financial/suppliers/:supplierId/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierProductController {
  constructor(
    private readonly supplierProductService: SupplierProductService,
  ) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List products for a supplier' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Filter by active status (default: true)' })
  @ApiResponse({ status: 200, description: 'Array of supplier products' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async findAll(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Query('is_active') isActive?: string,
  ) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.supplierProductService.findAll(
      req.user.tenant_id,
      supplierId,
      isActiveBool,
    );
  }

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Add a product to a supplier' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 409, description: 'Product name already exists for this supplier' })
  async create(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() dto: CreateSupplierProductDto,
  ) {
    return this.supplierProductService.create(
      req.user.tenant_id,
      supplierId,
      req.user.id,
      dto,
    );
  }

  @Patch(':productId')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a supplier product (price change triggers history)' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Supplier or product not found' })
  @ApiResponse({ status: 409, description: 'Product name already exists for this supplier' })
  async update(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateSupplierProductDto,
  ) {
    return this.supplierProductService.update(
      req.user.tenant_id,
      supplierId,
      productId,
      req.user.id,
      dto,
    );
  }

  @Delete(':productId')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Soft-delete a supplier product' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Supplier or product not found' })
  async softDelete(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.supplierProductService.softDelete(
      req.user.tenant_id,
      supplierId,
      productId,
      req.user.id,
    );
  }

  @Get(':productId/price-history')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get price change history for a product' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Price history ordered by most recent first' })
  @ApiResponse({ status: 404, description: 'Supplier or product not found' })
  async getPriceHistory(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.supplierProductService.getPriceHistory(
      req.user.tenant_id,
      supplierId,
      productId,
    );
  }
}
```

**Endpoint summary (5 endpoints):**
| Method | Path | Roles |
|--------|------|-------|
| GET | `/financial/suppliers/:supplierId/products` | All |
| POST | `/financial/suppliers/:supplierId/products` | Owner, Admin, Manager, Bookkeeper |
| PATCH | `/financial/suppliers/:supplierId/products/:productId` | Owner, Admin, Manager, Bookkeeper |
| DELETE | `/financial/suppliers/:supplierId/products/:productId` | Owner, Admin |
| GET | `/financial/suppliers/:supplierId/products/:productId/price-history` | All |

---

### Task 4 — Update `financial.module.ts`

**File:** `api/src/modules/financial/financial.module.ts`

**What to modify:**

1. **Add `LeadsModule` to imports** (provides `GoogleMapsService` needed by `SupplierService`):
   ```typescript
   import { LeadsModule } from '../leads/leads.module';
   ```
   Add `LeadsModule` to the `imports` array.

2. **Add new service imports:**
   ```typescript
   // Gate 4 (Sprint F-02) — Supplier Registry
   import { SupplierCategoryService } from './services/supplier-category.service';
   import { SupplierService } from './services/supplier.service';
   import { SupplierProductService } from './services/supplier-product.service';
   ```

3. **Add new controller imports:**
   ```typescript
   import { SupplierCategoryController } from './controllers/supplier-category.controller';
   import { SupplierController } from './controllers/supplier.controller';
   import { SupplierProductController } from './controllers/supplier-product.controller';
   ```

4. **Register in `@Module` decorator:**
   - Add to `imports`: `LeadsModule`
   - Add to `controllers`: `SupplierCategoryController`, `SupplierController`, `SupplierProductController`
   - Add to `providers`: `SupplierCategoryService`, `SupplierService`, `SupplierProductService`
   - Add to `exports`: `SupplierService` (needed by FinancialEntryService in Sprint 2.7)

**Example of what the updated module looks like (add these AFTER the existing Gate 3 entries):**

```typescript
@Module({
  imports: [PrismaModule, AuditModule, FilesModule, LeadsModule], // ← Add LeadsModule
  controllers: [
    // Gate 1
    FinancialCategoryController,
    FinancialEntryController,
    ProjectFinancialSummaryController,
    // Gate 2
    ReceiptController,
    // Gate 3
    CrewPaymentController,
    CrewPaymentHistoryController,
    CrewHourLogController,
    SubcontractorPaymentController,
    SubcontractorPaymentHistoryController,
    SubcontractorPaymentSummaryController,
    SubcontractorInvoiceController,
    TaskInvoicesController,
    SubcontractorInvoiceListController,
    // Gate 4 — Supplier Registry
    SupplierCategoryController,
    SupplierController,
    SupplierProductController,
  ],
  providers: [
    // ... existing providers ...
    // Gate 4 — Supplier Registry
    SupplierCategoryService,
    SupplierService,
    SupplierProductService,
  ],
  exports: [
    // ... existing exports ...
    // Gate 4 — Supplier Registry
    SupplierService,
  ],
})
```

**CRITICAL:** Check for circular dependency between `FinancialModule` and `LeadsModule`. The `LeadsModule` does NOT import `FinancialModule`, so there is no circular dependency. Verify this by reading `LeadsModule.imports`.

---

### Task 5 — Add Supplier Models to TENANT_SCOPED_MODELS

**File:** `api/src/core/database/prisma.service.ts`

**What to modify:** Locate the `TENANT_SCOPED_MODELS` array in the `setupTenantIsolationMiddleware()` private method. Add the new supplier models to the array.

**Add these entries** (after the existing entries, before the closing `]`):

The existing entries in the array use **PascalCase** (e.g., `'Vendor'`, `'Quote'`, `'TenantAddress'`). You MUST match this convention exactly. Prisma middleware returns model names in PascalCase regardless of how they are defined in the schema. If you use the wrong casing, the tenant isolation check will silently fail.

```typescript
// Supplier Registry Models (Sprint F-02)
'SupplierCategory',
'SupplierCategoryAssignment',
'Supplier',
'SupplierProduct',
'SupplierProductPriceHistory',
```

**Also add financial models if they're missing** (check if `FinancialEntry` and `FinancialCategory` are already in the array — if not, add them):
```typescript
'FinancialCategory',
'FinancialEntry',
```

**VERIFICATION:** After adding, read the full `TENANT_SCOPED_MODELS` array and confirm every entry uses PascalCase. If you see any snake_case entry mixed in, that entry is broken — fix it.

---

### Task 6 — Verify Server Starts and Routes Exist

**Steps:**

1. Start the dev server (see Dev Server section)
2. Wait for health check to pass
3. Verify Swagger docs show new endpoints:
   ```bash
   curl -s http://localhost:8000/api/docs-json | grep -o '"\/financial\/supplier[^"]*"' | sort
   ```
   Expected routes in Swagger:
   - `/financial/supplier-categories`
   - `/financial/supplier-categories/{id}`
   - `/financial/suppliers`
   - `/financial/suppliers/map`
   - `/financial/suppliers/{id}`
   - `/financial/suppliers/{id}/statistics`
   - `/financial/suppliers/{supplierId}/products`
   - `/financial/suppliers/{supplierId}/products/{productId}`
   - `/financial/suppliers/{supplierId}/products/{productId}/price-history`

4. Verify routes respond (401 is OK — proves route exists):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/supplier-categories
   # Expected: 401 (no auth token)

   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/suppliers
   # Expected: 401

   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/suppliers/map
   # Expected: 401
   ```

5. Verify map route is NOT matching as `:id`:
   ```bash
   # This should return 401 (auth required), NOT 400 (invalid UUID)
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/financial/suppliers/map
   # If it returns 400, the route order is wrong — map is being matched as :id
   ```

6. Stop the dev server.

---

## Files Created

| File | Purpose |
|------|---------|
| `api/src/modules/financial/controllers/supplier-category.controller.ts` | 4 supplier category endpoints |
| `api/src/modules/financial/controllers/supplier.controller.ts` | 7 supplier endpoints |
| `api/src/modules/financial/controllers/supplier-product.controller.ts` | 5 supplier product endpoints |

## Files Modified

| File | Changes |
|------|---------|
| `api/src/modules/financial/financial.module.ts` | Add LeadsModule import, register 3 new services + 3 new controllers |
| `api/src/core/database/prisma.service.ts` | Add 5 new models to TENANT_SCOPED_MODELS |

---

## Acceptance Criteria

- [ ] `SupplierCategoryController` exposes 4 endpoints under `/financial/supplier-categories`
- [ ] `SupplierController` exposes 7 endpoints under `/financial/suppliers`
- [ ] `SupplierProductController` exposes 5 endpoints under `/financial/suppliers/:supplierId/products`
- [ ] `GET /financial/suppliers/map` route is defined BEFORE `GET /financial/suppliers/:id`
- [ ] All controllers use `JwtAuthGuard` and `RolesGuard`
- [ ] All controllers have `@ApiTags`, `@ApiBearerAuth`, and `@ApiOperation` decorators
- [ ] `financial.module.ts` imports `LeadsModule` (for GoogleMapsService)
- [ ] All 3 services and 3 controllers registered in `financial.module.ts`
- [ ] `SupplierService` is exported from `financial.module.ts`
- [ ] 5 new models added to `TENANT_SCOPED_MODELS` in `prisma.service.ts`
- [ ] Server starts without errors
- [ ] Swagger shows all 16 new endpoints
- [ ] `/financial/suppliers/map` returns 401 (not 400 invalid UUID)
- [ ] No existing routes broken
- [ ] Dev server shut down before marking sprint complete

---

## Gate Marker

**STOP** — Server must start without errors. All 16 new endpoints must be visible in Swagger. The `/financial/suppliers/map` route must return 401 (not 400), confirming correct routing order. **Do not begin Sprint 2.7 until verified.**

---

## Handoff Notes

**For Sprint 2.7 (Financial Entry Integration):**
- All supplier endpoints are live and accessible
- `SupplierService` is exported from `FinancialModule` and can be injected into `FinancialEntryService`
- `SupplierService.updateSpendTotals(tenantId, supplierId)` is the method that `FinancialEntryService` must call when a financial_entry with `supplier_id` is created, updated, or deleted
- The `financial_entry` model has `supplier_id` field (from Sprint 2.1)
- The `CreateFinancialEntryDto` and `UpdateFinancialEntryDto` do NOT yet include `supplier_id` — that must be added in Sprint 2.7
