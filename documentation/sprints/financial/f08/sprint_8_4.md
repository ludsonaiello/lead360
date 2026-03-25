# Sprint 8_4 — Project Invoice Service

**Module:** Financial
**File:** `./documentation/sprints/financial/f08/sprint_8_4.md`
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

Create the `ProjectInvoiceService` — the service for managing project customer invoices. This handles manual invoice creation, querying, updating draft invoices, marking invoices as sent, voiding invoices (with milestone reset), recording payments (with atomic invoice state updates), and listing payments. The payment recording has a strict atomicity requirement: payment creation and invoice amount/status update must be in a single Prisma transaction.

---

## Pre-Sprint Checklist

- [ ] Sprint 8_1 GATE passed: schema migration clean
- [ ] Sprint 8_2 GATE passed: all DTOs and InvoiceNumberGeneratorService compile
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/subcontractor-invoice.service.ts` — understand existing invoice/payment patterns, status transitions, audit logging
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/invoice-number-generator.service.ts` — confirm it exists from Sprint 8_2
- [ ] Read all DTOs from Sprint 8_2: `CreateProjectInvoiceDto`, `UpdateProjectInvoiceDto`, `RecordInvoicePaymentDto`, `VoidInvoiceDto`, `ListProjectInvoicesDto`

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

### Task 1 — Create `ProjectInvoiceService`

**File:** `api/src/modules/financial/services/project-invoice.service.ts`

**Constructor:**
```typescript
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { InvoiceNumberGeneratorService } from './invoice-number-generator.service';
import { CreateProjectInvoiceDto } from '../dto/create-project-invoice.dto';
import { UpdateProjectInvoiceDto } from '../dto/update-project-invoice.dto';
import { RecordInvoicePaymentDto } from '../dto/record-invoice-payment.dto';
import { VoidInvoiceDto } from '../dto/void-invoice.dto';
import { ListProjectInvoicesDto } from '../dto/list-project-invoices.dto';

@Injectable()
export class ProjectInvoiceService {
  private readonly logger = new Logger(ProjectInvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly invoiceNumberGenerator: InvoiceNumberGeneratorService,
  ) {}
```

---

### Task 2 — Implement `create()` method

**Signature:** `async create(tenantId: string, projectId: string, userId: string, dto: CreateProjectInvoiceDto)`

**Purpose:** Manual invoice creation (not from a milestone).

**Business logic:**

1. Verify project exists:
   ```typescript
   const project = await this.prisma.project.findFirst({
     where: { id: projectId, tenant_id: tenantId },
     select: { id: true },
   });
   if (!project) throw new NotFoundException('Project not found');
   ```

2. Generate invoice number and create invoice in a transaction:
   ```typescript
   const invoice = await this.prisma.$transaction(async (tx) => {
     const invoiceNumber = await this.invoiceNumberGenerator.generate(tenantId, tx);

     const taxAmount = dto.tax_amount ?? null;
     const amountDue = taxAmount !== null
       ? Math.round((dto.amount + taxAmount) * 100) / 100
       : dto.amount;

     return tx.project_invoice.create({
       data: {
         tenant_id: tenantId,
         project_id: projectId,
         invoice_number: invoiceNumber,
         description: dto.description,
         amount: dto.amount,
         tax_amount: taxAmount,
         amount_paid: 0,
         amount_due: amountDue,
         status: 'draft',
         due_date: dto.due_date ? new Date(dto.due_date) : null,
         notes: dto.notes ?? null,
         created_by_user_id: userId,
       },
     });
   });
   ```

3. Audit log.

4. Return with Decimal conversions (Number() on all decimal fields).

**Response:** 201 Created — invoice object with `status = draft`.

---

### Task 3 — Implement `findByProject()` method

**Signature:** `async findByProject(tenantId: string, projectId: string, query: ListProjectInvoicesDto)`

**Business logic:**

1. Build where clause:
   ```typescript
   const where: any = {
     tenant_id: tenantId,
     project_id: projectId,
   };

   if (query.status) where.status = query.status;
   if (query.date_from || query.date_to) {
     where.created_at = {};
     if (query.date_from) where.created_at.gte = new Date(query.date_from);
     if (query.date_to) where.created_at.lte = new Date(query.date_to + 'T23:59:59.999Z');
   }
   ```

2. Paginate:
   ```typescript
   const page = Math.max(query.page || 1, 1);
   const limit = Math.min(Math.max(query.limit || 20, 1), 100);
   const skip = (page - 1) * limit;
   ```

3. Query with payment count:
   ```typescript
   const [invoices, total] = await Promise.all([
     this.prisma.project_invoice.findMany({
       where,
       include: {
         milestone: {
           select: { id: true, description: true, draw_number: true },
         },
         _count: {
           select: { payments: true },
         },
       },
       orderBy: { created_at: 'desc' },
       skip,
       take: limit,
     }),
     this.prisma.project_invoice.count({ where }),
   ]);
   ```

