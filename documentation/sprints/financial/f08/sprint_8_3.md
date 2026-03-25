# Sprint 8_3 — Draw Milestone Service

**Module:** Financial
**File:** `./documentation/sprints/financial/f08/sprint_8_3.md`
**Type:** Backend — Service Layer
**Depends On:** Sprint 8_1 (schema), Sprint 8_2 (DTOs + InvoiceNumberGeneratorService)
**Gate:** STOP — Service compiles, all methods defined, `npx tsc --noEmit` passes
**Estimated Complexity:** High

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

Create the `DrawMilestoneService` — the core service for managing project draw milestones. This service handles: seeding milestones from quote draw schedules when a project is created, manual CRUD operations for standalone projects, and the critical automation action of generating invoices from milestones. This is the bridge between the quoting module's draw schedules and the invoicing module.

---

## Pre-Sprint Checklist

- [ ] Sprint 8_1 GATE passed: schema migration clean
- [ ] Sprint 8_2 GATE passed: all DTOs and InvoiceNumberGeneratorService compile
- [ ] Read `/var/www/lead360.app/api/src/modules/quotes/services/draw-schedule.service.ts` — understand draw_schedule_entry structure and fields
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/subcontractor-invoice.service.ts` — understand existing invoice service patterns (validation, audit logging, status transitions)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/invoice-number-generator.service.ts` — confirm service exists from Sprint 8_2
- [ ] Read `/var/www/lead360.app/api/src/modules/projects/services/project.service.ts` — understand `createFromQuote()` (lines 73-237) to know the context where `seedFromQuote()` will be called
- [ ] Read all DTOs from Sprint 8_2

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

### Task 1 — Create `DrawMilestoneService`

**File:** `api/src/modules/financial/services/draw-milestone.service.ts`

**Constructor dependencies:**
```typescript
import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { InvoiceNumberGeneratorService } from './invoice-number-generator.service';
import { CreateDrawMilestoneDto } from '../dto/create-draw-milestone.dto';
import { UpdateDrawMilestoneDto } from '../dto/update-draw-milestone.dto';
import { GenerateMilestoneInvoiceDto } from '../dto/generate-milestone-invoice.dto';

@Injectable()
export class DrawMilestoneService {
  private readonly logger = new Logger(DrawMilestoneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly invoiceNumberGenerator: InvoiceNumberGeneratorService,
  ) {}
```

---

### Task 2 — Implement `seedFromQuote()` method

**Signature:** `async seedFromQuote(tenantId: string, projectId: string, quoteId: string, userId: string, transaction?: any): Promise<void>`

**CRITICAL:** This method must accept an optional `transaction` parameter. When called from `ProjectService.createFromQuote()`, the Prisma transaction client (`tx`) will be passed in. If `transaction` is provided, ALL database operations in this method must use `transaction` instead of `this.prisma`. If not provided (standalone call), use `this.prisma`.

**Business logic:**

1. Determine the Prisma client to use:
   ```typescript
   const db = transaction || this.prisma;
   ```

2. Fetch all `draw_schedule_entry` records for the given `quoteId`, ordered by `draw_number ASC`:
   ```typescript
   const entries = await db.draw_schedule_entry.findMany({
     where: { quote_id: quoteId },
     orderBy: { draw_number: 'asc' },
   });
   ```

3. If no entries found, return without error — standalone projects may not have draw schedules:
   ```typescript
   if (entries.length === 0) {
     this.logger.log(`No draw schedule entries for quote ${quoteId} — skipping milestone seeding`);
     return;
   }
   ```

4. Fetch the project's `contract_value`:
   ```typescript
   const project = await db.project.findFirst({
     where: { id: projectId, tenant_id: tenantId },
     select: { contract_value: true },
   });
   ```

5. For each entry, compute `calculated_amount`:
   - If `calculation_type === 'percentage'`:
     - If `project.contract_value` is not null: `calculated_amount = (entry.value / 100) * project.contract_value`
     - If `project.contract_value` is null: `calculated_amount = entry.value` (use raw value as fallback, add note)
   - If `calculation_type === 'fixed_amount'`: `calculated_amount = entry.value`

   **IMPORTANT:** Prisma `Decimal` fields require careful handling. Use `Number()` to convert Decimal to number for arithmetic, then pass the result as a plain number to `createMany()`.

