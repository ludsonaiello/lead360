/**
 * Quote Admin Analytics API Client
 * Dashboard analytics endpoints for platform administrators
 * Source: /var/www/lead360.app/api/documentation/quote_admin_REST_API.md
 */

import apiClient from './axios';
import type {
  DashboardOverviewResponse,
  QuoteTrendsResponse,
  ConversionFunnelResponse,
  SystemHealthResponse,
  RevenueAnalyticsResponse,
  GlobalItemPricingResponse,
  DateRangeParams,
} from '../types/quote-admin';

// ==========================================
// DASHBOARD ANALYTICS ENDPOINTS
// ==========================================

/**
 * Get platform-wide quote statistics and trends across all tenants
 * @endpoint GET /admin/quotes/dashboard/overview
 * @permission platform_admin:view_all_tenants
 * @param params Date range filters
 * @returns Platform-wide statistics, tenant breakdown, and trends
 * @throws 403 - Platform Admin privileges required
 */
export async function getDashboardOverview(
  params?: DateRangeParams
): Promise<DashboardOverviewResponse> {
  const queryParams = new URLSearchParams();
  if (params?.date_from) queryParams.append('date_from', params.date_from);
  if (params?.date_to) queryParams.append('date_to', params.date_to);

  const url = `/admin/quotes/dashboard/overview${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<DashboardOverviewResponse>(url);
  return response.data;
}

/**
 * Get quote volume and revenue trends over time with configurable interval
 * @endpoint GET /admin/quotes/dashboard/quote-trends
 * @permission platform_admin:view_all_tenants
 * @param params Date range and interval configuration
 * @returns Time series data with quote counts, revenue, and conversion rates
 * @throws 400 - Invalid interval (must be: day, week, or month)
 * @throws 403 - Platform Admin privileges required
 * @note Date range limits: 2 years for "day", 5 years for "week", unlimited for "month"
 */
export async function getQuoteTrends(params: {
  date_from: string;
  date_to: string;
  interval?: 'day' | 'week' | 'month';
}): Promise<QuoteTrendsResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('date_from', params.date_from);
  queryParams.append('date_to', params.date_to);
  if (params.interval) queryParams.append('interval', params.interval);

  const url = `/admin/quotes/dashboard/quote-trends?${queryParams.toString()}`;
  const response = await apiClient.get<QuoteTrendsResponse>(url);
  return response.data;
}

/**
 * Get quote conversion funnel showing status progression and conversion rates
 * @endpoint GET /admin/quotes/dashboard/conversion-funnel
 * @permission platform_admin:view_all_tenants
 * @param params Date range filters
 * @returns Funnel stages, drop-off analysis, and overall conversion rate
 * @throws 403 - Platform Admin privileges required
 */
export async function getConversionFunnel(
  params?: DateRangeParams
): Promise<ConversionFunnelResponse> {
  const queryParams = new URLSearchParams();
  if (params?.date_from) queryParams.append('date_from', params.date_from);
  if (params?.date_to) queryParams.append('date_to', params.date_to);

  const url = `/admin/quotes/dashboard/conversion-funnel${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<ConversionFunnelResponse>(url);
  return response.data;
}

/**
 * Get real-time system health metrics including database, cache, storage, and service status
 * @endpoint GET /admin/quotes/dashboard/system-health
 * @permission platform_admin:view_all_tenants
 * @returns System health status for all services and quote module metrics
 * @throws 403 - Platform Admin privileges required
 * @note Cached for 1 minute only (near real-time)
 */
export async function getSystemHealth(): Promise<SystemHealthResponse> {
  const response = await apiClient.get<SystemHealthResponse>('/admin/quotes/dashboard/system-health');
  return response.data;
}

/**
 * Get revenue analytics grouped by vendor, tenant, or ungrouped aggregates
 * @endpoint GET /admin/quotes/dashboard/revenue-analytics
 * @permission platform_admin:view_all_tenants
 * @param params Date range and grouping configuration
 * @returns Revenue breakdown with optional grouping by vendor or tenant
 * @throws 400 - Invalid group_by value (must be: vendor, tenant, or none)
 * @throws 403 - Platform Admin privileges required
 * @note Revenue only includes approved, started, and concluded quotes
 */
export async function getRevenueAnalytics(params: {
  date_from: string;
  date_to: string;
  group_by?: 'vendor' | 'tenant' | 'none';
}): Promise<RevenueAnalyticsResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('date_from', params.date_from);
  queryParams.append('date_to', params.date_to);
  if (params.group_by) queryParams.append('group_by', params.group_by);

  const url = `/admin/quotes/dashboard/revenue-analytics?${queryParams.toString()}`;
  const response = await apiClient.get<RevenueAnalyticsResponse>(url);
  return response.data;
}

/**
 * Get global item pricing benchmarks across all tenants for competitive analysis
 * @endpoint GET /admin/quotes/dashboard/global-item-pricing
 * @permission platform_admin:view_all_tenants
 * @param params Filters and privacy configuration
 * @returns Pricing benchmarks with privacy anonymization
 * @throws 400 - Invalid parameters (min_tenant_count must be between 2 and 50)
 * @throws 403 - Platform Admin privileges required
 * @note Only items used by at least min_tenant_count tenants are included (privacy protection)
 */
export async function getGlobalItemPricing(params?: {
  item_title_contains?: string;
  min_tenant_count?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<GlobalItemPricingResponse> {
  const queryParams = new URLSearchParams();
  if (params?.item_title_contains) queryParams.append('item_title_contains', params.item_title_contains);
  if (params?.min_tenant_count) queryParams.append('min_tenant_count', params.min_tenant_count.toString());
  if (params?.date_from) queryParams.append('date_from', params.date_from);
  if (params?.date_to) queryParams.append('date_to', params.date_to);
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/admin/quotes/dashboard/global-item-pricing${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<GlobalItemPricingResponse>(url);
  return response.data;
}
