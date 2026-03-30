# Sprint 1c — Financial API Client Functions (All 109 Endpoints)
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_1c.md
**Type:** Frontend — Foundation (API Client)
**Depends On:** Sprint 1a, Sprint 1b
**Gate:** STOP — All 109 API functions must compile before any UI sprint starts
**Estimated Complexity:** High (large but mechanical)

---

## Objective

Rewrite the financial API client to cover ALL 109 endpoints. Every function must be typed, use the `apiClient` from `./axios`, and import types from `@/lib/types/financial`.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation at `/var/www/lead360.app/api/documentation/financial_REST_API.md`.
- **Follow the exact same patterns** already used in the codebase. Read existing files first.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Pre-Sprint Checklist
- [ ] Sprint 1a + 1b COMPLETE — ALL types exist and compile
- [ ] Read `/var/www/lead360.app/app/src/lib/api/financial.ts` — existing API client (will be replaced)
- [ ] Read `/var/www/lead360.app/app/src/lib/api/axios.ts` — axios setup and interceptors
- [ ] Read `/var/www/lead360.app/app/src/lib/api/projects.ts` — API client patterns to follow

---

## Dev Server (Backend — Read Only)

```
Ensure backend running on port 8000.

TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Quick sanity check — hit a few endpoints to verify they work:
curl -s "http://localhost:8000/api/v1/financial/entries?limit=1" -H "Authorization: Bearer $TOKEN" | jq '.meta'
curl -s "http://localhost:8000/api/v1/financial/dashboard/overview" -H "Authorization: Bearer $TOKEN" | jq '.generated_at'
```

---

## Tasks

### Task 1 — Rewrite Financial API Client

**File:** `/var/www/lead360.app/app/src/lib/api/financial.ts`

Replace the ENTIRE file. Import `apiClient` from `./axios` and ALL needed types from `@/lib/types/financial`.

Organize by section with clear `// ========== SECTION NAME ==========` comments.

**Pattern to follow (from existing codebase):**
```typescript
import { apiClient } from './axios';
import type { ... } from '@/lib/types/financial';

export const getFinancialCategories = async (): Promise<FinancialCategory[]> => {
  const { data } = await apiClient.get<FinancialCategory[]>('/settings/financial-categories');
  return data;
};
```

**For query parameters, use this pattern:**
```typescript
export const getFinancialEntries = async (params: ListFinancialEntriesParams): Promise<FinancialEntryListResponse> => {
  const queryParams: Record<string, string | number | boolean> = {};
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;
  if (params.project_id) queryParams.project_id = params.project_id;
  // ... all other optional params ...
  if (params.search) queryParams.search = params.search;
  if (params.sort_by) queryParams.sort_by = params.sort_by;
  if (params.sort_order) queryParams.sort_order = params.sort_order;

  const { data } = await apiClient.get<FinancialEntryListResponse>('/financial/entries', { params: queryParams });
  return data;
};
```

**For CSV/Blob downloads:**
```typescript
export const exportEntries = async (params: ListFinancialEntriesParams): Promise<Blob> => {
  const queryParams: Record<string, string | number | boolean> = {};
  // ... build query params same as list ...
  const { data } = await apiClient.get('/financial/entries/export', {
    params: queryParams,
    responseType: 'blob',
  });
  return data;
};
```

**For FormData uploads:**
```typescript
export const uploadReceipt = async (formData: FormData): Promise<Receipt> => {
  const { data } = await apiClient.post<Receipt>('/financial/receipts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
```

---

### Task 2 — Complete Function List (109 endpoints)

Write ALL of these functions. Every function MUST have explicit return type.

