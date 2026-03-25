# Sprint 1 — TypeScript Types & API Client Foundation
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_1.md
**Type:** Frontend — Foundation
**Depends On:** NONE
**Gate:** STOP — All types and API functions must compile before any other sprint starts
**Estimated Complexity:** High (large but mechanical)

---

## Objective

Create ALL TypeScript type definitions and API client functions required by the complete financial module (109 endpoints). This is the foundation every other sprint depends on. You will hit every backend endpoint first to verify the real response shape, then write types and API functions that match exactly.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation at `/var/www/lead360.app/api/documentation/` as much as you need.
- **Follow the exact same patterns** already used in the codebase. Read existing files first.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Pre-Sprint Checklist
- [ ] Read `/var/www/lead360.app/app/src/lib/types/financial.ts` — existing types
- [ ] Read `/var/www/lead360.app/app/src/lib/api/financial.ts` — existing API client
- [ ] Read `/var/www/lead360.app/app/src/lib/api/axios.ts` — axios setup
- [ ] Read `/var/www/lead360.app/app/src/lib/types/projects.ts` — type patterns
- [ ] Read `/var/www/lead360.app/api/documentation/financial_REST_API.md` — complete API reference (109 endpoints)
- [ ] Backend server running on port 8000

---

## Dev Server (Backend — Read Only)

```
CHECK if port 8000 is already in use:
  lsof -i :8000

The backend must be running. If not running, start it:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT for health check:
  curl -s http://localhost:8000/health   ← must return 200

Get an auth token for testing:
  curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq '.access_token'

Save the token for endpoint verification throughout this sprint.
```

---

## Tasks

### Task 1 — Verify Key Endpoints Against Real API

Before writing types, hit these endpoints to verify response shapes match documentation:

```bash
TOKEN="your-token-here"

# Categories
curl -s http://localhost:8000/api/v1/settings/financial-categories -H "Authorization: Bearer $TOKEN" | jq '.[0]'

# Entries (enriched format)
curl -s "http://localhost:8000/api/v1/financial/entries?limit=1" -H "Authorization: Bearer $TOKEN" | jq '.data[0]'

# Payment Methods
curl -s http://localhost:8000/api/v1/financial/payment-methods -H "Authorization: Bearer $TOKEN" | jq '.[0]'

# Suppliers
curl -s "http://localhost:8000/api/v1/financial/suppliers?limit=1" -H "Authorization: Bearer $TOKEN" | jq '.data[0]'

# Supplier Categories
curl -s http://localhost:8000/api/v1/financial/supplier-categories -H "Authorization: Bearer $TOKEN" | jq '.[0]'

# Recurring Rules
curl -s "http://localhost:8000/api/v1/financial/recurring-rules?limit=1" -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard overview
curl -s http://localhost:8000/api/v1/financial/dashboard/overview -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard P&L
curl -s "http://localhost:8000/api/v1/financial/dashboard/pl?year=2026" -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard AR
curl -s http://localhost:8000/api/v1/financial/dashboard/ar -H "Authorization: Bearer $TOKEN" | jq '.'

# Dashboard AP
curl -s http://localhost:8000/api/v1/financial/dashboard/ap -H "Authorization: Bearer $TOKEN" | jq '.'

# Export account mappings
curl -s http://localhost:8000/api/v1/financial/export/account-mappings -H "Authorization: Bearer $TOKEN" | jq '.'

# Export history
curl -s http://localhost:8000/api/v1/financial/export/history -H "Authorization: Bearer $TOKEN" | jq '.'

# Quality report
curl -s http://localhost:8000/api/v1/financial/export/quality-report -H "Authorization: Bearer $TOKEN" | jq '.'
```

Document any differences between the live response and the documentation. Use the LIVE response as the source of truth for types.

---

### Task 2 — Rewrite Financial Types File

**File:** `/var/www/lead360.app/app/src/lib/types/financial.ts`

Replace the entire file with comprehensive types covering ALL 109 endpoints. The file must include:

**Section 1 — Enums (as union types):**
```typescript
// payment_method
export type PaymentMethodType = 'cash' | 'check' | 'bank_transfer' | 'venmo' | 'zelle' | 'credit_card' | 'debit_card' | 'ACH';

// financial_category_type
export type CategoryType = 'labor' | 'material' | 'subcontractor' | 'equipment' | 'insurance' | 'fuel' | 'utilities' | 'office' | 'marketing' | 'taxes' | 'tools' | 'other';

// financial_category_classification
export type CategoryClassification = 'cost_of_goods_sold' | 'operating_expense';

// financial_entry_type
export type EntryType = 'expense' | 'income';

// expense_submission_status
export type SubmissionStatus = 'pending_review' | 'confirmed';

// recurring_frequency
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

// recurring_rule_status
export type RecurringRuleStatus = 'active' | 'paused' | 'completed' | 'cancelled';

// receipt
export type OcrStatus = 'not_processed' | 'processing' | 'complete' | 'failed';
export type ReceiptFileType = 'photo' | 'pdf';

// milestone
export type MilestoneStatus = 'pending' | 'invoiced' | 'paid';
export type DrawCalculationType = 'percentage' | 'fixed_amount';

// invoice
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'voided';

// subcontractor invoice
export type SubcontractorInvoiceStatus = 'pending' | 'approved' | 'paid';

// export
export type ExportType = 'quickbooks_expenses' | 'quickbooks_invoices' | 'xero_expenses' | 'xero_invoices' | 'pl_csv' | 'entries_csv';
export type AccountingPlatform = 'quickbooks' | 'xero';

// alert
export type AlertType = 'cost_overrun' | 'overdue_invoice' | 'upcoming_obligation' | 'budget_warning';
export type AlertSeverity = 'info' | 'warning' | 'error';
```

