# Sprint 8_2 — DTOs + Invoice Number Generator Service

**Module:** Financial
**File:** `./documentation/sprints/financial/f08/sprint_8_2.md`
**Type:** Backend
**Depends On:** Sprint 8_1 (schema migration must be complete)
**Gate:** STOP — All DTOs compile, InvoiceNumberGeneratorService compiles, `npx tsc --noEmit` passes
**Estimated Complexity:** Medium

---

## Developer Standard

You are a **masterclass-level engineer** whose work makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is deliberate, precise, and production-grade.

---

## ⚠️ Critical Warnings

- **This platform is 85% production-ready.** Do NOT break any existing functionality. Not a single comma, relation, or enum may be disrupted.
- **Read the codebase BEFORE touching anything.** Understand what exists. Then implement with surgical precision.
- **Never leave the dev server running in the background** when you finish.
- **Never use `pkill -f`** — always use `lsof -i :PORT` + `kill {PID}`.
- **Never use PM2** — this project does NOT use PM2.
- **MySQL credentials** are in `/var/www/lead360.app/api/.env` — do NOT hardcode credentials anywhere.

---

## Objective

Create all DTOs (Data Transfer Objects) for the draw milestone and project invoice endpoints, plus the `InvoiceNumberGeneratorService` that generates atomic sequential invoice numbers per tenant. The DTOs define validation rules, Swagger documentation, and request/response shapes. The invoice number generator is a standalone service needed by both the DrawMilestoneService and ProjectInvoiceService in subsequent sprints.

---

## Pre-Sprint Checklist

