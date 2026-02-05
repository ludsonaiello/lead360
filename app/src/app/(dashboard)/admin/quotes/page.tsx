/**
 * Quote Admin Dashboard Page
 * Platform-wide quote statistics and overview
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Building2,
  FileText,
  AlertCircle,
  BarChart3,
  Users,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import { getDashboardOverview } from '@/lib/api/quote-admin-analytics';
import type { DashboardOverviewResponse } from '@/lib/types/quote-admin';

export default function QuoteAdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      // Default to last 30 days
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);

      const result = await getDashboardOverview({
        date_from: dateFrom.toISOString(),
        date_to: new Date().toISOString(),
      });
      setData(result);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" centered />;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Failed to load dashboard data</p>
        <Button onClick={loadDashboard} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const stats = data.global_stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Quote Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Platform-wide quote statistics and management
          </p>
        </div>
        <Button onClick={() => router.push('/admin/quotes/analytics')}>
          <BarChart3 className="w-4 h-4" />
          View Analytics
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Quotes */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Quotes</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.total_quotes.toLocaleString()}
              </p>
              {data.trends.quote_velocity && (
                <p className={`text-sm mt-1 ${
                  data.trends.quote_velocity.startsWith('+')
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {data.trends.quote_velocity} vs previous period
                </p>
              )}
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calculator className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        {/* Total Revenue */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                ${stats.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {data.trends.avg_value_change && (
                <p className={`text-sm mt-1 ${
                  data.trends.avg_value_change.startsWith('+')
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {data.trends.avg_value_change} vs previous period
                </p>
              )}
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        {/* Avg Quote Value */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Quote Value</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                ${stats.avg_quote_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>

        {/* Active Tenants */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Tenants</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.active_tenants.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                of {stats.total_tenants.toLocaleString()} total
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Building2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </Card>

        {/* Conversion Rate */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Conversion Rate</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {stats.conversion_rate.toFixed(1)}%
              </p>
              {data.trends.conversion_rate_change && (
                <p className={`text-sm mt-1 ${
                  data.trends.conversion_rate_change.startsWith('+')
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {data.trends.conversion_rate_change} vs previous period
                </p>
              )}
            </div>
            <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <FileText className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>
        </Card>

        {/* New Tenants */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">New Tenants</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {data.tenant_breakdown.new_tenants_this_period.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Last 30 days
              </p>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Top Tenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top by Revenue */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Tenants by Revenue
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Company
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Quotes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {data.tenant_breakdown.top_tenants_by_revenue.slice(0, 5).map((tenant, idx) => (
                  <tr key={tenant.tenant_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {tenant.company_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                      ${tenant.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                      {tenant.quote_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Top by Quote Count */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Tenants by Volume
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Company
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Quotes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {data.tenant_breakdown.top_tenants_by_quote_count.slice(0, 5).map((tenant, idx) => (
                  <tr key={tenant.tenant_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {tenant.company_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                      {tenant.quote_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                      ${tenant.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            variant="secondary"
            onClick={() => router.push('/admin/quotes/analytics')}
            className="w-full"
          >
            <BarChart3 className="w-4 h-4" />
            View Analytics
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push('/admin/quotes/templates')}
            className="w-full"
          >
            <FileText className="w-4 h-4" />
            Manage Templates
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push('/admin/quotes/operational')}
            className="w-full"
          >
            <AlertCircle className="w-4 h-4" />
            Operations
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push('/admin/quotes/reports')}
            className="w-full"
          >
            <BarChart3 className="w-4 h-4" />
            Generate Report
          </Button>
        </div>
      </Card>
    </div>
  );
}