**Section 2 — Shared/Generic Types:**
```typescript
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages?: number;
    pages?: number;
    totalPages?: number;
  };
}

// Helper to get pages from any meta format
export function getPageCount(meta: PaginatedResponse<unknown>['meta']): number {
  return meta.total_pages ?? meta.pages ?? meta.totalPages ?? 1;
}
```

**Section 3 — Financial Categories:**
```typescript
export interface FinancialCategory {
  id: string;
  tenant_id: string;
  name: string;
  type: CategoryType;
  classification: CategoryClassification;
  description: string | null;
  is_active: boolean;
  is_system_default: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryDto {
  name: string;
  type: CategoryType;
  classification?: CategoryClassification;
  description?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  classification?: CategoryClassification;
}
```

**Section 4 — Financial Entries (Enriched):**
```typescript
export interface FinancialEntry {
  id: string;
  tenant_id: string;
  project_id: string | null;
  project_name: string | null;
  task_id: string | null;
  task_title: string | null;
  category_id: string;
  category_name: string;
  category_type: CategoryType;
  category_classification: CategoryClassification;
  entry_type: EntryType;
  amount: string;
  tax_amount: string | null;
  entry_date: string;
  entry_time: string | null;
  vendor_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  payment_method: PaymentMethodType | null;
  payment_method_registry_id: string | null;
  payment_method_nickname: string | null;
  purchased_by_user_id: string | null;
  purchased_by_user_name: string | null;
  purchased_by_crew_member_id: string | null;
  purchased_by_crew_member_name: string | null;
  submission_status: SubmissionStatus;
  rejection_reason: string | null;
  rejected_by_user_id: string | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
  is_recurring_instance: boolean;
  recurring_rule_id: string | null;
  has_receipt: boolean;
  notes: string | null;
  created_by_user_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialEntryListResponse extends PaginatedResponse<FinancialEntry> {
  summary: {
    total_expenses: number;
    total_income: number;
    total_tax: number;
    entry_count: number;
  };
}

export interface CreateFinancialEntryDto {
  category_id: string;
  entry_type: EntryType;
  amount: number;
  entry_date: string;
  project_id?: string;
  task_id?: string;
  tax_amount?: number;
  entry_time?: string;
  vendor_name?: string;
  supplier_id?: string;
  payment_method?: PaymentMethodType;
  payment_method_registry_id?: string;
  purchased_by_user_id?: string;
  purchased_by_crew_member_id?: string;
  submission_status?: SubmissionStatus;
  notes?: string;
}

export interface UpdateFinancialEntryDto {
  category_id?: string;
  entry_type?: EntryType;
  amount?: number;
  tax_amount?: number;
  entry_date?: string;
  entry_time?: string;
  vendor_name?: string;
  supplier_id?: string | null;
  payment_method?: PaymentMethodType;
  payment_method_registry_id?: string | null;
  purchased_by_user_id?: string | null;
  purchased_by_crew_member_id?: string | null;
  notes?: string;
}

export interface ListFinancialEntriesParams {
  page?: number;
  limit?: number;
  project_id?: string;
  task_id?: string;
  category_id?: string;
  category_type?: CategoryType;
  classification?: CategoryClassification;
  entry_type?: EntryType;
  supplier_id?: string;
  payment_method?: PaymentMethodType;
  submission_status?: SubmissionStatus;
  purchased_by_user_id?: string;
  purchased_by_crew_member_id?: string;
  date_from?: string;
  date_to?: string;
  has_receipt?: boolean;
  is_recurring_instance?: boolean;
  search?: string;
  sort_by?: 'entry_date' | 'amount' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface ListPendingEntriesParams {
  page?: number;
  limit?: number;
  submitted_by_user_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface ApproveEntryDto {
  notes?: string;
}

export interface RejectEntryDto {
  rejection_reason: string;
}

export interface ResubmitEntryDto extends UpdateFinancialEntryDto {}
```

