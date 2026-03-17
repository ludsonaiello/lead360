# Sprint 1.2 — DTO Updates: Optional project_id, New Fields, Category Classification

**Module:** Financial
**File:** `./documentation/sprints/financial/f01/sprint_1_2.md`
**Type:** Backend (DTO Layer)
**Depends On:** Sprint 1.1 (schema migration must be complete and `npx prisma generate` must have succeeded)
**Gate:** STOP — All DTOs must compile cleanly. `npm run build` must succeed before Sprint 1.3 begins.
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

Update all DTOs affected by the F-01 schema changes:
1. Make `project_id` optional in `CreateFinancialEntryDto`
2. Add 7 new optional fields to `CreateFinancialEntryDto`
3. Make `project_id` optional in `ListFinancialEntriesDto`
4. Expand `FinancialCategoryType` enum in `CreateFinancialCategoryDto`
5. Add `classification` field to `CreateFinancialCategoryDto`

**No service logic changes in this sprint.** Only DTO files are modified.

---

## Pre-Sprint Checklist

- [ ] Confirm Sprint 1.1 is complete: `cd /var/www/lead360.app/api && npx prisma generate` succeeds
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/update-financial-entry.dto.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries.dto.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-category.dto.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/update-financial-category.dto.ts`

---

## Dev Server

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

---

## Tasks

### Task 1 — Update `CreateFinancialEntryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts`

**Current state:**
```typescript
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFinancialEntryDto {
  @ApiProperty({
    description: 'Project ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  project_id: string;

  // ... other fields
}
```

**Changes:**

**1a. Make `project_id` optional:**

Replace the `project_id` field block with:
```typescript
  @ApiPropertyOptional({
    description: 'Project ID — omit for business-level (overhead) expenses',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;
```

**1b. Add new imports.** The file needs these additional imports from `class-validator`:
```typescript
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
```

**1c. Add an enum for `payment_method` values** (for DTO validation only):
```typescript
export enum PaymentMethodEnum {
  CASH = 'cash',
  CHECK = 'check',
  BANK_TRANSFER = 'bank_transfer',
  VENMO = 'venmo',
  ZELLE = 'zelle',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  ACH = 'ACH',
}

export enum ExpenseSubmissionStatusEnum {
  PENDING_REVIEW = 'pending_review',
  CONFIRMED = 'confirmed',
}
```

**1d. Add 7 new optional fields AFTER `notes`:**

```typescript
  @ApiPropertyOptional({
    description: 'Payment method used for this expense',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.CREDIT_CARD,
  })
  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  payment_method?: PaymentMethodEnum;

  @ApiPropertyOptional({
    description: 'Supplier ID (FK — supplier table built in F-02, stub field)',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({
    description: 'User who made the purchase',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_user_id?: string;

  @ApiPropertyOptional({
    description: 'Crew member who made the purchase',
    example: '550e8400-e29b-41d4-a716-446655440012',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_crew_member_id?: string;

  @ApiPropertyOptional({
    description: 'Time of purchase (HH:MM:SS format)',
    example: '14:30:00',
  })
  @IsOptional()
  @IsString()
  entry_time?: string;

  @ApiPropertyOptional({
    description: 'Tax amount paid on this purchase (must be less than amount)',
    example: 25.50,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Tax amount must be 0 or greater' })
  tax_amount?: number;

  @ApiPropertyOptional({
    description: 'Submission status — defaults to confirmed. Role-based logic wired in F-04.',
    enum: ExpenseSubmissionStatusEnum,
    example: ExpenseSubmissionStatusEnum.CONFIRMED,
    default: ExpenseSubmissionStatusEnum.CONFIRMED,
  })
  @IsOptional()
  @IsEnum(ExpenseSubmissionStatusEnum)
  submission_status?: ExpenseSubmissionStatusEnum;
```

**Do NOT add `is_recurring_instance` or `recurring_rule_id` to the DTO.** These are set by the system (recurring engine in F-06), never by the user.

---

### Task 2 — Verify `UpdateFinancialEntryDto` Still Works

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/update-financial-entry.dto.ts`

**Current state:**
```typescript
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFinancialEntryDto } from './create-financial-entry.dto';

// project_id is NOT updatable — entries cannot be moved between projects.
export class UpdateFinancialEntryDto extends PartialType(
  OmitType(CreateFinancialEntryDto, ['project_id'] as const),
) {}
```

**This file should NOT need changes.** The `OmitType` already excludes `project_id`, and `PartialType` makes everything optional. The new fields added to `CreateFinancialEntryDto` will automatically become optional partial fields in the update DTO.

**Verify** that the file compiles correctly by running `npx tsc --noEmit` or checking the build.

---

### Task 3 — Update `ListFinancialEntriesDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries.dto.ts`

**Current state:**
```typescript
export class ListFinancialEntriesDto {
  @ApiProperty({
    description: 'Project ID (required)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  project_id: string;

  // ... other optional fields
}
```

**Change `project_id` to optional:**
```typescript
  @ApiPropertyOptional({
    description: 'Project ID — omit to list all tenant entries across all projects',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;
```

**This requires:**
- Change `@ApiProperty` to `@ApiPropertyOptional`
- Add `@IsOptional()` decorator
- Change type from `project_id: string` to `project_id?: string`
- Ensure `IsOptional` is imported (it already is in this file)

---

### Task 4 — Update `CreateFinancialCategoryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-category.dto.ts`

**Current state:**
```typescript
export enum FinancialCategoryType {
  LABOR = 'labor',
  MATERIAL = 'material',
  SUBCONTRACTOR = 'subcontractor',
  EQUIPMENT = 'equipment',
  OTHER = 'other',
}

export class CreateFinancialCategoryDto {
  @ApiProperty({...})
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({...})
  @IsEnum(FinancialCategoryType)
  type: FinancialCategoryType;

  @ApiPropertyOptional({...})
  @IsOptional()
  @IsString()
  description?: string;
}
```

**4a. Expand the `FinancialCategoryType` enum:**
```typescript
export enum FinancialCategoryType {
  LABOR = 'labor',
  MATERIAL = 'material',
  SUBCONTRACTOR = 'subcontractor',
  EQUIPMENT = 'equipment',
  INSURANCE = 'insurance',
  FUEL = 'fuel',
  UTILITIES = 'utilities',
  OFFICE = 'office',
  MARKETING = 'marketing',
  TAXES = 'taxes',
  TOOLS = 'tools',
  OTHER = 'other',
}
```

**4b. Add a `FinancialCategoryClassification` enum:**
```typescript
export enum FinancialCategoryClassification {
  COST_OF_GOODS_SOLD = 'cost_of_goods_sold',
  OPERATING_EXPENSE = 'operating_expense',
}
```

**4c. Add `classification` field to the DTO class** (after `type`):
```typescript
  @ApiPropertyOptional({
    description: 'Category classification for P&L reporting. Defaults to cost_of_goods_sold if omitted.',
    enum: FinancialCategoryClassification,
    example: FinancialCategoryClassification.COST_OF_GOODS_SOLD,
    default: FinancialCategoryClassification.COST_OF_GOODS_SOLD,
  })
  @IsOptional()
  @IsEnum(FinancialCategoryClassification)
  classification?: FinancialCategoryClassification;
```

---

### Task 5 — Update `UpdateFinancialCategoryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/update-financial-category.dto.ts`

**Current state:** This file is a standalone class (does NOT extend `PartialType(CreateFinancialCategoryDto)`). It only has `name` and `description` fields. The `classification` field must be explicitly added.

**Current file contents:**
```typescript
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// NOTE: `type` is intentionally NOT updatable (business rule).
export class UpdateFinancialCategoryDto {
  @ApiPropertyOptional({ ... })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ ... })
  @IsOptional()
  @IsString()
  description?: string;
}
```

**Changes required:**

**5a. Add imports:**
```typescript
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialCategoryClassification } from './create-financial-category.dto';
```

**5b. Add `classification` field** after `description`:
```typescript
  @ApiPropertyOptional({
    description: 'Category classification — cannot be changed for system-default categories',
    enum: FinancialCategoryClassification,
  })
  @IsOptional()
  @IsEnum(FinancialCategoryClassification)
  classification?: FinancialCategoryClassification;
```

**Business rule:** System-default categories (`is_system_default = true`) cannot have their `classification` changed. This is enforced in the service layer (Sprint 1.3), not in the DTO.

---

### Task 6 — Verify Build Succeeds

**What:** Run the TypeScript compiler to confirm all DTO changes compile correctly.

```bash
cd /var/www/lead360.app/api
npx tsc --noEmit
```

If there are errors, fix them. Common issues:
- Missing imports for `IsEnum`
- Import path issues for new enums
- Swagger decorator mismatches

Then start the dev server to confirm full compilation:
```bash
npm run start:dev
```

Wait for it to compile. Verify with health check:
```bash
curl -s http://localhost:8000/health
```

**After confirming compilation succeeds, shut down the server:**
```bash
lsof -i :8000
kill {PID}
lsof -i :8000   # Must return nothing
```

---

## Patterns to Apply

### DTO Validation Pattern (class-validator)
```typescript
// Required field
@ApiProperty({ description: 'Field description', example: 'value' })
@IsString()
field_name: string;

// Optional field
@ApiPropertyOptional({ description: 'Field description', example: 'value' })
@IsOptional()
@IsString()
field_name?: string;

// Enum field
@ApiProperty({ description: 'Field description', enum: MyEnum, example: MyEnum.VALUE })
@IsEnum(MyEnum)
field_name: MyEnum;

// Optional enum field
@ApiPropertyOptional({ description: 'Field description', enum: MyEnum })
@IsOptional()
@IsEnum(MyEnum)
field_name?: MyEnum;

// Number with constraints
@ApiProperty({ description: 'Amount', example: 100.00, minimum: 0.01 })
@IsNumber({ maxDecimalPlaces: 2 })
@Min(0.01, { message: 'Amount must be greater than 0' })
amount: number;
```

### Swagger Documentation Pattern
- Every field must have `@ApiProperty()` or `@ApiPropertyOptional()`
- Include `description`, `example`, and where applicable `enum`, `minimum`, `maximum`, `default`
- The Swagger UI at `/api/docs` must show all fields correctly

---

## Acceptance Criteria

- [ ] `CreateFinancialEntryDto.project_id` is optional (`@IsOptional()`, `project_id?: string`)
- [ ] `CreateFinancialEntryDto` has all 7 new optional fields: `payment_method`, `supplier_id`, `purchased_by_user_id`, `purchased_by_crew_member_id`, `entry_time`, `tax_amount`, `submission_status`
- [ ] `PaymentMethodEnum` and `ExpenseSubmissionStatusEnum` are exported from the DTO file
- [ ] `ListFinancialEntriesDto.project_id` is optional
- [ ] `FinancialCategoryType` enum has all 12 values
- [ ] `FinancialCategoryClassification` enum exists with `cost_of_goods_sold` and `operating_expense`
- [ ] `CreateFinancialCategoryDto` has optional `classification` field
- [ ] `UpdateFinancialCategoryDto` allows updating `classification`
- [ ] `UpdateFinancialEntryDto` does NOT include `project_id` (still excluded)
- [ ] `UpdateFinancialEntryDto` automatically includes the new optional fields from CreateDto
- [ ] `npx tsc --noEmit` passes without errors
- [ ] Dev server compiles and responds to health check
- [ ] Dev server is shut down
- [ ] No existing DTO field was removed or renamed
- [ ] No service logic was changed

---

## Gate Marker

**STOP** — All DTOs must compile. Verify:
1. `npx tsc --noEmit` succeeds
2. Dev server compiles cleanly
3. All Swagger decorators are present on new fields

---

## Handoff Notes

**For Sprint 1.3 (Service Logic Changes):**
- `CreateFinancialEntryDto.project_id` is now optional — the service must handle `undefined` gracefully
- `ListFinancialEntriesDto.project_id` is now optional — the service query filter must conditionally include it
- `CreateFinancialCategoryDto` now has `classification` — the service must pass it to Prisma
- New validation required in service: `tax_amount` must be less than `amount`
- New validation required in service: if `project_id` is provided, verify it belongs to tenant; if omitted, skip project validation
- `FinancialCategoryService.updateCategory()` must reject classification changes on system-default categories
- `FinancialCategoryService.createCategory()` must pass classification to Prisma (default `cost_of_goods_sold` if not provided)
- `FinancialCategoryService.seedDefaultCategories()` must be updated to include classification and overhead category types
