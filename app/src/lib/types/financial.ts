// Lead360 - Financial Module Type Definitions
// Complete types for all 109 endpoints
// Based on verified API responses from financial_REST_API.md
// Sprint 1a: Enums, Categories, Entries, Receipts, Payment Methods, Suppliers, Products
// Sprint 1b will ADD: Recurring Rules, Milestones, Invoices, Summary, Dashboard, Exports

// ========== ENUM TYPES ==========

// API Section 4: payment_method
export type PaymentMethodType = 'cash' | 'check' | 'bank_transfer' | 'venmo' | 'zelle' | 'credit_card' | 'debit_card' | 'ACH';

// API Section 4: financial_category_type (12 values)
export type CategoryType = 'labor' | 'material' | 'subcontractor' | 'equipment' | 'insurance' | 'fuel' | 'utilities' | 'office' | 'marketing' | 'taxes' | 'tools' | 'other';

// API Section 4: financial_category_classification
export type CategoryClassification = 'cost_of_goods_sold' | 'operating_expense';

// API Section 4: financial_entry_type
export type EntryType = 'expense' | 'income';

// API Section 4: expense_submission_status
export type SubmissionStatus = 'pending_review' | 'confirmed' | 'denied';

// API Section 4: recurring_frequency
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

// API Section 4: recurring_rule_status
export type RecurringRuleStatus = 'active' | 'paused' | 'completed' | 'cancelled';

// API Section 4: receipt
export type OcrStatus = 'not_processed' | 'processing' | 'complete' | 'failed';
export type ReceiptFileType = 'photo' | 'pdf';

// API Section 4: milestone
export type MilestoneStatus = 'pending' | 'invoiced' | 'paid';
export type DrawCalculationType = 'percentage' | 'fixed_amount';

// API Section 4: invoice_status_extended
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'voided';

// API Section 4: subcontractor_invoice_status
export type SubcontractorInvoiceStatus = 'pending' | 'approved' | 'paid';

// API Section 4: export_type
export type ExportType = 'quickbooks_expenses' | 'quickbooks_invoices' | 'xero_expenses' | 'xero_invoices' | 'pl_csv' | 'entries_csv';

// API Section 4: accounting_platform
export type AccountingPlatform = 'quickbooks' | 'xero';

// Dashboard alert types (API Section 21.7)
export type AlertType = 'cost_overrun' | 'overdue_invoice' | 'upcoming_obligation' | 'budget_warning';
export type AlertSeverity = 'info' | 'warning' | 'error';

// ========== BACKWARD COMPATIBILITY ==========

/** @deprecated Use PaymentMethodType instead — now includes all 8 values */
export type PaymentMethod = PaymentMethodType;

// ========== SHARED TYPES ==========

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages?: number;  // Used by: entries, pending, recurring rules, export history, project receipts
    pages?: number;        // Used by: suppliers, receipts, crew hours, crew payments, sub invoices, sub payments
    totalPages?: number;   // Used by: project invoices (camelCase!)
  };
}

// Helper to get page count from any meta format the API returns
export function getPageCount(meta: PaginatedResponse<unknown>['meta']): number {
  return meta.total_pages ?? meta.pages ?? meta.totalPages ?? 1;
}

// ========== FINANCIAL CATEGORIES (API Section 5) ==========
// Verified against: GET /api/v1/settings/financial-categories

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
  classification?: CategoryClassification; // BLOCKED for system defaults by backend
  is_active?: boolean;
}

// ========== FINANCIAL ENTRIES — RAW (API Section 16: Task-Level Costs) ==========
// Verified against: GET /api/v1/projects/:id/tasks/:id/costs
// Raw Prisma entries WITHOUT enriched name fields. Has nested `category` object.

export interface RawFinancialEntry {
  id: string;
  tenant_id: string;
  project_id: string | null;
  task_id: string | null;
  category_id: string;
  entry_type: EntryType;
  amount: string;                                      // String from API — parseFloat() needed
  tax_amount: string | null;                           // String from API
  discount: string | null;                             // String from API
  entry_date: string;
  entry_time: string | null;
  vendor_name: string | null;
  supplier_id: string | null;
  payment_method: PaymentMethodType | null;
  payment_method_registry_id: string | null;
  purchased_by_user_id: string | null;
  purchased_by_crew_member_id: string | null;
  crew_member_id: string | null;                       // Raw-only field
  subcontractor_id: string | null;                     // Raw-only field
  updated_by_user_id: string | null;                   // Raw-only field
  submission_status: SubmissionStatus;
  rejection_reason: string | null;
  rejected_by_user_id: string | null;
  rejected_at: string | null;
  is_recurring_instance: boolean;
  recurring_rule_id: string | null;
  has_receipt: boolean;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  category: {                                          // Nested object (not flattened)
    id: string;
    name: string;
    type: CategoryType;
  };
}

// ========== FINANCIAL ENTRIES — ENRICHED (API Section 6) ==========
// Verified against: GET /api/v1/financial/entries
// CRITICAL: This is the ENRICHED response (38 fields). amount is string, category is flattened.

