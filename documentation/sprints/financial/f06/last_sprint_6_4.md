# Sprint 6_4 — Service Layer Lifecycle: pause/resume/skip/trigger/processRule/preview/history

**Module:** Financial
**File:** ./documentation/sprints/financial/f06/sprint_6_4.md
**Type:** Backend — Service (continuation)
**Depends On:** Sprint 6_3 (core service with CRUD + calculateNextDueDate)
**Gate:** STOP — All lifecycle methods must compile. `processRule()` must contain a Prisma transaction. Service must have all 13 public methods.
**Estimated Complexity:** High

---

> **You are a masterclass-level backend engineer.** Your code quality makes engineers at Google, Amazon, and Apple jealous. Every line you write is precise, intentional, and production-grade.

> **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> **MySQL credentials** are in the `.env` file at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.

---

## Objective

Add the remaining lifecycle methods to `RecurringExpenseService`: pause, resume, skip, triggerNow, processRule (the core entry-generation logic), getHistory, and getPreview. This completes the full service layer for the recurring expense engine.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/recurring-expense.service.ts` — the file you're modifying (created in Sprint 6_3)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand the `createEntry()` method signature
- [ ] Read the DTOs from Sprint 6_2: `skip-recurring-rule.dto.ts`, `recurring-rule-history.dto.ts`, `preview-recurring-rules.dto.ts`
- [ ] Verify `FinancialEntryService` is importable from the financial module

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

### Task 1 — Add `FinancialEntryService` Dependency to Constructor

**What:** Add `FinancialEntryService` as a constructor dependency. This is needed for `processRule()` to create entries via the standard service.

**Modify the constructor in `/var/www/lead360.app/api/src/modules/financial/services/recurring-expense.service.ts`:**

```typescript
import { FinancialEntryService } from './financial-entry.service';
import { SkipRecurringRuleDto } from '../dto/skip-recurring-rule.dto';
import { RecurringRuleHistoryDto } from '../dto/recurring-rule-history.dto';
import { PreviewRecurringRulesDto } from '../dto/preview-recurring-rules.dto';
```

Update the constructor:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly auditLogger: AuditLoggerService,
  private readonly financialEntryService: FinancialEntryService,
) {}
```

**Note:** Do NOT add `@InjectQueue()` yet — the queue is registered in Sprint 6_6. For `triggerNow()`, use a placeholder pattern that Sprint 6_6 will complete.

---

### Task 2 — Implement `pause()` Method

**Signature:**
```typescript
async pause(tenantId: string, ruleId: string, userId: string)
```

**Implementation:**

```typescript
const rule = await this.prisma.recurring_expense_rule.findFirst({
  where: { id: ruleId, tenant_id: tenantId },
});
if (!rule) throw new NotFoundException('Recurring rule not found');

if (rule.status !== 'active') {
  throw new BadRequestException('Only active rules can be paused');
}

const updated = await this.prisma.recurring_expense_rule.update({
  where: { id: ruleId },
  data: { status: 'paused', updated_by_user_id: userId },
  include: {
    category: { select: { id: true, name: true, type: true } },
    supplier: { select: { id: true, name: true } },
    payment_method: { select: { id: true, nickname: true, type: true } },
  },
});

await this.auditLogger.logTenantChange({
  action: 'updated',
  entityType: 'recurring_expense_rule',
  entityId: ruleId,
  tenantId,
  actorUserId: userId,
  before: rule,
  after: updated,
  description: `Paused recurring rule: ${rule.name}`,
});

return updated;
```

**Business rule:** `next_due_date` is preserved when paused — when resumed, the rule picks up where it left off (but if next_due_date is in the past, resume advances it).

---

### Task 3 — Implement `resume()` Method

**Signature:**
```typescript
async resume(tenantId: string, ruleId: string, userId: string)
```

**Implementation:**

