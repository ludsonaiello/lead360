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
}): Promise<DashboardOverview> => {
  const response = await apiClient.get<DashboardOverview>('/quotes/dashboard/overview', {
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