export interface FinancialEntry {
  id: string;
  tenant_id: string;
  project_id: string | null;
  project_name: string | null;                        // Enriched from project relation
  task_id: string | null;
  task_title: string | null;                           // Enriched from task relation
  category_id: string;
  category_name: string;                               // Enriched — flattened from category
  category_type: CategoryType;                         // Enriched — flattened from category
  category_classification: CategoryClassification;     // Enriched — flattened from category
  entry_type: EntryType;
  amount: string;                                      // String from API — parseFloat() needed
  tax_amount: string | null;                           // String from API — parseFloat() needed
  entry_date: string;
  entry_time: string | null;
  vendor_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;                        // Enriched from supplier relation
  payment_method: PaymentMethodType | null;
  payment_method_registry_id: string | null;
  payment_method_nickname: string | null;              // Enriched from payment method relation
  purchased_by_user_id: string | null;
  purchased_by_user_name: string | null;               // Enriched from user relation
  purchased_by_crew_member_id: string | null;
  purchased_by_crew_member_name: string | null;        // Enriched from crew member relation
  submission_status: SubmissionStatus;
  rejection_reason: string | null;
  rejected_by_user_id: string | null;
  rejected_by_name: string | null;                     // Enriched from user relation
  rejected_at: string | null;
  is_recurring_instance: boolean;
  recurring_rule_id: string | null;
  has_receipt: boolean;
  discount: string | null;                               // String from API — parseFloat() needed
  notes: string | null;
  created_by_user_id: string;
  created_by_name: string;                             // Enriched from user relation
  created_at: string;
  updated_at: string;
  line_items: LineItem[];                                // Array of line items ordered by order_index
  has_line_items: boolean;                               // Convenience flag
  items_subtotal: number;                                // Computed sum of all line item totals
}

// Entry list response includes summary alongside pagination
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
  discount?: number;
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

// Task-level cost creation — entry_type, project_id, task_id are auto-filled from URL
export type CreateTaskCostDto = Omit<CreateFinancialEntryDto, 'entry_type' | 'project_id' | 'task_id'>;