```typescript
const rule = await this.prisma.recurring_expense_rule.findFirst({
  where: { id: ruleId, tenant_id: tenantId },
});
if (!rule) throw new NotFoundException('Recurring rule not found');

if (rule.status !== 'paused') {
  throw new BadRequestException('Only paused rules can be resumed');
}

// If next_due_date is in the past, advance to next future occurrence
const today = startOfDay(new Date());
let nextDueDate = new Date(rule.next_due_date);

if (nextDueDate < today) {
  // Advance until we find a future date — do NOT back-generate missed entries
  while (nextDueDate < today) {
    nextDueDate = this.calculateNextDueDate(
      rule.frequency,
      rule.interval,
      nextDueDate,
      rule.day_of_month,
      rule.day_of_week,
    );
  }
}

const updated = await this.prisma.recurring_expense_rule.update({
  where: { id: ruleId },
  data: {
    status: 'active',
    next_due_date: nextDueDate,
    updated_by_user_id: userId,
  },
  include: {
    category: { select: { id: true, name: true, type: true } },
    supplier: { select: { id: true, name: true } },
    payment_method: { select: { id: true, nickname: true, type: true } },
  },
});

await this.auditLogger.logTenantChange({
  action: 'updated',
  entityType: 'recurring_expense_rule',
  entityId: ruleId,
  tenantId,
  actorUserId: userId,
  before: rule,
  after: updated,
  description: `Resumed recurring rule: ${rule.name}. Next due: ${nextDueDate.toISOString().split('T')[0]}`,
});

return updated;
```

**Business rules:**
- BR-3: Do NOT back-generate missed entries on resume
- Only advance `next_due_date` to the NEXT upcoming occurrence from today

---

### Task 4 — Implement `skipNext()` Method

**Signature:**
```typescript
async skipNext(tenantId: string, ruleId: string, userId: string, dto: SkipRecurringRuleDto)
```

**Implementation:**

```typescript
const rule = await this.prisma.recurring_expense_rule.findFirst({
  where: { id: ruleId, tenant_id: tenantId },
});
if (!rule) throw new NotFoundException('Recurring rule not found');

if (rule.status !== 'active') {
  throw new BadRequestException('Only active rules can skip occurrences');
}

// Calculate the NEXT occurrence after current next_due_date
const newNextDueDate = this.calculateNextDueDate(
  rule.frequency,
  rule.interval,
  new Date(rule.next_due_date),
  rule.day_of_month,
  rule.day_of_week,
);

// Increment occurrences_generated (skip counts toward recurrence_count)
const newOccurrencesGenerated = rule.occurrences_generated + 1;

// Check termination conditions
let newStatus = rule.status;
if (rule.end_date && newNextDueDate > new Date(rule.end_date)) {
  newStatus = 'completed';
}
if (rule.recurrence_count && newOccurrencesGenerated >= rule.recurrence_count) {
  newStatus = 'completed';
}

const updated = await this.prisma.recurring_expense_rule.update({
  where: { id: ruleId },
  data: {
    next_due_date: newNextDueDate,
    occurrences_generated: newOccurrencesGenerated,
    status: newStatus as any,
    updated_by_user_id: userId,
  },
  include: {
    category: { select: { id: true, name: true, type: true } },
    supplier: { select: { id: true, name: true } },
    payment_method: { select: { id: true, nickname: true, type: true } },
  },
});

await this.auditLogger.logTenantChange({
  action: 'updated',
  entityType: 'recurring_expense_rule',
  entityId: ruleId,
  tenantId,
  actorUserId: userId,
  before: rule,
  after: updated,
  metadata: { skipped_date: rule.next_due_date, reason: dto.reason },
  description: `Skipped occurrence on ${new Date(rule.next_due_date).toISOString().split('T')[0]} for rule: ${rule.name}${dto.reason ? ` (reason: ${dto.reason})` : ''}`,
});

return updated;
```

**Business rules:**
- BR-6: Skipping counts toward `recurrence_count`
- BR-7: Termination checked after every skip

---

### Task 5 — Implement `triggerNow()` Method (Placeholder)

**Signature:**
```typescript
async triggerNow(tenantId: string, ruleId: string, userId: string)
```

**Implementation:**

This method will enqueue a high-priority BullMQ job. Since the queue is not registered until Sprint 6_6, implement this method as a **direct synchronous call** to `processRule()` for now. Sprint 6_6 will convert it to use the queue.

```typescript
const rule = await this.prisma.recurring_expense_rule.findFirst({
  where: { id: ruleId, tenant_id: tenantId },
});
if (!rule) throw new NotFoundException('Recurring rule not found');

if (rule.status === 'cancelled' || rule.status === 'completed') {
  throw new BadRequestException(`Cannot trigger a ${rule.status} rule`);
}

// Sprint 6_6 will replace this direct call with queue enqueue
await this.processRule(ruleId, tenantId);

await this.auditLogger.logTenantChange({
  action: 'updated',
  entityType: 'recurring_expense_rule',
  entityId: ruleId,
  tenantId,
  actorUserId: userId,
  description: `Manually triggered entry generation for rule: ${rule.name}`,
});

return { message: 'Entry generation triggered', rule_id: ruleId };
```

