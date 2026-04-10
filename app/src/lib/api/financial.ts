// Lead360 - Financial Module API Client
// Complete coverage: 109 endpoints across 17 sections
// All types from @/lib/types/financial (Sprint 1a + 1b)

import { apiClient } from './axios';
import type {
  // Categories
  FinancialCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
  // Raw entries (task-level)
  RawFinancialEntry,
  CreateTaskCostDto,
  // Entries
  FinancialEntry,
  FinancialEntryListResponse,
  CreateFinancialEntryDto,
  UpdateFinancialEntryDto,
  ListFinancialEntriesParams,
  ListPendingEntriesParams,
  ApproveEntryDto,
  RejectEntryDto,
  ResubmitEntryDto,
  // Line Items
  LineItem,
  CreateLineItemDto,
  UpdateLineItemDto,
  // Receipts & OCR
  Receipt,
  ListReceiptsParams,
  OcrStatusResponse,
  CreateEntryFromReceiptDto,
  CreateEntryFromReceiptResponse,
  UpdateReceiptDto,
  LinkReceiptDto,
  // Payment Methods
  PaymentMethodRegistry,
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  ListPaymentMethodsParams,
  // Supplier Categories
  SupplierCategory,
  CreateSupplierCategoryDto,
  UpdateSupplierCategoryDto,
  // Suppliers
  Supplier,
  SupplierListItem,
  CreateSupplierDto,
  UpdateSupplierDto,
  ListSuppliersParams,
  SupplierMapItem,
  SupplierStatistics,
  // Supplier Products
  SupplierProduct,
  CreateSupplierProductDto,
  UpdateSupplierProductDto,
  PriceHistoryEntry,
  // Recurring Rules
  RecurringRule,
  RecurringRuleDetail,
  RecurringRuleListResponse,
  CreateRecurringRuleDto,
  UpdateRecurringRuleDto,
  ListRecurringRulesParams,
  SkipRuleDto,
  RecurringPreviewResponse,
  // Draw Milestones
  DrawMilestone,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  GenerateMilestoneInvoiceDto,
  // Project Invoices
  ProjectInvoice,
  CreateProjectInvoiceDto,
  UpdateProjectInvoiceDto,
  VoidInvoiceDto,
  InvoicePayment,
  RecordInvoicePaymentDto,
  ListProjectInvoicesParams,
  // Project Financial Summary
  ProjectFinancialSummary,
  TaskBreakdownResponse,
  TimelineResponse,
  WorkforceResponse,
  // Crew
  CrewHourLog,
  CreateCrewHourDto,
  UpdateCrewHourDto,
  CrewPayment,
  CreateCrewPaymentDto,
  UpdateCrewPaymentDto,
  // Subcontractors
  SubcontractorInvoice,
  TaskSubcontractorInvoice,
  CreateSubcontractorInvoiceDto,
  UpdateSubcontractorInvoiceDto,
  SubcontractorPayment,
  CreateSubcontractorPaymentDto,
  UpdateSubcontractorPaymentDto,
  SubcontractorPaymentSummary,
  // Dashboard
  DashboardOverview,
  DashboardPLParams,
  PLSummary,
  DashboardARParams,
  ARSummary,
  DashboardAPParams,
  APSummary,
  DashboardForecastParams,
  ForecastResponse,
  AlertsResponse,
  // Account Mappings & Exports
  AccountingPlatform,
  AccountMapping,
  DefaultMapping,
  CreateAccountMappingDto,
  ExportExpenseParams,
  ExportInvoiceParams,
  QualityReportParams,
  QualityReportResponse,
  ExportHistoryParams,
  ExportHistoryItem,
  // Shared
  PaginatedResponse,
} from '@/lib/types/financial';

// ========== FINANCIAL CATEGORIES (4 endpoints) ==========
// API paths: /settings/financial-categories

export const getFinancialCategories = async (params?: { include_inactive?: boolean }): Promise<FinancialCategory[]> => {
  const { data } = await apiClient.get<FinancialCategory[]>('/settings/financial-categories', {
    params: params?.include_inactive ? { include_inactive: 'true' } : undefined,
  });
  return data;
};

export const createFinancialCategory = async (dto: CreateCategoryDto): Promise<FinancialCategory> => {
  const { data } = await apiClient.post<FinancialCategory>('/settings/financial-categories', dto);
  return data;
};

export const updateFinancialCategory = async (id: string, dto: UpdateCategoryDto): Promise<FinancialCategory> => {
  const { data } = await apiClient.patch<FinancialCategory>(`/settings/financial-categories/${id}`, dto);
  return data;
};

export const deleteFinancialCategory = async (id: string): Promise<FinancialCategory> => {
  const { data } = await apiClient.delete<FinancialCategory>(`/settings/financial-categories/${id}`);
  return data;
};

// ========== FINANCIAL ENTRIES (10 endpoints) ==========
// API paths: /financial/entries, /financial/entries/pending, /financial/entries/export, /financial/entries/:id/*