**Section 5 — Receipts & OCR:**
```typescript
export interface Receipt {
  id: string;
  tenant_id: string;
  project_id: string | null;
  task_id: string | null;
  task_title?: string | null;
  financial_entry_id: string | null;
  file_url: string;
  file_name: string;
  file_type: ReceiptFileType;
  file_size_bytes: number | null;
  vendor_name: string | null;
  amount: number | null;
  receipt_date: string | null;
  ocr_status: OcrStatus;
  ocr_vendor: string | null;
  ocr_amount: number | null;
  ocr_date: string | null;
  is_categorized: boolean;
  uploaded_by_user_id: string;
  uploaded_by?: { id: string; first_name: string; last_name: string };
  created_at: string;
  updated_at: string;
}

export interface OcrStatusResponse {
  receipt_id: string;
  ocr_status: OcrStatus;
  ocr_vendor: string | null;
  ocr_amount: number | null;
  ocr_date: string | null;
  has_suggestions: boolean;
}

export interface CreateEntryFromReceiptDto {
  project_id: string;
  category_id: string;
  task_id?: string;
  amount?: number;
  tax_amount?: number;
  entry_date?: string;
  entry_time?: string;
  vendor_name?: string;
  supplier_id?: string;
  payment_method?: PaymentMethodType;
  payment_method_registry_id?: string;
  purchased_by_user_id?: string;
  purchased_by_crew_member_id?: string;
  submission_status?: SubmissionStatus;
  notes?: string;
}

export interface CreateEntryFromReceiptResponse {
  entry: FinancialEntry;
  receipt: Receipt;
}

export interface UpdateReceiptDto {
  vendor_name?: string | null;
  amount?: number | null;
  receipt_date?: string | null;
}

export interface LinkReceiptDto {
  financial_entry_id: string;
}

export interface ListReceiptsParams {
  project_id?: string;
  task_id?: string;
  is_categorized?: boolean;
  ocr_status?: OcrStatus;
  page?: number;
  limit?: number;
}
```

**Section 6 — Payment Method Registry:**
```typescript
export interface PaymentMethodRegistry {
  id: string;
  tenant_id: string;
  nickname: string;
  type: PaymentMethodType;
  bank_name: string | null;
  last_four: string | null;
  notes: string | null;
  is_default: boolean;
  is_active: boolean;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  usage_count: number;
  last_used_date: string | null;
}

export interface CreatePaymentMethodDto {
  nickname: string;
  type: PaymentMethodType;
  bank_name?: string;
  last_four?: string;
  notes?: string;
  is_default?: boolean;
}

export interface UpdatePaymentMethodDto {
  nickname?: string;
  type?: PaymentMethodType;
  bank_name?: string;
  last_four?: string;
  notes?: string;
  is_active?: boolean;
}

export interface ListPaymentMethodsParams {
  is_active?: boolean;
  type?: PaymentMethodType;
}
```

**Section 7 — Suppliers:**
```typescript
export interface SupplierCategory {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  supplier_count: number;
}

export interface CreateSupplierCategoryDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateSupplierCategoryDto {
  name?: string;
  description?: string;
  color?: string;
  is_active?: boolean;
}

export interface SupplierListItem {
  id: string;
  name: string;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  city: string | null;
  state: string | null;
  is_preferred: boolean;
  is_active: boolean;
  total_spend: string;
  last_purchase_date: string | null;
  categories: SupplierCategory[];
  product_count: number;
  created_at: string;
}

export interface Supplier extends SupplierListItem {
  tenant_id: string;
  legal_name: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  zip_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  notes: string | null;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  updated_at: string;
  products: SupplierProduct[];
  created_by: { id: string; first_name: string; last_name: string };
}

export interface CreateSupplierDto {
  name: string;
  legal_name?: string;
  website?: string;
  phone?: string;
  email?: string;
  contact_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
  notes?: string;
  is_preferred?: boolean;
  category_ids?: string[];
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {
  is_active?: boolean;
}

export interface ListSuppliersParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  is_active?: boolean;
  is_preferred?: boolean;
  sort_by?: 'name' | 'total_spend' | 'last_purchase_date' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface SupplierStatistics {
  supplier_id: string;
  total_spend: number;
  transaction_count: number;
  last_purchase_date: string | null;
  first_purchase_date: string | null;
  spend_by_category: { category_name: string; category_type: string; total: number }[];
  spend_by_month: { year: number; month: number; month_label: string; total: number }[];
}

export interface SupplierMapItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  total_spend: string;
}
```

**Section 8 — Supplier Products:**
```typescript
export interface SupplierProduct {
  id: string;
  tenant_id: string;
  supplier_id: string;
  name: string;
  description: string | null;
  unit_of_measure: string;
  unit_price: string;
  price_last_updated_at: string | null;
  price_last_updated_by_user_id: string | null;
  sku: string | null;
  is_active: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierProductDto {
  name: string;
  unit_of_measure: string;
  description?: string;
  unit_price?: number;
  sku?: string;
}

export interface UpdateSupplierProductDto {
  name?: string;
  description?: string;
  unit_of_measure?: string;
  unit_price?: number;
  sku?: string;
  is_active?: boolean;
}

export interface PriceHistoryEntry {
  id: string;
  previous_price: string;
  new_price: string;
  changed_by: { id: string; first_name: string; last_name: string };
  changed_at: string;
  notes: string | null;
}
```

