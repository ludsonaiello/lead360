/**
 * Quote Admin Analytics Page
 * Detailed analytics with charts and comparisons
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  FileText,
  Filter,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Tabs } from '@/components/ui/Tabs';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { toast } from 'react-hot-toast';
import {
  getQuoteTrends,
  getConversionFunnel,
  getRevenueAnalytics,
} from '@/lib/api/quote-admin-analytics';
import { compareTenants } from '@/lib/api/quote-admin-tenants';
import type {
  QuoteTrendsResponse,
  ConversionFunnelResponse,
  RevenueAnalyticsResponse,
  TenantComparisonResponse,
} from '@/lib/types/quote-admin';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Helper function to normalize date to start of day in UTC
const getStartOfDayUTC = (date: Date): string => {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized.toISOString();
};

// Helper function to normalize date to end of day in UTC (but not future)
const getEndOfDayUTC = (date: Date): string => {
  const normalized = new Date(date);
  normalized.setUTCHours(23, 59, 59, 999);

  // Ensure we don't send a future date
  const now = new Date();
  if (normalized > now) {
    return now.toISOString();
  }

  return normalized.toISOString();
};

export default function QuoteAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('trends');
  const [loading, setLoading] = useState(true);

  // Initialize with 30 days ago to today (normalized to UTC boundaries)
  const today = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [dateRange, setDateRange] = useState({
    from: getStartOfDayUTC(thirtyDaysAgo),
    to: getEndOfDayUTC(today),
  });

  // Data states
  const [trendsData, setTrendsData] = useState<QuoteTrendsResponse | null>(null);
  const [funnelData, setFunnelData] = useState<ConversionFunnelResponse | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueAnalyticsResponse | null>(null);
  const [tenantComparison, setTenantComparison] = useState<TenantComparisonResponse | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, activeTab]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      if (activeTab === 'trends') {
        const data = await getQuoteTrends({
          date_from: dateRange.from,
          date_to: dateRange.to,
          interval: 'day',
        });
        setTrendsData(data);
      } else if (activeTab === 'conversion') {
        const data = await getConversionFunnel({
          date_from: dateRange.from,
          date_to: dateRange.to,
        });
        setFunnelData(data);
      } else if (activeTab === 'revenue') {
        const data = await getRevenueAnalytics({
          date_from: dateRange.from,
          date_to: dateRange.to,
          group_by: 'tenant',
        });
        setRevenueData(data);
      } else if (activeTab === 'tenants') {
        const data = await compareTenants({
          metric: 'revenue',
          limit: 10,
          date_from: dateRange.from,
          date_to: dateRange.to,
        });
        setTenantComparison(data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (from: Date | null, to: Date | null) => {
    if (from && to) {
      setDateRange({
        from: getStartOfDayUTC(from),
        to: getEndOfDayUTC(to),
      });
    }
  };

  const tabs = [
    { id: 'trends', label: 'Quote Trends', icon: TrendingUp },
    { id: 'conversion', label: 'Conversion Funnel', icon: Filter },
    { id: 'revenue', label: 'Revenue Analysis', icon: FileText },
    { id: 'tenants', label: 'Tenant Comparison', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Quote Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Detailed trends, conversions, and performance metrics
        </p>
      </div>

      {/* Date Range Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Date Range:
          </label>
          <DateRangePicker
            startDate={new Date(dateRange.from)}
            endDate={new Date(dateRange.to)}
            onChange={handleDateRangeChange}
          />
        </div>
      </Card>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Content */}
      {loading ? (
        <LoadingSpinner size="lg" centered />
      ) : (
        <>
          {/* Trends Tab */}
          {activeTab === 'trends' && trendsData && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Quotes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {trendsData.summary.total_quotes.toLocaleString()}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    ${trendsData.summary.total_revenue.toLocaleString()}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Quote Value</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    ${(trendsData.summary.total_revenue / trendsData.summary.total_quotes).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </Card>
              </div>

              {/* Chart */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Quote Volume & Revenue Trends
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendsData.data_points}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis
                      dataKey="date"
                      className="text-gray-600 dark:text-gray-400"
                    />
                    <YAxis
                      yAxisId="left"
                      className="text-gray-600 dark:text-gray-400"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      className="text-gray-600 dark:text-gray-400"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Quote Count"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Revenue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {/* Conversion Funnel Tab */}
          {activeTab === 'conversion' && funnelData && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Conversion Funnel
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={funnelData.funnel_stages} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                    <XAxis type="number" className="text-gray-600 dark:text-gray-400" />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      className="text-gray-600 dark:text-gray-400"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6" name="Quote Count" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Overall Conversion Rate: {funnelData.conversion_rates.overall.toFixed(1)}%
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Sent → Viewed</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {funnelData.conversion_rates.sent_to_viewed.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Viewed → Accepted</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {funnelData.conversion_rates.viewed_to_accepted.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Stage Details */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Stage-by-Stage Breakdown
                </h3>
                <div className="space-y-3">
                  {funnelData.funnel_stages.map((stage, idx) => {
                    const nextStage = funnelData.funnel_stages[idx + 1];
                    const dropoff = nextStage ? stage.count - nextStage.count : 0;
                    const dropoffPercentage = nextStage ? ((dropoff / stage.count) * 100) : 0;

                    return (
                      <div key={stage.stage} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {stage.stage}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {stage.count} quotes ({stage.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        {nextStage && (
                          <div className="text-sm text-red-600 dark:text-red-400">
                            Drop-off to {nextStage.stage}: {dropoff} quotes ({dropoffPercentage.toFixed(1)}%)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* Revenue Analysis Tab */}
          {activeTab === 'revenue' && revenueData && (() => {
            const totalQuotes = revenueData.revenue_by_group.reduce((sum, g) => sum + g.quote_count, 0);
            const avgQuoteValue = totalQuotes > 0 ? revenueData.total_revenue / totalQuotes : 0;

            return (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      ${revenueData.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Quotes</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {totalQuotes.toLocaleString()}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Quote Value</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      ${avgQuoteValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </Card>
                </div>

                {/* Revenue by Group */}
                {revenueData.revenue_by_group.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Revenue Breakdown
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Group
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Revenue
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Quotes
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Avg Value
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              % of Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                          {revenueData.revenue_by_group.map((group) => {
                            const groupAvg = group.quote_count > 0 ? group.revenue / group.quote_count : 0;
                            const percentage = (group.revenue / revenueData.total_revenue) * 100;

                            return (
                              <tr key={group.group_id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                  {group.group_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                  ${group.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                                  {group.quote_count}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                                  ${groupAvg.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                  {percentage.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            );
          })()}

          {/* Tenant Comparison Tab */}
          {activeTab === 'tenants' && tenantComparison && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Tenants</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {tenantComparison.summary.total_tenants}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Metric Average</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {tenantComparison.summary.metric_average.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Metric Median</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {tenantComparison.summary.metric_median.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </Card>
              </div>

              {/* Rankings Table */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Top Tenants by {tenantComparison.metric.replace('_', ' ')}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Rank
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Company
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Metric Value
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Quotes
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Conversion %
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Avg Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                      {tenantComparison.rankings.map((tenant) => (
                        <tr key={tenant.tenant_id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex-shrink-0 h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                #{tenant.rank}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {tenant.tenant_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                            {tenant.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                            {tenant.supplementary.quote_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                            {tenant.supplementary.conversion_rate.toFixed(1)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                            ${tenant.supplementary.avg_quote_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
