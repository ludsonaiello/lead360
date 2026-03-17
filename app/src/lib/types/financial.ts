// Lead360 - Financial Module Type Definitions
// Based on verified API responses from:
//   - financial_gate1_REST_API.md
//   - receipt_REST_API.md
//   - financial_gate3_REST_API.md
//   - task_financial_REST_API.md
//   - task_crew_hours_REST_API.md

// ========== FINANCIAL CATEGORIES ==========

export type CategoryType = 'labor' | 'material' | 'subcontractor' | 'equipment' | 'other';

export interface FinancialCategory {
  id: string;
  tenant_id: string;
  name: string;
  type: CategoryType;
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
  description?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
}

// ========== FINANCIAL ENTRIES ==========

export interface FinancialEntryCategory {
  id: string;
  name: string;
  type: CategoryType;
}

export interface FinancialEntry {
  id: string;
  tenant_id: string;
  project_id: string;
  task_id: string | null;
  category_id: string;
  category: FinancialEntryCategory;
  entry_type: 'expense';
  amount: number | string;
  entry_date: string;
  vendor_name: string | null;
  crew_member_id: string | null;
  subcontractor_id: string | null;
  notes: string | null;
  has_receipt: boolean;
  created_by_user_id: string;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFinancialEntryDto {
  project_id: string;
  task_id?: string | null;
  category_id: string;
  amount: number;
  entry_date: string;
  vendor_name?: string;
  crew_member_id?: string | null;
  subcontractor_id?: string | null;
  notes?: string;
}

export interface UpdateFinancialEntryDto {
  task_id?: string | null;
  category_id?: string;
  amount?: number;
  entry_date?: string;
  vendor_name?: string;
  crew_member_id?: string | null;
  subcontractor_id?: string | null;
  notes?: string;
}

export interface ListFinancialEntriesParams {
  project_id: string;
  task_id?: string;
  category_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// ========== RECEIPTS ==========

export type OcrStatus = 'not_processed' | 'processing' | 'complete' | 'failed';
export type ReceiptFileType = 'photo' | 'pdf';

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
  is_categorized: boolean;
  uploaded_by_user_id: string;
  created_at: string;
  updated_at: string;
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

// ========== CREW HOURS ==========

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
  hours_regular: string;
  hours_overtime: string;
  source: 'manual' | 'time_clock';
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

// ========== CREW PAYMENTS ==========

export type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'venmo' | 'zelle';

export interface CrewPayment {
  id: string;
  tenant_id: string;
  crew_member_id: string;
  project_id: string | null;
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  period_start_date: string | null;
  period_end_date: string | null;
  hours_paid: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  crew_member: CrewMemberRef;
  project: ProjectRef | null;
}

export interface CreateCrewPaymentDto {
  crew_member_id: string;
  project_id?: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  period_start_date?: string;
  period_end_date?: string;
  hours_paid?: number;
  notes?: string;
}

// ========== SUBCONTRACTOR PAYMENTS ==========

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
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  subcontractor: SubcontractorRef;
  project: ProjectRef | null;
}

export interface CreateSubcontractorPaymentDto {
  subcontractor_id: string;
  project_id?: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
}

// ========== SUBCONTRACTOR INVOICES ==========

export type InvoiceStatus = 'pending' | 'approved' | 'paid';

export interface SubcontractorInvoice {
  id: string;
  tenant_id: string;
  subcontractor_id: string;
  task_id: string;
  project_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: string;
  status: InvoiceStatus;
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
  status?: InvoiceStatus;
  amount?: number;
  notes?: string;
}

// ========== SUBCONTRACTOR PAYMENT SUMMARY ==========

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