export interface UpdateFinancialEntryDto {
  category_id?: string;
  entry_type?: EntryType;
  amount?: number;
  tax_amount?: number;
  discount?: number;
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

// 20+ filter fields for the entries list endpoint
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

// ========== LINE ITEMS (API Section 6.12) ==========
// Verified against: POST/GET/PATCH/DELETE /api/v1/financial/entries/:entryId/line-items
// quantity, unit_price, total returned as strings from API — parseFloat() needed

export interface LineItem {
  id: string;
  tenant_id?: string;                                    // Present in full response, not in entry.line_items[]
  financial_entry_id?: string;                           // Present in full response, not in entry.line_items[]
  description: string;
  quantity: string;                                      // String from API — parseFloat() needed
  unit_price: string;                                    // String from API — parseFloat() needed
  total: string;                                         // Computed: quantity × unit_price, string from API
  unit_of_measure: string | null;
  supplier_product_id: string | null;
  supplier_product?: {                                   // Included in list response if linked
    id: string;
    name: string;
    sku: string;
  } | null;
  order_index: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateLineItemDto {
  description: string;
  quantity: number;
  unit_price: number;
  unit_of_measure?: string;
  supplier_product_id?: string;
  order_index?: number;
  notes?: string;
}

export interface UpdateLineItemDto {
  description?: string;
  quantity?: number;
  unit_price?: number;
  unit_of_measure?: string;
  supplier_product_id?: string | null;
  order_index?: number;
  notes?: string;
}

// Approval queue filters (API Section 6.7)
export interface ListPendingEntriesParams {
  page?: number;
  limit?: number;
  submitted_by_user_id?: string;
  date_from?: string;
  date_to?: string;
}

// Approve/Reject DTOs (API Sections 6.8–6.9)
export interface ApproveEntryDto {
  notes?: string;
}

export interface RejectEntryDto {
  rejection_reason: string;
}

// ========== RECEIPTS & OCR (API Section 7) ==========
// Verified against: GET /api/v1/financial/receipts?project_id=...

export interface Receipt {
  id: string;
  tenant_id: string;
  financial_entry_id: string | null;
  project_id: string | null;
  task_id: string | null;
  file_id: string;
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
  ocr_tax: number | null;                             // AI-parsed tax amount
  ocr_discount: number | null;                        // AI-parsed discount/savings
  ocr_subtotal: number | null;                        // AI-parsed subtotal before tax/discount
  ocr_time: string | null;                            // AI-parsed time of purchase (HH:MM)
  ocr_entry_type: 'expense' | 'refund' | null;        // AI-parsed: expense or refund
  ocr_line_items: OcrLineItem[] | null;               // AI-parsed itemized products
  ocr_notes: string | null;                           // AI-parsed payment info, change due, etc.
  is_categorized: boolean;
  uploaded_by_user_id: string;
  uploaded_by?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface OcrLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// OCR polling response (API Section 7.4)
// Note: The polling endpoint returns a MINIMAL shape. For full OCR data
// (line items, tax, discount, notes, etc.), fetch the full receipt after OCR completes.
export interface OcrStatusResponse {
  receipt_id: string;
  ocr_status: OcrStatus;
  ocr_vendor: string | null;
  ocr_amount: number | null;
  ocr_date: string | null;
  has_suggestions: boolean;
}

// Create entry from receipt OCR results (API Section 7.5)
export interface CreateEntryFromReceiptDto {
  project_id?: string;                         // Optional — omit for business-level overhead expenses
  category_id: string;                         // REQUIRED
  task_id?: string;
  amount?: number;
  tax_amount?: number;
  discount?: number;                           // Falls back to ocr_discount if omitted
  entry_date?: string;
  entry_time?: string;
  vendor_name?: string;
  supplier_id?: string;
  payment_method?: PaymentMethodType;
  payment_method_registry_id?: string;
  purchased_by_user_id?: string;
  purchased_by_crew_member_id?: string;
  crew_member_id?: string;                     // Legacy field
  subcontractor_id?: string;
  submission_status?: SubmissionStatus;
  notes?: string;
  // NOTE: entry_type is NOT in this DTO — backend auto-resolves from ocr_entry_type
  // ('refund' → 'income', 'expense' → 'expense')
}

// Composite response from create-entry-from-receipt
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
  page?: number;
  limit?: number;
}

// ========== PAYMENT METHOD REGISTRY (API Section 8) ==========
// Verified against: GET /api/v1/financial/payment-methods
// Response is a FLAT ARRAY (not paginated)

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
  usage_count: number;                         // Enriched — computed from entries
  last_used_date: string | null;               // Enriched — computed from entries
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

// ========== SUPPLIER CATEGORIES (API Section 10) ==========
// Verified against: GET /api/v1/financial/supplier-categories
// Response is a FLAT ARRAY (not paginated)

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
  supplier_count: number;                      // Enriched — computed
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

// ========== SUPPLIERS (API Section 9) ==========
// Verified against: GET /api/v1/financial/suppliers and GET /api/v1/financial/suppliers/:id

// Reference shape for categories embedded in supplier responses
export interface SupplierCategoryRef {
  id: string;
  name: string;
  color?: string | null; // API returns color in category refs (not documented but verified)
}

// Lightweight list item from GET /api/v1/financial/suppliers
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
  total_spend: string;                         // String from API — parseFloat() needed
  last_purchase_date: string | null;
  categories: SupplierCategoryRef[];
  product_count: number;
  created_at: string;
}

// Full detail from GET /api/v1/financial/suppliers/:id
// Detail response does not include product_count (use products.length instead)
export interface Supplier extends Omit<SupplierListItem, 'product_count'> {
  tenant_id: string;
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
  created_by: {
    id: string;
    first_name: string;
    last_name: string;
  };
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

export interface UpdateSupplierDto {
  name?: string;
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
  is_active?: boolean;
  category_ids?: string[];
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

// Supplier statistics (API Section 9.7)
export interface SupplierSpendByCategory {
  category_name: string;
  category_type: string;
  total: number;
  entry_count: number;
}

export interface SupplierSpendByMonth {
  year: number;
  month: number;
  month_label: string;
  total: number;
}

export interface SupplierStatistics {
  supplier_id: string;
  total_spend: number;
  transaction_count: number;
  last_purchase_date: string | null;
  first_purchase_date: string | null;
  spend_by_category: SupplierSpendByCategory[];
  spend_by_month: SupplierSpendByMonth[];
}

// Supplier map data (API Section 9.6)
export interface SupplierMapItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  is_preferred: boolean;
  total_spend: string;                         // String — parseFloat() needed
}

// ========== SUPPLIER PRODUCTS (API Section 11) ==========
// Verified against API docs — response is FLAT ARRAY (not paginated), ordered by name
// unit_price is a STRING (decimal) — parseFloat() needed

export interface SupplierProduct {
  id: string;
  tenant_id: string;
  supplier_id: string;
  name: string;
  description: string | null;
  unit_of_measure: string;
  unit_price: string;                          // String from API — parseFloat() needed
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

// Price history (API Section 11.5) — previous_price and new_price are strings
export interface PriceHistoryEntry {
  id: string;
  previous_price: string | null;                // null for initial price entry
  new_price: string;                           // String from API — parseFloat() needed
  changed_by: {
    id: string;
    first_name: string;
    last_name: string;
  };
  changed_at: string;
  notes: string | null;
}

// ========== CREW HOURS (API Section 17) ==========
// Verified against API doc — hours_regular and hours_overtime are strings (decimal)

export interface CrewMemberRef {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ProjectRef {
  id: string;
  name: string;
  project_number: string;
}

export interface TaskRef {
  id: string;
  title: string;
}

export interface CrewHourLog {
  id: string;
  tenant_id: string;
  crew_member_id: string;
  project_id: string;
  task_id: string | null;
  log_date: string;
  hours_regular: string;                       // String from API — parseFloat() needed
  hours_overtime: string;                      // String from API — parseFloat() needed
  source: 'manual' | 'clockin_system';
  clockin_event_id: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  crew_member: CrewMemberRef;
  project: ProjectRef;
  task: TaskRef | null;
}

export interface CreateCrewHourDto {
  crew_member_id: string;
  project_id: string;
  task_id?: string;
  log_date: string;
  hours_regular: number;
  hours_overtime?: number;
  notes?: string;
}

export interface UpdateCrewHourDto {
  task_id?: string;
  log_date?: string;
  hours_regular?: number;
  hours_overtime?: number;
  notes?: string;
}

export interface CrewMemberHourSummary {
  crew_member_id: string;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_hours: number;
  logs_by_project: {
    project_id: string;
    project_name: string;
    regular_hours: number;
    overtime_hours: number;
    total_hours: number;
  }[];
}

// ========== CREW PAYMENTS (API Section 18) ==========

export interface CrewPayment {
  id: string;
  tenant_id: string;
  crew_member_id: string;
  project_id: string | null;
  amount: string;                              // String from API — parseFloat() needed
  payment_date: string;
  payment_method: PaymentMethodType;
  reference_number: string | null;
  period_start_date: string | null;
  period_end_date: string | null;
  hours_paid: string | null;                   // String from API — parseFloat() needed
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  crew_member: CrewMemberRef;
  project: ProjectRef | null;
}

export interface CreateCrewPaymentDto {
  crew_member_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethodType;
  project_id?: string;
  reference_number?: string;
  period_start_date?: string;
  period_end_date?: string;
  hours_paid?: number;
  notes?: string;
}

// ========== SUBCONTRACTOR PAYMENTS (API Section 20) ==========

export interface SubcontractorRef {
  id: string;
  business_name: string;
  trade_specialty: string;
}

export interface SubcontractorPayment {
  id: string;
  tenant_id: string;
  subcontractor_id: string;
  project_id: string | null;
  amount: string;                              // String from API — parseFloat() needed
  payment_date: string;
  payment_method: PaymentMethodType;
  reference_number: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  subcontractor: SubcontractorRef;
  project: ProjectRef | null;
}

export interface CreateSubcontractorPaymentDto {
  subcontractor_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethodType;
  project_id?: string;
  reference_number?: string;
  notes?: string;
}

// ========== SUBCONTRACTOR INVOICES (API Section 19) ==========

export interface SubcontractorInvoice {
  id: string;
  tenant_id: string;
  subcontractor_id: string;
  task_id: string;
  project_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: string;                              // String from API — parseFloat() needed
  status: SubcontractorInvoiceStatus;
  notes: string | null;
  file_id: string | null;
  file_url: string | null;
  file_name: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  subcontractor: SubcontractorRef;
  task: TaskRef;
  project: ProjectRef;
}

export interface CreateSubcontractorInvoiceDto {
  subcontractor_id: string;
  task_id: string;
  project_id: string;
  amount: number;
  invoice_number?: string;
  invoice_date?: string;
  notes?: string;
}

export interface UpdateSubcontractorInvoiceDto {
  status?: SubcontractorInvoiceStatus;
  amount?: number;
  notes?: string;
}

// ========== SUBCONTRACTOR PAYMENT SUMMARY (API Section 20.4) ==========

export interface SubcontractorPaymentSummary {
  subcontractor_id: string;
  total_invoiced: number;
  total_paid: number;
  total_pending: number;
  total_approved: number;
  invoices_count: number;
  payments_count: number;
}

// ========== CREW MEMBER (for autocomplete) ==========

export interface CrewMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  default_hourly_rate: number | null;
  is_active: boolean;
}

// ========== SUBCONTRACTOR (for autocomplete) ==========

export interface Subcontractor {
  id: string;
  business_name: string;
  trade_specialty: string | null;
  email: string | null;
  is_active: boolean;
}

// ========== END OF SPRINT 1a ==========

// ========== RECURRING EXPENSE RULES (API Section 12) ==========
// Verified against: GET /api/v1/financial/recurring-rules
// amount is a STRING (decimal) — parseFloat() needed

// Nested reference shapes used in recurring rule responses
export interface RecurringRuleCategoryRef {
  id: string;
  name: string;
  type: CategoryType;
}

export interface RecurringRuleSupplierRef {
  id: string;
  name: string;
}

export interface RecurringRulePaymentMethodRef {
  id: string;
  nickname: string;
  type: PaymentMethodType;
}

// Base recurring rule from list endpoint (30 fields)
export interface RecurringRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category_id: string;
  amount: string;                                    // String from API — parseFloat() needed
  tax_amount: string | null;                         // String from API — parseFloat() needed
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
  category: RecurringRuleCategoryRef;
  supplier: RecurringRuleSupplierRef | null;
  payment_method: RecurringRulePaymentMethodRef | null;
}

// Detail view from GET /api/v1/financial/recurring-rules/:id — adds computed fields
export interface RecurringRuleDetail extends RecurringRule {
  last_generated_entry: {
    id: string;
    amount: string;
    entry_date: string;
    submission_status: SubmissionStatus;
  } | null;
  next_occurrence_preview: string[];                 // Array of ISO date strings
}

// List response includes summary alongside pagination
export interface RecurringRuleListResponse extends PaginatedResponse<RecurringRule> {
  summary: {
    total_active_rules: number;
    monthly_obligation: number;
  };
}

// Create DTO — 17 fields, 5 required
export interface CreateRecurringRuleDto {
  name: string;                                      // REQUIRED — max 200 chars
  category_id: string;                               // REQUIRED — must exist and be active
  amount: number;                                    // REQUIRED — min 0.01, max 2 decimal places
  frequency: RecurringFrequency;                     // REQUIRED
  start_date: string;                                // REQUIRED — ISO 8601, must be >= today
  description?: string;
  tax_amount?: number;                               // Min 0, must be < amount
  supplier_id?: string;
  vendor_name?: string;                              // Max 200 chars
  payment_method_registry_id?: string;
  interval?: number;                                 // 1-12, default: 1
  day_of_month?: number;                             // 1-28
  day_of_week?: number;                              // 0-6 (Sun=0, Sat=6)
  end_date?: string;                                 // ISO 8601, must be > start_date
  recurrence_count?: number;                         // Min 1
  auto_confirm?: boolean;                            // Default: true
  notes?: string;
}

// Update DTO — all optional, start_date CANNOT be changed (omitted)
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
  next_due_date?: string;                              // YYYY-MM-DD — override to correct schedule after manual trigger or deleted entry
}

// Filter params for recurring rules list
export interface ListRecurringRulesParams {
  page?: number;
  limit?: number;
  status?: RecurringRuleStatus;
  category_id?: string;
  frequency?: RecurringFrequency;
  sort_by?: 'next_due_date' | 'amount' | 'name' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

// Skip next occurrence DTO
export interface SkipRuleDto {
  reason?: string;                                   // Max 500 chars
}

// Preview upcoming obligations — SEPARATE endpoint from list
// GET /api/v1/financial/recurring-rules/preview?days=30|60|90
export interface RecurringPreviewOccurrence {
  rule_id: string;
  rule_name: string;
  amount: number;
  tax_amount: number | null;
  category_name: string;
  due_date: string;
  frequency: RecurringFrequency;
  supplier_name: string | null;
  payment_method_nickname: string | null;
}

export interface RecurringPreviewResponse {
  period_days: number;
  total_obligations: number;
  occurrences: RecurringPreviewOccurrence[];
}

// ========== DRAW MILESTONES (API Section 13) ==========
// Verified against: GET /api/v1/projects/:projectId/milestones (2026-03-29)
// Response is a FLAT ARRAY (not paginated), ordered by draw_number
// NOTE: API docs say value/calculated_amount are strings, but actual response returns numbers. Types reflect actual API behavior.
// List endpoint returns slimmed shape (no tenant_id/project_id/quote_draw_entry_id/created_by_user_id/updated_at)
// but includes invoice_number. Create/Update returns full shape without invoice_number.

export interface DrawMilestone {
  id: string;
  tenant_id?: string;                                // Only in create/update response
  project_id?: string;                               // Only in create/update response
  quote_draw_entry_id?: string | null;               // null if manually created; only in create/update
  draw_number: number;
  description: string;
  calculation_type: DrawCalculationType;
  value: number;                                     // Number from API (docs say string, actual is number)
  calculated_amount: number;                         // Number from API (docs say string, actual is number)
  status: MilestoneStatus;
  invoice_id: string | null;
  invoice_number?: string | null;                    // Only in list response
  invoiced_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_by_user_id?: string;                       // Only in create/update response
  created_at: string;
  updated_at?: string;                               // Only in create/update response
}

// Create DTO — draw_number, description, calculation_type, value required
export interface CreateMilestoneDto {
  draw_number: number;                               // Integer, min 1, unique per project
  description: string;                               // 1-255 chars
  calculation_type: DrawCalculationType;
  value: number;                                     // Min 0.01, max 2 decimals (max 100 for percentage)
  calculated_amount?: number;                        // Override computed amount
  notes?: string;                                    // Max 5000 chars
}

// Update DTO — BLOCKED if status is "invoiced" or "paid" for calculated_amount
export interface UpdateMilestoneDto {
  description?: string;                              // Max 255 chars
  calculated_amount?: number;                        // BLOCKED if status invoiced/paid
  notes?: string;                                    // Max 5000 chars
}

// Generate invoice from milestone
export interface GenerateMilestoneInvoiceDto {
  description?: string;                              // Max 500 chars — overrides milestone description
  due_date?: string;                                 // ISO 8601
  tax_amount?: number;                               // Min 0
  notes?: string;                                    // Max 5000 chars
}

// ========== PROJECT INVOICES (API Section 14) ==========
// Verified against: GET /api/v1/projects/:projectId/invoices
// CRITICAL: Pagination uses `totalPages` (camelCase), NOT `total_pages`
// amounts are STRINGS (decimal) — parseFloat() needed

export interface ProjectInvoiceMilestoneRef {
  id: string;
  draw_number: number;
  description: string;
}

export interface ProjectInvoice {
  id: string;
  tenant_id: string;
  project_id: string;
  invoice_number: string;                            // Auto-generated (e.g., "INV-0001")
  milestone_id: string | null;
  description: string;
  amount: string;                                    // String from API — parseFloat() needed
  tax_amount: string | null;                         // String from API — parseFloat() needed
  amount_paid: string;                               // String from API — parseFloat() needed
  amount_due: string;                                // String from API — parseFloat() needed
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
  milestone: ProjectInvoiceMilestoneRef | null;
  payment_count: number;
}

// Create DTO — description and amount REQUIRED
export interface CreateProjectInvoiceDto {
  description: string;                               // 1-500 chars
  amount: number;                                    // Min 0.01, max 2 decimal places
  tax_amount?: number;                               // Min 0, max 2 decimal places
  due_date?: string;                                 // ISO 8601
  notes?: string;                                    // Max 5000 chars
}

// Update DTO — only works on "draft" status invoices
export interface UpdateProjectInvoiceDto {
  description?: string;                              // Max 500 chars
  amount?: number;                                   // Min 0.01
  tax_amount?: number;                               // Min 0
  due_date?: string;                                 // ISO 8601
  notes?: string;                                    // Max 5000 chars
}

// Void DTO — voided_reason REQUIRED (1-500 chars)
export interface VoidInvoiceDto {
  voided_reason: string;                             // 1-500 chars — REQUIRED
}

// Invoice payment record
export interface InvoicePayment {
  id: string;
  tenant_id: string;
  invoice_id: string;
  project_id: string;
  amount: string;                                    // String from API — parseFloat() needed
  payment_date: string;
  payment_method: PaymentMethodType;
  payment_method_registry_id: string | null;
  reference_number: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
}

// Record payment DTO — amount, payment_date, payment_method REQUIRED
export interface RecordInvoicePaymentDto {
  amount: number;                                    // Min 0.01, max 2 decimal places
  payment_date: string;                              // ISO 8601
  payment_method: PaymentMethodType;
  payment_method_registry_id?: string;
  reference_number?: string;                         // Max 200 chars
  notes?: string;                                    // Max 5000 chars
}

// Filter params for project invoices list
export interface ListProjectInvoicesParams {
  page?: number;
  limit?: number;
  status?: InvoiceStatus;
  date_from?: string;
  date_to?: string;
}

// ========== PROJECT FINANCIAL SUMMARY (API Section 15) ==========
// Verified against: GET /api/v1/projects/:projectId/financial/summary
// CRITICAL: All values are numbers (not strings) in summary responses
// TODO: API field mismatch — docs say 'revenue_summary', actual response uses 'revenue'. Update docs.
// TODO: API field mismatch — docs say 'categorized'/'uncategorized', actual uses 'categorized_receipts'/'uncategorized_receipts'. Update docs.
// TODO: API field mismatch — margin_analysis has different fields than docs. actual uses actual_cost_confirmed/actual_cost_total/cost_variance/billing_coverage. Update docs.

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
    categorized_receipts: number;                    // ACTUAL field name (docs say 'categorized')
    uncategorized_receipts: number;                  // ACTUAL field name (docs say 'uncategorized')
  };
  revenue: {                                         // ACTUAL field name (docs say 'revenue_summary')
    total_invoiced: number;
    total_collected: number;
    outstanding: number;
    invoice_count: number;
    paid_invoices: number;
    partial_invoices: number;
    draft_invoices: number;
  };
  margin_analysis: {
    contract_value: number | null;
    estimated_cost: number | null;
    actual_cost_confirmed: number;                   // ACTUAL field (docs say 'actual_cost')
    actual_cost_total: number;                       // ACTUAL field (not in docs)
    estimated_margin: number | null;                 // ACTUAL field (docs say 'budget_remaining')
    actual_margin: number | null;                    // ACTUAL field (docs say 'budget_used_percent')
    cost_variance: number;                           // ACTUAL field (not in docs)
    margin_percent: number | null;                   // ACTUAL field (docs say 'gross_margin_percent')
    gross_margin: number | null;
    billing_coverage: number | null;                 // ACTUAL field (not in docs)
  };
}

