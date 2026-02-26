/**
 * Voice AI Usage Dashboard (Tenant)
 * Route: /(dashboard)/voice-ai/usage
 * Permission: Owner, Admin, Manager
 */

'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Loader2, AlertCircle } from 'lucide-react';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { MonthYearSelector } from '@/components/voice-ai/tenant/usage/MonthYearSelector';
import { UsageKPICards } from '@/components/voice-ai/tenant/usage/UsageKPICards';
import { QuotaProgressBar } from '@/components/voice-ai/tenant/usage/QuotaProgressBar';
import { ProviderBreakdown } from '@/components/voice-ai/tenant/usage/ProviderBreakdown';
import { UpgradePlanCTA } from '@/components/voice-ai/tenant/usage/UpgradePlanCTA';
import * as voiceAiApi from '@/lib/api/voice-ai';
import type { TenantUsageSummaryResponse } from '@/lib/types/voice-ai';
import toast from 'react-hot-toast';

export default function UsageDashboardPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Voice AI', href: '/voice-ai/settings' },
    { label: 'Usage Dashboard', href: '/voice-ai/usage' },
  ];

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const [usageData, setUsageData] = useState<TenantUsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load usage data from API
   */
  const loadUsageData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await voiceAiApi.getTenantUsage(selectedYear, selectedMonth);
      setUsageData(data);
    } catch (err: any) {
      console.error('[UsageDashboard] Failed to load usage data:', err);
      const errorMessage = err.response?.data?.message || 'Failed to load usage data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load data on mount and when year/month changes
   */
  useEffect(() => {
    loadUsageData();
  }, [selectedYear, selectedMonth]);

  /**
   * Calculate minutes from seconds
   */
  const minutesUsed = usageData ? Math.ceil(usageData.total_stt_seconds / 60) : 0;

  /**
   * Plan quota (hardcoded for now - can be fetched from settings later)
   * TODO: Fetch this from tenant settings or subscription plan
   */
  const planMinutesIncluded = 500; // Professional plan
  const planName = 'Professional';
  const overageRate = null; // null means block calls when quota exceeded

  const minutesRemaining = Math.max(0, planMinutesIncluded - minutesUsed);
  const percentageUsed = (minutesUsed / planMinutesIncluded) * 100;
  const isOverQuota = minutesUsed > planMinutesIncluded;
  const overageMinutes = isOverQuota ? minutesUsed - planMinutesIncluded : 0;

  return (
    <ProtectedRoute requiredRole={['Owner', 'Admin', 'Manager']}>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-4 flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Voice AI Usage Dashboard
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Monitor your monthly Voice AI usage and quota
              </p>
            </div>
          </div>
        </div>

        {/* Month/Year Selector */}
        <MonthYearSelector
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
        />

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading usage data...
            </span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100">
                  Failed to load usage data
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Usage Data */}
        {!loading && !error && usageData && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <UsageKPICards
              totalCalls={usageData.total_calls}
              minutesUsed={minutesUsed}
              minutesRemaining={minutesRemaining}
              estimatedCost={usageData.estimated_cost}
            />

            {/* Quota Progress Bar */}
            <QuotaProgressBar
              used={minutesUsed}
              total={planMinutesIncluded}
              planName={planName}
              year={usageData.year}
              month={usageData.month}
              overageRate={overageRate}
            />

            {/* Overage Warning (if quota exceeded and no overage allowed) */}
            {isOverQuota && overageRate === null && (
              <UpgradePlanCTA
                overageMinutes={overageMinutes}
                planMinutesIncluded={planMinutesIncluded}
              />
            )}

            {/* Provider Breakdown */}
            <ProviderBreakdown
              providers={usageData.by_provider}
              totalEstimatedCost={usageData.estimated_cost}
            />
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && usageData && usageData.total_calls === 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No usage data for this period
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You haven't made any Voice AI calls in{' '}
              {new Date(usageData.year, usageData.month - 1).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
              .
            </p>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