export const getFinancialEntries = async (params: ListFinancialEntriesParams): Promise<FinancialEntryListResponse> => {
  const queryParams: Record<string, string | number | boolean> = {};
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.task_id) queryParams.task_id = params.task_id;
  if (params.category_id) queryParams.category_id = params.category_id;
  if (params.category_type) queryParams.category_type = params.category_type;
  if (params.classification) queryParams.classification = params.classification;
  if (params.entry_type) queryParams.entry_type = params.entry_type;
  if (params.supplier_id) queryParams.supplier_id = params.supplier_id;
  if (params.payment_method) queryParams.payment_method = params.payment_method;
  if (params.submission_status) queryParams.submission_status = params.submission_status;
  if (params.purchased_by_user_id) queryParams.purchased_by_user_id = params.purchased_by_user_id;
  if (params.purchased_by_crew_member_id) queryParams.purchased_by_crew_member_id = params.purchased_by_crew_member_id;
  if (params.date_from) queryParams.date_from = params.date_from;
  if (params.date_to) queryParams.date_to = params.date_to;
  if (params.has_receipt !== undefined) queryParams.has_receipt = params.has_receipt;
  if (params.is_recurring_instance !== undefined) queryParams.is_recurring_instance = params.is_recurring_instance;
  if (params.search) queryParams.search = params.search;
  if (params.sort_by) queryParams.sort_by = params.sort_by;
  if (params.sort_order) queryParams.sort_order = params.sort_order;

  const { data } = await apiClient.get<FinancialEntryListResponse>('/financial/entries', { params: queryParams });
  return data;
};

export const getFinancialEntry = async (id: string): Promise<FinancialEntry> => {
  const { data } = await apiClient.get<FinancialEntry>(`/financial/entries/${id}`);
  return data;
};

export const createFinancialEntry = async (dto: CreateFinancialEntryDto): Promise<FinancialEntry> => {
  const { data } = await apiClient.post<FinancialEntry>('/financial/entries', dto);
  return data;
};

export const updateFinancialEntry = async (id: string, dto: UpdateFinancialEntryDto): Promise<FinancialEntry> => {
  const { data } = await apiClient.patch<FinancialEntry>(`/financial/entries/${id}`, dto);
  return data;
};

export const deleteFinancialEntry = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/financial/entries/${id}`);
  return data;
};

export const getPendingEntries = async (params: ListPendingEntriesParams): Promise<FinancialEntryListResponse> => {
  const queryParams: Record<string, string | number> = {};
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;
  if (params.submitted_by_user_id) queryParams.submitted_by_user_id = params.submitted_by_user_id;
  if (params.date_from) queryParams.date_from = params.date_from;
  if (params.date_to) queryParams.date_to = params.date_to;

  const { data } = await apiClient.get<FinancialEntryListResponse>('/financial/entries/pending', { params: queryParams });
  return data;
};

export const approveEntry = async (id: string, dto?: ApproveEntryDto): Promise<FinancialEntry> => {
  const { data } = await apiClient.post<FinancialEntry>(`/financial/entries/${id}/approve`, dto || {});
  return data;
};

export const rejectEntry = async (id: string, dto: RejectEntryDto): Promise<FinancialEntry> => {
  const { data } = await apiClient.post<FinancialEntry>(`/financial/entries/${id}/reject`, dto);
  return data;
};

export const resubmitEntry = async (id: string, dto?: ResubmitEntryDto): Promise<FinancialEntry> => {
  const { data } = await apiClient.post<FinancialEntry>(`/financial/entries/${id}/resubmit`, dto || {});
  return data;
};

export const exportEntries = async (params: ListFinancialEntriesParams): Promise<Blob> => {
  const queryParams: Record<string, string | number | boolean> = {};
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.task_id) queryParams.task_id = params.task_id;
  if (params.category_id) queryParams.category_id = params.category_id;
  if (params.category_type) queryParams.category_type = params.category_type;
  if (params.classification) queryParams.classification = params.classification;
  if (params.entry_type) queryParams.entry_type = params.entry_type;
  if (params.supplier_id) queryParams.supplier_id = params.supplier_id;
  if (params.payment_method) queryParams.payment_method = params.payment_method;
  if (params.submission_status) queryParams.submission_status = params.submission_status;
  if (params.purchased_by_user_id) queryParams.purchased_by_user_id = params.purchased_by_user_id;
  if (params.purchased_by_crew_member_id) queryParams.purchased_by_crew_member_id = params.purchased_by_crew_member_id;
  if (params.date_from) queryParams.date_from = params.date_from;
  if (params.date_to) queryParams.date_to = params.date_to;
  if (params.has_receipt !== undefined) queryParams.has_receipt = params.has_receipt;
  if (params.is_recurring_instance !== undefined) queryParams.is_recurring_instance = params.is_recurring_instance;
  if (params.search) queryParams.search = params.search;
  if (params.sort_by) queryParams.sort_by = params.sort_by;
  if (params.sort_order) queryParams.sort_order = params.sort_order;

  const { data } = await apiClient.get('/financial/entries/export', {
    params: queryParams,
    responseType: 'blob',
  });
  return data;
};

// ========== LINE ITEMS (4 endpoints) ==========
// API paths: /financial/entries/:entryId/line-items

export const getLineItems = async (entryId: string): Promise<LineItem[]> => {
  const { data } = await apiClient.get<LineItem[]>(`/financial/entries/${entryId}/line-items`);
  return data;
};

export const createLineItem = async (entryId: string, dto: CreateLineItemDto): Promise<LineItem> => {
  const { data } = await apiClient.post<LineItem>(`/financial/entries/${entryId}/line-items`, dto);
  return data;
};

export const updateLineItem = async (entryId: string, itemId: string, dto: UpdateLineItemDto): Promise<LineItem> => {
  const { data } = await apiClient.patch<LineItem>(`/financial/entries/${entryId}/line-items/${itemId}`, dto);
  return data;
};

export const deleteLineItem = async (entryId: string, itemId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/financial/entries/${entryId}/line-items/${itemId}`);
  return data;
};