**Sprint 6_6 will replace the `await this.processRule()` call** with an async queue enqueue. Do NOT leave TODO comments in the code — Sprint 6_6 handles this change completely.

---

### Task 6 — Implement `processRule()` Method — Core Entry Generation

**This is the most critical method. It generates the financial entry and updates the rule atomically.**

**Signature:**
```typescript
async processRule(ruleId: string, tenantId: string)
```

**Implementation:**

**IMPORTANT:** The entry creation and rule update MUST be atomic. `FinancialEntryService.createEntry()` uses its own Prisma instance, so it cannot participate in a `$transaction`. Therefore, create the entry directly via `tx.financial_entry.create()` inside the transaction. This duplicates some logic from `createEntry()` but guarantees atomicity.

```typescript
async processRule(ruleId: string, tenantId: string) {
  const rule = await this.prisma.recurring_expense_rule.findFirst({
    where: { id: ruleId, tenant_id: tenantId },
  });

  if (!rule) {
    this.logger.warn(`Rule ${ruleId} not found for tenant ${tenantId} — skipping`);
    return;
  }

  // Verify rule is still active and due
  const today = startOfDay(new Date());
  if (rule.status !== 'active') {
    this.logger.log(`Rule ${ruleId} is ${rule.status} — skipping`);
    return;
  }

  if (new Date(rule.next_due_date) > today) {
    this.logger.log(`Rule ${ruleId} not yet due (next: ${rule.next_due_date}) — skipping`);
    return;
  }

  // Duplicate prevention (Business Rule 11):
  // Check if an entry with this rule's next_due_date already exists
  const ruleDueDate = new Date(rule.next_due_date);
  const nextDay = new Date(ruleDueDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const existingEntry = await this.prisma.financial_entry.findFirst({
    where: {
      recurring_rule_id: ruleId,
      tenant_id: tenantId,
      entry_date: {
        gte: ruleDueDate,
        lt: nextDay,
      },
    },
  });

  if (existingEntry) {
    this.logger.warn(`Entry already exists for rule ${ruleId} on ${ruleDueDate.toISOString().split('T')[0]} — skipping duplicate`);
    return;
  }

  // Use Prisma interactive transaction for atomicity
  const result = await this.prisma.$transaction(async (tx) => {
    // Create entry directly via Prisma (inside transaction for atomicity)
    const entry = await tx.financial_entry.create({
      data: {
        tenant_id: tenantId,
        category_id: rule.category_id,
        entry_type: 'expense',
        amount: rule.amount,
        tax_amount: rule.tax_amount,
        entry_date: new Date(rule.next_due_date),
        vendor_name: rule.vendor_name,
        supplier_id: rule.supplier_id,
        payment_method_registry_id: rule.payment_method_registry_id,
        notes: rule.notes,
        is_recurring_instance: true,
        recurring_rule_id: rule.id,
        submission_status: rule.auto_confirm ? 'confirmed' : 'pending_review',
        has_receipt: false,
        created_by_user_id: rule.created_by_user_id,
      },
    });

    // Calculate next due date
    const nextDueDate = this.calculateNextDueDate(
      rule.frequency,
      rule.interval,
      new Date(rule.next_due_date),
      rule.day_of_month,
      rule.day_of_week,
    );

    const newOccurrences = rule.occurrences_generated + 1;

    // Check termination conditions
    let newStatus: string = rule.status;
    if (rule.end_date && nextDueDate > new Date(rule.end_date)) {
      newStatus = 'completed';
    }
    if (rule.recurrence_count && newOccurrences >= rule.recurrence_count) {
      newStatus = 'completed';
    }

    // Update the rule
    await tx.recurring_expense_rule.update({
      where: { id: ruleId },
      data: {
        occurrences_generated: newOccurrences,
        last_generated_at: new Date(),
        last_generated_entry_id: entry.id,
        next_due_date: nextDueDate,
        status: newStatus as any,
      },
    });

    return entry;
  });

  this.logger.log(`Generated entry ${result.id} for recurring rule ${ruleId}`);
  return result;
}
```

