// Lead360 - Quotes Module API Client
// All 12 core quote endpoints from backend API documentation
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  Quote,
  QuoteSummary,
  QuoteListResponse,
  QuoteFilters,
  QuoteStatistics,
  QuoteStatus,
  CreateQuoteDto,
  CreateQuoteWithCustomerDto,
  UpdateQuoteDto,
} from '@/lib/types/quotes';

// ========== CORE QUOTE OPERATIONS (12 endpoints) ==========

/**
 * Create quote from existing lead
 * @endpoint POST /quotes/from-lead/:leadId
 * @permission quotes:create
 * @param leadId Lead UUID
 * @param dto Quote creation data
 * @returns Complete quote object with relations
 * @throws 400 - Validation errors (missing required fields)
 * @throws 404 - Lead not found or vendor not found
 * @throws 422 - Address validation failed (Google Maps)
 */
export const createQuoteFromLead = async (
  leadId: string,
  dto: CreateQuoteDto
): Promise<Quote> => {
  const { data } = await apiClient.post<Quote>(`/quotes/from-lead/${leadId}`, dto);
  return data;
};

/**
 * Create quote with new customer (creates lead inline)
 * @endpoint POST /quotes/with-new-customer
 * @permission quotes:create
 * @param dto Quote creation data with customer information
 * @returns Quote object and newly created lead
 * @throws 400 - Validation errors
 * @throws 409 - Phone number already exists for tenant
 * @throws 422 - Address validation failed (Google Maps)
 * @note Creates lead first, then quote - both operations are transactional
 */
export const createQuoteWithNewCustomer = async (
  dto: CreateQuoteWithCustomerDto
): Promise<Quote> => {
  const response = await apiClient.post<Quote>(
    '/quotes/with-new-customer',
    dto
  );
  return response.data;
};

/**
 * Create quote (manual - requires lead_id in body)
 * @endpoint POST /quotes
 * @permission quotes:create
 * @param dto Quote creation data
 * @returns Complete quote object
 * @throws 400 - Validation errors
 * @throws 404 - Lead not found or vendor not found
 * @throws 422 - Address validation failed
 */
export const createQuote = async (dto: CreateQuoteDto): Promise<Quote> => {
  const { data } = await apiClient.post<Quote>('/quotes', dto);
  return data;
};

/**
 * Get paginated list of quotes with filters
 * @endpoint GET /quotes
 * @permission quotes:view
 * @param filters Optional query parameters for filtering, sorting, pagination
 * @returns Paginated list of quote summaries with metadata
 * @note Default pagination: page=1, limit=50
 */
export const getQuotes = async (filters?: QuoteFilters): Promise<QuoteListResponse> => {
  const params: Record<string, any> = {};

  if (filters?.page) params.page = filters.page;
  if (filters?.limit) params.limit = filters.limit;
  if (filters?.status) params.status = filters.status;
  if (filters?.vendor_id) params.vendor_id = filters.vendor_id;
  if (filters?.lead_id) params.lead_id = filters.lead_id;
  if (filters?.search) params.search = filters.search;
  if (filters?.created_from) params.created_from = filters.created_from;
  if (filters?.created_to) params.created_to = filters.created_to;
  if (filters?.sort_by) params.sort_by = filters.sort_by;
  if (filters?.sort_order) params.sort_order = filters.sort_order;

  const { data } = await apiClient.get<QuoteListResponse>('/quotes', { params });
  return data;
};

/**
 * Search quotes (simple text search)
 * @endpoint GET /quotes/search
 * @permission quotes:view
 * @param query Search term (searches quote number, title, customer name)
 * @returns Array of matching quote summaries with count
 * @note Searches across: quote_number, title, customer first/last name
 */
export const searchQuotes = async (query: string): Promise<{ results: QuoteSummary[]; count: number }> => {
  const { data } = await apiClient.get<{ results: QuoteSummary[]; count: number }>(
    '/quotes/search',
    { params: { q: query } }
  );
  return data;
};

/**
 * Get quote statistics
 * @endpoint GET /quotes/statistics
 * @permission quotes:view
 * @param filters Optional filters (status, date range, vendor, lead)
 * @returns Statistics object with counts and financial totals
 * @note Includes: total quotes, status breakdown, total revenue, conversion rate, avg quote value
 */
export const getQuoteStatistics = async (filters?: {
  status?: QuoteStatus;
  vendor_id?: string;
  lead_id?: string;
  created_from?: string;
  created_to?: string;
}): Promise<QuoteStatistics> => {
  const { data } = await apiClient.get<QuoteStatistics>('/quotes/statistics', {
    params: filters,
  });
  return data;
};

/**
 * Get single quote by ID
 * @endpoint GET /quotes/:id
 * @permission quotes:view
 * @param id Quote UUID
 * @returns Complete quote object with all relations
 * @throws 404 - Quote not found
 * @note Includes: lead, vendor, items, groups, draw schedule, discount rules
 */
export const getQuoteById = async (id: string): Promise<Quote> => {
  const { data } = await apiClient.get<Quote>(`/quotes/${id}`);
  return data;
};

/**
 * Update quote
 * @endpoint PATCH /quotes/:id
 * @permission quotes:edit
 * @param id Quote UUID
 * @param dto Partial quote update data
 * @returns Updated quote object
 * @throws 400 - Validation errors
 * @throws 404 - Quote not found or vendor not found
 * @throws 422 - Cannot edit quote in certain statuses (accepted, expired)
 * @note Recalculates totals if profit/overhead percentages changed
 */
