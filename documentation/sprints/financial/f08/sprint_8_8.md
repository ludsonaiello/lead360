# Sprint 8_8 — F-07 Revenue Addendum: Project Financial Summary

**Module:** Financial
**File:** `./documentation/sprints/financial/f08/sprint_8_8.md`
**Type:** Backend — Service Enhancement
**Depends On:** Sprint 8_7 (all services registered, server compiles)
**Gate:** STOP — Revenue data appears in financial summary response, voided invoices excluded
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

Now that `project_invoice` and `project_invoice_payment` tables exist, add revenue-side data to the project financial summary. Create a `ProjectFinancialSummaryService` that combines the existing cost summary from `FinancialEntryService.getProjectCostSummary()` with new revenue aggregations from the invoice tables. Update the `ProjectFinancialSummaryController` to use this new service.

---

## Pre-Sprint Checklist

- [ ] Sprint 8_7 GATE passed: server compiles and starts with all endpoints
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/controllers/project-financial-summary.controller.ts` IN FULL — understand the current routing and service call
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — find `getProjectCostSummary()` method (approximately line 258), understand what it returns
- [ ] Read `/var/www/lead360.app/api/src/modules/projects/services/project.service.ts` — find `getFinancialSummary()` method (approximately line 635), understand what it returns (this is a DIFFERENT endpoint — do NOT modify it)

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

### Task 1 — Create `ProjectFinancialSummaryService`

**File:** `api/src/modules/financial/services/project-financial-summary.service.ts`

**Purpose:** Combines cost summary (from `FinancialEntryService`) with revenue summary (from invoice tables) into a unified project financial summary.

**Implementation:**

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { FinancialEntryService } from './financial-entry.service';

@Injectable()
export class ProjectFinancialSummaryService {
  private readonly logger = new Logger(ProjectFinancialSummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialEntryService: FinancialEntryService,
  ) {}

  /**
   * Get full project financial summary — costs + revenue.
   * Combines existing cost summary with new revenue aggregations from invoice tables.
   */
  async getFullSummary(tenantId: string, projectId: string) {
    // 1. Verify project exists
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true, contract_value: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 2. Fetch cost summary + revenue data in parallel
    const [costSummary, revenueData] = await Promise.all([
      this.financialEntryService.getProjectCostSummary(tenantId, projectId),
      this.getRevenueSummary(tenantId, projectId),
    ]);

    // 3. Calculate margin analysis
    const contractValue = project.contract_value != null ? Number(project.contract_value) : null;

    const grossMargin = contractValue !== null && revenueData.total_collected > 0
      ? Math.round((contractValue - revenueData.total_collected) * 100) / 100
      : null;

    const billingCoverage = contractValue !== null && contractValue > 0
      ? Math.round((revenueData.total_invoiced / contractValue) * 10000) / 100
      : null;

    // 4. Return combined summary
    return {
      ...costSummary,
      revenue: {
        total_invoiced: revenueData.total_invoiced,
        total_collected: revenueData.total_collected,
        outstanding: revenueData.outstanding,
        invoice_count: revenueData.invoice_count,
        paid_invoices: revenueData.paid_invoices,
        partial_invoices: revenueData.partial_invoices,
        draft_invoices: revenueData.draft_invoices,
      },
      margin_analysis: {
        gross_margin: grossMargin,
        billing_coverage: billingCoverage,
      },
    };
  }

  /**
   * Get revenue-side aggregations from project_invoice and project_invoice_payment tables.
   * Excludes voided invoices from all totals.
   */
  private async getRevenueSummary(tenantId: string, projectId: string) {
    // All queries filter out voided invoices
    const nonVoidedWhere = {
      tenant_id: tenantId,
      project_id: projectId,
      status: { not: 'voided' as const },
    };

    const [
      invoiceAggregation,
      invoiceCount,
      paidCount,
      partialCount,
      draftCount,
    ] = await Promise.all([
      // Sum of amounts and amount_paid for non-voided invoices
      this.prisma.project_invoice.aggregate({
        where: nonVoidedWhere,
        _sum: {
          amount: true,
          amount_paid: true,
        },
      }),
      // Total count of non-voided invoices
      this.prisma.project_invoice.count({
        where: nonVoidedWhere,
      }),
      // Count by status
      this.prisma.project_invoice.count({
        where: { ...nonVoidedWhere, status: 'paid' },
      }),
      this.prisma.project_invoice.count({
        where: { ...nonVoidedWhere, status: 'partial' },
      }),
      this.prisma.project_invoice.count({
        where: { ...nonVoidedWhere, status: 'draft' },
      }),
    ]);

    const totalInvoiced = invoiceAggregation._sum.amount != null
      ? Number(invoiceAggregation._sum.amount)
      : 0;
    const totalCollected = invoiceAggregation._sum.amount_paid != null
      ? Number(invoiceAggregation._sum.amount_paid)
      : 0;

    return {
      total_invoiced: Math.round(totalInvoiced * 100) / 100,
      total_collected: Math.round(totalCollected * 100) / 100,
      outstanding: Math.round((totalInvoiced - totalCollected) * 100) / 100,
      invoice_count: invoiceCount,
      paid_invoices: paidCount,
      partial_invoices: partialCount,
      draft_invoices: draftCount,
    };
  }
}
```

---

### Task 2 — Register `ProjectFinancialSummaryService` in `financial.module.ts`