// ========== RECEIPTS & OCR (8 endpoints) ==========
// API paths: /financial/receipts, /financial/receipts/:id/*

export const uploadReceipt = async (formData: FormData): Promise<Receipt> => {
  const { data } = await apiClient.post<Receipt>('/financial/receipts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const getReceipts = async (params: ListReceiptsParams): Promise<PaginatedResponse<Receipt>> => {
  const queryParams: Record<string, string | number | boolean> = {};
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.task_id) queryParams.task_id = params.task_id;
  if (params.is_categorized !== undefined) queryParams.is_categorized = params.is_categorized;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<Receipt>>('/financial/receipts', { params: queryParams });
  return data;
};

export const getReceipt = async (id: string): Promise<Receipt> => {
  const { data } = await apiClient.get<Receipt>(`/financial/receipts/${id}`);
  return data;
};

export const getOcrStatus = async (id: string): Promise<OcrStatusResponse> => {
  const { data } = await apiClient.get<OcrStatusResponse>(`/financial/receipts/${id}/ocr-status`);
  return data;
};

export const createEntryFromReceipt = async (receiptId: string, dto: CreateEntryFromReceiptDto): Promise<CreateEntryFromReceiptResponse> => {
  const { data } = await apiClient.post<CreateEntryFromReceiptResponse>(`/financial/receipts/${receiptId}/create-entry`, dto);
  return data;
};

export const retryOcr = async (id: string): Promise<Receipt> => {
  const { data } = await apiClient.post<Receipt>(`/financial/receipts/${id}/retry-ocr`);
  return data;
};

export const linkReceiptToEntry = async (receiptId: string, dto: LinkReceiptDto): Promise<Receipt> => {
  const { data } = await apiClient.patch<Receipt>(`/financial/receipts/${receiptId}/link`, dto);
  return data;
};

export const updateReceipt = async (id: string, dto: UpdateReceiptDto): Promise<Receipt> => {
  const { data } = await apiClient.patch<Receipt>(`/financial/receipts/${id}`, dto);
  return data;
};

export const unlinkReceipt = async (id: string): Promise<Receipt> => {
  const { data } = await apiClient.patch<Receipt>(`/financial/receipts/${id}/unlink`);
  return data;
};

export const deleteReceipt = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/financial/receipts/${id}`);
  return data;
};

// ========== PAYMENT METHODS (6 endpoints) ==========
// API paths: /financial/payment-methods, /financial/payment-methods/:id/*

export const getPaymentMethods = async (params?: ListPaymentMethodsParams): Promise<PaymentMethodRegistry[]> => {
  const queryParams: Record<string, string | boolean> = {};
  if (params?.is_active !== undefined) queryParams.is_active = params.is_active;
  if (params?.type) queryParams.type = params.type;

  const { data } = await apiClient.get<PaymentMethodRegistry[]>('/financial/payment-methods', { params: queryParams });
  return data;
};

export const createPaymentMethod = async (dto: CreatePaymentMethodDto): Promise<PaymentMethodRegistry> => {
  const { data } = await apiClient.post<PaymentMethodRegistry>('/financial/payment-methods', dto);
  return data;
};

export const getPaymentMethod = async (id: string): Promise<PaymentMethodRegistry> => {
  const { data } = await apiClient.get<PaymentMethodRegistry>(`/financial/payment-methods/${id}`);
  return data;
};

export const updatePaymentMethod = async (id: string, dto: UpdatePaymentMethodDto): Promise<PaymentMethodRegistry> => {
  const { data } = await apiClient.patch<PaymentMethodRegistry>(`/financial/payment-methods/${id}`, dto);
  return data;
};

export const deletePaymentMethod = async (id: string): Promise<PaymentMethodRegistry> => {
  const { data } = await apiClient.delete<PaymentMethodRegistry>(`/financial/payment-methods/${id}`);
  return data;
};

export const permanentDeletePaymentMethod = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/financial/payment-methods/${id}`, { params: { permanent: true } });
  return data;
};

export const setDefaultPaymentMethod = async (id: string): Promise<PaymentMethodRegistry> => {
  const { data } = await apiClient.post<PaymentMethodRegistry>(`/financial/payment-methods/${id}/set-default`);
  return data;
};

// ========== SUPPLIER CATEGORIES (4 endpoints) ==========
// API paths: /financial/supplier-categories, /financial/supplier-categories/:id

export const getSupplierCategories = async (params?: { is_active?: boolean }): Promise<SupplierCategory[]> => {
  const queryParams: Record<string, boolean> = {};
  if (params?.is_active !== undefined) queryParams.is_active = params.is_active;

  const { data } = await apiClient.get<SupplierCategory[]>('/financial/supplier-categories', { params: queryParams });
  return data;
};

export const createSupplierCategory = async (dto: CreateSupplierCategoryDto): Promise<SupplierCategory> => {
  const { data } = await apiClient.post<SupplierCategory>('/financial/supplier-categories', dto);
  return data;
};

export const updateSupplierCategory = async (id: string, dto: UpdateSupplierCategoryDto): Promise<SupplierCategory> => {
  const { data } = await apiClient.patch<SupplierCategory>(`/financial/supplier-categories/${id}`, dto);
  return data;
};

export const deleteSupplierCategory = async (id: string): Promise<void> => {
  await apiClient.delete(`/financial/supplier-categories/${id}`);
};

// ========== SUPPLIERS (7 endpoints) ==========
// API paths: /financial/suppliers, /financial/suppliers/:id, /financial/suppliers/map, /financial/suppliers/:id/statistics