**Section 9 — Recurring Expense Rules:**
```typescript
export interface RecurringRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category_id: string;
  amount: string;
  tax_amount: string | null;
  supplier_id: string | null;
  vendor_name: string | null;
  payment_method_registry_id: string | null;
  frequency: RecurringFrequency;
  interval: number;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  recurrence_count: number | null;
  occurrences_generated: number;
  next_due_date: string;
  auto_confirm: boolean;
  notes: string | null;
  status: RecurringRuleStatus;
  last_generated_at: string | null;
  last_generated_entry_id: string | null;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  category: { id: string; name: string; type: CategoryType };
  supplier: { id: string; name: string } | null;
  payment_method: { id: string; nickname: string; type: PaymentMethodType } | null;
}

export interface RecurringRuleDetail extends RecurringRule {
  last_generated_entry: {
    id: string;
    amount: string;
    entry_date: string;
    submission_status: SubmissionStatus;
  } | null;
  next_occurrence_preview: string[];
}

export interface RecurringRuleListResponse extends PaginatedResponse<RecurringRule> {
  summary: {
    total_active_rules: number;
    monthly_obligation: number;
  };
}

export interface CreateRecurringRuleDto {
  name: string;
  category_id: string;
  amount: number;
  frequency: RecurringFrequency;
  start_date: string;
  description?: string;
  tax_amount?: number;
  supplier_id?: string;
  vendor_name?: string;
  payment_method_registry_id?: string;
  interval?: number;
  day_of_month?: number;
  day_of_week?: number;
  end_date?: string;
  recurrence_count?: number;
  auto_confirm?: boolean;
  notes?: string;
}

export interface UpdateRecurringRuleDto {
  name?: string;
  category_id?: string;
  amount?: number;
  frequency?: RecurringFrequency;
  description?: string;
  tax_amount?: number;
  supplier_id?: string;
  vendor_name?: string;
  payment_method_registry_id?: string;
  interval?: number;
  day_of_month?: number;
  day_of_week?: number;
  end_date?: string;
  recurrence_count?: number;
  auto_confirm?: boolean;
  notes?: string;
}

export interface ListRecurringRulesParams {
  page?: number;
  limit?: number;
  status?: RecurringRuleStatus;
  category_id?: string;
  frequency?: RecurringFrequency;
  sort_by?: 'next_due_date' | 'amount' | 'name' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface SkipRuleDto {
  reason?: string;
}

export interface RecurringPreviewResponse {
  period_days: number;
  total_obligations: number;
  occurrences: {
    rule_id: string;
    rule_name: string;
    amount: number;
    tax_amount: number | null;
    category_name: string;
    due_date: string;
    frequency: RecurringFrequency;
    supplier_name: string | null;
    payment_method_nickname: string | null;
  }[];
}
```

**Section 10 — Draw Milestones:**
```typescript
export interface DrawMilestone {
  id: string;
  tenant_id: string;
  project_id: string;
  quote_draw_entry_id: string | null;
  draw_number: number;
  description: string;
  calculation_type: DrawCalculationType;
  value: string;
  calculated_amount: string;
  status: MilestoneStatus;
  invoice_id: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneDto {
  draw_number: number;
  description: string;
  calculation_type: DrawCalculationType;
  value: number;
  calculated_amount?: number;
  notes?: string;
}

export interface UpdateMilestoneDto {
  description?: string;
  calculated_amount?: number;
  notes?: string;
}

export interface GenerateMilestoneInvoiceDto {
  description?: string;
  due_date?: string;
  tax_amount?: number;
  notes?: string;
}
```

**Section 11 — Project Invoices:**
```typescript
export interface ProjectInvoice {
  id: string;
  tenant_id: string;
  project_id: string;
  invoice_number: string;
  milestone_id: string | null;
  description: string;
  amount: string;
  tax_amount: string | null;
  amount_paid: string;
  amount_due: string;
  status: InvoiceStatus;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  voided_reason: string | null;
  notes: string | null;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  milestone: { id: string; draw_number: number; description: string } | null;
  payment_count: number;
}

export interface CreateProjectInvoiceDto {
  description: string;
  amount: number;
  tax_amount?: number;
  due_date?: string;
  notes?: string;
}

export interface UpdateProjectInvoiceDto {
  description?: string;
  amount?: number;
  tax_amount?: number;
  due_date?: string;
  notes?: string;
}

export interface VoidInvoiceDto {
  voided_reason: string;
}

export interface InvoicePayment {
  id: string;
  tenant_id: string;
  invoice_id: string;
  project_id: string;
  amount: string;
  payment_date: string;
  payment_method: PaymentMethodType;
  payment_method_registry_id: string | null;
  reference_number: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
}

export interface RecordInvoicePaymentDto {
  amount: number;
  payment_date: string;
  payment_method: PaymentMethodType;
  payment_method_registry_id?: string;
  reference_number?: string;
  notes?: string;
}

export interface ListProjectInvoicesParams {
  page?: number;
  limit?: number;
  status?: InvoiceStatus;
  date_from?: string;
  date_to?: string;
}
```

