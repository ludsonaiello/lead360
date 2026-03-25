# Sprint 7_2 — DTOs for Project Financial Summary Endpoints

**Module:** Financial
**File:** ./documentation/sprints/financial/f07/sprint_7_2.md
**Type:** Backend — DTOs and Validation
**Depends On:** Sprint 7_1 (prerequisite migration complete)
**Gate:** NONE — Sprint 7_3 can begin immediately after this sprint completes
**Estimated Complexity:** Low

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

Create query parameter DTOs for the 5 new project financial summary endpoints. These DTOs validate and type the query parameters that the controller will pass to the service layer.

**Endpoints requiring DTOs:**

| Endpoint | Query Params |
|----------|-------------|
| `GET /projects/:projectId/financial/summary` | `date_from?`, `date_to?` |
| `GET /projects/:projectId/financial/tasks` | `date_from?`, `date_to?`, `sort_by?`, `sort_order?` |
| `GET /projects/:projectId/financial/timeline` | `date_from?`, `date_to?` |
| `GET /projects/:projectId/financial/receipts` | `is_categorized?`, `ocr_status?`, `page?`, `limit?` |
| `GET /projects/:projectId/financial/workforce` | `date_from?`, `date_to?` |

Three endpoints share the same `date_from`/`date_to` pattern (summary, timeline, workforce). The tasks endpoint extends that with sorting. The receipts endpoint has its own unique filter set.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/` — understand existing DTO patterns
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries.dto.ts` — reference for date_from/date_to pattern
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/list-receipts.dto.ts` — reference for receipt filter pattern
- [ ] Confirm Sprint 7_1 gate is met (enums available in Prisma types)

---

## Dev Server

> This sprint creates DTOs only. The dev server is NOT needed unless you want to verify compilation at the end.

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

### Task 1 — Create `project-financial-query.dto.ts`

**What:** Create a single DTO file containing all query DTOs for the 5 project financial endpoints.

**File:** `/var/www/lead360.app/api/src/modules/financial/dto/project-financial-query.dto.ts`

**Existing DTO pattern** (from `list-financial-entries.dto.ts`):
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsEnum, IsBoolean, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
```

**Complete DTO file content:**

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ─── Shared Date Range ───────────────────────────────────────────────

/**
 * Shared date range filter used by summary, timeline, and workforce endpoints.
 * Filters financial_entry.entry_date for cost endpoints.
 * Filters log_date/payment_date for workforce endpoint.
 */