export const getSuppliers = async (params: ListSuppliersParams): Promise<PaginatedResponse<SupplierListItem>> => {
  const queryParams: Record<string, string | number | boolean> = {};
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;
  if (params.search) queryParams.search = params.search;
  if (params.category_id) queryParams.category_id = params.category_id;
  if (params.is_active !== undefined) queryParams.is_active = params.is_active;
  if (params.is_preferred !== undefined) queryParams.is_preferred = params.is_preferred;
  if (params.sort_by) queryParams.sort_by = params.sort_by;
  if (params.sort_order) queryParams.sort_order = params.sort_order;

  const { data } = await apiClient.get<PaginatedResponse<SupplierListItem>>('/financial/suppliers', { params: queryParams });
  return data;
};

export const createSupplier = async (dto: CreateSupplierDto): Promise<Supplier> => {
  const { data } = await apiClient.post<Supplier>('/financial/suppliers', dto);
  return data;
};

// NOTE: /map must be registered before /:id routes to avoid route shadowing
export const getSupplierMap = async (): Promise<SupplierMapItem[]> => {
  const { data } = await apiClient.get<SupplierMapItem[]>('/financial/suppliers/map');
  return data;
};

export const getSupplier = async (id: string): Promise<Supplier> => {
  const { data } = await apiClient.get<Supplier>(`/financial/suppliers/${id}`);
  return data;
};

export const updateSupplier = async (id: string, dto: UpdateSupplierDto): Promise<Supplier> => {
  const { data } = await apiClient.patch<Supplier>(`/financial/suppliers/${id}`, dto);
  return data;
};

export const deleteSupplier = async (id: string, permanent?: boolean): Promise<void> => {
  const params = permanent ? { permanent: true } : undefined;
  await apiClient.delete(`/financial/suppliers/${id}`, { params });
};

export const getSupplierStatistics = async (id: string): Promise<SupplierStatistics> => {
  const { data } = await apiClient.get<SupplierStatistics>(`/financial/suppliers/${id}/statistics`);
  return data;
};

// ========== SUPPLIER PRODUCTS (5 endpoints) ==========
// API paths: /financial/suppliers/:supplierId/products, /financial/suppliers/:supplierId/products/:productId/*

export const getSupplierProducts = async (supplierId: string, params?: { is_active?: boolean }): Promise<SupplierProduct[]> => {
  const queryParams: Record<string, boolean> = {};
  if (params?.is_active !== undefined) queryParams.is_active = params.is_active;

  const { data } = await apiClient.get<SupplierProduct[]>(`/financial/suppliers/${supplierId}/products`, { params: queryParams });
  return data;
};

export const createSupplierProduct = async (supplierId: string, dto: CreateSupplierProductDto): Promise<SupplierProduct> => {
  const { data } = await apiClient.post<SupplierProduct>(`/financial/suppliers/${supplierId}/products`, dto);
  return data;
};

export const updateSupplierProduct = async (supplierId: string, productId: string, dto: UpdateSupplierProductDto): Promise<SupplierProduct> => {
  const { data } = await apiClient.patch<SupplierProduct>(`/financial/suppliers/${supplierId}/products/${productId}`, dto);
  return data;
};

export const deleteSupplierProduct = async (supplierId: string, productId: string, permanent?: boolean): Promise<void> => {
  const params = permanent ? { permanent: true } : {};
  await apiClient.delete(`/financial/suppliers/${supplierId}/products/${productId}`, { params });
};

export const getProductPriceHistory = async (supplierId: string, productId: string): Promise<PriceHistoryEntry[]> => {
  const { data } = await apiClient.get<PriceHistoryEntry[]>(`/financial/suppliers/${supplierId}/products/${productId}/price-history`);
  return data;
};

// ========== RECURRING RULES (11 endpoints) ==========
// API paths: /financial/recurring-rules, /financial/recurring-rules/preview, /financial/recurring-rules/:id/*

export const getRecurringRules = async (params: ListRecurringRulesParams): Promise<RecurringRuleListResponse> => {
  const queryParams: Record<string, string | number> = {};
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;
  if (params.status) queryParams.status = params.status;
  if (params.category_id) queryParams.category_id = params.category_id;
  if (params.frequency) queryParams.frequency = params.frequency;
  if (params.sort_by) queryParams.sort_by = params.sort_by;
  if (params.sort_order) queryParams.sort_order = params.sort_order;

  const { data } = await apiClient.get<RecurringRuleListResponse>('/financial/recurring-rules', { params: queryParams });
  return data;
};

export const createRecurringRule = async (dto: CreateRecurringRuleDto): Promise<RecurringRule> => {
  const { data } = await apiClient.post<RecurringRule>('/financial/recurring-rules', dto);
  return data;
};

export const getRecurringRule = async (id: string): Promise<RecurringRuleDetail> => {
  const { data } = await apiClient.get<RecurringRuleDetail>(`/financial/recurring-rules/${id}`);
  return data;
};

export const updateRecurringRule = async (id: string, dto: UpdateRecurringRuleDto): Promise<RecurringRule> => {
  const { data } = await apiClient.patch<RecurringRule>(`/financial/recurring-rules/${id}`, dto);
  return data;
};

// DELETE method — API returns the cancelled rule object (status: "cancelled")
export const cancelRecurringRule = async (id: string): Promise<RecurringRule> => {
  const { data } = await apiClient.delete<RecurringRule>(`/financial/recurring-rules/${id}`);
  return data;
};