// Task breakdown — GET /api/v1/projects/:projectId/financial/tasks
export interface TaskBreakdownItem {
  task_id: string;
  task_title: string;
  task_status: string;
  task_order_index: number;
  expenses: {
    total: number;
    by_category: {
      category_name: string;
      category_type: CategoryType;
      classification: CategoryClassification;
      total: number;
    }[];
    entry_count: number;
  };
  subcontractor_invoices: {
    total_invoiced: number;
    invoice_count: number;
  };
  crew_hours: {
    total_regular_hours: number;
    total_overtime_hours: number;
    total_hours: number;
  };
}

export interface TaskBreakdownResponse {
  project_id: string;
  total_task_cost: number;
  tasks: TaskBreakdownItem[];
}

// Timeline (monthly cost trend) — GET /api/v1/projects/:projectId/financial/timeline
export interface TimelineMonth {
  year: number;
  month: number;
  month_label: string;
  total_expenses: number;
  by_category: {
    category_name: string;
    category_type: CategoryType;
    total: number;
  }[];
}

export interface TimelineResponse {
  project_id: string;
  months: TimelineMonth[];
  cumulative_total: number;
}

// Workforce summary — GET /api/v1/projects/:projectId/financial/workforce
export interface WorkforceCrewHourMember {
  crew_member_id: string;
  crew_member_name: string;
  regular_hours: number;
  overtime_hours: number;
  log_count: number;
  total_hours: number;
}

