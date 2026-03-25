# Sprint 6_3 — Service Layer Core: CRUD + calculateNextDueDate

**Module:** Financial
**File:** ./documentation/sprints/financial/f06/sprint_6_3.md
**Type:** Backend — Service
**Depends On:** Sprint 6_1 (migration), Sprint 6_2 (DTOs)
**Gate:** STOP — Service must compile. `calculateNextDueDate()` must be unit-testable as a pure function. All CRUD methods must be implemented.
**Estimated Complexity:** High

---

> **You are a masterclass-level backend engineer.** Your code quality makes engineers at Google, Amazon, and Apple jealous. Every line you write is precise, intentional, and production-grade.

> **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> **MySQL credentials** are in the `.env` file at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.

---

## Objective

Implement the `RecurringExpenseService` with the core scheduling algorithm (`calculateNextDueDate`) and all CRUD operations (create, findAll with monthly obligation summary, findOne with previews, update with schedule recalculation, cancel). This is the heart of the recurring expense engine.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand the service pattern, constructor dependencies, Prisma usage
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.ts` — understand validation patterns
- [ ] Read all DTO files created in Sprint 6_2
- [ ] Verify `recurring_expense_rule` model is accessible via `this.prisma.recurring_expense_rule`
- [ ] Check what date library is available: `date-fns` is installed (version ^4.1.0) — use it for date calculations
- [ ] Read `/var/www/lead360.app/api/src/modules/audit/services/audit-logger.service.ts` — confirm `logTenantChange` method signature

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

### Task 1 — Create `RecurringExpenseService` Class Skeleton

**File:** `/var/www/lead360.app/api/src/modules/financial/services/recurring-expense.service.ts`

**Imports:**
```typescript
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateRecurringRuleDto, RecurringFrequency } from '../dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from '../dto/update-recurring-rule.dto';
import { ListRecurringRulesDto } from '../dto/list-recurring-rules.dto';
import { Decimal } from '@prisma/client/runtime/library';
```

**Note:** Check the actual import path for `Decimal` in the codebase. It may be `@prisma/client/runtime/library` or similar. Look at how other services import Decimal (check `financial-entry.service.ts` or `crew-payment.service.ts`).

**Constructor:**
```typescript
@Injectable()
export class RecurringExpenseService {
  private readonly logger = new Logger(RecurringExpenseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // Methods added in Tasks below
}
```

**Note on BullMQ queue injection:** The `triggerNow` method (Sprint 6_4) will need `@InjectQueue('recurring-expense-generation')`. Do NOT add it yet — Sprint 6_6 registers the queue. For now, the constructor only needs `PrismaService` and `AuditLoggerService`. Sprint 6_6 will add the queue injection.

---

### Task 2 — Implement `calculateNextDueDate()` — Pure Function

**This is the core scheduling algorithm. It MUST be a pure function — no database calls, no side effects.**

**Method signature:**
```typescript
calculateNextDueDate(
  frequency: string,
  interval: number,
  currentDueDate: Date,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): Date
```

**Implementation rules by frequency:**

**`daily`:** Add `interval` days to `currentDueDate`.
```typescript
// Use date-fns: addDays(currentDueDate, interval)
```

**`weekly`:** Add `interval * 7` days to `currentDueDate`. If `dayOfWeek` is set (0-6, 0=Sunday), find the next occurrence of that weekday on or after the calculated date.
```typescript
// 1. Add interval * 7 days
// 2. If dayOfWeek is set, adjust to next matching weekday (getDay() comparison)
// Use date-fns: addDays, getDay
```

**`monthly`:** Add `interval` months to `currentDueDate`. If `dayOfMonth` is set, use that day. Handle end-of-month: if the target month doesn't have that day, use the last day of the month.
```typescript
// 1. Add interval months: addMonths(currentDueDate, interval)
// 2. If dayOfMonth is set:
//    a. Get the target month/year
//    b. Get the last day of that month: getDaysInMonth(targetDate) or endOfMonth
//    c. Use Math.min(dayOfMonth, lastDayOfMonth) as the target day
//    d. Set the date to that day
// Use date-fns: addMonths, getDaysInMonth, setDate
```

**`quarterly`:** Same as monthly but add `interval * 3` months.

**`annual`:** Add `interval` years. Same `dayOfMonth` logic.
```typescript
// Use date-fns: addYears
// If dayOfMonth set and month is February, handle leap year:
// Math.min(dayOfMonth, getDaysInMonth(targetDate))
```

**Edge case — end of month snapping:**
- Rule on Jan 31, monthly, no `dayOfMonth` set → use start_date day (31)
- February: no day 31 → snap to Feb 28 (or Feb 29 in leap year)
- March: day 31 exists → use March 31
- April: no day 31 → snap to April 30

**Implementation example for monthly/quarterly/annual dayOfMonth logic:**
```typescript
private resolveDay(targetDate: Date, preferredDay: number): Date {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const daysInMonth = getDaysInMonth(targetDate); // from date-fns
  const actualDay = Math.min(preferredDay, daysInMonth);
  return new Date(year, month, actualDay);
}
```

**Critical: Make this method `public` so it can be unit-tested and called from the processor.**

**date-fns imports you will need:**
```typescript
import { addDays, addMonths, addYears, getDaysInMonth, getDay, setDate, startOfDay } from 'date-fns';
```

Verify these are available in `date-fns` version ^4.1.0. If import paths differ in v4, adjust accordingly (v4 uses `import { addDays } from 'date-fns'`).

---

### Task 3 — Implement `create()` Method

**Signature:**
```typescript
async create(tenantId: string, userId: string, dto: CreateRecurringRuleDto)
```

**Service behavior (in this exact order):**

1. **Validate max active rules (100 per tenant):**
   ```typescript
   const activeCount = await this.prisma.recurring_expense_rule.count({
     where: { tenant_id: tenantId, status: 'active' },
   });
   if (activeCount >= 100) {
     throw new BadRequestException('Maximum of 100 active recurring rules per tenant');
   }
   ```

2. **Validate `category_id` belongs to tenant:**
   ```typescript
   const category = await this.prisma.financial_category.findFirst({
     where: { id: dto.category_id, tenant_id: tenantId, is_active: true },
   });
   if (!category) {
     throw new BadRequestException('Category not found or inactive');
   }
   ```

3. **Validate `supplier_id` (if provided) belongs to tenant:**
   ```typescript
   if (dto.supplier_id) {
     const supplier = await this.prisma.supplier.findFirst({
       where: { id: dto.supplier_id, tenant_id: tenantId },
     });
     if (!supplier) {
       throw new BadRequestException('Supplier not found in tenant');
     }
   }
   ```

4. **Validate `payment_method_registry_id` (if provided) belongs to tenant:**
   ```typescript
   if (dto.payment_method_registry_id) {
     const pm = await this.prisma.payment_method_registry.findFirst({
       where: { id: dto.payment_method_registry_id, tenant_id: tenantId },
     });
     if (!pm) {
       throw new BadRequestException('Payment method not found in tenant');
     }
   }
   ```

5. **Validate `start_date` is today or future:**
   ```typescript
   const startDate = new Date(dto.start_date);
   const today = startOfDay(new Date());
   if (startDate < today) {
     throw new BadRequestException('start_date must be today or in the future');
   }
   ```

6. **Validate `end_date > start_date` if both provided:**
   ```typescript
   if (dto.end_date) {
     const endDate = new Date(dto.end_date);
     if (endDate <= startDate) {
       throw new BadRequestException('end_date must be after start_date');
     }
   }
   ```

7. **Validate `tax_amount < amount` if both provided:**
   ```typescript
   if (dto.tax_amount !== undefined && dto.tax_amount >= dto.amount) {
     throw new BadRequestException('tax_amount must be less than amount');
   }
   ```

8. **Auto-populate `day_of_month` from start_date when null (CRITICAL for end-of-month snapping):**
   ```typescript
   // When user doesn't provide day_of_month for monthly/quarterly/annual,
   // store start_date's day so calculateNextDueDate always has a preferred day.
   // Without this, a rule starting Jan 31 would snap to Feb 28 and STAY on 28 forever.
   // With this, it correctly does: Jan 31 → Feb 28 → Mar 31 → Apr 30 → May 31
   let resolvedDayOfMonth = dto.day_of_month ?? null;
   if (resolvedDayOfMonth === null && ['monthly', 'quarterly', 'annual'].includes(dto.frequency)) {
     resolvedDayOfMonth = startDate.getDate();
   }

