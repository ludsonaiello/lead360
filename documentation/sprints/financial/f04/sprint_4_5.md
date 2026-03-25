# Sprint 4_5 — Service Layer Part 3: Approve + Reject + Resubmit + CSV Export

**Module:** Financial
**File:** ./documentation/sprints/financial/f04/sprint_4_5.md
**Type:** Backend — Service Layer
**Depends On:** Sprint 4_4 (CRUD methods complete with role logic)
**Gate:** STOP — All workflow methods and export written with correct syntax. Do NOT start dev server (expected break until Sprint 4_6)
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

Add the four remaining service methods to `FinancialEntryService`:
1. `approveEntry()` — mark a pending entry as confirmed
2. `rejectEntry()` — attach rejection reason to a pending entry
3. `resubmitEntry()` — clear rejection and optionally update fields
4. `exportEntries()` — generate CSV from filtered entries

---

## Pre-Sprint Checklist

- [ ] Read the current `financial-entry.service.ts` in full (including Sprint 4_3 and 4_4 additions)
- [ ] Verify all helper methods from previous sprints exist: `getEnrichedInclude()`, `transformToEnrichedResponse()`, `isPrivilegedRole()`, `getHighestRole()`
- [ ] Read the DTOs: `ApproveEntryDto`, `RejectEntryDto`, `ResubmitEntryDto`
- [ ] Read the Prisma schema for `financial_entry` — confirm `rejection_reason`, `rejected_by_user_id`, `rejected_at` fields exist

---

## Dev Server

> ⚠️ **DO NOT start the dev server in this sprint.** This is the last service sprint before the controller rebuild. The dev server will not compile until Sprint 4_6. If port 8000 is in use from a previous sprint, kill it:
>
> ```
> lsof -i :8000
> kill {PID}
> ```

---

## Tasks

### Task 1 — Implement `approveEntry()`

**Signature:**
```typescript
async approveEntry(
  tenantId: string,
  entryId: string,
  approverId: string,
  dto: ApproveEntryDto,
)
```

**Import:**
```typescript
import { ApproveEntryDto } from '../dto/approve-entry.dto';
```

**Step-by-step logic:**

```
1. Fetch entry using fetchEntryOrFail(tenantId, entryId) → 404 if not found

2. Verify submission_status === 'pending_review'
   - If not → throw BadRequestException('Entry is not in pending_review status. Only pending entries can be approved.')

3. Update the entry:
   data: {
     submission_status: 'confirmed',
     updated_by_user_id: approverId,
   }
   include: getEnrichedInclude()

4. Audit log:
   action: 'updated'
   entityType: 'financial_entry'
   entityId: entryId
   tenantId: tenantId
   actorUserId: approverId
   before: existing entry
   after: updated entry
   metadata: { workflow_action: 'EXPENSE_APPROVED', approval_notes: dto.notes }
   description: `Approved financial entry ${entryId}`

5. Return transformToEnrichedResponse(updated)
```

**Key rule:** Approval does NOT clear rejection fields. If an entry was rejected then resubmitted and then approved, the rejection history remains on the record. This is intentional — it preserves the audit trail.

---

### Task 2 — Implement `rejectEntry()`

**Signature:**
```typescript
async rejectEntry(
  tenantId: string,
  entryId: string,
  rejectorId: string,
  dto: RejectEntryDto,
)
```

**Import:**
```typescript
import { RejectEntryDto } from '../dto/reject-entry.dto';
```

**Step-by-step logic:**