export interface WorkforceCrewPaymentMember {
  crew_member_id: string;
  crew_member_name: string;
  total_paid: number;
  payment_count: number;
  last_payment_date: string | null;
}

export interface WorkforceSubcontractorDetail {
  subcontractor_id: string;
  subcontractor_name: string;
  invoiced: number;
  paid: number;
  invoice_count: number;
  pending_invoices: number;
  approved_invoices: number;
  paid_invoices: number;
  outstanding: number;
}

export interface WorkforceResponse {
  project_id: string;
  crew_hours: {
    total_regular_hours: number;
    total_overtime_hours: number;
    total_hours: number;
    by_crew_member: WorkforceCrewHourMember[];
  };
  crew_payments: {
    total_paid: number;
    payment_count: number;
    by_crew_member: WorkforceCrewPaymentMember[];
  };
  subcontractor_invoices: {
    total_invoiced: number;
    total_paid: number;
    outstanding: number;
    by_subcontractor: WorkforceSubcontractorDetail[];
  };
}

// ========== FINANCIAL DASHBOARD (API Section 21) ==========
// Verified against: GET /api/v1/financial/dashboard/overview
// Dashboard overview returns ALL 5 sections in one API call

// --- P&L Types (Section 21.2) ---

export interface PLIncomeByProject {
  project_id: string;
  project_name: string;
  project_number: string;                             // Verified from actual API response
  collected: number;                                  // Verified: API returns 'collected' not 'total'
}