**Section 12 — Project Financial Summary (F-07):**
```typescript
export interface ProjectFinancialSummary {
  project: {
    id: string;
    project_number: string;
    name: string;
    status: string;
    progress_percent: number;
    start_date: string | null;
    target_completion_date: string | null;
    actual_completion_date: string | null;
    contract_value: number | null;
    estimated_cost: number | null;
    assigned_pm: string | null;
  };
  cost_summary: {
    total_expenses: number;
    total_expenses_pending: number;
    total_tax_paid: number;
    entry_count: number;
    by_category: {
      category_id: string;
      category_name: string;
      category_type: CategoryType;
      classification: CategoryClassification;
      total: number;
      entry_count: number;
    }[];
    by_classification: {
      cost_of_goods_sold: number;
      operating_expense: number;
    };
  };
  subcontractor_summary: {
    total_invoiced: number;
    total_paid: number;
    outstanding: number;
    invoice_count: number;
    payment_count: number;
  };
  crew_summary: {
    total_regular_hours: number;
    total_overtime_hours: number;
    total_hours: number;
    total_crew_payments: number;
    crew_member_count: number;
  };
  receipt_summary: {
    total_receipts: number;
    categorized: number;
    uncategorized: number;
  };
  revenue_summary: {
    total_invoiced: number;
    total_collected: number;
    outstanding: number;
    invoice_count: number;
  };
  margin_analysis: {
    contract_value: number | null;
    estimated_cost: number | null;
    actual_cost: number;
    budget_remaining: number | null;
    budget_used_percent: number | null;
    gross_margin: number | null;
    gross_margin_percent: number | null;
  };
}

export interface TaskBreakdownResponse {
  project_id: string;
  total_task_cost: number;
  tasks: {
    task_id: string;
    task_title: string;
    task_status: string;
    task_order_index: number;
    expenses: {
      total: number;
      by_category: { category_name: string; category_type: string; classification: string; total: number }[];
      entry_count: number;
    };
    subcontractor_invoices: { total_invoiced: number; invoice_count: number };
    crew_hours: { total_regular_hours: number; total_overtime_hours: number; total_hours: number };
  }[];
}

export interface TimelineResponse {
  project_id: string;
  months: {
    year: number;
    month: number;
    month_label: string;
    total_expenses: number;
    by_category: { category_name: string; category_type: string; total: number }[];
  }[];
  cumulative_total: number;
}

export interface WorkforceResponse {
  project_id: string;
  crew_hours: {
    total_regular_hours: number;
    total_overtime_hours: number;
    total_hours: number;
    by_crew_member: {
      crew_member_id: string;
      crew_member_name: string;
      regular_hours: number;
      overtime_hours: number;
      log_count: number;
      total_hours: number;
    }[];
  };
  crew_payments: {
    total_paid: number;
    payment_count: number;
    by_crew_member: {
      crew_member_id: string;
      crew_member_name: string;
      total_paid: number;
      payment_count: number;
      last_payment_date: string | null;
    }[];
  };
  subcontractor_invoices: {
    total_invoiced: number;
    total_paid: number;
    outstanding: number;
    by_subcontractor: {
      subcontractor_id: string;
      subcontractor_name: string;
      invoiced: number;
      paid: number;
      invoice_count: number;
      pending_invoices: number;
      approved_invoices: number;
      paid_invoices: number;
      outstanding: number;
    }[];
  };
}
```

