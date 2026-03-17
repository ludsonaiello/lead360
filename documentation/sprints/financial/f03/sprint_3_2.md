# Sprint 3_2 — DTOs: Payment Method Registry Create, Update, and List

**Module:** Financial
**File:** ./documentation/sprints/financial/f03/sprint_3_2.md
**Type:** Backend
**Depends On:** Sprint 3_1 (Schema Migration must be complete)
**Gate:** NONE — proceed to Sprint 3_3 when DTOs compile correctly
**Estimated Complexity:** Low

> **You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality.** Every line you write must reflect that standard.

> **WARNING:** This platform is 85% production-ready. Never leave the dev server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

---

## Objective

Create three DTO files for the Payment Method Registry: `CreatePaymentMethodRegistryDto`, `UpdatePaymentMethodRegistryDto`, and `ListPaymentMethodsDto`. These DTOs define the request validation for all CRUD endpoints. They use `class-validator` decorators for validation and `@nestjs/swagger` decorators for API documentation, matching the existing patterns used throughout the financial module.

---

## Pre-Sprint Checklist

- [ ] Sprint 3_1 is complete — `payment_method_registry` model exists in Prisma schema
- [ ] Read existing DTO files for patterns:
  - `/var/www/lead360.app/api/src/modules/financial/dto/create-crew-payment.dto.ts`
  - `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-category.dto.ts`
  - `/var/www/lead360.app/api/src/modules/quotes/dto/vendor/create-vendor.dto.ts`
- [ ] Confirm the `payment_method` enum values: `cash`, `check`, `bank_transfer`, `venmo`, `zelle`, `credit_card`, `debit_card`, `ACH`
- [ ] Verify the DTO directory exists: `/var/www/lead360.app/api/src/modules/financial/dto/`

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

**MySQL credentials** are in `/var/www/lead360.app/api/.env` — do not hardcode any database credentials.

---

## Tasks

### Task 1 — Read Existing DTO Patterns

**What:** Read these files to understand the exact patterns used in this codebase:

1. `/var/www/lead360.app/api/src/modules/financial/dto/create-crew-payment.dto.ts`
2. `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-category.dto.ts`
3. `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries.dto.ts`

**Why:** DTOs must match the established patterns exactly — same import style, same decorator usage, same naming convention.

**Do NOT:** Skip this step. You must replicate the exact conventions.

---

### Task 2 — Create `CreatePaymentMethodRegistryDto`

**What:** Create the file at:
```
/var/www/lead360.app/api/src/modules/financial/dto/create-payment-method-registry.dto.ts
```

**Exact content:**

```typescript
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentMethodRegistryDto {
  @ApiProperty({
    description: 'Human-readable name for this payment method',
    example: 'Chase Business Visa - Vehicle 1',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  nickname: string;

  @ApiProperty({
    description: 'Payment method type',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
    example: 'credit_card',
  })
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'type must be one of: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH',
  })
  type: string;

  @ApiPropertyOptional({
    description: 'Bank or institution name',
    example: 'Chase',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank_name?: string;

  @ApiPropertyOptional({
    description: 'Last 4 digits of card/account number (display label only). Must be exactly 4 numeric digits.',
    example: '4521',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'last_four must be exactly 4 numeric digits',
  })
  last_four?: string;

  @ApiPropertyOptional({
    description: 'Internal notes about this payment method',
    example: 'Assigned to field crew for supply runs',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Set as default payment method for new expense entries',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
```

**Field validation rules (from the Feature Contract):**
- `nickname`: Required, max 100 characters. Uniqueness is enforced at the service level (case-insensitive), not in the DTO.
- `type`: Required, must be one of the 8 enum values.
- `bank_name`: Optional, max 100 characters.
- `last_four`: Optional, must be exactly 4 numeric digits if provided. Validated with regex `/^\d{4}$/`.
- `notes`: Optional, free text.
- `is_default`: Optional, defaults to `false`. When `true`, the service unsets all other defaults atomically.

**Do NOT:**
- Add `tenant_id` or `created_by_user_id` to the DTO — those come from the JWT
- Add `is_active` — creation always starts as active
- Use `class-transformer` `@Transform` decorators on this DTO — not needed here
- Add `@IsUUID()` validators — no UUID fields in this DTO

---

### Task 3 — Create `UpdatePaymentMethodRegistryDto`

**What:** Create the file at:
```
/var/www/lead360.app/api/src/modules/financial/dto/update-payment-method-registry.dto.ts
```

**Exact content:**

```typescript
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentMethodRegistryDto {
  @ApiPropertyOptional({
    description: 'Human-readable name for this payment method',
    example: 'Chase Business Visa - Vehicle 1',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;

  @ApiPropertyOptional({
    description: 'Payment method type',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
    example: 'credit_card',
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'type must be one of: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH',
  })
  type?: string;

  @ApiPropertyOptional({
    description: 'Bank or institution name',
    example: 'Chase',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank_name?: string;

  @ApiPropertyOptional({
    description: 'Last 4 digits of card/account number. Must be exactly 4 numeric digits, or null to clear.',
    example: '4521',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'last_four must be exactly 4 numeric digits',
  })
  last_four?: string;

  @ApiPropertyOptional({
    description: 'Internal notes about this payment method',
    example: 'Assigned to field crew for supply runs',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Activate or deactivate this payment method',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
```