```
1. Fetch entry using fetchEntryOrFail(tenantId, entryId) → 404 if not found

2. Verify submission_status === 'pending_review'
   - If not → throw BadRequestException('Entry is not in pending_review status. Only pending entries can be rejected.')

3. Verify dto.rejection_reason is not empty
   - If empty → throw BadRequestException('Rejection reason is required')
   (Note: class-validator @IsNotEmpty handles this, but double-check in service for safety)

4. Update the entry:
   data: {
     rejection_reason: dto.rejection_reason,
     rejected_by_user_id: rejectorId,
     rejected_at: new Date(),
     // submission_status STAYS as 'pending_review' — rejection is NOT a status change
     // The entry remains visible in the pending list with a rejection reason attached
   }
   include: getEnrichedInclude()

5. Audit log:
   action: 'updated'
   entityType: 'financial_entry'
   entityId: entryId
   tenantId: tenantId
   actorUserId: rejectorId
   before: existing entry
   after: updated entry
   metadata: { workflow_action: 'EXPENSE_REJECTED', rejection_reason: dto.rejection_reason }
   description: `Rejected financial entry ${entryId}: ${dto.rejection_reason}`

6. Return transformToEnrichedResponse(updated)
```

**CRITICAL:** Rejection does NOT change `submission_status`. It stays `pending_review`. The entry is still in the pending list, but now has a `rejection_reason` and `rejected_at` timestamp. The Employee sees the reason and can correct the entry.

---

### Task 3 — Implement `resubmitEntry()`

**Signature:**
```typescript
async resubmitEntry(
  tenantId: string,
  entryId: string,
  userId: string,
  userRoles: string[],
  dto: ResubmitEntryDto,
)
```

**Import:**
```typescript
import { ResubmitEntryDto } from '../dto/resubmit-entry.dto';
```

**Step-by-step logic:**

```
1. Fetch entry using fetchEntryOrFail(tenantId, entryId) → 404 if not found

2. If Employee (!isPrivilegedRole(userRoles)):
   - Verify entry.created_by_user_id === userId
   - If not → throw ForbiddenException('Access denied. You can only resubmit your own entries.')

3. Verify entry.rejected_at is NOT null
   - If rejected_at is null → throw BadRequestException('Only rejected entries can be resubmitted. This entry has not been rejected.')

4. Build update data:
   Start with rejection clearing fields:
   {
     rejection_reason: null,
     rejected_by_user_id: null,
     rejected_at: null,
     // submission_status stays 'pending_review'
   }

   Then apply any field updates from the dto (same logic as updateEntry):
   - If dto.category_id → validate it belongs to tenant
   - If dto.supplier_id → validate it belongs to tenant and is active
   - If dto.payment_method_registry_id → validate and auto-copy type
   - Validate purchased_by mutual exclusion on RESULTING state (merge dto with existing)
   - Validate tax vs amount on RESULTING state (not just dto):
     const resultingAmount = dto.amount !== undefined ? dto.amount : Number(existing.amount);
     const resultingTax = dto.tax_amount !== undefined ? dto.tax_amount : (existing.tax_amount ? Number(existing.tax_amount) : null);
     if (resultingTax !== null && resultingTax >= resultingAmount) throw 400
   - Apply all provided fields to the update data

5. Execute Prisma update with enriched include

6. Handle supplier spend change (if supplier_id changed):
   - Same logic as updateEntry in Sprint 4_4

7. Audit log:
   action: 'updated'
   entityType: 'financial_entry'
   entityId: entryId
   tenantId: tenantId
   actorUserId: userId
   before: existing entry
   after: updated entry
   metadata: { workflow_action: 'EXPENSE_RESUBMITTED' }
   description: `Resubmitted financial entry ${entryId}`

8. Return transformToEnrichedResponse(updated)
```

**Key rule:** Only entries with `rejected_at` populated can be resubmitted. An entry that is simply `pending_review` without a rejection cannot be "resubmitted" — it was never rejected.

---

### Task 4 — Implement `exportEntries()`

**Signature:**
```typescript
async exportEntries(
  tenantId: string,
  userId: string,
  userRoles: string[],
  query: ListFinancialEntriesQueryDto,
): Promise<string>
```

**Import:**
```typescript
import { ListFinancialEntriesQueryDto } from '../dto/list-financial-entries-query.dto';
```

**Step-by-step logic:**