export const pauseRecurringRule = async (id: string): Promise<RecurringRule> => {
  const { data } = await apiClient.post<RecurringRule>(`/financial/recurring-rules/${id}/pause`);
  return data;
};

export const resumeRecurringRule = async (id: string): Promise<RecurringRule> => {
  const { data } = await apiClient.post<RecurringRule>(`/financial/recurring-rules/${id}/resume`);
  return data;
};

// POST .../trigger → 202 Accepted (no body)
export const triggerRecurringRule = async (id: string): Promise<void> => {
  await apiClient.post(`/financial/recurring-rules/${id}/trigger`);
};

export const skipRecurringRule = async (id: string, dto?: SkipRuleDto): Promise<RecurringRule> => {
  const { data } = await apiClient.post<RecurringRule>(`/financial/recurring-rules/${id}/skip`, dto || {});
  return data;
};

export const getRecurringRuleHistory = async (id: string, params?: { page?: number; limit?: number; date_from?: string; date_to?: string }): Promise<PaginatedResponse<FinancialEntry>> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;

  const { data } = await apiClient.get<PaginatedResponse<FinancialEntry>>(`/financial/recurring-rules/${id}/history`, { params: queryParams });
  return data;
};

// GET /preview?days=X
export const getRecurringPreview = async (days: 30 | 60 | 90): Promise<RecurringPreviewResponse> => {
  const { data } = await apiClient.get<RecurringPreviewResponse>('/financial/recurring-rules/preview', { params: { days } });
  return data;
};

// ========== DRAW MILESTONES (5 endpoints) ==========
// API paths: /projects/:projectId/milestones, /projects/:projectId/milestones/:id/*

export const getMilestones = async (projectId: string): Promise<DrawMilestone[]> => {
  const { data } = await apiClient.get<DrawMilestone[]>(`/projects/${projectId}/milestones`);
  return data;
};

export const createMilestone = async (projectId: string, dto: CreateMilestoneDto): Promise<DrawMilestone> => {
  const { data } = await apiClient.post<DrawMilestone>(`/projects/${projectId}/milestones`, dto);
  return data;
};

export const updateMilestone = async (projectId: string, id: string, dto: UpdateMilestoneDto): Promise<DrawMilestone> => {
  const { data } = await apiClient.patch<DrawMilestone>(`/projects/${projectId}/milestones/${id}`, dto);
  return data;
};

export const deleteMilestone = async (projectId: string, id: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}/milestones/${id}`);
};

export const generateMilestoneInvoice = async (projectId: string, id: string, dto?: GenerateMilestoneInvoiceDto): Promise<ProjectInvoice> => {
  const { data } = await apiClient.post<ProjectInvoice>(`/projects/${projectId}/milestones/${id}/invoice`, dto || {});
  return data;
};

// ========== PROJECT INVOICES (8 endpoints) ==========
// API paths: /projects/:projectId/invoices, /projects/:projectId/invoices/:id/*

export const getProjectInvoices = async (projectId: string, params?: ListProjectInvoicesParams): Promise<PaginatedResponse<ProjectInvoice>> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.status) queryParams.status = params.status;
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;

  const { data } = await apiClient.get<PaginatedResponse<ProjectInvoice>>(`/projects/${projectId}/invoices`, { params: queryParams });
  return data;
};

export const createProjectInvoice = async (projectId: string, dto: CreateProjectInvoiceDto): Promise<ProjectInvoice> => {
  const { data } = await apiClient.post<ProjectInvoice>(`/projects/${projectId}/invoices`, dto);
  return data;
};

export const getProjectInvoice = async (projectId: string, id: string): Promise<ProjectInvoice> => {
  const { data } = await apiClient.get<ProjectInvoice>(`/projects/${projectId}/invoices/${id}`);
  return data;
};

export const updateProjectInvoice = async (projectId: string, id: string, dto: UpdateProjectInvoiceDto): Promise<ProjectInvoice> => {
  const { data } = await apiClient.patch<ProjectInvoice>(`/projects/${projectId}/invoices/${id}`, dto);
  return data;
};

export const sendInvoice = async (projectId: string, id: string): Promise<ProjectInvoice> => {
  const { data } = await apiClient.post<ProjectInvoice>(`/projects/${projectId}/invoices/${id}/send`);
  return data;
};

export const voidInvoice = async (projectId: string, id: string, dto: VoidInvoiceDto): Promise<ProjectInvoice> => {
  const { data } = await apiClient.post<ProjectInvoice>(`/projects/${projectId}/invoices/${id}/void`, dto);
  return data;
};

export const deleteProjectInvoice = async (projectId: string, id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${projectId}/invoices/${id}`);
  return data;
};

export const recordInvoicePayment = async (projectId: string, invoiceId: string, dto: RecordInvoicePaymentDto): Promise<InvoicePayment> => {
  const { data } = await apiClient.post<InvoicePayment>(`/projects/${projectId}/invoices/${invoiceId}/payments`, dto);
  return data;
};

export const getInvoicePayments = async (projectId: string, invoiceId: string): Promise<InvoicePayment[]> => {
  const { data } = await apiClient.get<InvoicePayment[]>(`/projects/${projectId}/invoices/${invoiceId}/payments`);
  return data;
};