- [ ] Sprint 8_1 GATE passed: migration clean, all tables exist, Prisma generates
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/` — understand existing DTO patterns (class-validator decorators, ApiProperty decorators, class-transformer usage)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/create-subcontractor-invoice.dto.ts` — use as reference for Swagger + validation pattern
- [ ] Read `/var/www/lead360.app/api/src/modules/projects/services/project-number-generator.service.ts` — understand the atomic number generation pattern (you'll replicate this for invoice numbers)
- [ ] Verify `tenant` model has `next_invoice_number` (Int, default 1) and `invoice_prefix` (String, default "INV")

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

### Task 1 — Create `CreateDrawMilestoneDto`

**File:** `api/src/modules/financial/dto/create-draw-milestone.dto.ts`

**Purpose:** Validates request body for `POST /projects/:projectId/milestones` (manual milestone creation).

```typescript
import { IsInt, IsString, IsEnum, IsNumber, IsOptional, Min, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDrawMilestoneDto {
  @ApiProperty({ description: 'Draw number (order of milestone)', example: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  draw_number: number;

  @ApiProperty({ description: 'Milestone description', example: 'Deposit', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description: string;

  @ApiProperty({ description: 'Calculation type', enum: ['percentage', 'fixed_amount'] })
  @IsEnum(['percentage', 'fixed_amount'], { message: 'calculation_type must be percentage or fixed_amount' })
  calculation_type: 'percentage' | 'fixed_amount';

  @ApiProperty({ description: 'Value — percentage (1-100) or fixed dollar amount', example: 50.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Value must be greater than 0' })
  @Type(() => Number)
  value: number;

  @ApiPropertyOptional({ description: 'Computed dollar amount — if not provided, computed from value and project.contract_value', example: 5000.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  calculated_amount?: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
```

---

### Task 2 — Create `UpdateDrawMilestoneDto`

**File:** `api/src/modules/financial/dto/update-draw-milestone.dto.ts`

**Purpose:** Validates request body for `PATCH /projects/:projectId/milestones/:id`.

```typescript
import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateDrawMilestoneDto {
  @ApiPropertyOptional({ description: 'Milestone description', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ description: 'Computed dollar amount — only editable if milestone status is pending', example: 5000.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  calculated_amount?: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
```

**Not editable via this DTO:** `status`, `invoice_id`, `invoiced_at`, `paid_at`, `draw_number`, `calculation_type`, `value`.

---

### Task 3 — Create `GenerateMilestoneInvoiceDto`

**File:** `api/src/modules/financial/dto/generate-milestone-invoice.dto.ts`

**Purpose:** Validates request body for `POST /projects/:projectId/milestones/:id/invoice` — generates an invoice from a milestone.

```typescript
import { IsString, IsNumber, IsOptional, IsDateString, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GenerateMilestoneInvoiceDto {
  @ApiPropertyOptional({ description: 'Invoice description — defaults to milestone description if not provided' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Payment due date', example: '2026-04-15' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ description: 'Tax amount', example: 125.50 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
```

---

### Task 4 — Create `CreateProjectInvoiceDto`

**File:** `api/src/modules/financial/dto/create-project-invoice.dto.ts`

**Purpose:** Validates request body for `POST /projects/:projectId/invoices` — manual invoice creation (not from milestone).

```typescript
import { IsString, IsNumber, IsOptional, IsDateString, Min, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProjectInvoiceDto {
  @ApiProperty({ description: 'Invoice line description', maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  @ApiProperty({ description: 'Invoice total amount', example: 5000.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ description: 'Tax amount', example: 125.50 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Payment due date', example: '2026-04-15' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
```

---

### Task 5 — Create `UpdateProjectInvoiceDto`

**File:** `api/src/modules/financial/dto/update-project-invoice.dto.ts`

**Purpose:** Validates request body for `PATCH /projects/:projectId/invoices/:id` — only draft invoices are editable.

```typescript
import { IsString, IsNumber, IsOptional, IsDateString, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateProjectInvoiceDto {
  @ApiPropertyOptional({ description: 'Invoice description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Invoice total amount', example: 5000.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({ description: 'Tax amount', example: 125.50 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Payment due date', example: '2026-04-15' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
```

---

### Task 6 — Create `RecordInvoicePaymentDto`

**File:** `api/src/modules/financial/dto/record-invoice-payment.dto.ts`

**Purpose:** Validates request body for `POST /projects/:projectId/invoices/:id/payments`.

```typescript
import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, IsUUID, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RecordInvoicePaymentDto {
  @ApiProperty({ description: 'Payment amount — must be > 0 and <= invoice.amount_due', example: 2500.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Payment amount must be greater than 0' })
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: 'Date payment was received', example: '2026-03-20' })
  @IsDateString()
  payment_date: string;

  @ApiProperty({ description: 'Payment method', enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle'] })
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle'], { message: 'payment_method must be one of: cash, check, bank_transfer, venmo, zelle' })
  payment_method: 'cash' | 'check' | 'bank_transfer' | 'venmo' | 'zelle';

  @ApiPropertyOptional({ description: 'Optional FK to payment_method_registry — named payment account' })
  @IsOptional()
  @IsUUID()
  payment_method_registry_id?: string;

  @ApiPropertyOptional({ description: 'Check number, transaction ID, etc.', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference_number?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
```

---

### Task 7 — Create `VoidInvoiceDto`

**File:** `api/src/modules/financial/dto/void-invoice.dto.ts`

**Purpose:** Validates request body for `POST /projects/:projectId/invoices/:id/void`.

```typescript
import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoidInvoiceDto {
  @ApiProperty({ description: 'Reason for voiding — required', example: 'Customer requested cancellation' })
  @IsString()
  @MinLength(1, { message: 'Voided reason is required' })
  @MaxLength(500)
  voided_reason: string;
}
```

---

### Task 8 — Create `ListProjectInvoicesDto`

**File:** `api/src/modules/financial/dto/list-project-invoices.dto.ts`

**Purpose:** Validates query parameters for `GET /projects/:projectId/invoices`.

```typescript
import { IsOptional, IsEnum, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListProjectInvoicesDto {
  @ApiPropertyOptional({ description: 'Filter by invoice status', enum: ['draft', 'sent', 'partial', 'paid', 'voided'] })
  @IsOptional()
  @IsEnum(['draft', 'sent', 'partial', 'paid', 'voided'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by created_at from date', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter by created_at to date', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
```

---

### Task 9 — Create `InvoiceNumberGeneratorService`

**File:** `api/src/modules/financial/services/invoice-number-generator.service.ts`

**Purpose:** Generates atomic sequential invoice numbers per tenant. Pattern: `{invoice_prefix}-{zero-padded number}` (e.g., `INV-0001`).

**IMPORTANT:** Before writing this service, read `/var/www/lead360.app/api/src/modules/projects/services/project-number-generator.service.ts` in full. Replicate its exact atomic pattern with these differences:
- Uses `tenant.next_invoice_number` instead of `tenant.next_project_number`
- Uses `tenant.invoice_prefix` (default "INV") instead of hardcoded "PRJ"
- Format: `{invoice_prefix}-{zero-padded 4-digit number}` — e.g., `INV-0001`, `INV-0002`
- No year component in the format

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class InvoiceNumberGeneratorService {
  private readonly logger = new Logger(InvoiceNumberGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate next sequential invoice number for tenant.
   * Format: {invoice_prefix}-{number padded to 4 digits} (e.g., "INV-0001")
   *
   * Thread-safe implementation using database transaction.
   * Mirrors ProjectNumberGeneratorService pattern.
   *
   * @param tenantId - Tenant UUID
   * @param transaction - Optional Prisma transaction client (if called within existing transaction)
   * @returns Formatted invoice number string
   */
  async generate(tenantId: string, transaction?: any): Promise<string> {
    if (transaction) {
      return this.generateInTransaction(transaction, tenantId);
    }

    return this.prisma.$transaction(async (tx) => {
      return this.generateInTransaction(tx, tenantId);
    });
  }

  private async generateInTransaction(
    tx: any,
    tenantId: string,
  ): Promise<string> {
    // Lock tenant row and fetch current invoice number + prefix
    const tenant = await tx.tenant.findFirst({
      where: { id: tenantId },
      select: {
        next_invoice_number: true,
        invoice_prefix: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const currentNumber = tenant.next_invoice_number;
    const prefix = tenant.invoice_prefix || 'INV';

    // Increment next_invoice_number for tenant
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        next_invoice_number: currentNumber + 1,
      },
    });

    // Format: INV-0001
    const paddedNumber = String(currentNumber).padStart(4, '0');
    const invoiceNumber = `${prefix}-${paddedNumber}`;

    this.logger.log(
      `Generated invoice number: ${invoiceNumber} for tenant: ${tenantId}`,
    );

    return invoiceNumber;
  }

  /**
   * Preview next invoice number for tenant (without incrementing).
   *
   * @param tenantId - Tenant UUID
   * @returns Next invoice number that will be generated
   */
  async previewNextNumber(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        next_invoice_number: true,
        invoice_prefix: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const prefix = tenant.invoice_prefix || 'INV';
    const paddedNumber = String(tenant.next_invoice_number).padStart(4, '0');

    return `${prefix}-${paddedNumber}`;
  }
}
```

---

## Patterns Applied

### DTO validation pattern (from existing codebase)
```typescript
// Always use class-validator + class-transformer + @nestjs/swagger
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// Use @Type(() => Number) for numeric fields to handle query param string→number conversion
// Use @IsDateString() for date fields (ISO 8601 format)
// Use @IsEnum() with explicit values for enum fields
```

### Atomic number generation pattern (from ProjectNumberGeneratorService)
```typescript
// 1. Accept optional transaction parameter (for embedding in larger transactions)
// 2. Lock tenant row with findFirst + update in same tx
// 3. Read counter → format → increment → return
// 4. No external dependencies — PrismaService only
```

---

## Acceptance Criteria

- [ ] `create-draw-milestone.dto.ts` created with all validations
- [ ] `update-draw-milestone.dto.ts` created with partial update fields only
- [ ] `generate-milestone-invoice.dto.ts` created with optional overrides
- [ ] `create-project-invoice.dto.ts` created with required amount + description
- [ ] `update-project-invoice.dto.ts` created with draft-only editable fields
- [ ] `record-invoice-payment.dto.ts` created with amount, date, method, reference
- [ ] `void-invoice.dto.ts` created with required voided_reason
- [ ] `list-project-invoices.dto.ts` created with status/date/pagination filters
- [ ] `invoice-number-generator.service.ts` created with atomic generation
- [ ] Invoice number format is `{prefix}-{0001}` (zero-padded to 4 digits)
- [ ] Generator accepts optional transaction parameter for embedding in larger transactions
- [ ] All files compile: `npx tsc --noEmit` passes
- [ ] No existing files modified (all new files)
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — All DTOs and InvoiceNumberGeneratorService must compile cleanly before Sprint 8_3 begins. Verify:
1. `npx tsc --noEmit` passes with no errors
2. All 8 DTO files exist in `api/src/modules/financial/dto/`
3. `invoice-number-generator.service.ts` exists in `api/src/modules/financial/services/`

---

## Handoff Notes

**DTOs available for Sprint 8_3+ controllers:**
- `CreateDrawMilestoneDto` — POST milestone
- `UpdateDrawMilestoneDto` — PATCH milestone
- `GenerateMilestoneInvoiceDto` — POST milestone/:id/invoice
- `CreateProjectInvoiceDto` — POST invoice
- `UpdateProjectInvoiceDto` — PATCH invoice
- `RecordInvoicePaymentDto` — POST invoice/:id/payments
- `VoidInvoiceDto` — POST invoice/:id/void
- `ListProjectInvoicesDto` — GET invoices query params

**InvoiceNumberGeneratorService available for Sprint 8_3+ services:**
- `generate(tenantId, transaction?)` — returns formatted invoice number string
- `previewNextNumber(tenantId)` — preview without incrementing
- Uses `tenant.next_invoice_number` (Int) and `tenant.invoice_prefix` (String, default "INV")
- Import: `import { InvoiceNumberGeneratorService } from './invoice-number-generator.service';`