**File:** `api/src/modules/financial/financial.module.ts`

**Step 1 — Add import:**
```typescript
import { ProjectFinancialSummaryService } from './services/project-financial-summary.service';
```
Place this after the Gate 4 imports added in Sprint 8_7.

**Step 2 — Add to `providers` array:**
```typescript
    ProjectFinancialSummaryService,
```
Add after the Gate 4 providers.

**Step 3 — Add to `exports` array:**
```typescript
    ProjectFinancialSummaryService,
```
Add after the Gate 4 exports.

---

### Task 3 — Update `ProjectFinancialSummaryController` to use new service

**File:** `api/src/modules/financial/controllers/project-financial-summary.controller.ts`

**Current implementation (DO NOT BREAK — understand first):**
```typescript
// Current: calls financialEntryService.getProjectCostSummary()
constructor(
    private readonly financialEntryService: FinancialEntryService,
) {}

@Get(':projectId/financial-summary')
async getProjectFinancialSummary(@Request() req, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.financialEntryService.getProjectCostSummary(req.user.tenant_id, projectId);
}
```

**Updated implementation:**

1. Add import for the new service:
   ```typescript
   import { ProjectFinancialSummaryService } from '../services/project-financial-summary.service';
   ```

2. Replace the constructor injection:
   ```typescript
   constructor(
     private readonly projectFinancialSummaryService: ProjectFinancialSummaryService,
   ) {}
   ```

3. Update the endpoint method to call the new service:
   ```typescript
   @Get(':projectId/financial-summary')
   @Roles('Owner', 'Admin', 'Manager')
   @ApiOperation({ summary: 'Get project financial summary with cost and revenue data' })
   @ApiParam({ name: 'projectId', description: 'Project UUID' })
   @ApiResponse({ status: 200, description: 'Project financial summary including costs, revenue, and margin analysis' })
   async getProjectFinancialSummary(
     @Request() req,
     @Param('projectId', ParseUUIDPipe) projectId: string,
   ) {
     return this.projectFinancialSummaryService.getFullSummary(
       req.user.tenant_id,
       projectId,
     );
   }
   ```

4. Remove the unused `FinancialEntryService` import from this controller (if no other methods use it).

**IMPORTANT:** The old `FinancialEntryService` import in the controller can be removed ONLY if the controller has no other methods that use it. Read the full controller file to confirm before removing.

---

### Task 4 — Verify the summary endpoint works

After starting the dev server:

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Find a project ID
curl -s http://localhost:8000/projects?limit=1 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20

# Test the financial summary (replace PROJECT_ID)
curl -s "http://localhost:8000/projects/{PROJECT_ID}/financial-summary" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

The response should now include:
- All existing cost summary fields (unchanged)
- A new `revenue` object with: `total_invoiced`, `total_collected`, `outstanding`, `invoice_count`, `paid_invoices`, `partial_invoices`, `draft_invoices`
- A new `margin_analysis` object with: `gross_margin`, `billing_coverage`

If no invoices exist yet, revenue values will all be 0 and margin analysis will be null — this is correct.

---

## Business Rules

- **Voided invoices excluded:** All revenue aggregations use `status: { not: 'voided' }` filter
- **`gross_margin`:** `contract_value - total_collected` — only computed when both exist
- **`billing_coverage`:** `(total_invoiced / contract_value) * 100` — percentage of contract that has been invoiced
- **Null contract_value:** If project has no contract_value, both margin_analysis fields are null

---

## Acceptance Criteria

- [ ] `project-financial-summary.service.ts` created at `api/src/modules/financial/services/`
- [ ] `getFullSummary()` combines cost summary + revenue summary
- [ ] Revenue aggregations exclude voided invoices
- [ ] Revenue block includes: total_invoiced, total_collected, outstanding, invoice_count, paid_invoices, partial_invoices, draft_invoices
- [ ] Margin analysis includes: gross_margin, billing_coverage
- [ ] `ProjectFinancialSummaryService` registered in `financial.module.ts` (providers + exports)
- [ ] `ProjectFinancialSummaryController` updated to use new service
- [ ] Existing cost summary data UNCHANGED in the response
- [ ] Summary endpoint returns 200 with complete data
- [ ] `npx tsc --noEmit` passes
- [ ] No existing tests broken
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The financial summary endpoint MUST return revenue data before Sprint 8_9 begins. Verify:
1. GET `/projects/:projectId/financial-summary` returns a `revenue` object
2. GET `/projects/:projectId/financial-summary` returns a `margin_analysis` object
3. Existing cost data is still present (not removed or broken)

---

## Handoff Notes

**Updated response shape for `GET /projects/:projectId/financial-summary`:**

```json
{
  // ... existing cost summary fields (unchanged) ...
  "revenue": {
    "total_invoiced": 0,
    "total_collected": 0,
    "outstanding": 0,
    "invoice_count": 0,
    "paid_invoices": 0,
    "partial_invoices": 0,
    "draft_invoices": 0
  },
  "margin_analysis": {
    "gross_margin": null,
    "billing_coverage": null
  }
}
```

**Files created:**
- `api/src/modules/financial/services/project-financial-summary.service.ts`

**Files modified:**
- `api/src/modules/financial/financial.module.ts` — added ProjectFinancialSummaryService to providers + exports
- `api/src/modules/financial/controllers/project-financial-summary.controller.ts` — switched to new service