export const deleteInvoicePayment = async (projectId: string, invoiceId: string, paymentId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${projectId}/invoices/${invoiceId}/payments/${paymentId}`);
  return data;
};

// ========== PROJECT FINANCIAL SUMMARY (5 endpoints) ==========
// API paths: /projects/:projectId/financial/*

export const getProjectFinancialSummary = async (projectId: string, params?: { date_from?: string; date_to?: string }): Promise<ProjectFinancialSummary> => {
  const queryParams: Record<string, string> = {};
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;

  const { data } = await apiClient.get<ProjectFinancialSummary>(`/projects/${projectId}/financial/summary`, { params: queryParams });
  return data;
};

export const getTaskBreakdown = async (projectId: string, params?: { date_from?: string; date_to?: string; sort_by?: string; sort_order?: string }): Promise<TaskBreakdownResponse> => {
  const queryParams: Record<string, string> = {};
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;
  if (params?.sort_by) queryParams.sort_by = params.sort_by;
  if (params?.sort_order) queryParams.sort_order = params.sort_order;

  const { data } = await apiClient.get<TaskBreakdownResponse>(`/projects/${projectId}/financial/tasks`, { params: queryParams });
  return data;
};

export const getFinancialTimeline = async (projectId: string, params?: { date_from?: string; date_to?: string }): Promise<TimelineResponse> => {
  const queryParams: Record<string, string> = {};
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;

  const { data } = await apiClient.get<TimelineResponse>(`/projects/${projectId}/financial/timeline`, { params: queryParams });
  return data;
};

// NOTE: Do NOT reuse ListReceiptsParams — the project-scoped endpoint does NOT accept project_id/task_id in params (they are in the URL path)
export const getProjectReceipts = async (projectId: string, params?: { is_categorized?: boolean; ocr_status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Receipt>> => {
  const queryParams: Record<string, string | number | boolean> = {};
  if (params?.is_categorized !== undefined) queryParams.is_categorized = params.is_categorized;
  if (params?.ocr_status) queryParams.ocr_status = params.ocr_status;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<Receipt>>(`/projects/${projectId}/financial/receipts`, { params: queryParams });
  return data;
};

export const getWorkforceSummary = async (projectId: string, params?: { date_from?: string; date_to?: string }): Promise<WorkforceResponse> => {
  const queryParams: Record<string, string> = {};
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;

  const { data } = await apiClient.get<WorkforceResponse>(`/projects/${projectId}/financial/workforce`, { params: queryParams });
  return data;
};

// ========== TASK-LEVEL (5 endpoints) ==========
// API paths: /projects/:projectId/tasks/:taskId/*

export const createTaskCost = async (projectId: string, taskId: string, dto: CreateTaskCostDto): Promise<FinancialEntry> => {
  const { data } = await apiClient.post<FinancialEntry>(`/projects/${projectId}/tasks/${taskId}/costs`, dto);
  return data;
};

export const getTaskCosts = async (projectId: string, taskId: string): Promise<RawFinancialEntry[]> => {
  const { data } = await apiClient.get<RawFinancialEntry[]>(`/projects/${projectId}/tasks/${taskId}/costs`);
  return data;
};

export const uploadTaskReceipt = async (projectId: string, taskId: string, formData: FormData): Promise<Receipt> => {
  const { data } = await apiClient.post<Receipt>(
    `/projects/${projectId}/tasks/${taskId}/receipts`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
};

export const getTaskReceipts = async (projectId: string, taskId: string): Promise<Receipt[]> => {
  const { data } = await apiClient.get<Receipt[]>(`/projects/${projectId}/tasks/${taskId}/receipts`);
  return data;
};

export const getTaskInvoices = async (projectId: string, taskId: string): Promise<TaskSubcontractorInvoice[]> => {
  const { data } = await apiClient.get<TaskSubcontractorInvoice[]>(`/projects/${projectId}/tasks/${taskId}/invoices`);
  return data;
};

// ========== CREW HOURS (3 endpoints) ==========
// API paths: /financial/crew-hours, /financial/crew-hours/:id

export const logCrewHours = async (dto: CreateCrewHourDto): Promise<CrewHourLog> => {
  const { data } = await apiClient.post<CrewHourLog>('/financial/crew-hours', dto);
  return data;
};

export const getCrewHours = async (params: { crew_member_id?: string; project_id?: string; date_from?: string; date_to?: string; page?: number; limit?: number }): Promise<PaginatedResponse<CrewHourLog>> => {
  const queryParams: Record<string, string | number> = {};
  if (params.crew_member_id) queryParams.crew_member_id = params.crew_member_id;
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.date_from) queryParams.date_from = params.date_from;
  if (params.date_to) queryParams.date_to = params.date_to;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<CrewHourLog>>('/financial/crew-hours', { params: queryParams });
  return data;
};

export const updateCrewHourLog = async (id: string, dto: UpdateCrewHourDto): Promise<CrewHourLog> => {
  const { data } = await apiClient.patch<CrewHourLog>(`/financial/crew-hours/${id}`, dto);
  return data;
};

export const deleteCrewHourLog = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/financial/crew-hours/${id}`);
  return data;
};

// ========== CREW PAYMENTS (3 endpoints) ==========
// API paths: /financial/crew-payments, /crew/:crewMemberId/payment-history

export const createCrewPayment = async (dto: CreateCrewPaymentDto): Promise<CrewPayment> => {
  const { data } = await apiClient.post<CrewPayment>('/financial/crew-payments', dto);
  return data;
};

export const getCrewPayments = async (params: { crew_member_id?: string; project_id?: string; page?: number; limit?: number }): Promise<PaginatedResponse<CrewPayment>> => {
  const queryParams: Record<string, string | number> = {};
  if (params.crew_member_id) queryParams.crew_member_id = params.crew_member_id;
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<CrewPayment>>('/financial/crew-payments', { params: queryParams });
  return data;
};

