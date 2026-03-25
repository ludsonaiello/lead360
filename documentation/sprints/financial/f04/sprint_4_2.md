# Sprint 4_2 — DTOs: Create, Update, List Query, Approve, Reject, Resubmit

**Module:** Financial
**File:** ./documentation/sprints/financial/f04/sprint_4_2.md
**Type:** Backend — DTO Layer
**Depends On:** Sprint 4_1 (migration complete, schema valid)
**Gate:** STOP — All DTO files syntactically valid. Do NOT start dev server (expected break until Sprint 4_6)
**Estimated Complexity:** Medium

---

> **You are a masterclass-level engineer.** Your code makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is intentional, precise, and production-grade.

> ⚠️ **CRITICAL WARNINGS:**
> - This platform is **85% production-ready**. Never break existing code. Not a single comma.
> - Never leave the dev server running in the background when you finish.
> - Read the codebase BEFORE touching anything. Implement with surgical precision.
> - MySQL credentials are in `/var/www/lead360.app/api/.env`
> - This project does **NOT** use PM2. Do not reference or run any PM2 command.

---

## Objective

Rebuild the existing `CreateFinancialEntryDto`, `UpdateFinancialEntryDto`, and `ListFinancialEntriesDto` to support all new F-04 fields. Create three new DTOs for the pending review workflow: `ApproveEntryDto`, `RejectEntryDto`, and `ResubmitEntryDto`.

After this sprint, the DTO layer is complete and ready for the service layer to consume.

---

## Pre-Sprint Checklist

- [ ] Read existing DTOs in `/var/www/lead360.app/api/src/modules/financial/dto/`:
  - `create-financial-entry.dto.ts`
  - `update-financial-entry.dto.ts`
  - `list-financial-entries.dto.ts`
- [ ] Read the Prisma schema for `financial_entry` to confirm all fields and enums available
- [ ] Verify Sprint 4_1 is complete (rejection fields exist in schema)
- [ ] Verify the following enums exist in the Prisma schema:
  - `financial_entry_type`: `expense | income`
  - `financial_entry_submission_status`: `pending_review | confirmed`
  - `payment_method`: `cash | check | bank_transfer | venmo | zelle | credit_card | debit_card | ACH`
  - `financial_category_classification`: `cost_of_goods_sold | operating_expense`

---

## Dev Server

> ⚠️ **DO NOT start the dev server in this sprint.** The DTO changes remove fields that the existing service still references. The dev server will not compile until Sprint 4_6 when the controller is rebuilt. If port 8000 is in use from a previous sprint, kill it:
>
> ```
> lsof -i :8000
> kill {PID}
> ```

---

## Tasks

### Task 1 — Rebuild `CreateFinancialEntryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts`

**What:** Replace the entire file content. The new DTO must support all F-04 fields. The `project_id` is now OPTIONAL (was required before — F-01 made it nullable for business-level overhead expenses).

