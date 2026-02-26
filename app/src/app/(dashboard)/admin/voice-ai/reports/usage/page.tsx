'use client';

import React, { useEffect, useState, useMemo } from 'react';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorModal from '@/components/ui/ErrorModal';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import UsageDashboard from '@/components/voice-ai/admin/reports/UsageDashboard';
import UsageChart from '@/components/voice-ai/admin/reports/UsageChart';
import TenantBreakdown from '@/components/voice-ai/admin/reports/TenantBreakdown';
import voiceAiApi from '@/lib/api/voice-ai';
import type { UsageReport } from '@/lib/types/voice-ai';
import { TrendingUp, RefreshCw, Download } from 'lucide-react';

/**
 * Voice AI Usage Report Page (Platform Admin Only)
 * Route: /admin/voice-ai/reports/usage
 *
 * Features:
 * - Platform-wide usage KPIs
 * - Month/Year selector
 * - Bar chart showing per-tenant breakdown
 * - Tenant usage table
 * - Export to CSV
 */
export default function UsageReportPage() {
  // State management
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date selection
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Prepare year options (memoized)
  const yearOptions = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const year = currentYear - i;
        return { value: year.toString(), label: year.toString() };
      }),
    [currentYear]
  );

  // Prepare month options (memoized)
  const monthOptions = useMemo(() => {
    const getMonthName = (month: number): string => {
      return new Date(2000, month - 1).toLocaleString('en-US', { month: 'long' });
    };

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return { value: month.toString(), label: getMonthName(month) };
    });
  }, []);

  // Initial data load
  useEffect(() => {
    fetchUsageReport();
  }, [selectedYear, selectedMonth]);

  const fetchUsageReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await voiceAiApi.getUsageReport(selectedYear, selectedMonth);
      setUsageReport(data);
    } catch (err: any) {
      console.error('Failed to fetch usage report:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load usage report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!usageReport) return;

    try {
      // Create CSV content
      const headers = ['Tenant Name', 'Total Calls', 'Total Minutes', 'Estimated Cost'];

      const rows = usageReport.by_tenant.map((tenant) => [
        tenant.tenant_name,
        tenant.total_calls.toString(),
        (tenant.total_stt_seconds / 60).toFixed(2),
        tenant.estimated_cost.toFixed(2),
      ]);

      // Add summary row
      rows.push([
        'TOTAL',
        usageReport.total_calls.toString(),
        (usageReport.total_stt_seconds / 60).toFixed(2),
        usageReport.total_estimated_cost.toFixed(2),
      ]);

      const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `usage_report_${selectedYear}_${selectedMonth.toString().padStart(2, '0')}.csv`;
      link.click();
    } catch (err: any) {
      console.error('Failed to export CSV:', err);
      setError('Failed to export CSV');
    }
  };

  const formatMinutes = (seconds: number): string => {
    return (seconds / 60).toFixed(1);
  };

  const getMonthName = (month: number): string => {
    return new Date(2000, month - 1).toLocaleString('en-US', { month: 'long' });
  };

  const breadcrumbItems = [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: 'Voice AI', href: '/admin/voice-ai/providers' },
    { label: 'Reports', href: '/admin/voice-ai/reports' },
    { label: 'Usage Analytics', href: '/admin/voice-ai/reports/usage' },
  ];

  // Prepare chart data
  const chartData =
    usageReport?.by_tenant.map((tenant) => ({
      name: tenant.tenant_name,
      calls: tenant.total_calls,
      minutes: parseFloat(formatMinutes(tenant.total_stt_seconds)),
      cost: tenant.estimated_cost,
    })) || [];

  return (
    <ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-100 dark:bg-brand-900/20 rounded-lg">
                <TrendingUp className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Usage Analytics
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Platform-wide Voice AI usage for {getMonthName(selectedMonth)} {selectedYear}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleExportCSV}
                disabled={!usageReport || usageReport.by_tenant.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={fetchUsageReport} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Month/Year Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-48">
              <Select
                label="Year"
                options={yearOptions}
                value={selectedYear.toString()}
                onChange={(value) => setSelectedYear(parseInt(value))}
              />
            </div>

            <div className="w-48">
              <Select
                label="Month"
                options={monthOptions}
                value={selectedMonth.toString()}
                onChange={(value) => setSelectedMonth(parseInt(value))}
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && !usageReport ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !usageReport ? (
          /* Error/Empty State */
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No usage data
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No usage data found for the selected period.
            </p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <UsageDashboard
              totalCalls={usageReport.total_calls}
              totalMinutes={parseFloat(formatMinutes(usageReport.total_stt_seconds))}
              totalCost={usageReport.total_estimated_cost}
            />

            {/* Usage Chart */}
            {chartData.length > 0 && <UsageChart data={chartData} />}

            {/* Tenant Breakdown Table */}
            <TenantBreakdown
              tenants={usageReport.by_tenant}
              totalCalls={usageReport.total_calls}
              totalMinutes={usageReport.total_stt_seconds}
              totalCost={usageReport.total_estimated_cost}
            />
          </>
        )}
      </div>

      {/* Error Modal */}
      {error && (
        <ErrorModal
          isOpen={!!error}
          onClose={() => setError(null)}
          title="Error"
          message={error}
        />
      )}
    </ProtectedRoute>
  );
}
