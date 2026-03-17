# Sprint 2.2 — DTOs: Supplier Category, Supplier, and Supplier Product Validation

**Module:** Financial
**File:** `./documentation/sprints/financial/f02/sprint_2_2.md`
**Type:** Backend — DTOs & Validation
**Depends On:** Sprint 2.1 (Schema Migration must be complete)
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

Create 7 DTO files for the Supplier Registry feature. These DTOs define request validation for all supplier category, supplier, and supplier product endpoints. Each DTO uses `class-validator` decorators for validation and `@nestjs/swagger` decorators for API documentation.

**No services, controllers, or module changes in this sprint.** Only DTO files.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-category.dto.ts` — understand the existing DTO pattern (class-validator + Swagger decorators)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts` — understand validation patterns for complex DTOs
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries.dto.ts` — understand list/pagination/filter DTO pattern
- [ ] Read `/var/www/lead360.app/api/src/modules/quotes/dto/vendor/create-vendor.dto.ts` — understand the address/geo field pattern
- [ ] Verify Sprint 2.1 is complete (all 5 supplier tables exist in schema)

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

### Task 1 — Create `create-supplier-category.dto.ts`

**File:** `api/src/modules/financial/dto/create-supplier-category.dto.ts`

**Exact implementation:**

```typescript
import {
  IsString,
  IsOptional,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierCategoryDto {
  @ApiProperty({
    description: 'Category name (unique per tenant)',
    example: 'Roofing Materials',
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional description of the category',
    example: 'Shingles, underlayment, flashing, and other roofing supplies',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Hex color for UI badge display (#RRGGBB format)',
    example: '#3B82F6',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color in #RRGGBB format (e.g., #3B82F6)',
  })
  color?: string;
}
```

---

### Task 2 — Create `update-supplier-category.dto.ts`

**File:** `api/src/modules/financial/dto/update-supplier-category.dto.ts`

**Exact implementation:**

```typescript
import {
  IsString,
  IsOptional,
  IsBoolean,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSupplierCategoryDto {
  @ApiPropertyOptional({
    description: 'Category name (unique per tenant)',
    example: 'Roofing Materials',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Optional description of the category',
    example: 'Shingles, underlayment, flashing, and other roofing supplies',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Hex color for UI badge display (#RRGGBB format)',
    example: '#3B82F6',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color in #RRGGBB format (e.g., #3B82F6)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Active status — deactivating hides from category picker but preserves assignments',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
```

---

### Task 3 — Create `create-supplier.dto.ts`

**File:** `api/src/modules/financial/dto/create-supplier.dto.ts`

**Exact implementation:**

```typescript
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  IsEmail,
  IsNumber,
  Length,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({
    description: 'Business name (unique per tenant)',
    example: 'ABC Building Supply',
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({
    description: 'Legal entity name if different from business name',
    example: 'ABC Building Supply LLC',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  legal_name?: string;

  @ApiPropertyOptional({
    description: 'Supplier website URL',
    example: 'https://www.abcbuildingsupply.com',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({
    description: 'Primary contact phone number',
    example: '5551234567',
    maxLength: 20,
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Primary contact email address',
    example: 'orders@abcsupply.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Primary contact person name',
    example: 'John Smith',
    maxLength: 150,
  })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  contact_name?: string;

  @ApiPropertyOptional({
    description: 'Street address line 1',
    example: '123 Industrial Blvd',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  address_line1?: string;

  @ApiPropertyOptional({
    description: 'Address line 2 (suite, unit, etc.)',
    example: 'Building B',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Houston',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: '2-letter US state code',
    example: 'TX',
  })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'State must be a 2-letter uppercase code' })
  state?: string;

  @ApiPropertyOptional({
    description: 'ZIP code (5 or 9 digits)',
    example: '77001',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{5}(-\d{4})?$/, { message: 'Invalid ZIP code format' })
  zip_code?: string;

  @ApiPropertyOptional({
    description: 'ISO 2-letter country code',
    example: 'US',
    default: 'US',
  })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({
    description: 'Latitude for map display (from Google Places or manual entry)',
    example: 29.7604,
  })
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude for map display (from Google Places or manual entry)',
    example: -95.3698,
  })
  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Google Place ID — when provided, triggers address auto-fill from Google Places API',
    example: 'ChIJAYWNSLS4QIYROwVl894CDco',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  google_place_id?: string;

  @ApiPropertyOptional({
    description: 'Internal notes about this supplier',
    example: 'Preferred vendor for bulk lumber orders. Net 30 terms.',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Mark as preferred supplier for UI highlighting',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_preferred?: boolean;

  @ApiPropertyOptional({
    description: 'Array of supplier_category UUIDs to assign to this supplier',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  category_ids?: string[];
}
```

---

### Task 4 — Create `update-supplier.dto.ts`

**File:** `api/src/modules/financial/dto/update-supplier.dto.ts`

**Exact implementation:**

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto';

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
```

**Note:** `PartialType` makes all fields optional. The `category_ids` field, when provided, replaces the full set of category assignments (not a merge — it is a replace operation). Send empty array `[]` to remove all categories. This behavior is enforced at the service level, not the DTO level.

---

### Task 5 — Create `list-suppliers.dto.ts`

**File:** `api/src/modules/financial/dto/list-suppliers.dto.ts`

**Exact implementation:**

```typescript
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SupplierSortBy {
  NAME = 'name',
  TOTAL_SPEND = 'total_spend',
  LAST_PURCHASE_DATE = 'last_purchase_date',
  CREATED_AT = 'created_at',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListSuppliersDto {
  @ApiPropertyOptional({
    description: 'Search against supplier name, contact_name, and email',
    example: 'ABC Supply',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by supplier category UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status. Default: true (active only)',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Filter preferred suppliers only',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_preferred?: boolean;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page (max 100)',
    example: 20,
    default: 20,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: SupplierSortBy,
    default: SupplierSortBy.NAME,
  })
  @IsEnum(SupplierSortBy)
  @IsOptional()
  sort_by?: SupplierSortBy;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortOrder,
    default: SortOrder.ASC,
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sort_order?: SortOrder;
}
```

---

### Task 6 — Create `create-supplier-product.dto.ts`

**File:** `api/src/modules/financial/dto/create-supplier-product.dto.ts`

**Exact implementation:**

```typescript
import {
  IsString,
  IsOptional,
  IsNumber,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSupplierProductDto {
  @ApiProperty({
    description: 'Product or service name (unique per supplier)',
    example: 'Crushed Stone',
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional product description',
    example: '#57 crushed limestone, suitable for driveways and drainage',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Unit of measure for pricing',
    example: 'ton',
    maxLength: 50,
  })
  @IsString()
  @Length(1, 50)
  unit_of_measure: string;

  @ApiPropertyOptional({
    description: 'Current price per unit (null if unknown)',
    example: 45.50,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  unit_price?: number;

  @ApiPropertyOptional({
    description: "Supplier's product code or SKU",
    example: 'CS-57-LM',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  sku?: string;
}
```

---

### Task 7 — Create `update-supplier-product.dto.ts`

**File:** `api/src/modules/financial/dto/update-supplier-product.dto.ts`

**Exact implementation:**

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateSupplierProductDto } from './create-supplier-product.dto';

export class UpdateSupplierProductDto extends PartialType(CreateSupplierProductDto) {}
```

---

### Task 8 — Verify Compilation

**What:** Start the dev server and verify all 7 new DTO files compile without errors.

**Steps:**
1. Start the dev server (see Dev Server section)
2. Watch the console output for any TypeScript compilation errors related to the new DTOs
3. The server may show errors because controllers/services don't exist yet — that's expected and OK
4. Verify that the DTO files themselves have no import errors or type errors

**Note:** Since no controllers or services reference these DTOs yet, they won't be loaded by NestJS. But TypeScript compilation will still check them for syntax and type errors.

5. Stop the dev server.

**Acceptance:** All 7 DTO files exist with correct imports, decorators, and types. No TypeScript compilation errors in the DTO files.

---

## Files Created in This Sprint

| File | Purpose |
|------|---------|
| `api/src/modules/financial/dto/create-supplier-category.dto.ts` | Create supplier category request validation |
| `api/src/modules/financial/dto/update-supplier-category.dto.ts` | Update supplier category request validation |
| `api/src/modules/financial/dto/create-supplier.dto.ts` | Create supplier request validation |
| `api/src/modules/financial/dto/update-supplier.dto.ts` | Update supplier request validation |
| `api/src/modules/financial/dto/list-suppliers.dto.ts` | List suppliers query validation (pagination, filters, sort) |
| `api/src/modules/financial/dto/create-supplier-product.dto.ts` | Create supplier product request validation |
| `api/src/modules/financial/dto/update-supplier-product.dto.ts` | Update supplier product request validation |

---

## Acceptance Criteria

- [ ] All 7 DTO files created at the specified paths
- [ ] All DTOs use `class-validator` decorators for input validation
- [ ] All DTOs use `@nestjs/swagger` decorators (`ApiProperty`, `ApiPropertyOptional`) for API documentation
- [ ] `CreateSupplierCategoryDto` validates name (required, max 100), description (optional), color (optional, hex format)
- [ ] `UpdateSupplierCategoryDto` makes all fields optional and adds `is_active` boolean
- [ ] `CreateSupplierDto` validates name (required), all optional address/contact fields, `category_ids` array of UUIDs
- [ ] `UpdateSupplierDto` extends `PartialType(CreateSupplierDto)` — all fields optional
- [ ] `ListSuppliersDto` supports search, category_id, is_active, is_preferred, pagination, and sort with Transform decorators for boolean query params
- [ ] `CreateSupplierProductDto` validates name (required), unit_of_measure (required), unit_price (optional, min 0)
- [ ] `UpdateSupplierProductDto` extends `PartialType(CreateSupplierProductDto)` — all fields optional
- [ ] No existing files modified
- [ ] Dev server shut down before marking sprint complete

---

## Gate Marker

**NONE** — This sprint has no gate. Proceed to Sprint 2.3 immediately.

---

## Handoff Notes

**For Sprint 2.3 (SupplierCategoryService):**
- DTOs are available at these import paths:
  - `import { CreateSupplierCategoryDto } from '../dto/create-supplier-category.dto';`
  - `import { UpdateSupplierCategoryDto } from '../dto/update-supplier-category.dto';`
- No DTO index file is created — import directly from each file (matching existing convention in the financial module)