```
// ========== FINANCIAL CATEGORIES (4 endpoints) ==========
// API paths: /settings/financial-categories
getFinancialCategories() → FinancialCategory[]
createFinancialCategory(dto: CreateCategoryDto) → FinancialCategory
updateFinancialCategory(id: string, dto: UpdateCategoryDto) → FinancialCategory
deleteFinancialCategory(id: string) → FinancialCategory

// ========== FINANCIAL ENTRIES (10 endpoints) ==========
// API paths: /financial/entries, /financial/entries/pending, /financial/entries/export, /financial/entries/:id/*
getFinancialEntries(params: ListFinancialEntriesParams) → FinancialEntryListResponse
getFinancialEntry(id: string) → FinancialEntry
createFinancialEntry(dto: CreateFinancialEntryDto) → FinancialEntry
updateFinancialEntry(id: string, dto: UpdateFinancialEntryDto) → FinancialEntry
deleteFinancialEntry(id: string) → { message: string }
getPendingEntries(params: ListPendingEntriesParams) → FinancialEntryListResponse
approveEntry(id: string, dto?: ApproveEntryDto) → FinancialEntry
rejectEntry(id: string, dto: RejectEntryDto) → FinancialEntry
resubmitEntry(id: string, dto?: ResubmitEntryDto) → FinancialEntry
exportEntries(params: ListFinancialEntriesParams) → Blob

// ========== RECEIPTS & OCR (8 endpoints) ==========
// API paths: /financial/receipts, /financial/receipts/:id/*
uploadReceipt(formData: FormData) → Receipt
getReceipts(params: ListReceiptsParams) → PaginatedResponse<Receipt>
getReceipt(id: string) → Receipt
getOcrStatus(id: string) → OcrStatusResponse
createEntryFromReceipt(receiptId: string, dto: CreateEntryFromReceiptDto) → CreateEntryFromReceiptResponse
retryOcr(id: string) → Receipt
linkReceiptToEntry(receiptId: string, dto: LinkReceiptDto) → Receipt
updateReceipt(id: string, dto: UpdateReceiptDto) → Receipt

// ========== PAYMENT METHODS (6 endpoints) ==========
// API paths: /financial/payment-methods, /financial/payment-methods/:id/*
getPaymentMethods(params?: ListPaymentMethodsParams) → PaymentMethodRegistry[]
createPaymentMethod(dto: CreatePaymentMethodDto) → PaymentMethodRegistry
getPaymentMethod(id: string) → PaymentMethodRegistry
updatePaymentMethod(id: string, dto: UpdatePaymentMethodDto) → PaymentMethodRegistry
deletePaymentMethod(id: string) → PaymentMethodRegistry
setDefaultPaymentMethod(id: string) → PaymentMethodRegistry

// ========== SUPPLIER CATEGORIES (4 endpoints) ==========
// API paths: /financial/supplier-categories, /financial/supplier-categories/:id
getSupplierCategories(params?: { is_active?: boolean }) → SupplierCategory[]
createSupplierCategory(dto: CreateSupplierCategoryDto) → SupplierCategory
updateSupplierCategory(id: string, dto: UpdateSupplierCategoryDto) → SupplierCategory
deleteSupplierCategory(id: string) → void

// ========== SUPPLIERS (7 endpoints) ==========
// API paths: /financial/suppliers, /financial/suppliers/:id, /financial/suppliers/map, /financial/suppliers/:id/statistics
getSuppliers(params: ListSuppliersParams) → PaginatedResponse<SupplierListItem>
createSupplier(dto: CreateSupplierDto) → Supplier
getSupplierMap() → SupplierMapItem[]            // MUST be registered before /:id routes to avoid route shadowing
getSupplier(id: string) → Supplier
updateSupplier(id: string, dto: UpdateSupplierDto) → Supplier
deleteSupplier(id: string) → void
getSupplierStatistics(id: string) → SupplierStatistics

// ========== SUPPLIER PRODUCTS (5 endpoints) ==========
// API paths: /financial/suppliers/:supplierId/products, /financial/suppliers/:supplierId/products/:productId/*
getSupplierProducts(supplierId: string, params?: { is_active?: boolean }) → SupplierProduct[]
createSupplierProduct(supplierId: string, dto: CreateSupplierProductDto) → SupplierProduct
updateSupplierProduct(supplierId: string, productId: string, dto: UpdateSupplierProductDto) → SupplierProduct
deleteSupplierProduct(supplierId: string, productId: string) → void   // DELETE — no request body
getProductPriceHistory(supplierId: string, productId: string) → PriceHistoryEntry[]

// ========== RECURRING RULES (11 endpoints) ==========
// API paths: /financial/recurring-rules, /financial/recurring-rules/preview, /financial/recurring-rules/:id/*
getRecurringRules(params: ListRecurringRulesParams) → RecurringRuleListResponse
createRecurringRule(dto: CreateRecurringRuleDto) → RecurringRule
getRecurringRule(id: string) → RecurringRuleDetail
updateRecurringRule(id: string, dto: UpdateRecurringRuleDto) → RecurringRule
cancelRecurringRule(id: string) → RecurringRule          // DELETE method — API returns the cancelled rule object (status: "cancelled")
pauseRecurringRule(id: string) → RecurringRule            // POST .../pause
resumeRecurringRule(id: string) → RecurringRule           // POST .../resume
triggerRecurringRule(id: string) → void                   // POST .../trigger → 202
skipRecurringRule(id: string, dto?: SkipRuleDto) → RecurringRule  // POST .../skip
getRecurringRuleHistory(id: string, params?: { page?: number; limit?: number; date_from?: string; date_to?: string }) → PaginatedResponse<FinancialEntry>
getRecurringPreview(days: 30 | 60 | 90) → RecurringPreviewResponse  // GET /preview?days=X

// ========== DRAW MILESTONES (5 endpoints) ==========
// API paths: /projects/:projectId/milestones, /projects/:projectId/milestones/:id/*
getMilestones(projectId: string) → DrawMilestone[]
createMilestone(projectId: string, dto: CreateMilestoneDto) → DrawMilestone
updateMilestone(projectId: string, id: string, dto: UpdateMilestoneDto) → DrawMilestone
deleteMilestone(projectId: string, id: string) → void
generateMilestoneInvoice(projectId: string, id: string, dto?: GenerateMilestoneInvoiceDto) → ProjectInvoice

// ========== PROJECT INVOICES (8 endpoints) ==========
// API paths: /projects/:projectId/invoices, /projects/:projectId/invoices/:id/*
getProjectInvoices(projectId: string, params?: ListProjectInvoicesParams) → PaginatedResponse<ProjectInvoice>
createProjectInvoice(projectId: string, dto: CreateProjectInvoiceDto) → ProjectInvoice
getProjectInvoice(projectId: string, id: string) → ProjectInvoice
updateProjectInvoice(projectId: string, id: string, dto: UpdateProjectInvoiceDto) → ProjectInvoice
sendInvoice(projectId: string, id: string) → ProjectInvoice
voidInvoice(projectId: string, id: string, dto: VoidInvoiceDto) → ProjectInvoice
recordInvoicePayment(projectId: string, invoiceId: string, dto: RecordInvoicePaymentDto) → InvoicePayment
getInvoicePayments(projectId: string, invoiceId: string) → InvoicePayment[]

// ========== PROJECT FINANCIAL SUMMARY (5 endpoints) ==========
// API paths: /projects/:projectId/financial/*
getProjectFinancialSummary(projectId: string, params?: { date_from?: string; date_to?: string }) → ProjectFinancialSummary
getTaskBreakdown(projectId: string, params?: { date_from?: string; date_to?: string; sort_by?: string; sort_order?: string }) → TaskBreakdownResponse
getFinancialTimeline(projectId: string, params?: { date_from?: string; date_to?: string }) → TimelineResponse
getProjectReceipts(projectId: string, params?: { is_categorized?: boolean; ocr_status?: string; page?: number; limit?: number }) → PaginatedResponse<Receipt>
// NOTE: Do NOT reuse ListReceiptsParams here — the project-scoped endpoint (15.4) does NOT accept project_id/task_id in params (they are in the URL path). It only accepts: is_categorized, ocr_status, page, limit.
getWorkforceSummary(projectId: string, params?: { date_from?: string; date_to?: string }) → WorkforceResponse

// ========== TASK-LEVEL (5 endpoints) ==========
// API paths: /projects/:projectId/tasks/:taskId/*
createTaskCost(projectId: string, taskId: string, dto: CreateFinancialEntryDto) → FinancialEntry
getTaskCosts(projectId: string, taskId: string) → FinancialEntry[]
uploadTaskReceipt(projectId: string, taskId: string, formData: FormData) → Receipt
getTaskReceipts(projectId: string, taskId: string) → Receipt[]
getTaskInvoices(projectId: string, taskId: string) → SubcontractorInvoice[]

// ========== CREW HOURS (3 endpoints) ==========
// API paths: /financial/crew-hours, /financial/crew-hours/:id
logCrewHours(dto: CreateCrewHourDto & { crew_member_id: string; project_id: string; task_id?: string }) → CrewHourLog
getCrewHours(params: { crew_member_id?: string; project_id?: string; date_from?: string; date_to?: string; page?: number; limit?: number }) → PaginatedResponse<CrewHourLog>
updateCrewHourLog(id: string, dto: UpdateCrewHourDto) → CrewHourLog

// ========== CREW PAYMENTS (3 endpoints) ==========
// API paths: /financial/crew-payments, /crew/:crewMemberId/payment-history
createCrewPayment(dto: CreateCrewPaymentDto) → CrewPayment
getCrewPayments(params: { crew_member_id?: string; project_id?: string; page?: number; limit?: number }) → PaginatedResponse<CrewPayment>
getCrewPaymentHistory(crewMemberId: string, params?: { project_id?: string; page?: number; limit?: number }) → PaginatedResponse<CrewPayment>

// ========== SUBCONTRACTOR INVOICES (4 endpoints) ==========
// API paths: /financial/subcontractor-invoices, /subcontractors/:id/invoices
createSubcontractorInvoice(dto: CreateSubcontractorInvoiceDto | FormData) → SubcontractorInvoice
getSubcontractorInvoices(params: { subcontractor_id?: string; task_id?: string; project_id?: string; status?: string; page?: number; limit?: number }) → PaginatedResponse<SubcontractorInvoice>
updateSubcontractorInvoice(id: string, dto: UpdateSubcontractorInvoiceDto) → SubcontractorInvoice
getSubcontractorInvoiceList(subcontractorId: string) → SubcontractorInvoice[]

// ========== SUBCONTRACTOR PAYMENTS (4 endpoints) ==========
// API paths: /financial/subcontractor-payments, /subcontractors/:id/payment-history, /subcontractors/:id/payment-summary
createSubcontractorPayment(dto: CreateSubcontractorPaymentDto) → SubcontractorPayment
getSubcontractorPayments(params: { subcontractor_id?: string; project_id?: string; page?: number; limit?: number }) → PaginatedResponse<SubcontractorPayment>
getSubcontractorPaymentHistory(subcontractorId: string, params?: { project_id?: string; page?: number; limit?: number }) → PaginatedResponse<SubcontractorPayment>
getSubcontractorPaymentSummary(subcontractorId: string) → SubcontractorPaymentSummary

// ========== DASHBOARD (7 endpoints) ==========
// API paths: /financial/dashboard/*
getDashboardOverview(params?: { forecast_days?: number }) → DashboardOverview
getDashboardPL(params: DashboardPLParams) → PLSummary
exportPL(params: DashboardPLParams) → Blob      // GET /dashboard/pl/export
getDashboardAR(params?: DashboardARParams) → ARSummary
getDashboardAP(params?: DashboardAPParams) → APSummary
getDashboardForecast(params: DashboardForecastParams) → ForecastResponse
getDashboardAlerts() → AlertsResponse

// ========== ACCOUNT MAPPINGS (4 endpoints) ==========
// API paths: /financial/export/account-mappings, /financial/export/account-mappings/defaults
getAccountMappings(params?: { platform?: AccountingPlatform }) → AccountMapping[]
getDefaultMappings(platform: AccountingPlatform) → DefaultMapping[]
createAccountMapping(dto: CreateAccountMappingDto) → AccountMapping    // UPSERT
deleteAccountMapping(id: string) → void

// ========== ACCOUNTING EXPORTS (6 endpoints) ==========
// API paths: /financial/export/quickbooks/*, /financial/export/xero/*, /financial/export/quality-report, /financial/export/history
exportQuickbooksExpenses(params: ExportExpenseParams) → Blob
exportQuickbooksInvoices(params: ExportInvoiceParams) → Blob
exportXeroExpenses(params: ExportExpenseParams) → Blob
exportXeroInvoices(params: ExportInvoiceParams) → Blob
getQualityReport(params?: QualityReportParams) → QualityReportResponse
getExportHistory(params?: ExportHistoryParams) → PaginatedResponse<ExportHistoryItem>
```