6. Build the milestone data array:
   ```typescript
   const milestoneData = entries.map((entry) => {
     const contractValue = project?.contract_value != null ? Number(project.contract_value) : null;
     const entryValue = Number(entry.value);

     let calculatedAmount: number;
     let notes: string | null = null;

     if (entry.calculation_type === 'percentage') {
       if (contractValue !== null) {
         calculatedAmount = Math.round((entryValue / 100) * contractValue * 100) / 100;
       } else {
         calculatedAmount = entryValue;
         notes = 'contract_value was null at seed time — calculated_amount set to raw value';
       }
     } else {
       // fixed_amount
       calculatedAmount = entryValue;
     }

     return {
       tenant_id: tenantId,
       project_id: projectId,
       quote_draw_entry_id: entry.id,
       draw_number: entry.draw_number,
       description: entry.description,
       calculation_type: entry.calculation_type,
       value: entryValue,
       calculated_amount: calculatedAmount,
       status: 'pending' as const,
       notes,
       created_by_user_id: userId,
     };
   });
   ```

7. Create all milestone records in a single `createMany()` call:
   ```typescript
   await db.project_draw_milestone.createMany({
     data: milestoneData,
   });
   ```

8. Log the action:
   ```typescript
   this.logger.log(
     `Seeded ${milestoneData.length} draw milestones for project ${projectId} from quote ${quoteId}`,
   );
   ```

**Do NOT** audit log inside `seedFromQuote()` — the calling `ProjectService.createFromQuote()` already handles its own audit logging. Adding another audit log here would be redundant.

---

### Task 3 — Implement `findByProject()` method

**Signature:** `async findByProject(tenantId: string, projectId: string)`

**Returns:** Array of milestone objects ordered by `draw_number ASC`, with joined invoice_number if invoice exists.

```typescript
async findByProject(tenantId: string, projectId: string) {
  const milestones = await this.prisma.project_draw_milestone.findMany({
    where: {
      tenant_id: tenantId,
      project_id: projectId,
    },
    include: {
      invoice: {
        select: { id: true, invoice_number: true, status: true },
      },
    },
    orderBy: { draw_number: 'asc' },
  });

  return milestones.map((m) => ({
    id: m.id,
    draw_number: m.draw_number,
    description: m.description,
    calculation_type: m.calculation_type,
    value: Number(m.value),
    calculated_amount: Number(m.calculated_amount),
    status: m.status,
    invoice_id: m.invoice_id,
    invoice_number: m.invoice?.invoice_number ?? null,
    invoiced_at: m.invoiced_at,
    paid_at: m.paid_at,
    notes: m.notes,
    created_at: m.created_at,
  }));
}
```

**Note:** `invoice` is the relation via `invoice_id` FK (named `milestone_current_invoice`). Prisma will use the field name `invoice` from the model definition.

---

### Task 4 — Implement `create()` method

**Signature:** `async create(tenantId: string, projectId: string, userId: string, dto: CreateDrawMilestoneDto)`

**Business logic:**

1. Verify project exists and belongs to tenant:
   ```typescript
   const project = await this.prisma.project.findFirst({
     where: { id: projectId, tenant_id: tenantId },
     select: { id: true, contract_value: true },
   });
   if (!project) throw new NotFoundException('Project not found');
   ```

2. Check for duplicate draw_number:
   ```typescript
   const existing = await this.prisma.project_draw_milestone.findFirst({
     where: { project_id: projectId, draw_number: dto.draw_number },
   });
   if (existing) {
     throw new ConflictException(`Draw number ${dto.draw_number} already exists for this project`);
   }
   ```

3. Validate percentage value:
   ```typescript
   if (dto.calculation_type === 'percentage' && dto.value > 100) {
     throw new BadRequestException('Percentage value cannot exceed 100');
   }
   ```

4. Compute `calculated_amount` if not provided:
   ```typescript
   let calculatedAmount = dto.calculated_amount;
   if (calculatedAmount === undefined || calculatedAmount === null) {
     if (dto.calculation_type === 'percentage') {
       const contractValue = project.contract_value != null ? Number(project.contract_value) : null;
       if (contractValue !== null) {
         calculatedAmount = Math.round((dto.value / 100) * contractValue * 100) / 100;
       } else {
         calculatedAmount = dto.value;
       }
     } else {
       calculatedAmount = dto.value;
     }
   }
   ```

5. Create the milestone:
   ```typescript
   const milestone = await this.prisma.project_draw_milestone.create({
     data: {
       tenant_id: tenantId,
       project_id: projectId,
       draw_number: dto.draw_number,
       description: dto.description,
       calculation_type: dto.calculation_type,
       value: dto.value,
       calculated_amount: calculatedAmount,
       status: 'pending',
       notes: dto.notes ?? null,
       created_by_user_id: userId,
     },
   });
   ```