**Section 13 — Dashboard:**
```typescript
export interface DashboardOverview {
  pl_summary: PLSummary;
  ar_summary: ARSummary;
  ap_summary: APSummary;
  forecast: ForecastResponse;
  alerts: FinancialAlert[];
  generated_at: string;
}

export interface PLSummary {
  year: number;
  period: string;
  currency: string;
  months: PLMonth[];
  totals: {
    total_income: number;
    total_expenses: number;
    total_gross_profit: number;
    total_operating_profit: number;
    total_tax_collected: number;
    total_tax_paid: number;
    avg_monthly_income: number;
    avg_monthly_expenses: number;
    best_month: { month_label: string; net_profit: number };
    worst_month: { month_label: string; net_profit: number };
  };
}

export interface PLMonth {
  year: number;
  month: number;
  month_label: string;
  income: {
    total: number;
    invoice_count: number;
    by_project: { project_id: string; project_name: string; total: number }[];
  };
  expenses: {
    total: number;
    total_with_pending: number;
    total_tax_paid: number;
    by_classification: { cost_of_goods_sold: number; operating_expense: number };
    by_category: {
      category_id: string;
      category_name: string;
      category_type: CategoryType;
      classification: CategoryClassification;
      total: number;
      entry_count: number;
    }[];
    top_suppliers: { supplier_name: string; total: number }[];
  };
  gross_profit: number;
  operating_profit: number;
  net_profit: number;
  gross_margin_percent: number | null;
  tax: { tax_collected: number; tax_paid: number; net_tax_position: number };
}

export interface ARSummary {
  summary: {
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    total_overdue: number;
    invoice_count: number;
    overdue_count: number;
    avg_days_outstanding: number;
  };
  aging_buckets: {
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_over_90: number;
  };
  invoices: {
    invoice_id: string;
    invoice_number: string;
    project_id: string;
    project_name: string;
    project_number: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    status: InvoiceStatus;
    due_date: string | null;
    days_outstanding: number;
    days_overdue: number | null;
    is_overdue: boolean;
  }[];
}

export interface APSummary {
  summary: {
    subcontractor_outstanding: number;
    crew_unpaid_estimate: number;
    recurring_upcoming: number;
    total_ap_estimate: number;
  };
  subcontractor_invoices: {
    total_pending: number;
    total_approved: number;
    total_outstanding: number;
    invoice_count: number;
    by_subcontractor: {
      subcontractor_id: string;
      subcontractor_name: string;
      pending: number;
      approved: number;
      total: number;
    }[];
  };
  recurring_upcoming: {
    rule_id: string;
    rule_name: string;
    amount: number;
    next_due_date: string;
    frequency: RecurringFrequency;
  }[];
  crew_hours_summary: {
    note: string;
    total_regular_hours_this_month: number;
    total_overtime_hours_this_month: number;
    crew_member_count: number;
  };
}

export interface ForecastResponse {
  period_days: number;
  forecast_start: string;
  forecast_end: string;
  expected_inflows: {
    total: number;
    items: {
      source: string;
      invoice_id?: string;
      invoice_number?: string;
      project_name?: string;
      amount_due: number;
      due_date: string;
    }[];
  };
  expected_outflows: {
    total: number;
    items: {
      source: string;
      rule_id?: string;
      rule_name?: string;
      amount: number;
      due_date: string;
    }[];
  };
  net_forecast: number;
  net_forecast_label: 'Positive' | 'Negative' | 'Breakeven';
}

export interface FinancialAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;
}

export interface AlertsResponse {
  alert_count: number;
  alerts: FinancialAlert[];
}

export interface DashboardPLParams {
  year: number;
  month?: number;
  include_pending?: boolean;
}

export interface DashboardARParams {
  status?: InvoiceStatus;
  overdue_only?: boolean;
}

export interface DashboardAPParams {
  days_ahead?: number;
}

export interface DashboardForecastParams {
  days: 30 | 60 | 90;
}
```

**Section 14 — Account Mappings & Exports:**
```typescript
export interface AccountMapping {
  id: string;
  tenant_id: string;
  category_id: string;
  platform: AccountingPlatform;
  account_name: string;
  account_code: string | null;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  category: { id: string; name: string; type: CategoryType };
}

export interface DefaultMapping {
  category_id: string;
  category_name: string;
  category_type: CategoryType;
  classification: CategoryClassification;
  has_custom_mapping: boolean;
  account_name: string;
  account_code: string | null;
}

export interface CreateAccountMappingDto {
  category_id: string;
  platform: AccountingPlatform;
  account_name: string;
  account_code?: string;
}

export interface ExportHistoryItem {
  id: string;
  export_type: ExportType;
  date_from: string;
  date_to: string;
  record_count: number;
  file_name: string;
  filters_applied: Record<string, unknown>;
  exported_by_user_id: string;
  created_at: string;
  exported_by: { id: string; first_name: string; last_name: string };
}

export interface QualityReportResponse {
  total_entries_checked: number;
  total_issues: number;
  errors: number;
  warnings: number;
  infos: number;
  issues: {
    severity: AlertSeverity;
    check_type: string;
    entry_id: string;
    entry_date: string;
    amount: number;
    category_name: string;
    supplier_name: string | null;
    message: string;
  }[];
}

export interface ExportExpenseParams {
  date_from: string;
  date_to: string;
  category_id?: string;
  classification?: CategoryClassification;
  project_id?: string;
  include_recurring?: boolean;
  include_pending?: boolean;
}

export interface ExportInvoiceParams {
  date_from: string;
  date_to: string;
  status?: InvoiceStatus;
}

export interface ExportHistoryParams {
  export_type?: ExportType;
  page?: number;
  limit?: number;
}

export interface QualityReportParams {
  date_from?: string;
  date_to?: string;
  platform?: AccountingPlatform;
}
```

**Section 15 — Crew Hours & Payments (keep existing + extend):**
Keep the existing `CrewMemberRef`, `ProjectRef`, `TaskRef`, `CrewHourLog`, `CreateCrewHourDto`, `UpdateCrewHourDto`, `CrewMemberHourSummary`, `CrewPayment`, `CreateCrewPaymentDto`, `SubcontractorRef`, `SubcontractorPayment`, `CreateSubcontractorPaymentDto`, `SubcontractorInvoice`, `CreateSubcontractorInvoiceDto`, `UpdateSubcontractorInvoiceDto`, `SubcontractorPaymentSummary`, `CrewMember`, `Subcontractor` — these remain the same but ensure they match the API doc exactly.

**Acceptance:** The file compiles with `npx tsc --noEmit` from the app directory.

---

### Task 3 — Rewrite Financial API Client