---

### Task 3 — Verify Full Compilation

```bash
cd /var/www/lead360.app/app
npx tsc --noEmit 2>&1 | head -50
```

Fix ALL TypeScript errors. Both types and API client must compile cleanly.

---

## Acceptance Criteria
- [ ] All 109 endpoint functions exist with typed returns
- [ ] Import all needed types from `@/lib/types/financial`
- [ ] Follow existing codebase pattern (apiClient, query params builder)
- [ ] CSV/Blob exports use `responseType: 'blob'`
- [ ] FormData uploads include multipart headers
- [ ] Every function has clear section comment
- [ ] API paths match documentation exactly
- [ ] TypeScript compiles cleanly
- [ ] No backend code modified

---

## Gate Marker
**STOP** — Every UI sprint imports from this API client. It must compile and cover all 109 endpoints.

---

## Handoff Notes
- Types file: `/var/www/lead360.app/app/src/lib/types/financial.ts` (from Sprint 1a + 1b)
- API client: `/var/www/lead360.app/app/src/lib/api/financial.ts` (this sprint)
- All amounts from API are strings — parse with `parseFloat()` on frontend
- CSV exports return Blob — trigger download with `URL.createObjectURL()`
- Crew hours `logCrewHours` uses `POST /financial/crew-hours` (not task-scoped path)
- Subcontractor invoice create supports both JSON and FormData (with file attachment)
- `triggerRecurringRule` returns 202 Accepted (no body) — use `void` return
- `cancelRecurringRule` uses DELETE HTTP method
- `deleteSupplierCategory` and `deleteSupplier` return 204 No Content — use `void` return