export const getCrewPaymentHistory = async (crewMemberId: string, params?: { project_id?: string; page?: number; limit?: number }): Promise<PaginatedResponse<CrewPayment>> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.project_id) queryParams.project_id = params.project_id;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<CrewPayment>>(
    `/crew/${crewMemberId}/payment-history`,
    { params: queryParams },
  );
  return data;
};

export const updateCrewPayment = async (id: string, dto: UpdateCrewPaymentDto): Promise<CrewPayment> => {
  const { data } = await apiClient.patch<CrewPayment>(`/financial/crew-payments/${id}`, dto);
  return data;
};

export const deleteCrewPayment = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/financial/crew-payments/${id}`);
  return data;
};

// ========== SUBCONTRACTOR INVOICES (4 endpoints) ==========
// API paths: /financial/subcontractor-invoices, /subcontractors/:id/invoices

export const createSubcontractorInvoice = async (dto: CreateSubcontractorInvoiceDto | FormData): Promise<SubcontractorInvoice> => {
  const isFormData = dto instanceof FormData;
  const { data } = await apiClient.post<SubcontractorInvoice>(
    '/financial/subcontractor-invoices',
    dto,
    isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined,
  );
  return data;
};

export const getSubcontractorInvoices = async (params: { subcontractor_id?: string; task_id?: string; project_id?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<SubcontractorInvoice>> => {
  const queryParams: Record<string, string | number> = {};
  if (params.subcontractor_id) queryParams.subcontractor_id = params.subcontractor_id;
  if (params.task_id) queryParams.task_id = params.task_id;
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.status) queryParams.status = params.status;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<SubcontractorInvoice>>(
    '/financial/subcontractor-invoices',
    { params: queryParams },
  );
  return data;
};

export const updateSubcontractorInvoice = async (id: string, dto: UpdateSubcontractorInvoiceDto): Promise<SubcontractorInvoice> => {
  const { data } = await apiClient.patch<SubcontractorInvoice>(`/financial/subcontractor-invoices/${id}`, dto);
  return data;
};

export const deleteSubcontractorInvoice = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/financial/subcontractor-invoices/${id}`);
  return data;
};

export const getSubcontractorInvoiceList = async (subcontractorId: string): Promise<SubcontractorInvoice[]> => {
  const { data } = await apiClient.get<SubcontractorInvoice[]>(`/subcontractors/${subcontractorId}/invoices`);
  return data;
};

// ========== SUBCONTRACTOR PAYMENTS (4 endpoints) ==========
// API paths: /financial/subcontractor-payments, /subcontractors/:id/payment-history, /subcontractors/:id/payment-summary

export const createSubcontractorPayment = async (dto: CreateSubcontractorPaymentDto): Promise<SubcontractorPayment> => {
  const { data } = await apiClient.post<SubcontractorPayment>('/financial/subcontractor-payments', dto);
  return data;
};

export const updateSubcontractorPayment = async (id: string, dto: UpdateSubcontractorPaymentDto): Promise<SubcontractorPayment> => {
  const { data } = await apiClient.patch<SubcontractorPayment>(`/financial/subcontractor-payments/${id}`, dto);
  return data;
};

export const deleteSubcontractorPayment = async (id: string): Promise<void> => {
  await apiClient.delete(`/financial/subcontractor-payments/${id}`);
};

export const getSubcontractorPayments = async (params: { subcontractor_id?: string; project_id?: string; page?: number; limit?: number }): Promise<PaginatedResponse<SubcontractorPayment>> => {
  const queryParams: Record<string, string | number> = {};
  if (params.subcontractor_id) queryParams.subcontractor_id = params.subcontractor_id;
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<SubcontractorPayment>>(
    '/financial/subcontractor-payments',
    { params: queryParams },
  );
  return data;
};

export const getSubcontractorPaymentHistory = async (subcontractorId: string, params?: { project_id?: string; page?: number; limit?: number }): Promise<PaginatedResponse<SubcontractorPayment>> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.project_id) queryParams.project_id = params.project_id;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<SubcontractorPayment>>(
    `/subcontractors/${subcontractorId}/payment-history`,
    { params: queryParams },
  );
  return data;
};

export const getSubcontractorPaymentSummary = async (subcontractorId: string): Promise<SubcontractorPaymentSummary> => {
  const { data } = await apiClient.get<SubcontractorPaymentSummary>(`/subcontractors/${subcontractorId}/payment-summary`);
  return data;
};

// ========== DASHBOARD (7 endpoints) ==========
// API paths: /financial/dashboard/*

export const getDashboardOverview = async (params?: { forecast_days?: number }): Promise<DashboardOverview> => {
  const queryParams: Record<string, number> = {};
  if (params?.forecast_days) queryParams.forecast_days = params.forecast_days;

  const { data } = await apiClient.get<DashboardOverview>('/financial/dashboard/overview', { params: queryParams });
  return data;
};

export const getDashboardPL = async (params: DashboardPLParams): Promise<PLSummary> => {
  const queryParams: Record<string, string | number | boolean> = { year: params.year };
  if (params.month) queryParams.month = params.month;
  if (params.include_pending !== undefined) queryParams.include_pending = params.include_pending;

  const { data } = await apiClient.get<PLSummary>('/financial/dashboard/pl', { params: queryParams });
  return data;
};