**Important contract rules:**
- `is_default` is **NOT** included in the update DTO. Default must be set via the dedicated `POST /:id/set-default` endpoint. This prevents accidental unsetting.
- `last_four` can be set to a new 4-digit value or the service can accept `null` to clear it (handled at service level, not DTO level — when the client sends `last_four: null`, the DTO validation passes because `@IsOptional()` allows it).
- All fields are optional — partial update.

**Do NOT:**
- Add `is_default` — it is NOT patchable via PATCH
- Add `tenant_id`, `created_by_user_id`, or `updated_by_user_id` — those come from JWT
- Use `PartialType(CreatePaymentMethodRegistryDto)` — the update DTO intentionally has different fields (`is_active` added, `is_default` removed)

---

### Task 4 — Create `ListPaymentMethodsDto`

**What:** Create the file at:
```
/var/www/lead360.app/api/src/modules/financial/dto/list-payment-methods.dto.ts
```

**Exact content:**

```typescript
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ListPaymentMethodsDto {
  @ApiPropertyOptional({
    description: 'Filter by active status. Defaults to true (only active). Pass false to include inactive.',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by payment method type',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
    example: 'credit_card',
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'type must be one of: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH',
  })
  type?: string;
}
```

**Contract rules:**
- `is_active` defaults to `true` at the service level (not in the DTO).
- `type` filters by `payment_method` enum value.
- **No pagination** — this is a settings-type endpoint with a max of 50 records per tenant. Returns a flat array, not an envelope.
- The `@Transform` on `is_active` converts query string `"true"`/`"false"` to actual booleans. This matches the pattern in the existing vendor list DTO.

**Do NOT:**
- Add `page` or `limit` parameters — this endpoint is not paginated
- Add `search` or `nickname` filter — not in the contract

---

### Task 5 — Verify Compilation

**What:** Start the dev server and verify all new DTO files compile without errors.

**Acceptance:**
- Server starts cleanly
- No TypeScript compilation errors related to the new DTO files
- Health check returns 200

---

## Patterns to Apply

### DTO Import Pattern (from existing financial module DTOs)

```typescript
// Validation decorators
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';

// Swagger decorators
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Transform (for query string boolean conversion)
import { Transform } from 'class-transformer';
```

### Enum Validation Pattern (from existing `create-crew-payment.dto.ts`)

```typescript
@IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle'], {
  message: 'payment_method must be one of: cash, check, bank_transfer, venmo, zelle',
})
```

This sprint uses the expanded 8-value enum.

### Boolean Query String Transform Pattern (from existing `list-vendors.dto.ts`)

```typescript
@IsOptional()
@IsBoolean()
@Transform(({ value }) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
})
is_active?: boolean;
```

---

## Business Rules Enforced in This Sprint

- BR-01: `nickname` max 100 characters (uniqueness enforced at service level, not DTO)
- BR-02: `last_four` must be exactly 4 numeric digits if provided — regex `/^\d{4}$/`
- BR-03: `type` must be a valid `payment_method` enum value
- BR-04: `is_default` is NOT patchable via the update DTO — must use `set-default` endpoint

---

## Integration Points

None — DTOs are standalone files with no service or database dependencies.

---

## Acceptance Criteria

- [ ] `create-payment-method-registry.dto.ts` exists at the correct path with all 6 fields
- [ ] `update-payment-method-registry.dto.ts` exists at the correct path with all 6 fields (no `is_default`)
- [ ] `list-payment-methods.dto.ts` exists at the correct path with 2 query parameters
- [ ] All files use `class-validator` decorators matching existing patterns
- [ ] All files include Swagger `@ApiProperty` / `@ApiPropertyOptional` decorators
- [ ] `last_four` validation uses `@Matches(/^\d{4}$/)` regex
- [ ] `type` enum validation includes all 8 values
- [ ] Dev server compiles without errors
- [ ] No existing code was modified
- [ ] No frontend code was modified
- [ ] Dev server is shut down before sprint is marked complete

---

## Gate Marker

NONE — Proceed to Sprint 3_3 when DTOs compile correctly.

---

## Handoff Notes

**For Sprint 3_3 (Service Layer):**
- Import `CreatePaymentMethodRegistryDto` from `'../dto/create-payment-method-registry.dto'`
- Import `UpdatePaymentMethodRegistryDto` from `'../dto/update-payment-method-registry.dto'`
- Import `ListPaymentMethodsDto` from `'../dto/list-payment-methods.dto'`
- The `is_active` filter in `ListPaymentMethodsDto` defaults to `true` — implement this default at the service level
- The update DTO does NOT include `is_default` — the service must enforce this by providing a separate `setDefault()` method
- `last_four` can be `null` to clear it — handle this at the service level even though the DTO regex only validates when the value is a string