export const updateQuote = async (id: string, dto: UpdateQuoteDto): Promise<Quote> => {
  const { data } = await apiClient.patch<Quote>(`/quotes/${id}`, dto);
  return data;
};

/**
 * Update quote status
 * @endpoint PATCH /quotes/:id/status
 * @permission quotes:edit
 * @param id Quote UUID
 * @param status New status value
 * @param reason Optional reason (required when status="rejected")
 * @returns Updated quote object
 * @throws 400 - Invalid status transition or missing reason for rejection
 * @throws 422 - Cannot change status (e.g., pending_approval requires approval first)
 * @note Status transitions have validation rules - not all transitions allowed
 */
export const updateQuoteStatus = async (
  id: string,
  status: string,
  reason?: string
): Promise<Quote> => {
  const { data } = await apiClient.patch<Quote>(`/quotes/${id}/status`, { status, reason });
  return data;
};

/**
 * Update jobsite address
 * @endpoint PATCH /quotes/:id/jobsite-address
 * @permission quotes:edit
 * @param id Quote UUID
 * @param address New address object
 * @returns Updated quote object
 * @throws 404 - Quote not found
 * @throws 422 - Address validation failed (Google Maps)
 * @note Address must pass Google Maps validation (requires valid lat/lng)
 */
export const updateJobsiteAddress = async (id: string, address: any): Promise<Quote> => {
  const { data } = await apiClient.patch<Quote>(`/quotes/${id}/jobsite-address`, address);
  return data;
};

/**
 * Clone quote
 * @endpoint POST /quotes/:id/clone
 * @permission quotes:create
 * @param id Quote UUID to clone
 * @returns New quote object (copy of original)
 * @throws 404 - Quote not found
 * @note Creates new quote with "COPY" appended to title, status="draft", new quote number
 */
export const cloneQuote = async (id: string): Promise<Quote> => {
  const { data } = await apiClient.post<Quote>(`/quotes/${id}/clone`);
  return data;
};

/**
 * Delete quote (soft delete / archive)
 * @endpoint DELETE /quotes/:id
 * @permission quotes:delete
 * @param id Quote UUID
 * @returns void (204 No Content)
 * @throws 404 - Quote not found
 * @throws 422 - Cannot delete quote in certain statuses (accepted)
 * @note Soft delete - quote marked as deleted but remains in database
 */
export const deleteQuote = async (id: string): Promise<void> => {
  await apiClient.delete(`/quotes/${id}`);
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Format money for display
 * @param amount Number amount in dollars (handles null, undefined, NaN)
 * @returns Formatted string like "$1,234.56" or "$0.00" for invalid values
 */
export const formatMoney = (amount: number | null | undefined): string => {
  // Sanitize input: handle null, undefined, NaN, and convert to number
  const sanitized = typeof amount === 'number' && !isNaN(amount) ? amount : 0;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(sanitized);
};

/**
 * Format percentage for display
 * @param percent Number (e.g., 25.5)
 * @returns Formatted string like "25.5%"
 */
export const formatPercent = (percent: number): string => {
  return `${percent.toFixed(1)}%`;
};

/**
 * Get customer name from quote (extracts from nested lead object)
 * @param quote QuoteSummary with nested lead
 * @returns Full customer name or 'N/A'
 */
export const getCustomerName = (quote: QuoteSummary): string => {
  if (!quote.lead) return 'N/A';
  return `${quote.lead.first_name} ${quote.lead.last_name}`.trim();
};

/**
 * Get vendor name from quote (extracts from nested vendor object)
 * @param quote QuoteSummary with nested vendor
 * @returns Vendor name or 'N/A'
 */
export const getVendorName = (quote: QuoteSummary): string => {
  return quote.vendor?.name || 'N/A';
};

/**
 * Get location from quote (extracts from nested jobsite_address object)
 * @param quote QuoteSummary with nested jobsite_address
 * @returns Location as "City, State" or 'N/A'
 */
export const getLocation = (quote: QuoteSummary): string => {
  if (!quote.jobsite_address) return 'N/A';
  return `${quote.jobsite_address.city}, ${quote.jobsite_address.state}`;
};

/**
 * Get quote status color
 * @param status QuoteStatus value
 * @returns Tailwind color class
 */
export const getQuoteStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    draft: 'gray',
    pending_approval: 'yellow',
    ready: 'blue',
    sent: 'purple',
    viewed: 'teal',
    accepted: 'green',
    rejected: 'red',
    expired: 'gray',
  };
  return colors[status] || 'gray';
};

/**
 * Check if quote is editable based on status
 * Only draft and ready statuses allow editing
 * @param status QuoteStatus value
 * @returns boolean
 */
export const isQuoteEditable = (status: string): boolean => {
  return ['draft', 'ready'].includes(status);
};

/**
 * Check if quote is near expiration (within 7 days)
 * @param expiresAt ISO date string or null
 * @returns boolean
 */
export const isQuoteNearExpiration = (expiresAt: string | null): boolean => {
  if (!expiresAt) return false;
  const expirationDate = new Date(expiresAt);
  if (isNaN(expirationDate.getTime())) return false;
  const today = new Date();
  const daysUntilExpiration = Math.ceil(
    (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysUntilExpiration <= 7 && daysUntilExpiration > 0;
};

/**
 * Check if quote is expired
 * @param expiresAt ISO date string or null
 * @returns boolean
 */
export const isQuoteExpired = (expiresAt: string | null): boolean => {
  if (!expiresAt) return false;
  const expirationDate = new Date(expiresAt);
  if (isNaN(expirationDate.getTime())) return false;
  const today = new Date();
  return expirationDate < today;
};