   // Same for day_of_week on weekly rules
   let resolvedDayOfWeek = dto.day_of_week ?? null;
   if (resolvedDayOfWeek === null && dto.frequency === 'weekly') {
     resolvedDayOfWeek = startDate.getDay();
   }
   ```

9. **Set `next_due_date = start_date`:**
   ```typescript
   const nextDueDate = startDate;
   ```

10. **Create the rule:**
   ```typescript
   const rule = await this.prisma.recurring_expense_rule.create({
     data: {
       tenant_id: tenantId,
       name: dto.name,
       description: dto.description ?? null,
       category_id: dto.category_id,
       amount: dto.amount,
       tax_amount: dto.tax_amount ?? null,
       supplier_id: dto.supplier_id ?? null,
       vendor_name: dto.vendor_name ?? null,
       payment_method_registry_id: dto.payment_method_registry_id ?? null,
       frequency: dto.frequency,
       interval: dto.interval ?? 1,
       day_of_month: resolvedDayOfMonth,
       day_of_week: resolvedDayOfWeek,
       start_date: startDate,
       end_date: dto.end_date ? new Date(dto.end_date) : null,
       recurrence_count: dto.recurrence_count ?? null,
       next_due_date: nextDueDate,
       auto_confirm: dto.auto_confirm ?? true,
       notes: dto.notes ?? null,
       status: 'active',
       created_by_user_id: userId,
     },
     include: {
       category: { select: { id: true, name: true, type: true } },
       supplier: { select: { id: true, name: true } },
       payment_method: { select: { id: true, nickname: true, type: true } },
     },
   });
   ```

   **Note:** Check if the `supplier` model has a `name` field. If F-02 uses a different field name (like `company_name`), adjust the `select`. Read the `supplier` model in the schema.

   **Note:** Check if `payment_method_registry` has `nickname` and `type` fields. Read the model in the schema and adjust selects accordingly.

11. **Audit log:**
    ```typescript
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'recurring_expense_rule',
      entityId: rule.id,
      tenantId,
      actorUserId: userId,
      after: rule,
      description: `Created recurring expense rule: ${dto.name} (${dto.frequency}, $${dto.amount})`,
    });
    ```

12. **Return the rule object.**

---

### Task 4 — Implement `findAll()` Method

**Signature:**
```typescript
async findAll(tenantId: string, query: ListRecurringRulesDto)
```

**Implementation:**

1. Build where clause:
   ```typescript
   const where: any = { tenant_id: tenantId };
   if (query.status) where.status = query.status;
   else where.status = 'active'; // Default filter
   if (query.category_id) where.category_id = query.category_id;
   if (query.frequency) where.frequency = query.frequency;
   ```

2. Pagination:
   ```typescript
   const page = query.page ?? 1;
   const limit = query.limit ?? 20;
   const skip = (page - 1) * limit;
   ```

3. Sorting:
   ```typescript
   const sortBy = query.sort_by ?? 'next_due_date';
   const sortOrder = query.sort_order ?? 'asc';
   const orderBy = { [sortBy]: sortOrder };
   ```

4. Query with count:
   ```typescript
   const [rules, total] = await Promise.all([
     this.prisma.recurring_expense_rule.findMany({
       where,
       skip,
       take: limit,
       orderBy,
       include: {
         category: { select: { id: true, name: true, type: true } },
         supplier: { select: { id: true, name: true } },
         payment_method: { select: { id: true, nickname: true, type: true } },
       },
     }),
     this.prisma.recurring_expense_rule.count({ where }),
   ]);
   ```

5. **Calculate monthly obligation summary** — compute for ALL active rules (not just current page):
   ```typescript
   const activeRules = await this.prisma.recurring_expense_rule.findMany({
     where: { tenant_id: tenantId, status: 'active' },
     select: { amount: true, frequency: true, interval: true },
   });

   let monthlyObligation = 0;
   for (const rule of activeRules) {
     const amount = Number(rule.amount);
     const interval = rule.interval;
     switch (rule.frequency) {
       case 'daily':
         monthlyObligation += amount * 30 / interval;
         break;
       case 'weekly':
         monthlyObligation += amount * (30 / (interval * 7));
         break;
       case 'monthly':
         monthlyObligation += amount / interval;
         break;
       case 'quarterly':
         monthlyObligation += amount / (interval * 3);
         break;
       case 'annual':
         monthlyObligation += amount / (interval * 12);
         break;
     }
   }
   ```

   **Monthly obligation normalization formulas (from contract):**
   - `daily`: `amount * 30 / interval` — e.g. daily interval=1 → amount*30, daily interval=2 → amount*15
   - `weekly`: `amount * (30 / (interval * 7))` — e.g. weekly interval=1 → amount*4.29
   - `monthly`: `amount / interval` — e.g. monthly interval=1 → amount, monthly interval=2 → amount/2
   - `quarterly`: `amount / (interval * 3)` — e.g. quarterly interval=1 → amount/3
   - `annual`: `amount / (interval * 12)` — e.g. annual interval=1 → amount/12

   **Note:** The contract line 295 shows `daily: amount * interval * 30` which produces incorrect results for interval > 1. Use the corrected formula `amount * 30 / interval` as shown above, and add a code comment noting the contract discrepancy.

6. Return response:
   ```typescript
   return {
     data: rules,
     meta: {
       total,
       page,
       limit,
       total_pages: Math.ceil(total / limit),
     },
     summary: {
       total_active_rules: activeRules.length,
       monthly_obligation: Math.round(monthlyObligation * 100) / 100,
     },
   };
   ```

---

### Task 5 — Implement `findOne()` Method

**Signature:**
```typescript
async findOne(tenantId: string, ruleId: string)
```

**Implementation:**

1. Fetch rule with relations:
   ```typescript
   const rule = await this.prisma.recurring_expense_rule.findFirst({
     where: { id: ruleId, tenant_id: tenantId },
     include: {
       category: { select: { id: true, name: true, type: true } },
       supplier: { select: { id: true, name: true } },
       payment_method: { select: { id: true, nickname: true, type: true } },
     },
   });

   if (!rule) {
     throw new NotFoundException('Recurring rule not found');
   }
   ```

2. Fetch last generated entry (if `last_generated_entry_id` is set):
   ```typescript
   let lastGeneratedEntry = null;
   if (rule.last_generated_entry_id) {
     lastGeneratedEntry = await this.prisma.financial_entry.findFirst({
       where: { id: rule.last_generated_entry_id, tenant_id: tenantId },
       select: { id: true, amount: true, entry_date: true, submission_status: true },
     });
   }
   ```

   **Note:** `submission_status` must exist on `financial_entry` (added by F-04). If the field doesn't exist in the schema, omit it from the select — do NOT add TODO comments in production code.

3. Calculate next 3 occurrence dates:
   ```typescript
   const nextOccurrences: Date[] = [];
   let nextDate = new Date(rule.next_due_date);

   for (let i = 0; i < 3; i++) {
     if (i === 0) {
       nextOccurrences.push(nextDate);
     } else {
       nextDate = this.calculateNextDueDate(
         rule.frequency,
         rule.interval,
         nextDate,
         rule.day_of_month,
         rule.day_of_week,
       );
       // Check end_date boundary
       if (rule.end_date && nextDate > new Date(rule.end_date)) break;
       // Check recurrence_count boundary
       if (rule.recurrence_count && (rule.occurrences_generated + i) >= rule.recurrence_count) break;
       nextOccurrences.push(nextDate);
     }
   }
   ```

4. Return enriched response:
   ```typescript
   return {
     ...rule,
     last_generated_entry: lastGeneratedEntry,
     next_occurrence_preview: nextOccurrences.map(d => d.toISOString().split('T')[0]),
   };
   ```

---

### Task 6 — Implement `update()` Method

**Signature:**
```typescript
async update(tenantId: string, ruleId: string, userId: string, dto: UpdateRecurringRuleDto)
```

**Implementation:**

1. Fetch existing rule:
   ```typescript
   const existing = await this.prisma.recurring_expense_rule.findFirst({
     where: { id: ruleId, tenant_id: tenantId },
   });
   if (!existing) throw new NotFoundException('Recurring rule not found');
   ```

2. Check status — cannot update cancelled or completed:
   ```typescript
   if (existing.status === 'cancelled' || existing.status === 'completed') {
     throw new BadRequestException(`Cannot update a ${existing.status} rule`);
   }
   ```

3. Validate FKs if provided (same as create):
   - `category_id` → validate belongs to tenant
   - `supplier_id` → validate belongs to tenant
   - `payment_method_registry_id` → validate belongs to tenant

4. Validate `end_date > start_date` if `end_date` changes:
   ```typescript
   if (dto.end_date) {
     const startDate = existing.start_date;
     if (new Date(dto.end_date) <= startDate) {
       throw new BadRequestException('end_date must be after start_date');
     }
   }
   ```

5. **Determine if schedule fields changed:**
   ```typescript
   const scheduleFieldsChanged =
     dto.frequency !== undefined ||
     dto.interval !== undefined ||
     dto.day_of_month !== undefined ||
     dto.day_of_week !== undefined ||
     dto.amount !== undefined;
   ```

6. Build update data:
   ```typescript
   const updateData: any = {
     ...dto,
     updated_by_user_id: userId,
   };
   // Convert date strings to Date objects if present
   if (dto.end_date) updateData.end_date = new Date(dto.end_date);
   ```

7. **Recalculate `next_due_date` if schedule changed:**
   ```typescript
   if (scheduleFieldsChanged) {
     const newFrequency = dto.frequency ?? existing.frequency;
     const newInterval = dto.interval ?? existing.interval;
     const newDayOfMonth = dto.day_of_month !== undefined ? dto.day_of_month : existing.day_of_month;
     const newDayOfWeek = dto.day_of_week !== undefined ? dto.day_of_week : existing.day_of_week;

     // Recalculate from the current next_due_date
     const recalculated = this.calculateNextDueDate(
       newFrequency,
       newInterval,
       new Date(existing.next_due_date),
       newDayOfMonth,
       newDayOfWeek,
     );

     // If recalculated date is in the past, advance to future
     const today = startOfDay(new Date());
     if (recalculated < today) {
       // Keep advancing until we find a future date
       let futureDate = recalculated;
       while (futureDate < today) {
         futureDate = this.calculateNextDueDate(newFrequency, newInterval, futureDate, newDayOfMonth, newDayOfWeek);
       }
       updateData.next_due_date = futureDate;
     } else {
       updateData.next_due_date = recalculated;
     }
   }
   ```

8. Update the rule:
   ```typescript
   const updated = await this.prisma.recurring_expense_rule.update({
     where: { id: ruleId },
     data: updateData,
     include: {
       category: { select: { id: true, name: true, type: true } },
       supplier: { select: { id: true, name: true } },
       payment_method: { select: { id: true, nickname: true, type: true } },
     },
   });
   ```

9. Audit log:
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'updated',
     entityType: 'recurring_expense_rule',
     entityId: ruleId,
     tenantId,
     actorUserId: userId,
     before: existing,
     after: updated,
     description: `Updated recurring rule: ${updated.name}${scheduleFieldsChanged ? ' (schedule modified)' : ''}`,
   });
   ```