**File:** `/var/www/lead360.app/app/src/lib/api/financial.ts`

Replace the entire file to cover ALL 109 endpoints. Follow the exact pattern from the existing file — use `apiClient` from `./axios`, typed imports from `@/lib/types/financial`.

Organize by section with clear `// ========== SECTION NAME ==========` comments. Every function must have a typed return value.

**All functions needed (group by API section):**

```
// ========== FINANCIAL CATEGORIES (4 endpoints) ==========
getFinancialCategories() → FinancialCategory[]
createFinancialCategory(dto) → FinancialCategory
updateFinancialCategory(id, dto) → FinancialCategory
deleteFinancialCategory(id) → FinancialCategory

// ========== FINANCIAL ENTRIES (10 endpoints) ==========
getFinancialEntries(params) → FinancialEntryListResponse
getFinancialEntry(id) → FinancialEntry
createFinancialEntry(dto) → FinancialEntry
updateFinancialEntry(id, dto) → FinancialEntry
deleteFinancialEntry(id) → { message: string }
getPendingEntries(params) → FinancialEntryListResponse
approveEntry(id, dto?) → FinancialEntry
rejectEntry(id, dto) → FinancialEntry
resubmitEntry(id, dto?) → FinancialEntry
exportEntries(params) → Blob  // CSV download

// ========== RECEIPTS & OCR (8 endpoints) ==========
uploadReceipt(formData) → Receipt
getReceipts(params) → PaginatedResponse<Receipt>
getReceipt(id) → Receipt
getOcrStatus(id) → OcrStatusResponse
createEntryFromReceipt(id, dto) → CreateEntryFromReceiptResponse
retryOcr(id) → Receipt
linkReceiptToEntry(id, dto) → Receipt
updateReceipt(id, dto) → Receipt

// ========== PAYMENT METHODS (6 endpoints) ==========
getPaymentMethods(params?) → PaymentMethodRegistry[]
createPaymentMethod(dto) → PaymentMethodRegistry
getPaymentMethod(id) → PaymentMethodRegistry
updatePaymentMethod(id, dto) → PaymentMethodRegistry
deletePaymentMethod(id) → PaymentMethodRegistry
setDefaultPaymentMethod(id) → PaymentMethodRegistry

// ========== SUPPLIER CATEGORIES (4 endpoints) ==========
getSupplierCategories(params?) → SupplierCategory[]
createSupplierCategory(dto) → SupplierCategory
updateSupplierCategory(id, dto) → SupplierCategory
deleteSupplierCategory(id) → void

// ========== SUPPLIERS (7 endpoints) ==========
getSuppliers(params) → PaginatedResponse<SupplierListItem>
getSupplier(id) → Supplier
createSupplier(dto) → Supplier
updateSupplier(id, dto) → Supplier
deleteSupplier(id) → void
getSupplierMap() → SupplierMapItem[]
getSupplierStatistics(id) → SupplierStatistics

// ========== SUPPLIER PRODUCTS (5 endpoints) ==========
getSupplierProducts(supplierId, params?) → SupplierProduct[]
createSupplierProduct(supplierId, dto) → SupplierProduct
updateSupplierProduct(supplierId, productId, dto) → SupplierProduct
deleteSupplierProduct(supplierId, productId) → void
getProductPriceHistory(supplierId, productId) → PriceHistoryEntry[]

// ========== RECURRING RULES (11 endpoints) ==========
getRecurringRules(params) → RecurringRuleListResponse
createRecurringRule(dto) → RecurringRule
getRecurringRule(id) → RecurringRuleDetail
updateRecurringRule(id, dto) → RecurringRule
cancelRecurringRule(id) → RecurringRule
pauseRecurringRule(id) → RecurringRule
resumeRecurringRule(id) → RecurringRule
triggerRecurringRule(id) → void
skipRecurringRule(id, dto?) → RecurringRule
getRecurringRuleHistory(id, params?) → PaginatedResponse<FinancialEntry>
getRecurringPreview(days) → RecurringPreviewResponse

// ========== DRAW MILESTONES (5 endpoints) ==========
getMilestones(projectId) → DrawMilestone[]
createMilestone(projectId, dto) → DrawMilestone
updateMilestone(projectId, id, dto) → DrawMilestone
deleteMilestone(projectId, id) → void
generateMilestoneInvoice(projectId, id, dto?) → ProjectInvoice

// ========== PROJECT INVOICES (8 endpoints) ==========
getProjectInvoices(projectId, params?) → PaginatedResponse<ProjectInvoice>
createProjectInvoice(projectId, dto) → ProjectInvoice
getProjectInvoice(projectId, id) → ProjectInvoice
updateProjectInvoice(projectId, id, dto) → ProjectInvoice
sendInvoice(projectId, id) → ProjectInvoice
voidInvoice(projectId, id, dto) → ProjectInvoice
recordInvoicePayment(projectId, invoiceId, dto) → InvoicePayment
getInvoicePayments(projectId, invoiceId) → InvoicePayment[]

// ========== PROJECT FINANCIAL SUMMARY (5 endpoints) ==========
getProjectFinancialSummary(projectId, params?) → ProjectFinancialSummary
getTaskBreakdown(projectId, params?) → TaskBreakdownResponse
getFinancialTimeline(projectId, params?) → TimelineResponse
getProjectReceipts(projectId, params?) → PaginatedResponse<Receipt>
getWorkforceSummary(projectId, params?) → WorkforceResponse

// ========== TASK-LEVEL (5 endpoints — keep existing) ==========
createTaskCost(projectId, taskId, dto) → FinancialEntry
getTaskCosts(projectId, taskId) → FinancialEntry[]
uploadTaskReceipt(projectId, taskId, formData) → Receipt
getTaskReceipts(projectId, taskId) → Receipt[]
getTaskInvoices(projectId, taskId) → SubcontractorInvoice[]

// ========== CREW HOURS (3 endpoints) ==========
logCrewHours(dto) → CrewHourLog
getCrewHours(params) → PaginatedResponse<CrewHourLog>
updateCrewHourLog(id, dto) → CrewHourLog

// ========== CREW PAYMENTS (3 endpoints) ==========
createCrewPayment(dto) → CrewPayment
getCrewPayments(params) → PaginatedResponse<CrewPayment>
getCrewPaymentHistory(crewMemberId, params?) → PaginatedResponse<CrewPayment>

// ========== SUBCONTRACTOR INVOICES (4 endpoints) ==========
createSubcontractorInvoice(dto) → SubcontractorInvoice
getSubcontractorInvoices(params) → PaginatedResponse<SubcontractorInvoice>
updateSubcontractorInvoice(id, dto) → SubcontractorInvoice
getSubcontractorInvoiceList(subcontractorId) → SubcontractorInvoice[]

// ========== SUBCONTRACTOR PAYMENTS (4 endpoints) ==========
createSubcontractorPayment(dto) → SubcontractorPayment
getSubcontractorPayments(params) → PaginatedResponse<SubcontractorPayment>
getSubcontractorPaymentHistory(subcontractorId, params?) → PaginatedResponse<SubcontractorPayment>
getSubcontractorPaymentSummary(subcontractorId) → SubcontractorPaymentSummary

// ========== DASHBOARD (7 endpoints) ==========
getDashboardOverview(params?) → DashboardOverview
getDashboardPL(params) → PLSummary
exportPL(params) → Blob
getDashboardAR(params?) → ARSummary
getDashboardAP(params?) → APSummary
getDashboardForecast(params) → ForecastResponse
getDashboardAlerts() → AlertsResponse

// ========== ACCOUNT MAPPINGS (4 endpoints) ==========
getAccountMappings(params?) → AccountMapping[]
getDefaultMappings(platform) → DefaultMapping[]
createAccountMapping(dto) → AccountMapping
deleteAccountMapping(id) → void

// ========== ACCOUNTING EXPORTS (6 endpoints) ==========
exportQuickbooksExpenses(params) → Blob
exportQuickbooksInvoices(params) → Blob
exportXeroExpenses(params) → Blob
exportXeroInvoices(params) → Blob
getQualityReport(params?) → QualityReportResponse
getExportHistory(params?) → PaginatedResponse<ExportHistoryItem>
```