6. Audit log:
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'created',
     entityType: 'project_draw_milestone',
     entityId: milestone.id,
     tenantId,
     actorUserId: userId,
     after: milestone,
     description: `Created draw milestone #${dto.draw_number}: "${dto.description}" for project ${projectId}`,
   });
   ```

7. Return with Decimal conversion:
   ```typescript
   return {
     ...milestone,
     value: Number(milestone.value),
     calculated_amount: Number(milestone.calculated_amount),
   };
   ```

---

### Task 5 — Implement `update()` method

**Signature:** `async update(tenantId: string, projectId: string, milestoneId: string, userId: string, dto: UpdateDrawMilestoneDto)`

**Business logic:**

1. Fetch existing milestone:
   ```typescript
   const existing = await this.prisma.project_draw_milestone.findFirst({
     where: { id: milestoneId, project_id: projectId, tenant_id: tenantId },
   });
   if (!existing) throw new NotFoundException('Milestone not found');
   ```

2. Guard: `calculated_amount` cannot be changed if milestone is `invoiced` or `paid`:
   ```typescript
   if (dto.calculated_amount !== undefined && existing.status !== 'pending') {
     throw new BadRequestException('Cannot modify calculated_amount on an invoiced or paid milestone');
   }
   ```

3. Build update data (only provided fields):
   ```typescript
   const data: any = {};
   if (dto.description !== undefined) data.description = dto.description;
   if (dto.calculated_amount !== undefined) data.calculated_amount = dto.calculated_amount;
   if (dto.notes !== undefined) data.notes = dto.notes;
   ```

4. Update:
   ```typescript
   const updated = await this.prisma.project_draw_milestone.update({
     where: { id: milestoneId },
     data,
   });
   ```

5. Audit log with before/after:
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'updated',
     entityType: 'project_draw_milestone',
     entityId: milestoneId,
     tenantId,
     actorUserId: userId,
     before: existing,
     after: updated,
     description: `Updated draw milestone #${existing.draw_number} for project ${projectId}`,
   });
   ```

6. Return with Decimal conversion.

---

### Task 6 — Implement `delete()` method

**Signature:** `async delete(tenantId: string, projectId: string, milestoneId: string, userId: string)`

**Business logic:**

1. Fetch existing milestone.
2. Guard: Only `pending` milestones can be deleted:
   ```typescript
   if (existing.status !== 'pending') {
     throw new BadRequestException(`Cannot delete milestone in ${existing.status} status — only pending milestones can be deleted`);
   }
   ```
3. Delete:
   ```typescript
   await this.prisma.project_draw_milestone.delete({
     where: { id: milestoneId },
   });
   ```
4. Audit log with action `'deleted'`.

---

### Task 7 — Implement `generateInvoice()` method

**Signature:** `async generateInvoice(tenantId: string, projectId: string, milestoneId: string, userId: string, dto: GenerateMilestoneInvoiceDto)`

**CRITICAL:** This is the core automation action — creates an invoice from a milestone. Must be atomic.

**Business logic:**

1. Fetch milestone:
   ```typescript
   const milestone = await this.prisma.project_draw_milestone.findFirst({
     where: { id: milestoneId, project_id: projectId, tenant_id: tenantId },
   });
   if (!milestone) throw new NotFoundException('Milestone not found');
   ```

2. Guard: Must be `pending`:
   ```typescript
   if (milestone.status !== 'pending') {
     throw new BadRequestException(`Milestone is already ${milestone.status} — can only generate invoice from pending milestones`);
   }
   ```

3. Execute in a single Prisma transaction:
   ```typescript
   const invoice = await this.prisma.$transaction(async (tx) => {
     // a. Generate invoice number (atomic within same transaction)
     const invoiceNumber = await this.invoiceNumberGenerator.generate(tenantId, tx);

     // b. Compute amounts
     const amount = Number(milestone.calculated_amount);
     const taxAmount = dto.tax_amount ?? null;
     const amountDue = taxAmount !== null ? Math.round((amount + taxAmount) * 100) / 100 : amount;

     // c. Create project_invoice record
     const newInvoice = await tx.project_invoice.create({
       data: {
         tenant_id: tenantId,
         project_id: projectId,
         invoice_number: invoiceNumber,
         milestone_id: milestone.id,
         description: dto.description || milestone.description,
         amount,
         tax_amount: taxAmount,
         amount_paid: 0,
         amount_due: amountDue,
         status: 'draft',
         due_date: dto.due_date ? new Date(dto.due_date) : null,
         notes: dto.notes ?? null,
         created_by_user_id: userId,
       },
     });

     // d. Update milestone within same transaction
     await tx.project_draw_milestone.update({
       where: { id: milestoneId },
       data: {
         status: 'invoiced',
         invoice_id: newInvoice.id,
         invoiced_at: new Date(),
       },
     });

     return newInvoice;
   });
   ```

4. Audit log (outside transaction):
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'created',
     entityType: 'project_invoice',
     entityId: invoice.id,
     tenantId,
     actorUserId: userId,
     after: invoice,
     metadata: { milestone_id: milestoneId, generated_from: 'draw_milestone' },
     description: `Generated invoice ${invoice.invoice_number} ($${Number(invoice.amount).toFixed(2)}) from milestone #${milestone.draw_number}: "${milestone.description}"`,
   });
   ```

5. Return the invoice with Decimal conversions:
   ```typescript
   return {
     ...invoice,
     amount: Number(invoice.amount),
     tax_amount: invoice.tax_amount != null ? Number(invoice.tax_amount) : null,
     amount_paid: Number(invoice.amount_paid),
     amount_due: Number(invoice.amount_due),
   };
   ```

---

## Business Rules Enforced in This Service

| Rule | Method | Enforcement |
|------|--------|-------------|
| BR-01: Milestone `invoiced/paid` cannot be deleted | `delete()` | Status check → 400 |
| BR-02: `calculated_amount` locked after invoice | `update()` | Status check → 400 |
| BR-03: Only one invoice per pending milestone | `generateInvoice()` | Status check → 400 |
| BR-04: `draw_number` unique per project | `create()` | Conflict check → 409 |
| BR-05: Percentage value ≤ 100 | `create()` | Validation → 400 |
| BR-06: `calculated_amount` computed at seed time | `seedFromQuote()` | Computed, never recalculated |
| BR-07: Null `contract_value` uses raw value with note | `seedFromQuote()` | Fallback logic |
| BR-10: Milestones trace to source draw entry | `seedFromQuote()` | `quote_draw_entry_id` set |

---

## Integration Points

| Dependency | Import Path | Used By |
|-----------|------------|---------|
| `PrismaService` | `../../../core/database/prisma.service` | All methods |
| `AuditLoggerService` | `../../audit/services/audit-logger.service` | All write methods |
| `InvoiceNumberGeneratorService` | `./invoice-number-generator.service` | `generateInvoice()` |

---

## Acceptance Criteria

- [ ] `draw-milestone.service.ts` created at `api/src/modules/financial/services/draw-milestone.service.ts`
- [ ] `seedFromQuote()` — accepts optional `transaction` parameter, uses it for all DB calls
- [ ] `seedFromQuote()` — correctly computes `calculated_amount` for both percentage and fixed_amount types
- [ ] `seedFromQuote()` — handles null `contract_value` gracefully (uses raw value + adds note)
- [ ] `seedFromQuote()` — returns silently if no draw schedule entries exist
- [ ] `seedFromQuote()` — uses `createMany()` for efficiency
- [ ] `findByProject()` — returns milestones ordered by `draw_number` with joined invoice data
- [ ] `create()` — validates draw_number uniqueness per project (409)
- [ ] `create()` — validates percentage ≤ 100 (400)
- [ ] `create()` — computes `calculated_amount` if not provided
- [ ] `update()` — blocks `calculated_amount` change on non-pending milestones (400)
- [ ] `delete()` — blocks deletion of non-pending milestones (400)
- [ ] `generateInvoice()` — creates invoice + updates milestone atomically in single transaction
- [ ] `generateInvoice()` — generates invoice number via InvoiceNumberGeneratorService within transaction
- [ ] `generateInvoice()` — blocks if milestone is not pending (400)
- [ ] All Prisma queries include `tenant_id` filter
- [ ] All write operations audit logged
- [ ] Decimal fields converted to Number in return values
- [ ] `npx tsc --noEmit` passes
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — DrawMilestoneService must compile and all methods must be defined before Sprint 8_4 begins. Verify:
1. `npx tsc --noEmit` passes
2. Service file exists with all 6 methods: `seedFromQuote`, `findByProject`, `create`, `update`, `delete`, `generateInvoice`

---

## Handoff Notes

**DrawMilestoneService is available for:**
- Sprint 8_5 (DrawMilestoneController) — controller will call these methods
- Sprint 8_7 (ProjectService integration) — `seedFromQuote()` will be called from `ProjectService.createFromQuote()`

**Method signatures summary:**
| Method | Signature |
|--------|-----------|
| `seedFromQuote` | `(tenantId, projectId, quoteId, userId, transaction?)` → `void` |
| `findByProject` | `(tenantId, projectId)` → milestone array |
| `create` | `(tenantId, projectId, userId, dto)` → milestone object |
| `update` | `(tenantId, projectId, milestoneId, userId, dto)` → milestone object |
| `delete` | `(tenantId, projectId, milestoneId, userId)` → `{ message }` |
| `generateInvoice` | `(tenantId, projectId, milestoneId, userId, dto)` → invoice object |

**Import path:** `import { DrawMilestoneService } from './draw-milestone.service';`
