// Lead360 - Financial Module API Client
// Endpoints from: financial_gate1_REST_API.md, receipt_REST_API.md,
// financial_gate3_REST_API.md, task_financial_REST_API.md, task_crew_hours_REST_API.md

import { apiClient } from './axios';
import type {
  FinancialCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
  FinancialEntry,
  CreateFinancialEntryDto,
  UpdateFinancialEntryDto,
  ListFinancialEntriesParams,
  PaginatedResponse,
  Receipt,
  UpdateReceiptDto,
  LinkReceiptDto,
  ListReceiptsParams,
  CrewHourLog,
  CreateCrewHourDto,
  UpdateCrewHourDto,
  CrewMemberHourSummary,
  CrewPayment,
  CreateCrewPaymentDto,
  SubcontractorPayment,
  CreateSubcontractorPaymentDto,
  SubcontractorInvoice,
  CreateSubcontractorInvoiceDto,
  UpdateSubcontractorInvoiceDto,
  SubcontractorPaymentSummary,
  CrewMember,
  Subcontractor,
} from '@/lib/types/financial';

// ========== FINANCIAL CATEGORIES ==========

export const getFinancialCategories = async (): Promise<FinancialCategory[]> => {
  const { data } = await apiClient.get<FinancialCategory[]>('/settings/financial-categories');
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

// ========== FINANCIAL ENTRIES ==========

export const getFinancialEntries = async (params: ListFinancialEntriesParams): Promise<PaginatedResponse<FinancialEntry>> => {
  const queryParams: Record<string, string | number> = { project_id: params.project_id };
  if (params.task_id) queryParams.task_id = params.task_id;
  if (params.category_id) queryParams.category_id = params.category_id;
  if (params.date_from) queryParams.date_from = params.date_from;
  if (params.date_to) queryParams.date_to = params.date_to;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<FinancialEntry>>('/financial/entries', { params: queryParams });
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

// ========== RECEIPTS ==========

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

export const updateReceipt = async (id: string, dto: UpdateReceiptDto): Promise<Receipt> => {
  const { data } = await apiClient.patch<Receipt>(`/financial/receipts/${id}`, dto);
  return data;
};

export const linkReceiptToEntry = async (receiptId: string, dto: LinkReceiptDto): Promise<Receipt> => {
  const { data } = await apiClient.patch<Receipt>(`/financial/receipts/${receiptId}/link`, dto);
  return data;
};

// Task-level receipt upload
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

// ========== CREW HOURS ==========

export const logCrewHours = async (projectId: string, taskId: string, dto: CreateCrewHourDto): Promise<CrewHourLog> => {
  const { data } = await apiClient.post<CrewHourLog>(
    `/projects/${projectId}/tasks/${taskId}/crew-hours`,
    dto,
  );
  return data;
};

export const getTaskCrewHours = async (projectId: string, taskId: string): Promise<CrewHourLog[]> => {
  const { data } = await apiClient.get<CrewHourLog[]>(`/projects/${projectId}/tasks/${taskId}/crew-hours`);
  return data;
};

export const getCrewHours = async (params: {
  crew_member_id?: string;
  project_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<CrewHourLog>> => {
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

export const getCrewMemberHourSummary = async (crewMemberId: string): Promise<CrewMemberHourSummary> => {
  const { data } = await apiClient.get<CrewMemberHourSummary>(`/crew/${crewMemberId}/hours`);
  return data;
};

// ========== CREW PAYMENTS ==========

export const createCrewPayment = async (dto: CreateCrewPaymentDto): Promise<CrewPayment> => {
  const { data } = await apiClient.post<CrewPayment>('/financial/crew-payments', dto);
  return data;
};

export const getCrewPayments = async (params: {
  crew_member_id?: string;
  project_id?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<CrewPayment>> => {
  const queryParams: Record<string, string | number> = {};
  if (params.crew_member_id) queryParams.crew_member_id = params.crew_member_id;
  if (params.project_id) queryParams.project_id = params.project_id;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<CrewPayment>>('/financial/crew-payments', { params: queryParams });
  return data;
};

export const getCrewPaymentHistory = async (crewMemberId: string, params?: {
  project_id?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<CrewPayment>> => {
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

// ========== SUBCONTRACTOR PAYMENTS ==========

export const createSubcontractorPayment = async (dto: CreateSubcontractorPaymentDto): Promise<SubcontractorPayment> => {
  const { data } = await apiClient.post<SubcontractorPayment>('/financial/subcontractor-payments', dto);
  return data;
};

export const getSubcontractorPayments = async (params: {
  subcontractor_id?: string;
  project_id?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<SubcontractorPayment>> => {
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

export const getSubcontractorPaymentHistory = async (subcontractorId: string, params?: {
  project_id?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<SubcontractorPayment>> => {
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

// ========== SUBCONTRACTOR INVOICES ==========

export const createSubcontractorInvoice = async (dto: CreateSubcontractorInvoiceDto | FormData): Promise<SubcontractorInvoice> => {
  const isFormData = dto instanceof FormData;
  const { data } = await apiClient.post<SubcontractorInvoice>(
    '/financial/subcontractor-invoices',
    dto,
    isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined,
  );
  return data;
};

export const getSubcontractorInvoices = async (params: {
  subcontractor_id?: string;
  task_id?: string;
  project_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<SubcontractorInvoice>> => {
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

export const getTaskInvoices = async (projectId: string, taskId: string): Promise<SubcontractorInvoice[]> => {
  const { data } = await apiClient.get<SubcontractorInvoice[]>(`/projects/${projectId}/tasks/${taskId}/invoices`);
  return data;
};

export const getSubcontractorInvoiceList = async (subcontractorId: string): Promise<SubcontractorInvoice[]> => {
  const { data } = await apiClient.get<SubcontractorInvoice[]>(`/subcontractors/${subcontractorId}/invoices`);
  return data;
};

export const getSubcontractorPaymentSummary = async (subcontractorId: string): Promise<SubcontractorPaymentSummary> => {
  const { data } = await apiClient.get<SubcontractorPaymentSummary>(`/subcontractors/${subcontractorId}/payment-summary`);
  return data;
};

// ========== CREW MEMBERS (for autocomplete) ==========

export const getCrewMembers = async (params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<CrewMember>> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<CrewMember>>('/crew', { params: queryParams });
  return data;
};

// ========== SUBCONTRACTORS (for autocomplete) ==========

export const getSubcontractors = async (params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Subcontractor>> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PaginatedResponse<Subcontractor>>('/subcontractors', { params: queryParams });
  return data;
};
