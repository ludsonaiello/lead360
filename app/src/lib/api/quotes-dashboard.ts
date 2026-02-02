/**
 * Quotes Dashboard API Client
 * Handles dashboard overview and analytics for quotes module
 */

import { apiClient } from './axios';

// Types (Updated to match actual API response)
export interface DashboardOverview {
  total_quotes: number;
  total_revenue: number;
  avg_quote_value: number;
  conversion_rate: number;
  by_status: Array<{
    status: string;
    count: number;
    total_revenue: number;
    avg_value: number;
  }>;
  date_from: string;
  date_to: string;
}

export interface RecentQuote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total: number;
  lead: {
    id: string;
    first_name: string;
    last_name: string;
  };
  vendor: {
    id: string;
    name: string;
  };
  jobsite_address: {
    id: string;
    city: string;
    state: string;
    address_line1: string;
  };
  created_at: string;
}

// Helper to get customer name from lead
export const getCustomerName = (quote: RecentQuote): string => {
  if (!quote.lead) return 'N/A';
  return `${quote.lead.first_name} ${quote.lead.last_name}`.trim();
};

// Helper to get vendor name
export const getVendorName = (quote: RecentQuote): string => {
  return quote.vendor?.name || 'N/A';
};

// Helper to get location
export const getLocation = (quote: RecentQuote): string => {
  if (!quote.jobsite_address) return 'N/A';
  return `${quote.jobsite_address.city}, ${quote.jobsite_address.state}`;
};

// API Functions

/**
 * Get dashboard overview with quote statistics
 */
export const getDashboardOverview = async (params?: {
  date_from?: string;
  date_to?: string;
}): Promise<DashboardOverviewResponse> => {
  const response = await apiClient.get<DashboardOverviewResponse>('/quotes/dashboard/overview', {
    params,
  });
  return response.data;
};

/**
 * Get recent quotes with customer and vendor names
 */
export const getRecentQuotes = async (limit: number = 10): Promise<RecentQuote[]> => {
  const response = await apiClient.get<{ data: RecentQuote[] }>('/quotes', {
    params: {
      limit,
      sort_by: 'created_at',
      sort_order: 'desc',
    },
  });
  return response.data.data;
};

/**
 * Helper to format money values
 */
export const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Helper to format percentage change
 */
export const formatPercentageChange = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

// ===== SPRINT 6: Additional Dashboard Analytics Endpoints =====

import type {
  DashboardOverviewResponse,
  QuotesOverTimeResponse,
  TopItemsResponse,
  WinLossAnalysisResponse,
  ConversionFunnelResponse,
  RevenueByVendorResponse,
  AvgPricingByTaskResponse,
  ExportDashboardDto,
  ExportDashboardResponse,
} from '../types/quotes';

/**
 * Get quotes over time with interval breakdown
 */
export const getQuotesOverTime = async (params?: {
  date_from?: string;
  date_to?: string;
  interval?: 'day' | 'week' | 'month';
}): Promise<QuotesOverTimeResponse> => {
  const response = await apiClient.get<QuotesOverTimeResponse>(
    '/quotes/dashboard/quotes-over-time',
    { params }
  );
  return response.data;
};

/**
 * Get top items by usage and revenue
 */
export const getTopItems = async (params?: {
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<TopItemsResponse> => {
  const response = await apiClient.get<TopItemsResponse>('/quotes/dashboard/top-items', {
    params,
  });
  return response.data;
};

/**
 * Get win/loss analysis
 */
export const getWinLossAnalysis = async (params?: {
  date_from?: string;
  date_to?: string;
}): Promise<WinLossAnalysisResponse> => {
  const response = await apiClient.get<WinLossAnalysisResponse>(
    '/quotes/dashboard/win-loss-analysis',
    { params }
  );
  return response.data;
};

/**
 * Get conversion funnel data
 */
export const getConversionFunnel = async (params?: {
  date_from?: string;
  date_to?: string;
}): Promise<ConversionFunnelResponse> => {
  const response = await apiClient.get<ConversionFunnelResponse>(
    '/quotes/dashboard/conversion-funnel',
    { params }
  );
  return response.data;
};

/**
 * Get revenue breakdown by vendor
 */
export const getRevenueByVendor = async (params?: {
  date_from?: string;
  date_to?: string;
}): Promise<RevenueByVendorResponse> => {
  const response = await apiClient.get<RevenueByVendorResponse>(
    '/quotes/dashboard/revenue-by-vendor',
    { params }
  );
  return response.data;
};

/**
 * Get average pricing benchmarks by task
 */
export const getAvgPricingByTask = async (params?: {
  date_from?: string;
  date_to?: string;
}): Promise<AvgPricingByTaskResponse> => {
  const response = await apiClient.get<AvgPricingByTaskResponse>(
    '/quotes/dashboard/avg-pricing-by-task',
    { params }
  );
  return response.data;
};

/**
 * Export dashboard data in specified format
 */
export const exportDashboard = async (dto: ExportDashboardDto): Promise<ExportDashboardResponse> => {
  const response = await apiClient.post<ExportDashboardResponse>(
    '/quotes/dashboard/export',
    dto
  );
  return response.data;
};