export interface PLExpenseByCategory {
  category_id: string;
  category_name: string;
  category_type: CategoryType;
  classification: CategoryClassification;
  total: number;
  entry_count: number;
}

export interface PLTopSupplier {
  supplier_id: string | null;
  supplier_name: string;
  total: number;
  entry_count: number;
}

export interface PLMonth {
  year: number;
  month: number;
  month_label: string;
  income: {
    total: number;
    invoice_count: number;
    by_project: PLIncomeByProject[];
  };
  expenses: {
    total: number;
    total_with_pending: number;
    total_tax_paid: number;
    by_classification: {
      cost_of_goods_sold: number;
      operating_expense: number;
    };
    by_category: PLExpenseByCategory[];
    top_suppliers: PLTopSupplier[];
  };
  gross_profit: number;
  operating_profit: number;
  net_profit: number;
  gross_margin_percent: number | null;
  tax: {
    tax_collected: number;
    tax_paid: number;
    net_tax_position: number;
  };
}

export interface PLTotals {
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
}

export interface PLSummary {
  year: number;
  period: string;                                    // "single_month" | "full_year" | etc.
  currency: string;                                  // "USD"
  months: PLMonth[];
  totals: PLTotals;
}

// --- AR Types (Section 21.4) ---

export interface ARInvoice {
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
    current: number;                                 // EXACT field name — do not rename
    days_1_30: number;                               // EXACT field name — do not rename
    days_31_60: number;                              // EXACT field name — do not rename
    days_61_90: number;                              // EXACT field name — do not rename
    days_over_90: number;                            // EXACT field name — do not rename
  };
  invoices: ARInvoice[];
}