10. Return updated rule.

---

### Task 7 — Implement `cancel()` Method

**Signature:**
```typescript
async cancel(tenantId: string, ruleId: string, userId: string)
```

**Implementation:**

1. Fetch rule, verify it exists and belongs to tenant.
2. Set `status = 'cancelled'`, `updated_by_user_id = userId`.
3. Do NOT delete the record — soft cancel only.
4. Audit log the cancellation.
5. Return updated rule.

```typescript
const rule = await this.prisma.recurring_expense_rule.findFirst({
  where: { id: ruleId, tenant_id: tenantId },
});
if (!rule) throw new NotFoundException('Recurring rule not found');

const updated = await this.prisma.recurring_expense_rule.update({
  where: { id: ruleId },
  data: { status: 'cancelled', updated_by_user_id: userId },
  include: {
    category: { select: { id: true, name: true, type: true } },
    supplier: { select: { id: true, name: true } },
    payment_method: { select: { id: true, nickname: true, type: true } },
  },
});

await this.auditLogger.logTenantChange({
  action: 'deleted',
  entityType: 'recurring_expense_rule',
  entityId: ruleId,
  tenantId,
  actorUserId: userId,
  before: rule,
  after: updated,
  description: `Cancelled recurring rule: ${rule.name}`,
});

return updated;
```