export class ProjectDateFilterDto {
  @ApiPropertyOptional({
    description: 'Start date filter (inclusive). ISO 8601 date format.',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'End date filter (inclusive). ISO 8601 date format.',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}

// ─── Task Breakdown Query ────────────────────────────────────────────

export enum TaskBreakdownSortBy {
  TOTAL_COST = 'total_cost',
  TASK_TITLE = 'task_title',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Query DTO for GET /projects/:projectId/financial/tasks
 */
export class ProjectTaskBreakdownQueryDto extends ProjectDateFilterDto {
  @ApiPropertyOptional({
    description: 'Sort field',
    enum: TaskBreakdownSortBy,
    default: TaskBreakdownSortBy.TOTAL_COST,
    example: 'total_cost',
  })
  @IsOptional()
  @IsEnum(TaskBreakdownSortBy)
  sort_by?: TaskBreakdownSortBy = TaskBreakdownSortBy.TOTAL_COST;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortOrder,
    default: SortOrder.DESC,
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.DESC;
}

// ─── Receipts Query ──────────────────────────────────────────────────

export enum ReceiptOcrStatus {
  NOT_PROCESSED = 'not_processed',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

/**
 * Query DTO for GET /projects/:projectId/financial/receipts
 */
export class ProjectReceiptsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by categorization status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_categorized?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by OCR processing status',
    enum: ReceiptOcrStatus,
    example: 'complete',
  })
  @IsOptional()
  @IsEnum(ReceiptOcrStatus)
  ocr_status?: ReceiptOcrStatus;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (max 100)',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

**Rules:**
- Every field has `@ApiPropertyOptional()` with description, example, and type info
- `@IsOptional()` on every field (all query params are optional)
- Boolean query params need `@Transform()` because they arrive as strings from the URL
- Pagination fields use `@Type(() => Number)` for string→number coercion from query strings
- Enum fields use `@IsEnum()` with TypeScript enums (not string unions)
- `sort_by` defaults to `total_cost`, `sort_order` defaults to `desc`
- `page` defaults to 1, `limit` defaults to 20
- `ProjectDateFilterDto` is a standalone class, not abstract, so it can be used directly by summary, timeline, and workforce endpoints
- `ProjectTaskBreakdownQueryDto` extends `ProjectDateFilterDto` to inherit date filters

**Do NOT:**
- Create separate files for each DTO — all go in one file
- Add validation for projectId here — that comes from the route param via `@Param('projectId', ParseUUIDPipe)`
- Add any response DTOs — responses are typed inline in the service

---

### Task 2 — Verify Compilation

**What:** Start the dev server to confirm the new DTO file compiles without errors.

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for compilation. Check for:
- TypeScript errors in the new DTO file
- Import resolution (class-validator, class-transformer, @nestjs/swagger must be available)
- No circular dependencies

```bash
curl -s http://localhost:8000/health
# Must return 200
```

**After confirming compilation, shut down:**
```bash
lsof -i :8000
kill {PID}
lsof -i :8000   # Must return nothing
```

---

## Patterns Applied

**DTO Pattern (from existing financial module):**
```typescript
// Required field:
@ApiProperty({ description: '...', example: '...' })
@IsString()
@IsUUID()
field: string;

// Optional field:
@ApiPropertyOptional({ description: '...', example: '...' })
@IsOptional()
@IsString()
field?: string;

// Query param number (arrives as string, needs coercion):
@ApiPropertyOptional({ ... })
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
page?: number = 1;

// Query param boolean (arrives as string, needs transform):
@ApiPropertyOptional({ ... })
@IsOptional()
@Transform(({ value }) => { if (value === 'true') return true; if (value === 'false') return false; return value; })
@IsBoolean()
flag?: boolean;
```

---

## Acceptance Criteria

- [ ] File created: `/var/www/lead360.app/api/src/modules/financial/dto/project-financial-query.dto.ts`
- [ ] `ProjectDateFilterDto` class exported with `date_from?` and `date_to?` fields
- [ ] `ProjectTaskBreakdownQueryDto` class exported, extends `ProjectDateFilterDto`, adds `sort_by?` and `sort_order?`
- [ ] `ProjectReceiptsQueryDto` class exported with `is_categorized?`, `ocr_status?`, `page?`, `limit?`
- [ ] `TaskBreakdownSortBy` enum exported with values `total_cost`, `task_title`
- [ ] `SortOrder` enum exported with values `asc`, `desc`
- [ ] `ReceiptOcrStatus` enum exported with values `not_processed`, `processing`, `complete`, `failed`
- [ ] All fields have `@ApiPropertyOptional()` decorators with descriptions and examples
- [ ] Boolean transform handles string-to-boolean coercion for query params
- [ ] Number coercion (`@Type(() => Number)`) on `page` and `limit`
- [ ] Application compiles without errors
- [ ] No existing files modified
- [ ] Dev server shut down

---

## Gate Marker

**NONE** — Sprint 7_3 can begin immediately.

---

## Handoff Notes

**For Sprint 7_3 (Service Part 1):**
- Import DTOs from `../dto/project-financial-query.dto`
- `ProjectDateFilterDto` is used by `getFullSummary()`, `getTimeline()`, and `getWorkforceSummary()`
- `ProjectTaskBreakdownQueryDto` is used by `getTaskBreakdown()` — has `sort_by`, `sort_order`, `date_from`, `date_to`
- `ProjectReceiptsQueryDto` is used by `getReceipts()` — has `is_categorized`, `ocr_status`, `page`, `limit`