**IMPORTANT:** Check the actual fields available on `financial_entry` after F-01/F-04. The `data` object must match exactly what columns exist in the Prisma schema. If a field doesn't exist yet (e.g. `submission_status`, `is_recurring_instance`), the create will fail. Verify by reading the Prisma schema before coding.

---

### Task 7 — Implement `getHistory()` Method

**Signature:**
```typescript
async getHistory(tenantId: string, ruleId: string, query: RecurringRuleHistoryDto)
```

**Implementation:**

```typescript
// Verify rule exists and belongs to tenant
const rule = await this.prisma.recurring_expense_rule.findFirst({
  where: { id: ruleId, tenant_id: tenantId },
});
if (!rule) throw new NotFoundException('Recurring rule not found');

const page = query.page ?? 1;
const limit = query.limit ?? 20;
const skip = (page - 1) * limit;

const where: any = {
  recurring_rule_id: ruleId,
  tenant_id: tenantId,
};

if (query.date_from) {
  where.entry_date = { ...where.entry_date, gte: new Date(query.date_from) };
}
if (query.date_to) {
  where.entry_date = { ...where.entry_date, lte: new Date(query.date_to) };
}

const [entries, total] = await Promise.all([
  this.prisma.financial_entry.findMany({
    where,
    skip,
    take: limit,
    orderBy: { entry_date: 'desc' },
    include: {
      category: { select: { id: true, name: true, type: true } },
    },
  }),
  this.prisma.financial_entry.count({ where }),
]);

return {
  data: entries,
  meta: {
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  },
};
```

---

### Task 8 — Implement `getPreview()` Method

**Signature:**
```typescript
async getPreview(tenantId: string, days: number)
```

**Implementation:**

```typescript
// Fetch all active rules for this tenant
const activeRules = await this.prisma.recurring_expense_rule.findMany({
  where: { tenant_id: tenantId, status: 'active' },
  include: {
    category: { select: { id: true, name: true } },
    supplier: { select: { id: true, name: true } },
    payment_method: { select: { id: true, nickname: true } },
  },
});

const today = startOfDay(new Date());
const endDate = addDays(today, days);

const occurrences: Array<{
  rule_id: string;
  rule_name: string;
  amount: number;
  tax_amount: number | null;
  category_name: string;
  due_date: string;
  frequency: string;
  supplier_name: string | null;
  payment_method_nickname: string | null;
}> = [];

let totalObligations = 0;

for (const rule of activeRules) {
  let nextDate = new Date(rule.next_due_date);
  let occurrenceCount = 0;

  // Generate all occurrences within the preview window
  while (nextDate <= endDate) {
    // Check recurrence_count limit BEFORE adding the occurrence
    if (rule.recurrence_count && (rule.occurrences_generated + occurrenceCount) >= rule.recurrence_count) break;

    // Check end_date BEFORE adding
    if (rule.end_date && nextDate > new Date(rule.end_date)) break;

    if (nextDate >= today) {
      const amount = Number(rule.amount);
      const taxAmount = rule.tax_amount ? Number(rule.tax_amount) : null;

      occurrences.push({
        rule_id: rule.id,
        rule_name: rule.name,
        amount,
        tax_amount: taxAmount,
        category_name: rule.category?.name ?? 'Unknown',
        due_date: nextDate.toISOString().split('T')[0],
        frequency: rule.frequency,
        supplier_name: rule.supplier?.name ?? null,
        payment_method_nickname: rule.payment_method?.nickname ?? null,
      });

      totalObligations += amount;
    }

    // Advance to next occurrence
    nextDate = this.calculateNextDueDate(
      rule.frequency,
      rule.interval,
      nextDate,
      rule.day_of_month,
      rule.day_of_week,
    );

    occurrenceCount++;

    // Safety: prevent infinite loops (max 365 occurrences in any preview)
    if (occurrenceCount > 365) break;
  }
}

// Sort occurrences by due_date
occurrences.sort((a, b) => a.due_date.localeCompare(b.due_date));

return {
  period_days: days,
  total_obligations: Math.round(totalObligations * 100) / 100,
  occurrences,
};
```

**Important:** Adjust `rule.supplier?.name` and `rule.payment_method?.nickname` to match the actual field names in the Prisma schema. Read the `supplier` and `payment_method_registry` models to confirm.

---

## Patterns Applied