// --- AP Types (Section 21.5) ---

export interface APSubcontractorDetail {
  subcontractor_id: string;
  subcontractor_name: string;
  total_pending: number;
  total_approved: number;
  outstanding: number;
  invoice_count: number;
}

export interface APRecurringUpcoming {
  rule_id: string;
  rule_name: string;
  amount: number;
  tax_amount?: number | null;
  category_name: string;
  due_date: string;
  frequency: RecurringFrequency;
  supplier_name: string | null;
  payment_method_nickname?: string | null;
  days_until_due?: number;
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
    by_subcontractor: APSubcontractorDetail[];
  };
  recurring_upcoming: APRecurringUpcoming[];
  crew_hours_summary: {
    note: string;                                    // Informational note about hourly rate requirement
    total_regular_hours_this_month: number;
    total_overtime_hours_this_month: number;
    crew_member_count: number;
  };
}

// --- Forecast Types (Section 21.6) ---

export interface ForecastInflowItem {
  source: string;                                    // "project_invoice"
  invoice_id: string;
  invoice_number: string;
  project_name: string;
  amount_due: number;
  due_date: string;
}

export interface ForecastOutflowItem {
  type: string;                                      // "recurring_expense" — TODO: API field mismatch — docs say 'source', actual response uses 'type'. Update docs.
  rule_id: string;
  rule_name: string;
  amount: number;
  due_date: string;
  days_until_due?: number;
  supplier_name?: string | null;
  category_name?: string | null;
}

export type NetForecastLabel = 'Positive' | 'Negative' | 'Breakeven';