export const exportPL = async (params: DashboardPLParams): Promise<Blob> => {
  const queryParams: Record<string, string | number | boolean> = { year: params.year };
  if (params.month) queryParams.month = params.month;
  if (params.include_pending !== undefined) queryParams.include_pending = params.include_pending;

  const { data } = await apiClient.get('/financial/dashboard/pl/export', {
    params: queryParams,
    responseType: 'blob',
  });
  return data;
};

export const getDashboardAR = async (params?: DashboardARParams): Promise<ARSummary> => {
  const queryParams: Record<string, string | boolean> = {};
  if (params?.status) queryParams.status = params.status;
  if (params?.overdue_only !== undefined) queryParams.overdue_only = params.overdue_only;

  const { data } = await apiClient.get<ARSummary>('/financial/dashboard/ar', { params: queryParams });
  return data;
};

export const getDashboardAP = async (params?: DashboardAPParams): Promise<APSummary> => {
  const queryParams: Record<string, number> = {};
  if (params?.days_ahead) queryParams.days_ahead = params.days_ahead;

  const { data } = await apiClient.get<APSummary>('/financial/dashboard/ap', { params: queryParams });
  return data;
};

export const getDashboardForecast = async (params: DashboardForecastParams): Promise<ForecastResponse> => {
  const { data } = await apiClient.get<ForecastResponse>('/financial/dashboard/forecast', { params: { days: params.days } });
  return data;
};

export const getDashboardAlerts = async (): Promise<AlertsResponse> => {
  const { data } = await apiClient.get<AlertsResponse>('/financial/dashboard/alerts');
  return data;
};

// ========== ACCOUNT MAPPINGS (4 endpoints) ==========
// API paths: /financial/export/account-mappings, /financial/export/account-mappings/defaults

export const getAccountMappings = async (params?: { platform?: AccountingPlatform }): Promise<AccountMapping[]> => {
  const queryParams: Record<string, string> = {};
  if (params?.platform) queryParams.platform = params.platform;

  const { data } = await apiClient.get<AccountMapping[]>('/financial/export/account-mappings', { params: queryParams });
  return data;
};

export const getDefaultMappings = async (platform: AccountingPlatform): Promise<DefaultMapping[]> => {
  const { data } = await apiClient.get<DefaultMapping[]>('/financial/export/account-mappings/defaults', { params: { platform } });
  return data;
};

// UPSERT — creates or updates per category+platform
export const createAccountMapping = async (dto: CreateAccountMappingDto): Promise<AccountMapping> => {
  const { data } = await apiClient.post<AccountMapping>('/financial/export/account-mappings', dto);
  return data;
};

export const deleteAccountMapping = async (id: string): Promise<void> => {
  await apiClient.delete(`/financial/export/account-mappings/${id}`);
};

// ========== ACCOUNTING EXPORTS (6 endpoints) ==========
// API paths: /financial/export/quickbooks/*, /financial/export/xero/*, /financial/export/quality-report, /financial/export/history

export const exportQuickbooksExpenses = async (params: ExportExpenseParams): Promise<Blob> => {
  const queryParams: Record<string, string | boolean> = {
    date_from: params.date_from,
    date_to: params.date_to,
  };
  if (params.category_id) queryParams.category_id = params.category_id;
  if (params.classification) queryParams.classification = params.classification;
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.include_recurring !== undefined) queryParams.include_recurring = params.include_recurring;
  if (params.include_pending !== undefined) queryParams.include_pending = params.include_pending;

  const { data } = await apiClient.get('/financial/export/quickbooks/expenses', {
    params: queryParams,
    responseType: 'blob',
  });
  return data;
};

export const exportQuickbooksInvoices = async (params: ExportInvoiceParams): Promise<Blob> => {
  const queryParams: Record<string, string> = {
    date_from: params.date_from,
    date_to: params.date_to,
  };
  if (params.status) queryParams.status = params.status;

  const { data } = await apiClient.get('/financial/export/quickbooks/invoices', {
    params: queryParams,
    responseType: 'blob',
  });
  return data;
};

export const exportXeroExpenses = async (params: ExportExpenseParams): Promise<Blob> => {
  const queryParams: Record<string, string | boolean> = {
    date_from: params.date_from,
    date_to: params.date_to,
  };
  if (params.category_id) queryParams.category_id = params.category_id;
  if (params.classification) queryParams.classification = params.classification;
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.include_recurring !== undefined) queryParams.include_recurring = params.include_recurring;
  if (params.include_pending !== undefined) queryParams.include_pending = params.include_pending;

  const { data } = await apiClient.get('/financial/export/xero/expenses', {
    params: queryParams,
    responseType: 'blob',
  });
  return data;
};

export const exportXeroInvoices = async (params: ExportInvoiceParams): Promise<Blob> => {
  const queryParams: Record<string, string> = {
    date_from: params.date_from,
    date_to: params.date_to,
  };
  if (params.status) queryParams.status = params.status;

  const { data } = await apiClient.get('/financial/export/xero/invoices', {
    params: queryParams,
    responseType: 'blob',
  });
  return data;
};

export const getQualityReport = async (params?: QualityReportParams): Promise<QualityReportResponse> => {
  const queryParams: Record<string, string> = {};
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;
  if (params?.platform) queryParams.platform = params.platform;

  const { data } = await apiClient.get<QualityReportResponse>('/financial/export/quality-report', { params: queryParams });
  return data;
};

export const getExportHistory = async (params?: ExportHistoryParams): Promise<PaginatedResponse<ExportHistoryItem>> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.export_type) queryParams.export_type = params.export_type;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<ExportHistoryItem>>('/financial/export/history', { params: queryParams });
  return data;
};