**Prisma interactive transactions:**
```typescript
const result = await this.prisma.$transaction(async (tx) => {
  // All operations inside use `tx` instead of `this.prisma`
  const created = await tx.some_model.create({ ... });
  await tx.other_model.update({ ... });
  return created;
});
```

**AuditLoggerService:**
```typescript
await this.auditLogger.logTenantChange({
  action: 'created' | 'updated' | 'deleted',
  entityType: 'recurring_expense_rule',
  entityId: string,
  tenantId: string,
  actorUserId: string,
  before?: object,
  after?: object,
  metadata?: object,
  description: string,
});
```

---

## Business Rules Enforced in This Sprint

- BR-3: Resume does NOT back-generate missed entries — `next_due_date` advances to future
- BR-6: Skipping counts toward `recurrence_count`
- BR-7: Termination checked after every generation and skip
- BR-9: Trigger generates ONE entry (next occurrence), not all past-due
- BR-10: `auto_confirm` determines `submission_status` on generated entries
- BR-11: Duplicate prevention — check if entry already exists for rule+date before generating

---

## Integration Points

| Service | Import Path | Usage |
|---------|-------------|-------|
| `FinancialEntryService` | `./financial-entry.service` | Constructor dependency (processRule uses direct tx.financial_entry.create instead) |
| `PrismaService` | `../../../core/database/prisma.service` | Database access + transactions |
| `AuditLoggerService` | `../../audit/services/audit-logger.service` | Audit logging |
| `date-fns` | `date-fns` | `startOfDay`, `addDays` for preview window |

---

## Acceptance Criteria

- [ ] `pause()` — sets status to paused, only works on active rules, preserves next_due_date
- [ ] `resume()` — sets status to active, advances next_due_date to future if in past
- [ ] `resume()` — does NOT back-generate missed entries
- [ ] `skipNext()` — advances next_due_date by one occurrence
- [ ] `skipNext()` — increments occurrences_generated
- [ ] `skipNext()` — checks termination conditions after skip
- [ ] `triggerNow()` — validates rule is not cancelled/completed
- [ ] `processRule()` — creates financial_entry with correct fields
- [ ] `processRule()` — wraps entry creation + rule update in Prisma transaction
- [ ] `processRule()` — updates occurrences_generated, last_generated_at, last_generated_entry_id, next_due_date
- [ ] `processRule()` — checks termination conditions (end_date, recurrence_count)
- [ ] `processRule()` — implements duplicate prevention (BR-11)
- [ ] `processRule()` — sets is_recurring_instance = true, recurring_rule_id = rule.id
- [ ] `processRule()` — auto_confirm true → submission_status = confirmed
- [ ] `processRule()` — auto_confirm false → submission_status = pending_review
- [ ] `getHistory()` — returns paginated entries filtered by recurring_rule_id
- [ ] `getHistory()` — supports date_from/date_to filters
- [ ] `getPreview()` — calculates all occurrences within 30/60/90 day window
- [ ] `getPreview()` — respects end_date and recurrence_count boundaries
- [ ] `getPreview()` — never creates entries (read-only)
- [ ] All methods enforce tenant_id filtering
- [ ] Service compiles without errors
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Service must compile with all 13 public methods: `calculateNextDueDate`, `create`, `findAll`, `findOne`, `update`, `cancel`, `pause`, `resume`, `skipNext`, `triggerNow`, `processRule`, `getHistory`, `getPreview`. `processRule` must use a Prisma `$transaction`. Run `npx tsc --noEmit` to verify. Do NOT proceed to Sprint 6_5 until confirmed.

---

## Handoff Notes

- Full service is at `/var/www/lead360.app/api/src/modules/financial/services/recurring-expense.service.ts`
- Service has 13 public methods: `calculateNextDueDate`, `create`, `findAll`, `findOne`, `update`, `cancel`, `pause`, `resume`, `skipNext`, `triggerNow`, `processRule`, `getHistory`, `getPreview`
- `triggerNow()` has a placeholder — Sprint 6_6 will add the queue injection and convert it to async
- `processRule()` is called by both the processor (Sprint 6_6) and `triggerNow()`
- The service is NOT yet registered in `financial.module.ts` — Sprint 6_5 handles this
- Constructor dependencies: `PrismaService`, `AuditLoggerService`, `FinancialEntryService`
- Sprint 6_6 will add: `@InjectQueue('recurring-expense-generation') private recurringExpenseQueue: Queue`