4. Map response:
   ```typescript
   const data = invoices.map((inv) => ({
     id: inv.id,
     invoice_number: inv.invoice_number,
     milestone_id: inv.milestone_id,
     milestone_description: inv.milestone?.description ?? null,
     description: inv.description,
     amount: Number(inv.amount),
     tax_amount: inv.tax_amount != null ? Number(inv.tax_amount) : null,
     amount_paid: Number(inv.amount_paid),
     amount_due: Number(inv.amount_due),
     status: inv.status,
     due_date: inv.due_date,
     sent_at: inv.sent_at,
     paid_at: inv.paid_at,
     voided_at: inv.voided_at,
     payment_count: inv._count.payments,
     created_at: inv.created_at,
   }));

   return {
     data,
     meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
   };
   ```

---

### Task 4 — Implement `findOne()` method

**Signature:** `async findOne(tenantId: string, projectId: string, invoiceId: string)`

**Business logic:**

1. Fetch invoice with milestone and payments:
   ```typescript
   const invoice = await this.prisma.project_invoice.findFirst({
     where: { id: invoiceId, project_id: projectId, tenant_id: tenantId },
     include: {
       milestone: {
         select: { id: true, description: true, draw_number: true, status: true },
       },
       payments: {
         orderBy: { payment_date: 'asc' },
       },
     },
   });
   if (!invoice) throw new NotFoundException('Invoice not found');
   ```

2. Return with all Decimal fields converted to Number, and payments also converted.

---

### Task 5 — Implement `update()` method

**Signature:** `async update(tenantId: string, projectId: string, invoiceId: string, userId: string, dto: UpdateProjectInvoiceDto)`

**Business logic:**

1. Fetch existing invoice.
2. Guard: Only `draft` invoices are editable:
   ```typescript
   if (existing.status !== 'draft') {
     throw new BadRequestException(`Cannot edit invoice in ${existing.status} status — only draft invoices are editable`);
   }
   ```
3. Build update data from provided fields:
   ```typescript
   const data: any = {};
   if (dto.description !== undefined) data.description = dto.description;
   if (dto.amount !== undefined) data.amount = dto.amount;
   if (dto.tax_amount !== undefined) data.tax_amount = dto.tax_amount;
   if (dto.due_date !== undefined) data.due_date = dto.due_date ? new Date(dto.due_date) : null;
   if (dto.notes !== undefined) data.notes = dto.notes;
   ```
4. If `amount` or `tax_amount` changed, recompute `amount_due`:
   ```typescript
   if (dto.amount !== undefined || dto.tax_amount !== undefined) {
     const newAmount = dto.amount ?? Number(existing.amount);
     const newTaxAmount = dto.tax_amount !== undefined ? dto.tax_amount : (existing.tax_amount != null ? Number(existing.tax_amount) : null);
     const currentAmountPaid = Number(existing.amount_paid);
     data.amount_due = newTaxAmount !== null
       ? Math.round((newAmount + newTaxAmount - currentAmountPaid) * 100) / 100
       : Math.round((newAmount - currentAmountPaid) * 100) / 100;
   }
   ```
5. Update invoice, set `updated_by_user_id = userId`:
   ```typescript
   data.updated_by_user_id = userId;

   const updated = await this.prisma.project_invoice.update({
     where: { id: invoiceId },
     data,
   });
   ```
6. Audit log with before/after.
7. Return with Decimal conversions.

---

### Task 6 — Implement `markSent()` method

**Signature:** `async markSent(tenantId: string, projectId: string, invoiceId: string, userId: string)`

**Business logic:**

1. Fetch existing invoice.
2. Guard: Must be `draft`:
   ```typescript
   if (existing.status !== 'draft') {
     throw new BadRequestException(`Cannot mark invoice as sent — current status is ${existing.status}. Only draft invoices can be sent.`);
   }
   ```
3. Update:
   ```typescript
   const updated = await this.prisma.project_invoice.update({
     where: { id: invoiceId },
     data: {
       status: 'sent',
       sent_at: new Date(),
       updated_by_user_id: userId,
     },
   });
   ```
4. Audit log.
5. Return with Decimal conversions.

---

### Task 7 — Implement `void()` method

**Signature:** `async voidInvoice(tenantId: string, projectId: string, invoiceId: string, userId: string, dto: VoidInvoiceDto)`

**CRITICAL:** If the invoice is linked to a milestone, the milestone must be RESET to `pending` to allow re-invoicing.

**Business logic:**

1. Fetch existing invoice.
2. Guard: Cannot void an already voided invoice:
   ```typescript
   if (existing.status === 'voided') {
     throw new BadRequestException('Invoice is already voided');
   }
   ```
