/**
 * Quote Admin Operational Tools API Client
 * Cross-tenant quote search, bulk operations, diagnostics, and emergency tools
 * Source: /var/www/lead360.app/api/documentation/quote_admin_REST_API.md
 */

import apiClient from './axios';
import type {
  AdminQuoteSearchParams,
  AdminQuoteListResponse,
  AdminQuoteDetailResponse,
  BulkStatusUpdateDto,
  BulkStatusUpdateResponse,
  QuoteDiagnosticsResponse,
  RecalculateQuoteResponse,
  BulkExportParams,
  BulkExportResponse,
  OrphanedQuotesResponse,
} from '../types/quote-admin';

// ==========================================
// OPERATIONAL TOOLS ENDPOINTS
// ==========================================

/**
 * Search quotes across all tenants with advanced filtering
 * @endpoint GET /admin/quotes
 * @permission platform_admin:view_all_tenants
 * @param params Search and filter parameters
 * @returns Paginated list of quotes with tenant information
 * @throws 403 - Platform Admin privileges required
 * @note Cross-tenant search capability
 */
export async function searchQuotes(
  params?: AdminQuoteSearchParams
): Promise<AdminQuoteListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.tenant_id) queryParams.append('tenant_id', params.tenant_id);
  if (params?.quote_number) queryParams.append('quote_number', params.quote_number);
  if (params?.customer_name) queryParams.append('customer_name', params.customer_name);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.date_from) queryParams.append('date_from', params.date_from);
  if (params?.date_to) queryParams.append('date_to', params.date_to);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/admin/quotes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<AdminQuoteListResponse>(url);
  return response.data;
}

/**
 * Get detailed quote information from any tenant
 * @endpoint GET /admin/quotes/:id
 * @permission platform_admin:view_all_tenants
 * @param quoteId Quote UUID
 * @returns Complete quote details including items, customer, and creator
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Quote not found
 */
export async function getQuoteDetail(
  quoteId: string
): Promise<AdminQuoteDetailResponse> {
  const response = await apiClient.get<AdminQuoteDetailResponse>(
    `/admin/quotes/${quoteId}`
  );
  return response.data;
}

/**
 * Bulk update quote status across multiple quotes (potentially cross-tenant)
 * @endpoint PATCH /admin/quotes/bulk/status
 * @permission platform_admin:manage_quotes
 * @param dto Bulk status update configuration
 * @returns Update results with success/failure counts
 * @throws 400 - Validation errors (quote_ids required, invalid status)
 * @throws 403 - Platform Admin privileges required
 * @note This is a destructive operation - use with caution
 */
export async function bulkUpdateQuoteStatus(
  dto: BulkStatusUpdateDto
): Promise<BulkStatusUpdateResponse> {
  const response = await apiClient.patch<BulkStatusUpdateResponse>(
    '/admin/quotes/bulk/status',
    dto
  );
  return response.data;
}

/**
 * Emergency hard delete quote (DESTRUCTIVE - permanent deletion)
 * @endpoint DELETE /admin/quotes/:id/hard-delete
 * @permission platform_admin:emergency_operations
 * @param quoteId Quote UUID
 * @param reason Required reason for deletion (audit trail)
 * @returns Deletion confirmation
 * @throws 400 - Reason required
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Quote not found
 * @warning This is IRREVERSIBLE and bypasses soft delete - use only in emergencies
 */
export async function hardDeleteQuote(
  quoteId: string,
  reason: string
): Promise<{ message: string; audit_id: string }> {
  const response = await apiClient.delete<{ message: string; audit_id: string }>(
    `/admin/quotes/${quoteId}/hard-delete`,
    { data: { reason } }
  );
  return response.data;
}

/**
 * Run comprehensive diagnostics on a quote
 * @endpoint GET /admin/quotes/:id/diagnostics
 * @permission platform_admin:view_all_tenants
 * @param quoteId Quote UUID
 * @returns Diagnostic results covering schema, pricing, references, and PDF generation
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Quote not found
 * @note Useful for troubleshooting quote issues
 */
export async function runQuoteDiagnostics(
  quoteId: string
): Promise<QuoteDiagnosticsResponse> {
  const response = await apiClient.get<QuoteDiagnosticsResponse>(
    `/admin/quotes/${quoteId}/diagnostics`
  );
  return response.data;
}

/**
 * Force recalculate quote totals (fixes pricing discrepancies)
 * @endpoint POST /admin/quotes/:id/recalculate
 * @permission platform_admin:manage_quotes
 * @param quoteId Quote UUID
 * @returns Recalculation results showing old vs new totals
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Quote not found
 * @throws 422 - Recalculation failed (missing data)
 */
export async function recalculateQuote(
  quoteId: string
): Promise<RecalculateQuoteResponse> {
  const response = await apiClient.post<RecalculateQuoteResponse>(
    `/admin/quotes/${quoteId}/recalculate`
  );
  return response.data;
}

/**
 * Generate bulk export of quotes (CSV or XLSX)
 * @endpoint POST /admin/quotes/bulk/export
 * @permission platform_admin:view_all_tenants
 * @param params Export configuration
 * @returns Export job ID and status
 * @throws 400 - Validation errors (format required)
 * @throws 403 - Platform Admin privileges required
 * @note Export is generated asynchronously - poll for completion
 */
export async function bulkExportQuotes(
  params: BulkExportParams
): Promise<BulkExportResponse> {
  const response = await apiClient.post<BulkExportResponse>(
    '/admin/quotes/bulk/export',
    params
  );
  return response.data;
}

/**
 * Get list of orphaned quotes (missing references to customers, vendors, etc.)
 * @endpoint GET /admin/quotes/orphaned
 * @permission platform_admin:view_all_tenants
 * @returns List of orphaned quotes with issue descriptions
 * @throws 403 - Platform Admin privileges required
 * @note Useful for data integrity checks and cleanup
 */
export async function getOrphanedQuotes(): Promise<OrphanedQuotesResponse> {
  const response = await apiClient.get<OrphanedQuotesResponse>(
    '/admin/quotes/orphaned'
  );
  return response.data;
}
