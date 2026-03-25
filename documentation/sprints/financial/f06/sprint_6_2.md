# Sprint 6_2 — DTOs + Validation for Recurring Expense Rules

**Module:** Financial
**File:** ./documentation/sprints/financial/f06/sprint_6_2.md
**Type:** Backend — DTOs
**Depends On:** Sprint 6_1 (schema migration must be complete)
**Gate:** STOP — All DTOs must compile without errors. `npm run build` must pass.
**Estimated Complexity:** Medium

---

> **You are a masterclass-level backend engineer.** Your code quality makes engineers at Google, Amazon, and Apple jealous. Every line you write is precise, intentional, and production-grade.

> **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> **MySQL credentials** are in the `.env` file at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.

---

## Objective

Create all Data Transfer Objects (DTOs) for the Recurring Expense Rule CRUD and lifecycle operations. These DTOs define request validation for every endpoint in the recurring expense engine.

---

## Pre-Sprint Checklist

- [ ] Verify Sprint 6_1 is complete — `npx prisma generate` has been run and `recurring_frequency` / `recurring_rule_status` types exist
- [ ] Read existing DTO files in `/var/www/lead360.app/api/src/modules/financial/dto/` — understand the validation patterns used (class-validator decorators, swagger decorators)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts` for the DTO pattern used in this project
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries.dto.ts` for the list/pagination pattern

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

### Task 1 — Create `create-recurring-rule.dto.ts`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/create-recurring-rule.dto.ts`

**Imports to use:**
```typescript
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber, IsBoolean, IsEnum, IsDateString, MaxLength, Min, Max, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
```

**Enum to define locally in this file (for Swagger visibility):**
```typescript
export enum RecurringFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}
```

**Fields with exact validation:**

```typescript
export class CreateRecurringRuleDto {
  @ApiProperty({ description: 'Human-readable rule name', example: 'Monthly Liability Insurance', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Internal description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'FK to financial_category', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  category_id: string;

  @ApiProperty({ description: 'Fixed amount per occurrence', example: 1850.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ description: 'Tax per occurrence', example: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'FK to supplier' })
  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({ description: 'Free-text vendor fallback', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({ description: 'FK to payment_method_registry' })
  @IsOptional()
  @IsUUID()
  payment_method_registry_id?: string;

  @ApiProperty({ description: 'Recurrence frequency', enum: RecurringFrequency, example: 'monthly' })
  @IsEnum(RecurringFrequency)
  @IsNotEmpty()
  frequency: RecurringFrequency;

  @ApiPropertyOptional({ description: 'Every N frequencies (default 1)', example: 1, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  interval?: number;

  @ApiPropertyOptional({ description: 'Day of month for monthly/quarterly/annual (1-28)', minimum: 1, maximum: 28 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  @Type(() => Number)
  day_of_month?: number;

  @ApiPropertyOptional({ description: 'Day of week for weekly (0=Sunday, 6=Saturday)', minimum: 0, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  day_of_week?: number;

  @ApiProperty({ description: 'First date this rule becomes active (YYYY-MM-DD)', example: '2026-04-01' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiPropertyOptional({ description: 'Optional end date (YYYY-MM-DD)', example: '2027-03-31' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Max occurrences before auto-complete', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  recurrence_count?: number;

  @ApiPropertyOptional({ description: 'If true, generated entries are confirmed. If false, pending_review.', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  auto_confirm?: boolean;

  @ApiPropertyOptional({ description: 'Notes passed into generated entries' })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

**Do NOT:** Add `status`, `next_due_date`, `occurrences_generated`, `last_generated_at`, `last_generated_entry_id`, `created_by_user_id`, or `updated_by_user_id` — these are system-managed fields set by the service.

---

### Task 2 — Create `update-recurring-rule.dto.ts`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/update-recurring-rule.dto.ts`

**Implementation:** Use `PartialType` from `@nestjs/swagger` to make all fields optional, then explicitly OMIT fields that must not be updated via PATCH.

```typescript
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRecurringRuleDto } from './create-recurring-rule.dto';

export class UpdateRecurringRuleDto extends PartialType(
  OmitType(CreateRecurringRuleDto, ['start_date'] as const),
) {}
```

**Explanation:** All fields from `CreateRecurringRuleDto` become optional. `start_date` is excluded — once a rule is created, its start_date cannot be changed (the schedule is anchored to it).

**Fields NOT editable via PATCH (enforced in service, not DTO):**
- `status` — use pause/resume/cancel endpoints
- `occurrences_generated` — system-managed
- `last_generated_at` — system-managed
- `last_generated_entry_id` — system-managed
- `next_due_date` — recalculated automatically when schedule fields change

**If any of these fields change: `amount`, `frequency`, `interval`, `day_of_month`, `day_of_week`** — the service must recalculate `next_due_date`.

---

