# Sprint 10_2 — DTOs and Validation

**Module:** Financial
**File:** ./documentation/sprints/financial/f10/sprint_10_2.md
**Type:** Backend — DTOs
**Depends On:** Sprint 10_1 (schema migration must be complete)
**Gate:** NONE
**Estimated Complexity:** Low

> **You are a masterclass-level engineer who makes Google, Amazon, and Apple engineers jealous of the quality of your work.**

> ⚠️ **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> ⚠️ **MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — do NOT hardcode database credentials anywhere.**

---

## Objective

Create all DTOs (Data Transfer Objects) for the F-10 Export module: account mapping creation, export query parameters, quality report query, and export history query. These DTOs enforce input validation and provide Swagger documentation for every field.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — confirm `export_type`, `accounting_platform` enums, `financial_export_log`, and `financial_category_account_mapping` tables exist (Sprint 10_1 must be done)
- [ ] Read an existing DTO for patterns: `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts`
- [ ] Read another existing DTO for list/query patterns: `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries.dto.ts`

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

### Task 1 — Create `CreateAccountMappingDto`

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/dto/create-account-mapping.dto.ts`

```typescript
import {
  IsString,
  IsUUID,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccountMappingDto {
  @ApiProperty({
    description: 'Financial category ID to map',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  category_id: string;

  @ApiProperty({
    description: 'Target accounting platform',
    enum: ['quickbooks', 'xero'],
    example: 'quickbooks',
  })
  @IsString()
  @IsIn(['quickbooks', 'xero'], { message: 'platform must be quickbooks or xero' })
  platform: 'quickbooks' | 'xero';

  @ApiProperty({
    description: 'Account name as it appears in QB/Xero chart of accounts',
    example: 'Office Supplies',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  account_name: string;

  @ApiPropertyOptional({
    description: 'Account code in QB/Xero (optional)',
    example: '6100',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  account_code?: string;
}
```

**Why:** This DTO validates the request body for creating or updating account mappings. The service performs upsert behavior — if a mapping for the same `category_id + platform` already exists, it is updated.

**Acceptance:** File exists, compiles, validates `category_id` as UUID, `platform` as enum, `account_name` as required string, `account_code` as optional string.

**Do NOT:** Add `tenant_id` or `user_id` fields — these come from the JWT, not the request body.

---

### Task 2 — Create `ExportExpenseQueryDto`

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/dto/export-expense-query.dto.ts`

```typescript
import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportExpenseQueryDto {
  @ApiProperty({
    description: 'Start of export period (required)',
    example: '2026-01-01',
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End of export period (required)',
    example: '2026-03-31',
  })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional({
    description: 'Filter to specific category',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by classification',
    enum: ['cost_of_goods_sold', 'operating_expense'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['cost_of_goods_sold', 'operating_expense'])
  classification?: string;

  @ApiPropertyOptional({
    description: 'Filter to project-linked entries',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Include recurring instance entries (default false)',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_recurring?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include pending_review entries (default false)',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_pending?: boolean = false;
}
```

**Why:** Shared query parameters for both QuickBooks and Xero expense exports. `date_from` and `date_to` are required — the controller will validate the 366-day limit.

**Acceptance:** File exists, compiles. `date_from` and `date_to` required. Boolean fields default to `false` and transform string `"true"` from query params.

**Do NOT:** Add pagination — exports return full CSV files, not paginated results.

---

### Task 3 — Create `ExportInvoiceQueryDto`

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/dto/export-invoice-query.dto.ts`

```typescript
import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportInvoiceQueryDto {
  @ApiProperty({
    description: 'Start of export period (required)',
    example: '2026-01-01',
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End of export period (required)',
    example: '2026-03-31',
  })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional({
    description: 'Filter by invoice status',
    enum: ['draft', 'sent', 'partial', 'paid'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['draft', 'sent', 'partial', 'paid'])
  status?: string;
}
```

**Why:** Query parameters for QB and Xero invoice exports. `date_from` and `date_to` are required, applied to `project_invoice.created_at`. Status filter is optional. Note: `voided` is NOT in the enum — voided invoices are never exported.

**Acceptance:** File exists, compiles. Status enum does NOT include `voided`.

**Do NOT:** Include `voided` in the status enum.

---

### Task 4 — Create `QualityReportQueryDto`

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/dto/quality-report-query.dto.ts`

```typescript
import {
  IsOptional,
  IsDateString,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QualityReportQueryDto {
  @ApiPropertyOptional({
    description: 'Start date filter (optional — if omitted, checks all records)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'End date filter (optional — if omitted, checks all records)',
    example: '2026-03-31',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Target platform for platform-specific checks',
    enum: ['quickbooks', 'xero'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['quickbooks', 'xero'])
  platform?: 'quickbooks' | 'xero';
}
```

**Why:** Both date fields and platform are optional. If dates are omitted, the quality report checks all financial entries. If platform is provided, it includes platform-specific mapping checks.

**Acceptance:** File exists, compiles. All fields optional.

---

### Task 5 — Create `ExportHistoryQueryDto`

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/dto/export-history-query.dto.ts`

```typescript
import {
  IsOptional,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ExportHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by export type',
    enum: ['quickbooks_expenses', 'quickbooks_invoices', 'xero_expenses', 'xero_invoices', 'pl_csv', 'entries_csv'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['quickbooks_expenses', 'quickbooks_invoices', 'xero_expenses', 'xero_invoices', 'pl_csv', 'entries_csv'])
  export_type?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

**Why:** Standard paginated list query with optional filter by export type. Follows the same pattern as all other list DTOs in the financial module (page/limit with defaults).

**Acceptance:** File exists, compiles. Page default 1, limit default 20, max 100.

---

### Task 6 — Create `AccountMappingQueryDto`

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/dto/account-mapping-query.dto.ts`

```typescript
import {
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountMappingQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by platform',
    enum: ['quickbooks', 'xero'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['quickbooks', 'xero'])
  platform?: 'quickbooks' | 'xero';
}

export class AccountMappingDefaultsQueryDto {
  @ApiProperty({
    description: 'Target platform (required)',
    enum: ['quickbooks', 'xero'],
    example: 'quickbooks',
  })
  @IsString()
  @IsIn(['quickbooks', 'xero'], { message: 'platform must be quickbooks or xero' })
  platform: 'quickbooks' | 'xero';
}
```

**NOTE:** Both `ApiProperty` and `ApiPropertyOptional` are imported because `AccountMappingQueryDto` uses `@ApiPropertyOptional` (optional) and `AccountMappingDefaultsQueryDto` uses `@ApiProperty` (required).

**Why:** Two separate DTOs — `AccountMappingQueryDto` has optional platform filter for the list endpoint, `AccountMappingDefaultsQueryDto` has required platform for the defaults endpoint.

**Acceptance:** Both classes exist in the same file. `AccountMappingQueryDto.platform` is optional. `AccountMappingDefaultsQueryDto.platform` is required.

---

### Task 7 — Verify Compilation

**What:** Start the dev server and verify all new DTOs compile without errors.

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for compilation. Verify no TypeScript errors in the new DTO files. Check health:
```bash
curl -s http://localhost:8000/health
```

Then stop the server:
```bash
lsof -i :8000
kill {PID}
```

**Acceptance:** Zero compilation errors. Health check passes.

---

## Patterns to Apply

### DTO Pattern (from existing codebase)
```typescript
import { IsString, IsOptional, IsUUID, IsDateString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SomeDto {
  @ApiProperty({ description: '...', example: '...' })
  @IsString()
  @IsUUID()
  required_field: string;

  @ApiPropertyOptional({ description: '...', example: '...' })
  @IsOptional()
  @IsString()
  optional_field?: string;

  @ApiPropertyOptional({ description: '...', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;
}
```

### Boolean Query Param Transform Pattern
Query parameters come as strings from HTTP. Booleans must be transformed:
```typescript
@Transform(({ value }) => value === 'true' || value === true)
@IsBoolean()
include_something?: boolean = false;
```

---

## Business Rules Enforced in This Sprint

- BR-03: `date_from` and `date_to` are required for expense and invoice exports. The 366-day limit is enforced in the service layer (Sprint 10_4), not the DTO.
- BR-04: `voided` status is NOT a valid filter for invoice exports — voided invoices are never exported.
- BR-05: `platform` is required for the defaults endpoint but optional for the list endpoint.

---

## Integration Points

None — DTOs are standalone validation classes with no service dependencies.

---

## Acceptance Criteria

- [ ] `create-account-mapping.dto.ts` created with correct validation
- [ ] `export-expense-query.dto.ts` created with required date fields and optional filters
- [ ] `export-invoice-query.dto.ts` created with required date fields and optional status filter
- [ ] `quality-report-query.dto.ts` created with all-optional fields
- [ ] `export-history-query.dto.ts` created with pagination defaults (page=1, limit=20)
- [ ] `account-mapping-query.dto.ts` created with both query DTOs
- [ ] All DTOs use `class-validator` decorators and `@nestjs/swagger` decorators
- [ ] Boolean query params use `@Transform` for string-to-boolean conversion
- [ ] Dev server compiles without errors
- [ ] No existing DTOs modified
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

NONE — Sprint 10_3 can proceed after this sprint completes.

---

## Handoff Notes

Files created in this sprint (all at `/var/www/lead360.app/api/src/modules/financial/dto/`):
- `create-account-mapping.dto.ts` — used by `POST /financial/export/account-mappings`
- `export-expense-query.dto.ts` — used by `GET /financial/export/quickbooks/expenses` and `GET /financial/export/xero/expenses`
- `export-invoice-query.dto.ts` — used by `GET /financial/export/quickbooks/invoices` and `GET /financial/export/xero/invoices`
- `quality-report-query.dto.ts` — used by `GET /financial/export/quality-report`
- `export-history-query.dto.ts` — used by `GET /financial/export/history`
- `account-mapping-query.dto.ts` — used by `GET /financial/export/account-mappings` and `GET /financial/export/account-mappings/defaults`