3. Execute in a single Prisma transaction:
   ```typescript
   const result = await this.prisma.$transaction(async (tx) => {
     // a. Void the invoice
     const voidedInvoice = await tx.project_invoice.update({
       where: { id: invoiceId },
       data: {
         status: 'voided',
         voided_at: new Date(),
         voided_reason: dto.voided_reason,
         updated_by_user_id: userId,
       },
     });

     // b. If linked to a milestone, reset milestone to pending
     if (existing.milestone_id) {
       await tx.project_draw_milestone.update({
         where: { id: existing.milestone_id },
         data: {
           status: 'pending',
           invoice_id: null,
           invoiced_at: null,
         },
       });
     }

     return voidedInvoice;
   });
   ```
4. Audit log with metadata including `milestone_reset: !!existing.milestone_id`.
5. Return with Decimal conversions.

**NOTE:** Payments already recorded against this invoice are NOT reversed. They remain in the system.

---

### Task 8 — Implement `recordPayment()` method

**Signature:** `async recordPayment(tenantId: string, projectId: string, invoiceId: string, userId: string, dto: RecordInvoicePaymentDto)`

**CRITICAL ATOMICITY:** Payment record creation and invoice `amount_paid`/`amount_due`/`status` update MUST be in a single Prisma transaction. If either fails, both roll back.

**Business logic:**

1. Fetch existing invoice (outside transaction for initial validation):
   ```typescript
   const invoice = await this.prisma.project_invoice.findFirst({
     where: { id: invoiceId, project_id: projectId, tenant_id: tenantId },
   });
   if (!invoice) throw new NotFoundException('Invoice not found');
   ```

2. Guard: Cannot pay a voided invoice:
   ```typescript
   if (invoice.status === 'voided') {
     throw new BadRequestException('Cannot record payment on a voided invoice');
   }
   ```

3. Guard: Payment amount cannot exceed amount_due:
   ```typescript
   const currentAmountDue = Number(invoice.amount_due);
   if (dto.amount > currentAmountDue) {
     throw new BadRequestException(
       `Payment amount ($${dto.amount}) exceeds amount due ($${currentAmountDue.toFixed(2)})`,
     );
   }
   ```

4. Execute in a single Prisma transaction:
   ```typescript
   const payment = await this.prisma.$transaction(async (tx) => {
     // a. Create payment record
     const newPayment = await tx.project_invoice_payment.create({
       data: {
         tenant_id: tenantId,
         invoice_id: invoiceId,
         project_id: projectId,
         amount: dto.amount,
         payment_date: new Date(dto.payment_date),
         payment_method: dto.payment_method,
         payment_method_registry_id: dto.payment_method_registry_id ?? null,
         reference_number: dto.reference_number ?? null,
         notes: dto.notes ?? null,
         created_by_user_id: userId,
       },
     });

     // b. Recompute invoice amounts
     const newAmountPaid = Math.round((Number(invoice.amount_paid) + dto.amount) * 100) / 100;
     const invoiceAmount = Number(invoice.amount);
     const taxAmount = invoice.tax_amount != null ? Number(invoice.tax_amount) : 0;
     const newAmountDue = Math.round((invoiceAmount + taxAmount - newAmountPaid) * 100) / 100;

     // c. Determine new status
     let newStatus = invoice.status;
     let paidAt = invoice.paid_at;

     if (newAmountDue <= 0) {
       newStatus = 'paid';
       paidAt = new Date();
     } else if (newAmountPaid > 0) {
       newStatus = 'partial';
     }

     // d. Update invoice
     await tx.project_invoice.update({
       where: { id: invoiceId },
       data: {
         amount_paid: newAmountPaid,
         amount_due: newAmountDue,
         status: newStatus,
         paid_at: paidAt,
         updated_by_user_id: userId,
       },
     });

     // e. If invoice is now fully paid AND linked to a milestone, update milestone
     if (newStatus === 'paid' && invoice.milestone_id) {
       await tx.project_draw_milestone.update({
         where: { id: invoice.milestone_id },
         data: {
           status: 'paid',
           paid_at: new Date(),
         },
       });
     }

     return newPayment;
   });
   ```

5. Audit log:
   ```typescript
   await this.auditLogger.logTenantChange({
     action: 'created',
     entityType: 'project_invoice_payment',
     entityId: payment.id,
     tenantId,
     actorUserId: userId,
     after: payment,
     metadata: { invoice_id: invoiceId, invoice_number: invoice.invoice_number },
     description: `Recorded $${dto.amount.toFixed(2)} payment (${dto.payment_method}) on invoice ${invoice.invoice_number}`,
   });
   ```

6. Return payment with Decimal conversions.

---

### Task 9 — Implement `getPayments()` method

**Signature:** `async getPayments(tenantId: string, projectId: string, invoiceId: string)`

**Business logic:**