### Task 3 — Create `list-recurring-rules.dto.ts`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/list-recurring-rules.dto.ts`

```typescript
import { IsOptional, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RecurringFrequency } from './create-recurring-rule.dto';

export enum RecurringRuleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RecurringRuleSortBy {
  NEXT_DUE_DATE = 'next_due_date',
  AMOUNT = 'amount',
  NAME = 'name',
  CREATED_AT = 'created_at',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListRecurringRulesDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: RecurringRuleStatus, default: 'active' })
  @IsOptional()
  @IsEnum(RecurringRuleStatus)
  status?: RecurringRuleStatus;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Filter by frequency', enum: RecurringFrequency })
  @IsOptional()
  @IsEnum(RecurringFrequency)
  frequency?: RecurringFrequency;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort by field', enum: RecurringRuleSortBy, default: 'next_due_date' })
  @IsOptional()
  @IsEnum(RecurringRuleSortBy)
  sort_by?: RecurringRuleSortBy;

  @ApiPropertyOptional({ description: 'Sort direction', enum: SortOrder, default: 'asc' })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder;
}
```

---

### Task 4 — Create `skip-recurring-rule.dto.ts`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/skip-recurring-rule.dto.ts`

```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SkipRecurringRuleDto {
  @ApiPropertyOptional({ description: 'Reason for skipping this occurrence', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```

---

### Task 5 — Create `recurring-rule-history.dto.ts`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/recurring-rule-history.dto.ts`

```typescript
import { IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RecurringRuleHistoryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter entries from date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter entries to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}
```

---

### Task 6 — Create `preview-recurring-rules.dto.ts`

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/preview-recurring-rules.dto.ts`

```typescript
import { IsInt, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PreviewRecurringRulesDto {
  @ApiProperty({ description: 'Preview period in days (30, 60, or 90)', example: 30 })
  @IsInt()
  @IsIn([30, 60, 90])
  @Type(() => Number)
  days: number;
}
```

---

### Task 7 — Verify Compilation

**What:** Verify all DTOs compile correctly.

```bash
cd /var/www/lead360.app/api && npx tsc --noEmit
```

If there are import errors, fix them. Common issues:
- Missing `class-transformer` → `npm install class-transformer` (should already be installed)
- Missing `class-validator` → `npm install class-validator` (should already be installed)
- Swagger decorator import path

Also verify with the dev server:
```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for compilation, verify no errors in console output.

---

## Patterns Applied

**DTO validation pattern (from existing codebase):**
- `@IsUUID()` for all FK references
- `@IsDateString()` for date fields in `YYYY-MM-DD` format
- `@Type(() => Number)` on numeric query params (required for class-transformer to work with query strings)
- `@Min()` / `@Max()` for numeric ranges
- `@MaxLength()` for string length limits
- `@ApiProperty()` / `@ApiPropertyOptional()` for Swagger documentation

---

## Files Created

| File | Purpose |
|------|---------|
| `dto/create-recurring-rule.dto.ts` | Create rule request validation |
| `dto/update-recurring-rule.dto.ts` | Update rule request validation (partial) |
| `dto/list-recurring-rules.dto.ts` | List rules query params + pagination |
| `dto/skip-recurring-rule.dto.ts` | Skip occurrence request body |
| `dto/recurring-rule-history.dto.ts` | History query params + pagination |
| `dto/preview-recurring-rules.dto.ts` | Preview query params (days) |

---

## Acceptance Criteria

- [ ] All 6 DTO files created at the correct paths
- [ ] `CreateRecurringRuleDto` has all 17 fields with correct validation
- [ ] `UpdateRecurringRuleDto` extends PartialType and excludes `start_date`
- [ ] `ListRecurringRulesDto` supports status, category_id, frequency, page, limit, sort_by, sort_order
- [ ] `SkipRecurringRuleDto` has optional `reason` with max 500 chars
- [ ] `RecurringRuleHistoryDto` has page, limit, date_from, date_to
- [ ] `PreviewRecurringRulesDto` has `days` field constrained to 30, 60, or 90
- [ ] `RecurringFrequency` enum exported from create DTO for reuse
- [ ] `RecurringRuleStatus`, `RecurringRuleSortBy`, `SortOrder` enums exported from list DTO
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Dev server compiles without DTO-related errors
- [ ] No existing DTO files modified
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — All 6 DTO files must exist and compile cleanly. `npm run build` or `npx tsc --noEmit` must pass. Verify all exports are accessible. Do NOT proceed to Sprint 6_3 until confirmed.

---

## Handoff Notes

- `RecurringFrequency` enum is exported from `create-recurring-rule.dto.ts` — import it from there in the service
- `RecurringRuleStatus` enum is exported from `list-recurring-rules.dto.ts` — import it in the service for type checking
- All DTO files are in `/var/www/lead360.app/api/src/modules/financial/dto/`
- The service will import these DTOs as parameter types for its methods