**For CSV/Blob downloads, use this pattern:**
```typescript
export const exportEntries = async (params: ListFinancialEntriesParams): Promise<Blob> => {
  const queryParams: Record<string, string | number | boolean> = {};
  // ... build query params ...
  const { data } = await apiClient.get('/financial/entries/export', {
    params: queryParams,
    responseType: 'blob',
  });
  return data;
};
```

**Note on crew hours endpoint change:** The create crew hours endpoint in the master API doc is `POST /financial/crew-hours` (not task-scoped). Update accordingly.

---

### Task 4 — Verify Compilation

```bash
cd /var/www/lead360.app/app
npx tsc --noEmit 2>&1 | head -50
```

Fix any TypeScript errors. The types file and API client must compile cleanly.

---

## Acceptance Criteria
- [ ] All 109 endpoint types are defined in `financial.ts` types file
- [ ] All 109 endpoint functions exist in `financial.ts` API client
- [ ] Types match the LIVE API responses (verified by hitting endpoints)
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [ ] File follows existing codebase patterns (imports, naming, structure)
- [ ] Enum union types match API doc section 4 exactly
- [ ] `getPageCount()` helper handles all 3 pagination field names
- [ ] No backend code was modified
- [ ] Both files have clear section comments

---

## Gate Marker
**STOP** — Every other sprint imports from these files. They must compile and cover all 109 endpoints before any other sprint begins.

---

## Handoff Notes
- Types file: `/var/www/lead360.app/app/src/lib/types/financial.ts`
- API client: `/var/www/lead360.app/app/src/lib/api/financial.ts`
- Pagination helper: `getPageCount(meta)` handles `total_pages`, `pages`, `totalPages`
- All amounts from API are strings — parse with `parseFloat()` on frontend
- CSV exports return Blob — use `responseType: 'blob'` in axios