---

## Integration Points

| Service | Import Path | Usage |
|---------|-------------|-------|
| `PrismaService` | `../../../core/database/prisma.service` | Database access |
| `AuditLoggerService` | `../../audit/services/audit-logger.service` | Audit logging |
| `date-fns` | `date-fns` | Date calculations (`addDays`, `addMonths`, `addYears`, `getDaysInMonth`, `getDay`, `startOfDay`, `setDate`) |

---

## Business Rules Enforced in This Sprint

- BR-1: Rules cannot have `start_date` in the past
- BR-2: `day_of_month` capped at 28
- BR-4: Cancelled/completed rules cannot be edited
- BR-5: Paused rules can be edited
- BR-8: Generated entries independent — cancelling rule doesn't affect them
- BR-12: Maximum 100 active recurring rules per tenant

---

## Acceptance Criteria

- [ ] `RecurringExpenseService` created at correct path
- [ ] `calculateNextDueDate()` implemented as a public pure function (no DB calls)
- [ ] `calculateNextDueDate()` handles all 5 frequencies: daily, weekly, monthly, quarterly, annual
- [ ] `calculateNextDueDate()` handles end-of-month snapping (Jan 31 → Feb 28)
- [ ] `create()` validates category, supplier, payment method belong to tenant
- [ ] `create()` validates start_date not in past
- [ ] `create()` validates end_date > start_date
- [ ] `create()` validates tax_amount < amount
- [ ] `create()` enforces 100 active rule limit
- [ ] `create()` auto-populates `day_of_month` from start_date when null (for monthly/quarterly/annual)
- [ ] `create()` auto-populates `day_of_week` from start_date when null (for weekly)
- [ ] `create()` sets `next_due_date = start_date`
- [ ] `findAll()` supports pagination, filtering (status, category, frequency), sorting
- [ ] `findAll()` computes monthly_obligation summary across ALL active rules
- [ ] `findOne()` includes last_generated_entry and next 3 occurrence preview
- [ ] `update()` blocks updates on cancelled/completed rules
- [ ] `update()` recalculates next_due_date when schedule fields change
- [ ] `cancel()` sets status to cancelled (soft delete)
- [ ] All methods enforce tenant_id filtering
- [ ] All mutating methods audit log
- [ ] Service compiles without errors
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Service must compile. `calculateNextDueDate()` must be implemented and publicly accessible. All CRUD methods must exist. Run `npx tsc --noEmit` to verify. Do NOT proceed to Sprint 6_4 until confirmed.

---

## Handoff Notes

- `RecurringExpenseService` is at `/var/www/lead360.app/api/src/modules/financial/services/recurring-expense.service.ts`
- `calculateNextDueDate(frequency, interval, currentDueDate, dayOfMonth?, dayOfWeek?)` → returns `Date`
- Sprint 6_4 will add lifecycle methods: `pause`, `resume`, `skipNext`, `triggerNow`, `processRule`, `getHistory`, `getPreview`
- Sprint 6_6 will add `@InjectQueue('recurring-expense-generation')` to the constructor for `triggerNow`
- The service is NOT yet registered in `financial.module.ts` — Sprint 6_5 will handle module registration