**EXACT fields and validation rules:**

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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFinancialEntryDto {
  @ApiPropertyOptional({
    description: 'Project ID (optional — omit for business-level overhead expenses)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Task ID (optional — requires project_id)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiProperty({
    description: 'Financial category ID (must belong to same tenant)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsString()
  @IsUUID()
  category_id: string;

  @ApiProperty({
    description: 'Entry type',
    enum: ['expense', 'income'],
    example: 'expense',
  })
  @IsEnum(['expense', 'income'], { message: 'entry_type must be expense or income' })
  entry_type: string;

  @ApiProperty({
    description: 'Entry amount (must be greater than 0)',
    example: 450.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Tax amount (must be less than amount)',
    example: 35.50,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Tax amount must be 0 or greater' })
  tax_amount?: number;

  @ApiProperty({
    description: 'Entry date in YYYY-MM-DD format',
    example: '2026-03-10',
  })
  @IsDateString()
  entry_date: string;

  @ApiPropertyOptional({
    description: 'Entry time in HH:MM:SS format',
    example: '14:30:00',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  entry_time?: string;

  @ApiPropertyOptional({
    description: 'Vendor name (free-text fallback when no supplier selected)',
    example: 'Home Depot',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({
    description: 'Supplier ID (must belong to same tenant and be active)',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({
    description: 'Payment method enum (ignored if payment_method_registry_id provided)',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'Invalid payment method',
  })
  payment_method?: string;

  @ApiPropertyOptional({
    description: 'Payment method registry ID (auto-copies type into payment_method)',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  payment_method_registry_id?: string;

  @ApiPropertyOptional({
    description: 'User who made the purchase (mutually exclusive with purchased_by_crew_member_id)',
    example: '550e8400-e29b-41d4-a716-446655440007',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_user_id?: string;

  @ApiPropertyOptional({
    description: 'Crew member who made the purchase (mutually exclusive with purchased_by_user_id)',
    example: '550e8400-e29b-41d4-a716-446655440008',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_crew_member_id?: string;

  @ApiPropertyOptional({
    description: 'Submission status (Owner/Admin/Manager/Bookkeeper only — Employee value is overridden to pending_review)',
    enum: ['pending_review', 'confirmed'],
    default: 'confirmed',
  })
  @IsOptional()
  @IsEnum(['pending_review', 'confirmed'], {
    message: 'submission_status must be pending_review or confirmed',
  })
  submission_status?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: '2x4 studs for framing',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
```

**Key changes from the old DTO:**
- `project_id` is now `@IsOptional()` (was required)
- `entry_type` is now explicit (was hardcoded to 'expense' in service)
- Added: `tax_amount`, `entry_time`, `supplier_id`, `payment_method`, `payment_method_registry_id`, `purchased_by_user_id`, `purchased_by_crew_member_id`, `submission_status`, `notes` max length now 2000
- Removed: `crew_member_id` and `subcontractor_id` are replaced by `purchased_by_user_id` and `purchased_by_crew_member_id`

**Do NOT:** Remove the existing file — overwrite it completely. The old DTO shape is incompatible with F-04.

---

### Task 2 — Rebuild `UpdateFinancialEntryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/update-financial-entry.dto.ts`

**What:** Replace the entire file. The update DTO has specific fields that are editable (NOT all create fields).

**EXACT content:**

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
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Update DTO for financial entries.
 *
 * NOT editable: project_id, task_id, submission_status, is_recurring_instance,
 * recurring_rule_id, created_by_user_id. Use approve/reject endpoints for status changes.
 */
export class UpdateFinancialEntryDto {
  @ApiPropertyOptional({ description: 'Financial category ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Entry type',
    enum: ['expense', 'income'],
  })
  @IsOptional()
  @IsEnum(['expense', 'income'], { message: 'entry_type must be expense or income' })
  entry_type?: string;

  @ApiPropertyOptional({
    description: 'Entry amount (must be > 0)',
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Tax amount must be 0 or greater' })
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Entry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  entry_date?: string;

  @ApiPropertyOptional({ description: 'Entry time (HH:MM:SS)' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  entry_time?: string;

  @ApiPropertyOptional({ description: 'Vendor name (max 200 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({ description: 'Supplier ID (set to null to unlink)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  supplier_id?: string | null;

  @ApiPropertyOptional({
    description: 'Payment method enum',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'Invalid payment method',
  })
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Payment method registry ID (set to null to unlink)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  payment_method_registry_id?: string | null;

  @ApiPropertyOptional({ description: 'User who made the purchase (set to null to unlink)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_user_id?: string | null;

  @ApiPropertyOptional({ description: 'Crew member who made the purchase (set to null to unlink)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_crew_member_id?: string | null;

  @ApiPropertyOptional({ description: 'Additional notes (max 2000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
```

**Key rules:**
- `project_id` is NOT editable (immutable after creation)
- `task_id` is NOT editable (immutable after creation)
- `submission_status` is NOT editable via PATCH (use approve/reject endpoints)
- `is_recurring_instance` and `recurring_rule_id` are NOT editable
- `created_by_user_id` is NOT editable
- `supplier_id`, `payment_method_registry_id`, `purchased_by_user_id`, `purchased_by_crew_member_id` accept `null` to unlink

---

### Task 3 — Create `ListFinancialEntriesQueryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries-query.dto.ts` (NEW FILE)

**What:** Create a new DTO for the enhanced list/filter endpoint. This replaces the old `ListFinancialEntriesDto` for the main `GET /financial/entries` endpoint. The old `ListFinancialEntriesDto` can remain for backward compatibility with `getProjectEntries` but the new controller will use this DTO.

**EXACT content:**

```typescript
import {
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListFinancialEntriesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Filter by task ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by category type',
    enum: ['labor', 'material', 'subcontractor', 'equipment', 'other'],
  })
  @IsOptional()
  @IsEnum(['labor', 'material', 'subcontractor', 'equipment', 'other'], {
    message: 'Invalid category_type',
  })
  category_type?: string;

  @ApiPropertyOptional({
    description: 'Filter by classification',
    enum: ['cost_of_goods_sold', 'operating_expense'],
  })
  @IsOptional()
  @IsEnum(['cost_of_goods_sold', 'operating_expense'], {
    message: 'Invalid classification',
  })
  classification?: string;

  @ApiPropertyOptional({
    description: 'Filter by entry type',
    enum: ['expense', 'income'],
  })
  @IsOptional()
  @IsEnum(['expense', 'income'], { message: 'Invalid entry_type' })
  entry_type?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'Invalid payment_method',
  })
  payment_method?: string;

  @ApiPropertyOptional({
    description: 'Filter by submission status',
    enum: ['pending_review', 'confirmed'],
  })
  @IsOptional()
  @IsEnum(['pending_review', 'confirmed'], { message: 'Invalid submission_status' })
  submission_status?: string;

  @ApiPropertyOptional({ description: 'Filter by purchasing user ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_user_id?: string;

  @ApiPropertyOptional({ description: 'Filter by purchasing crew member ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_crew_member_id?: string;

  @ApiPropertyOptional({ description: 'Filter entries from this date (inclusive, YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter entries to this date (inclusive, YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Filter entries with/without receipt' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  has_receipt?: boolean;

  @ApiPropertyOptional({ description: 'Filter recurring instances' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_recurring_instance?: boolean;

  @ApiPropertyOptional({ description: 'Search in vendor_name and notes fields' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['entry_date', 'amount', 'created_at'],
    default: 'entry_date',
  })
  @IsOptional()
  @IsEnum(['entry_date', 'amount', 'created_at'], { message: 'Invalid sort_by value' })
  sort_by?: string = 'entry_date';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Invalid sort_order value' })
  sort_order?: string = 'desc';
}
```

**Do NOT:** Modify the existing `list-financial-entries.dto.ts` — it is used by `getProjectEntries()` which continues to exist. Create this as a NEW file.

---

### Task 4 — Create `ApproveEntryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/approve-entry.dto.ts` (NEW FILE)

**EXACT content:**

```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveEntryDto {
  @ApiPropertyOptional({
    description: 'Internal note about the approval decision',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

---

### Task 5 — Create `RejectEntryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/reject-entry.dto.ts` (NEW FILE)

**EXACT content:**

```typescript
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectEntryDto {
  @ApiProperty({
    description: 'Reason for rejection (required — must explain why)',
    example: 'Receipt is illegible. Please re-upload a clearer photo.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @MaxLength(500)
  rejection_reason: string;
}
```

---

### Task 6 — Create `ResubmitEntryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/resubmit-entry.dto.ts` (NEW FILE)

**What:** This DTO allows optional field updates when resubmitting. It extends the same editable fields as the update DTO.

**EXACT content:**

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
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Resubmit DTO — optional field updates applied before clearing rejection.
 * Same editable fields as UpdateFinancialEntryDto.
 */
export class ResubmitEntryDto {
  @ApiPropertyOptional({ description: 'Financial category ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Entry type',
    enum: ['expense', 'income'],
  })
  @IsOptional()
  @IsEnum(['expense', 'income'], { message: 'entry_type must be expense or income' })
  entry_type?: string;

  @ApiPropertyOptional({ description: 'Entry amount (must be > 0)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Tax amount must be 0 or greater' })
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Entry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  entry_date?: string;

  @ApiPropertyOptional({ description: 'Entry time (HH:MM:SS)' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  entry_time?: string;

  @ApiPropertyOptional({ description: 'Vendor name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  supplier_id?: string | null;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'])
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Payment method registry ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  payment_method_registry_id?: string | null;

  @ApiPropertyOptional({ description: 'User who made the purchase' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_user_id?: string | null;

  @ApiPropertyOptional({ description: 'Crew member who made the purchase' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_crew_member_id?: string | null;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
```

---

### Task 7 — Create `ListPendingEntriesQueryDto`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/list-pending-entries-query.dto.ts` (NEW FILE)

**EXACT content:**

```typescript
import { IsOptional, IsString, IsUUID, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListPendingEntriesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by submitter user ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  submitted_by_user_id?: string;

  @ApiPropertyOptional({ description: 'Filter from date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

---

### Task 8 — Verify DTO File Syntax

**What:** Verify all new and modified DTO files are syntactically valid TypeScript. Run a targeted type check:

```bash
cd /var/www/lead360.app/api
npx tsc --noEmit --skipLibCheck src/modules/financial/dto/create-financial-entry.dto.ts src/modules/financial/dto/update-financial-entry.dto.ts src/modules/financial/dto/list-financial-entries-query.dto.ts src/modules/financial/dto/approve-entry.dto.ts src/modules/financial/dto/reject-entry.dto.ts src/modules/financial/dto/resubmit-entry.dto.ts src/modules/financial/dto/list-pending-entries-query.dto.ts 2>&1 || true
```

If the above command doesn't work due to module resolution, simply verify each file opens without red squiggles by checking the TypeScript syntax is valid. The files reference only `class-validator`, `class-transformer`, and `@nestjs/swagger` — all standard installed packages.

> ⚠️ **DO NOT start the dev server in this sprint.** The DTO rebuild removes fields (`crew_member_id`, `subcontractor_id`) that the existing service still references. Full compilation will break until the service is rebuilt in Sprints 4_3/4_4. This is expected and intentional. Full compilation check happens in Sprint 4_6.

**Do NOT:** Modify any service or controller files in this sprint.

---

## Files Created

| File | Purpose |
|------|---------|
| `dto/list-financial-entries-query.dto.ts` | Full filter/sort/paginate query DTO for `GET /financial/entries` |
| `dto/approve-entry.dto.ts` | Approval DTO with optional notes |
| `dto/reject-entry.dto.ts` | Rejection DTO with required reason |
| `dto/resubmit-entry.dto.ts` | Resubmit DTO with optional field updates |
| `dto/list-pending-entries-query.dto.ts` | Query DTO for `GET /financial/entries/pending` |

## Files Modified

| File | Change |
|------|--------|
| `dto/create-financial-entry.dto.ts` | Full rebuild — all F-04 fields |
| `dto/update-financial-entry.dto.ts` | Full rebuild — explicit fields, not PartialType |

---

## Acceptance Criteria

- [ ] `CreateFinancialEntryDto` has all 16 fields with correct validators
- [ ] `project_id` is optional in `CreateFinancialEntryDto`
- [ ] `entry_type` is required in `CreateFinancialEntryDto` (not hardcoded)
- [ ] `UpdateFinancialEntryDto` does NOT include `project_id`, `task_id`, `submission_status`
- [ ] `ListFinancialEntriesQueryDto` has all 20 query parameters
- [ ] `ApproveEntryDto` has optional `notes` field
- [ ] `RejectEntryDto` has required `rejection_reason` field with `@IsNotEmpty()`
- [ ] `ResubmitEntryDto` has all editable fields matching `UpdateFinancialEntryDto`
- [ ] `ListPendingEntriesQueryDto` has `submitted_by_user_id`, `date_from`, `date_to`, `page`, `limit`
- [ ] All DTOs have Swagger decorators (`@ApiProperty` / `@ApiPropertyOptional`)
- [ ] All DTO files are syntactically valid TypeScript (no red squiggles in the DTO files themselves)
- [ ] No existing service or controller files modified
- [ ] Dev server NOT started (expected compilation break — see gate marker)

---

## Gate Marker

**STOP** — All DTO files must be syntactically valid TypeScript. All imports must reference real packages. All class-validator decorators must match field types. **Do NOT attempt to start the dev server** — it will fail because the existing service references old DTO fields. Full compilation check happens in Sprint 4_6.

---

## Handoff Notes

After this sprint, the following DTOs are available for the service layer (Sprints 4_3, 4_4, 4_5):

| DTO | Used By |
|-----|---------|
| `CreateFinancialEntryDto` | `createEntry()` |
| `UpdateFinancialEntryDto` | `updateEntry()` |
| `ListFinancialEntriesQueryDto` | `getEntries()` |
| `ListPendingEntriesQueryDto` | `getPendingEntries()` |
| `ApproveEntryDto` | `approveEntry()` |
| `RejectEntryDto` | `rejectEntry()` |
| `ResubmitEntryDto` | `resubmitEntry()` |

The old `ListFinancialEntriesDto` still exists and is used by `getProjectEntries()` — do not delete it.