1. Verify invoice exists:
   ```typescript
   const invoice = await this.prisma.project_invoice.findFirst({
     where: { id: invoiceId, project_id: projectId, tenant_id: tenantId },
     select: { id: true },
   });
   if (!invoice) throw new NotFoundException('Invoice not found');
   ```

2. Fetch payments ordered by `payment_date ASC`:
   ```typescript
   const payments = await this.prisma.project_invoice_payment.findMany({
     where: { invoice_id: invoiceId, tenant_id: tenantId },
     orderBy: { payment_date: 'asc' },
   });
   ```

3. Return with Decimal conversions:
   ```typescript
   return payments.map((p) => ({
     ...p,
     amount: Number(p.amount),
   }));
   ```

---

## Business Rules Enforced in This Service

| Rule | Method | Enforcement |
|------|--------|-------------|
| BR-05: Payments immutable once created | — | No update/delete methods exist |
| BR-06: Payment ≤ amount_due | `recordPayment()` | Validation → 400 |
| BR-07: Full payment → invoice `paid` + milestone `paid` | `recordPayment()` | Status transition in transaction |
| BR-08: Partial payment → invoice `partial` | `recordPayment()` | Status transition in transaction |
| BR-09: Only `draft` invoices editable | `update()` | Status check → 400 |
| BR-04: Void resets linked milestone to `pending` | `voidInvoice()` | Milestone update in transaction |
| BR-11: Cannot void already voided | `voidInvoice()` | Status check → 400 |
| BR-12: Cannot pay voided invoice | `recordPayment()` | Status check → 400 |
| BR-08: Invoice numbers sequential per tenant | `create()` | Via InvoiceNumberGeneratorService |

---

## Integration Points

| Dependency | Import Path | Used By |
|-----------|------------|---------|
| `PrismaService` | `../../../core/database/prisma.service` | All methods |
| `AuditLoggerService` | `../../audit/services/audit-logger.service` | All write methods |
| `InvoiceNumberGeneratorService` | `./invoice-number-generator.service` | `create()` |

---

## Acceptance Criteria

- [ ] `project-invoice.service.ts` created at `api/src/modules/financial/services/project-invoice.service.ts`
- [ ] `create()` — generates invoice number, creates draft invoice, returns 201
- [ ] `findByProject()` — paginated list with status/date filters, includes payment_count and milestone_description
- [ ] `findOne()` — single invoice with payments and milestone details
- [ ] `update()` — only draft invoices editable, recomputes amount_due on amount/tax changes
- [ ] `markSent()` — draft → sent transition, sets sent_at
- [ ] `voidInvoice()` — sets voided status, resets linked milestone to pending (CRITICAL)
- [ ] `recordPayment()` — atomic: payment + invoice update + milestone update in single transaction
- [ ] `recordPayment()` — validates amount ≤ amount_due (400 on overpayment)
- [ ] `recordPayment()` — validates invoice not voided (400)
- [ ] `recordPayment()` — full payment transitions invoice to `paid` and milestone to `paid`
- [ ] `recordPayment()` — partial payment transitions invoice to `partial`
- [ ] `getPayments()` — returns payments ordered by payment_date ASC
- [ ] All Prisma queries include `tenant_id` filter
- [ ] All write operations audit logged
- [ ] Decimal fields converted to Number in return values
- [ ] `npx tsc --noEmit` passes
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — ProjectInvoiceService must compile and all methods must be defined before Sprint 8_6 begins. Verify:
1. `npx tsc --noEmit` passes
2. Service file exists with all 8 methods: `create`, `findByProject`, `findOne`, `update`, `markSent`, `voidInvoice`, `recordPayment`, `getPayments`

---

## Handoff Notes

**ProjectInvoiceService is available for:**
- Sprint 8_6 (ProjectInvoiceController) — controller will call these methods

**Method signatures summary:**
| Method | Signature |
|--------|-----------|
| `create` | `(tenantId, projectId, userId, dto: CreateProjectInvoiceDto)` → invoice object |
| `findByProject` | `(tenantId, projectId, query: ListProjectInvoicesDto)` → `{ data, meta }` |
| `findOne` | `(tenantId, projectId, invoiceId)` → invoice with payments |
| `update` | `(tenantId, projectId, invoiceId, userId, dto: UpdateProjectInvoiceDto)` → invoice |
| `markSent` | `(tenantId, projectId, invoiceId, userId)` → invoice |
| `voidInvoice` | `(tenantId, projectId, invoiceId, userId, dto: VoidInvoiceDto)` → invoice |
| `recordPayment` | `(tenantId, projectId, invoiceId, userId, dto: RecordInvoicePaymentDto)` → payment |
| `getPayments` | `(tenantId, projectId, invoiceId)` → payment array |

**Import path:** `import { ProjectInvoiceService } from './project-invoice.service';`