export interface ForecastResponse {
  period_days: number;
  forecast_start: string;
  forecast_end: string;
  expected_inflows: {
    total: number;
    items: ForecastInflowItem[];
  };
  expected_outflows: {
    total: number;
    items: ForecastOutflowItem[];
  };
  net_forecast: number;
  net_forecast_label: NetForecastLabel;              // EXACTLY 'Positive' | 'Negative' | 'Breakeven'
}

// --- Alert Types (Section 21.7) ---

export interface FinancialAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;                  // Generic object — structure varies by alert type
}

export interface AlertsResponse {
  alert_count: number;
  alerts: FinancialAlert[];
}

// --- Dashboard Overview (All-in-One) ---

export interface DashboardOverview {
  pl_summary: PLSummary;
  ar_summary: ARSummary;
  ap_summary: APSummary;
  forecast: ForecastResponse;
  alerts: FinancialAlert[];
  generated_at: string;
}

// --- Dashboard Param Interfaces ---

export interface DashboardOverviewParams {
  forecast_days?: number;                            // 30, 60, or 90
}

export interface DashboardPLParams {
  year: number;                                      // REQUIRED — 2020-2100
  month?: number;                                    // 1-12, omit for full year
  include_pending?: boolean;                         // Default: false
}

export interface DashboardARParams {
  status?: InvoiceStatus;
  overdue_only?: boolean;
}

export interface DashboardAPParams {
  days_ahead?: number;                               // 1-365, default: 30
}

export interface DashboardForecastParams {
  days: number;                                      // REQUIRED — 30, 60, or 90
}

// ========== ACCOUNT MAPPINGS & EXPORTS (API Sections 22-23) ==========
// Verified against live endpoints

// Account mapping — maps Lead360 categories to accounting software accounts
// GET /api/v1/financial/export/account-mappings — returns FLAT ARRAY (not paginated)
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
  category: {
    id: string;
    name: string;
    type: CategoryType;
  };
}

// Default mapping preview — what account name will be used per category
// GET /api/v1/financial/export/account-mappings/defaults?platform=quickbooks
export interface DefaultMapping {
  category_id: string;
  category_name: string;
  category_type: CategoryType;
  classification: CategoryClassification;
  has_custom_mapping: boolean;
  account_name: string;
  account_code: string | null;
}

// Create/update mapping DTO — this is an UPSERT (creates or updates per category+platform)
export interface CreateAccountMappingDto {
  category_id: string;                               // REQUIRED — must exist
  platform: AccountingPlatform;                      // REQUIRED — "quickbooks" or "xero"
  account_name: string;                              // REQUIRED — max 200 chars
  account_code?: string;                             // Max 50 chars
}

// Export history item
export interface ExportHistoryItem {
  id: string;
  export_type: ExportType;
  date_from: string;
  date_to: string;
  record_count: number;
  file_name: string;
  filters_applied: Record<string, unknown>;          // Structure varies by export type
  exported_by_user_id: string;
  created_at: string;
  exported_by: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// Quality report issue item
export interface QualityReportIssue {
  severity: AlertSeverity;                           // "error" | "warning" | "info"
  check_type: string;                                // e.g. "missing_vendor", "no_account_mapping", "missing_payment_method"
  entry_id: string;
  entry_date: string;
  amount: number;
  category_name: string;
  supplier_name: string | null;
  message: string;
}

// Quality report response
// TODO: API field mismatch — docs don't mention 'total_issues' or 'export_readiness', but actual response includes them. Update docs.
export interface QualityReportResponse {
  total_entries_checked: number;
  total_issues: number;                              // ACTUAL field (not in sprint docs)
  errors: number;
  warnings: number;
  infos: number;
  issues: QualityReportIssue[];
  export_readiness: Record<string, string>;          // ACTUAL field — e.g. { quickbooks: "warnings_present", xero: "warnings_present" }
}

// Export expense params — date_from and date_to REQUIRED
export interface ExportExpenseParams {
  date_from: string;                                 // REQUIRED — ISO 8601
  date_to: string;                                   // REQUIRED — ISO 8601
  category_id?: string;
  classification?: CategoryClassification;
  project_id?: string;
  include_recurring?: boolean;                       // Default: false
  include_pending?: boolean;                         // Default: false
}

// Export invoice params — date_from and date_to REQUIRED
export interface ExportInvoiceParams {
  date_from: string;                                 // REQUIRED — ISO 8601
  date_to: string;                                   // REQUIRED — ISO 8601
  status?: Exclude<InvoiceStatus, 'voided'>;         // Voided never included in exports
}

// Export history list params
export interface ExportHistoryParams {
  export_type?: ExportType;
  page?: number;
  limit?: number;
}

// Quality report params — all optional
export interface QualityReportParams {
  date_from?: string;
  date_to?: string;
  platform?: AccountingPlatform;
}

// Resubmit DTO — same shape as Update (API Section 6.10: "Same fields as Update 6.5")
export type ResubmitEntryDto = UpdateFinancialEntryDto;

// ========== END OF SPRINT 1b ==========