```
1. Build where clause — SAME logic as getEntries() (reuse the filter building)
   - Include Employee scoping if applicable (though Employee can't access export endpoint — enforced at controller level)

2. Count total matching entries:
   const count = await this.prisma.financial_entry.count({ where });

3. If count > 10000:
   throw new BadRequestException('Export limit exceeded. Apply date filters to narrow the result set.');

4. Fetch entries with SELECT (not full include — use select for efficiency):
   Use Prisma select to fetch only the fields needed for CSV columns:

   const entries = await this.prisma.financial_entry.findMany({
     where,
     select: {
       entry_date: true,
       entry_time: true,
       entry_type: true,
       amount: true,
       tax_amount: true,
       vendor_name: true,
       payment_method: true,
       submission_status: true,
       notes: true,
       created_at: true,
       has_receipt: true,
       category: { select: { name: true, type: true, classification: true } },
       project: { select: { name: true } },
       task: { select: { title: true } },
       supplier: { select: { name: true } },
       payment_method_registry_rel: { select: { nickname: true } },  // CHECK relation name
       purchased_by_user: { select: { first_name: true, last_name: true } },  // CHECK relation name
       purchased_by_crew_member: { select: { first_name: true, last_name: true } },  // CHECK relation name
       created_by: { select: { first_name: true, last_name: true } },
     },
     orderBy: { entry_date: 'desc' },
   });

5. Build CSV string:

   CSV Header:
   Date,Time,Type,Category,Classification,Project,Task,Supplier,Vendor Name,Amount,Tax Amount,Payment Method,Payment Account,Purchased By,Submitted By,Status,Notes,Created At

   For each entry, build a CSV row:
   - Date: format entry_date as YYYY-MM-DD
   - Time: entry_time or empty
   - Type: entry_type
   - Category: category.name
   - Classification: category.classification or empty
   - Project: project?.name or empty
   - Task: task?.title or empty
   - Supplier: supplier?.name or empty
   - Vendor Name: vendor_name or empty
   - Amount: amount (as number)
   - Tax Amount: tax_amount or empty
   - Payment Method: payment_method or empty
   - Payment Account: payment_method_registry_rel?.nickname or empty  // CHECK relation name
   - Purchased By: purchased_by_user name or purchased_by_crew_member name or empty
   - Submitted By: created_by first_name + last_name
   - Status: submission_status
   - Notes: notes or empty (ESCAPE commas and quotes in notes!)
   - Created At: created_at ISO string

6. Return the CSV string (the controller will set Content-Type and Content-Disposition headers)
```

**CSV escaping rules:**
- Wrap fields containing commas, quotes, or newlines in double quotes
- Escape double quotes by doubling them: `"` → `""`
- Helper function:

```typescript
private escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

**IMPORTANT:** Check the actual relation names in the Prisma schema for the `select` clause. The names above are educated guesses.

---

### Task 5 — Extract Shared Filter Builder (Optional Refactor)

**What:** If the `where` clause building logic is identical between `getEntries()` and `exportEntries()`, extract it into a shared private method to avoid duplication:

```typescript
private buildEntryWhereClause(
  tenantId: string,
  userId: string,
  userRoles: string[],
  query: ListFinancialEntriesQueryDto,
): any {
  // ... all filter logic from getEntries()
}
```

**Why:** DRY principle. The export uses the exact same filters as the list endpoint.

**Do NOT:** Over-engineer this. If the duplication is minimal, skip this refactor.

---

### Task 6 — Verify File Syntax

**What:** Verify the service file is syntactically valid TypeScript. Check that all new methods have consistent types and all imports resolve.

> ⚠️ **DO NOT start the dev server in this sprint.** The old controller still references old method signatures. Full compilation check happens in Sprint 4_6 after the controller is rebuilt.

**Acceptance:** The `financial-entry.service.ts` file has no syntax errors within itself. All workflow methods use `fetchEntryOrFail()` for entry retrieval.

---

## Business Rules Enforced in This Sprint

- **BR-17:** Only `pending_review` entries can be approved — confirmed entries throw 400.
- **BR-18:** Only `pending_review` entries can be rejected — confirmed entries throw 400.
- **BR-19:** Rejected entries are NOT deleted — they remain `pending_review` with rejection fields populated.
- **BR-20:** Only entries with `rejected_at` populated can be resubmitted.
- **BR-21:** Resubmission clears `rejection_reason`, `rejected_by_user_id`, `rejected_at`.
- **BR-22:** Resubmission keeps `submission_status = pending_review`.
- **BR-23:** Approval does NOT clear rejection fields — history is preserved.
- **BR-24:** CSV export limited to 10,000 rows — exceeding this returns 400.
- **BR-25:** CSV export does NOT paginate — exports all matching records up to the limit.

---

## Acceptance Criteria

- [ ] `approveEntry()` sets `submission_status` to `confirmed`
- [ ] `approveEntry()` throws 400 if entry is not `pending_review`
- [ ] `approveEntry()` audit logs with `EXPENSE_APPROVED` action
- [ ] `rejectEntry()` sets `rejection_reason`, `rejected_by_user_id`, `rejected_at`
- [ ] `rejectEntry()` does NOT change `submission_status` (stays `pending_review`)
- [ ] `rejectEntry()` throws 400 if entry is not `pending_review`
- [ ] `rejectEntry()` audit logs with `EXPENSE_REJECTED` action
- [ ] `resubmitEntry()` clears all three rejection fields
- [ ] `resubmitEntry()` applies optional field updates from dto
- [ ] `resubmitEntry()` throws 400 if entry was not rejected
- [ ] `resubmitEntry()` enforces Employee ownership check
- [ ] `resubmitEntry()` audit logs with `EXPENSE_RESUBMITTED` action
- [ ] `exportEntries()` returns CSV string with correct headers
- [ ] `exportEntries()` throws 400 if result set exceeds 10,000 rows
- [ ] `exportEntries()` properly escapes commas and quotes in CSV fields
- [ ] All enriched response shapes include rejection fields
- [ ] All workflow methods use `fetchEntryOrFail()` for entry retrieval
- [ ] Service file is syntactically valid TypeScript (no errors within the file itself)
- [ ] Dev server NOT started (expected compilation break — controller uses old signatures until Sprint 4_6)

---

## Gate Marker

**STOP** — All service methods must be syntactically valid within the file. The `FinancialEntryService` is now feature-complete. **Do NOT start the dev server** — the controller is rebuilt in Sprint 4_6 where the first full compilation check happens.

---

## Handoff Notes

After this sprint, `FinancialEntryService` has ALL methods specified in the F-04 contract:

| Method | Signature | Status |
|--------|-----------|--------|
| `createEntry` | `(tenantId, userId, userRoles, dto)` | Complete |
| `getEntries` | `(tenantId, userId, userRoles, query)` | Complete |
| `getEntryById` | `(tenantId, entryId, userId, userRoles)` | Complete |
| `updateEntry` | `(tenantId, entryId, userId, userRoles, dto)` | Complete |
| `deleteEntry` | `(tenantId, entryId, userId, userRoles)` | Complete |
| `getPendingEntries` | `(tenantId, query)` | Complete |
| `approveEntry` | `(tenantId, entryId, approverId, dto)` | Complete |
| `rejectEntry` | `(tenantId, entryId, rejectorId, dto)` | Complete |
| `resubmitEntry` | `(tenantId, entryId, userId, userRoles, dto)` | Complete |
| `exportEntries` | `(tenantId, userId, userRoles, query)` | Complete |
| `getProjectEntries` | `(tenantId, query)` | Unchanged from pre-F-04 |
| `getTaskEntries` | `(tenantId, taskId)` | Unchanged |
| `getProjectCostSummary` | `(tenantId, projectId)` | Unchanged |
| `getTaskCostSummary` | `(tenantId, taskId)` | Unchanged |

Sprint 4_6 will wire these methods to controller routes.
