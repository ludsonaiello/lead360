/**
 * Quote Admin Tenant Management API Client
 * Tenant-specific quote management endpoints for platform administrators
 * Source: /var/www/lead360.app/api/documentation/quote_admin_REST_API.md
 */

import apiClient from './axios';
import type {
  TenantListParams,
  TenantListResponse,
  TenantComparisonParams,
  TenantComparisonResponse,
  TenantStatsResponse,
  TenantActivityResponse,
  TenantSettingsResponse,
  UpdateTenantSettingsDto,
  MigrateTemplateDto,
  MigrateTemplateResponse,
} from '../types/quote-admin';

// ==========================================
// TENANT MANAGEMENT ENDPOINTS
// ==========================================

/**
 * List all tenants with quote activity, filterable by status and searchable
 * @endpoint GET /admin/quotes/tenants
 * @permission platform_admin:view_all_tenants
 * @param params Filters and pagination
 * @returns Paginated list of tenants with quote statistics
 * @throws 400 - Invalid status (must be: active, trial, suspended, or all)
 * @throws 403 - Platform Admin privileges required
 * @note Cached for 15 minutes
 */
export async function listTenants(
  params?: TenantListParams
): Promise<TenantListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/admin/quotes/tenants${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<TenantListResponse>(url);
  return response.data;
}

/**
 * Compare tenants by specific metric
 * @endpoint GET /admin/quotes/tenants/compare
 * @permission platform_admin:view_all_tenants
 * @param params Comparison metric and filters
 * @returns Ranked tenant comparison
 * @throws 400 - Invalid metric (must be: revenue, quote_count, conversion_rate, or avg_quote_value)
 * @throws 403 - Platform Admin privileges required
 * @note Cached for 15 minutes
 */
export async function compareTenants(
  params: TenantComparisonParams
): Promise<TenantComparisonResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('metric', params.metric);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.date_from) queryParams.append('date_from', params.date_from);
  if (params.date_to) queryParams.append('date_to', params.date_to);

  const url = `/admin/quotes/tenants/compare?${queryParams.toString()}`;
  const response = await apiClient.get<TenantComparisonResponse>(url);
  return response.data;
}

/**
 * Get detailed quote statistics for a specific tenant
 * @endpoint GET /admin/quotes/tenants/:tenantId/stats
 * @permission platform_admin:view_all_tenants
 * @param tenantId Tenant UUID
 * @param params Date range filters
 * @returns Detailed quote statistics including status breakdown, revenue, and conversion metrics
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Tenant not found
 * @note Cached for 15 minutes
 */
export async function getTenantStats(
  tenantId: string,
  params?: { date_from?: string; date_to?: string }
): Promise<TenantStatsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.date_from) queryParams.append('date_from', params.date_from);
  if (params?.date_to) queryParams.append('date_to', params.date_to);

  const url = `/admin/quotes/tenants/${tenantId}/stats${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<TenantStatsResponse>(url);
  return response.data;
}

/**
 * Get tenant activity timeline showing recent quote events
 * @endpoint GET /admin/quotes/tenants/:tenantId/activity
 * @permission platform_admin:view_all_tenants
 * @param tenantId Tenant UUID
 * @param params Date range and limit
 * @returns Timeline of recent quote activities
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Tenant not found
 */
export async function getTenantActivity(
  tenantId: string,
  params?: { date_from?: string; date_to?: string; limit?: number }
): Promise<TenantActivityResponse> {
  const queryParams = new URLSearchParams();
  if (params?.date_from) queryParams.append('date_from', params.date_from);
  if (params?.date_to) queryParams.append('date_to', params.date_to);
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/admin/quotes/tenants/${tenantId}/activity${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<TenantActivityResponse>(url);
  return response.data;
}

/**
 * Get tenant quote settings
 * @endpoint GET /admin/quotes/tenants/:tenantId/settings
 * @permission platform_admin:view_all_tenants
 * @param tenantId Tenant UUID
 * @returns Tenant quote settings
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Tenant not found
 */
export async function getTenantSettings(
  tenantId: string
): Promise<TenantSettingsResponse> {
  const response = await apiClient.get<TenantSettingsResponse>(
    `/admin/quotes/tenants/${tenantId}/settings`
  );
  return response.data;
}

/**
 * Update tenant quote settings
 * @endpoint PATCH /admin/quotes/tenants/:tenantId/settings
 * @permission platform_admin:manage_tenants
 * @param tenantId Tenant UUID
 * @param dto Settings to update
 * @returns Updated tenant settings
 * @throws 400 - Validation errors
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Tenant not found
 */
export async function updateTenantSettings(
  tenantId: string,
  dto: UpdateTenantSettingsDto
): Promise<TenantSettingsResponse> {
  const response = await apiClient.patch<TenantSettingsResponse>(
    `/admin/quotes/tenants/${tenantId}/settings`,
    dto
  );
  return response.data;
}

/**
 * Migrate quotes from one template to another for a specific tenant
 * @endpoint POST /admin/quotes/tenants/:tenantId/migrate-template
 * @permission platform_admin:manage_tenants
 * @param tenantId Tenant UUID
 * @param dto Migration configuration
 * @returns Migration results with success/failed counts
 * @throws 400 - Validation errors or templates not found
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Tenant not found
 * @note This is a potentially long-running operation
 */
export async function migrateTemplate(
  tenantId: string,
  dto: MigrateTemplateDto
): Promise<MigrateTemplateResponse> {
  const response = await apiClient.post<MigrateTemplateResponse>(
    `/admin/quotes/tenants/${tenantId}/migrate-template`,
    dto
  );
  return response.data;
}
