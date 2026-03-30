/**
 * Financial Dashboard Page
 * Tabbed dashboard: Overview, P&L, Receivable, Payable, Forecast, Alerts
 * Sprint 19: Overview and P&L tabs
 * Sprint 20: Receivable, Payable, Forecast, and Alerts tabs
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  LineChart,
  DollarSign,
  Bell,
} from 'lucide-react';
import { useRBAC } from '@/contexts/RBACContext';
import { getDashboardOverview } from '@/lib/api/financial';
import type { DashboardOverview } from '@/lib/types/financial';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import OverviewTab from './components/OverviewTab';
import ProfitLossTab from './components/ProfitLossTab';
import ReceivableTab from './components/ReceivableTab';
import PayableTab from './components/PayableTab';
import ForecastTab from './components/ForecastTab';
import AlertsTab from './components/AlertsTab';

// ============================================================================
// Tab Definitions
// ============================================================================

const ALL_TABS: (TabItem & { roles: string[] })[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['Owner', 'Admin', 'Bookkeeper'] },
  { id: 'pl', label: 'Profit & Loss', icon: TrendingUp, roles: ['Owner', 'Admin', 'Bookkeeper'] },
  { id: 'receivable', label: 'Receivable', icon: ArrowDownCircle, roles: ['Owner', 'Admin', 'Manager', 'Bookkeeper'] },
  { id: 'payable', label: 'Payable', icon: ArrowUpCircle, roles: ['Owner', 'Admin', 'Manager', 'Bookkeeper'] },
  { id: 'forecast', label: 'Forecast', icon: LineChart, roles: ['Owner', 'Admin', 'Bookkeeper'] },
  { id: 'alerts', label: 'Alerts', icon: Bell, roles: ['Owner', 'Admin', 'Bookkeeper'] },
];

// ============================================================================
// Component
// ============================================================================

export default function FinancialDashboardPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();

  // Filter tabs by role
  const visibleTabs = ALL_TABS.filter((tab) => hasRole(tab.roles));
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Overview data (shared between page header date and Overview tab)
  const [overviewData, setOverviewData] = useState<DashboardOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [forecastDays, setForecastDays] = useState<number>(30);
  const [retryCount, setRetryCount] = useState(0);

  // RBAC: Financial Dashboard visible to Owner, Admin, Manager, Bookkeeper
  const canViewDashboard = hasRole(['Owner', 'Admin', 'Manager', 'Bookkeeper']);
  // Overview/P&L endpoints require Owner, Admin, or Bookkeeper
  const canViewOverview = hasRole(['Owner', 'Admin', 'Bookkeeper']);

  // Fetch overview data for the Overview tab (only for roles that have access)
  const fetchOverview = useCallback(async () => {
    if (!canViewOverview) {
      setOverviewLoading(false);
      return;
    }
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await getDashboardOverview({ forecast_days: forecastDays });
      setOverviewData(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load financial overview';
      setOverviewError(message);
      toast.error(message);
    } finally {
      setOverviewLoading(false);
    }
  }, [forecastDays, canViewOverview]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview, retryCount]);

  // Ensure active tab is in the visible set (when RBAC filters tabs)
  const visibleTabIds = visibleTabs.map(t => t.id).join(',');
  useEffect(() => {
    if (!rbacLoading && visibleTabs.length > 0 && !visibleTabs.some(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rbacLoading, visibleTabIds]);

  // RBAC guard
  if (rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canViewDashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <DollarSign className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view the financial dashboard.</p>
      </div>
    );
  }

  // Generate "as of" date from overview data or now
  const asOfDate = overviewData?.generated_at
    ? new Date(overviewData.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Financial', href: '/financial' },
          { label: 'Dashboard' },
        ]}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Financial Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          As of {asOfDate}
        </p>
      </div>

      {/* Tabs */}
      {visibleTabs.length > 0 && (
        <Tabs
          tabs={visibleTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      )}

      {/* Tab Content */}
      <div className="mt-2">
        {activeTab === 'overview' && (
          <OverviewTab
            data={overviewData}
            loading={overviewLoading}
            error={overviewError}
            onRetry={() => setRetryCount((c) => c + 1)}
            forecastDays={forecastDays}
            onForecastDaysChange={setForecastDays}
            hasRole={hasRole}
          />
        )}

        {activeTab === 'pl' && (
          <ProfitLossTab />
        )}

        {activeTab === 'receivable' && (
          <ReceivableTab />
        )}

        {activeTab === 'payable' && (
          <PayableTab />
        )}

        {activeTab === 'forecast' && (
          <ForecastTab />
        )}

        {activeTab === 'alerts' && (
          <AlertsTab />
        )}
      </div>
    </div>
  );
}
