/**
 * Usage & Billing Dashboard Page
 * Sprint 3: Usage Tracking & Billing
 * Monitor platform-wide usage and costs
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Phone, MessageSquare, Mic, FileText, RefreshCw } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import {
  getUsageSummary,
  getTopTenants,
  triggerUsageSync,
} from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import { formatCurrency } from '@/lib/utils/currency-formatter';
import UsageCategoryCard from '@/components/admin/twilio/UsageCategoryCard';
import UsageTrendsChart from '@/components/admin/twilio/UsageTrendsChart';
import TopTenantsTable from '@/components/admin/twilio/TopTenantsTable';
import SyncUsageButton from '@/components/admin/twilio/SyncUsageButton';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { useRouter } from 'next/navigation';
import type {
  UsageSummaryResponse,
  TopTenant,
} from '@/lib/types/twilio-admin';

export default function UsageDashboardPage() {
  const router = useRouter();

  // Date range state (default: current month)
  const [dateRange, setDateRange] = useState({
    start_date: startOfMonth(new Date()).toISOString(),
    end_date: new Date().toISOString(),
  });

  // Data state
  const [usageData, setUsageData] = useState<UsageSummaryResponse | null>(null);
  const [topTenants, setTopTenants] = useState<TopTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Modal state
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch usage data
  const fetchUsageData = async () => {
    try {
      setLoading(true);
      const [usage, tenants] = await Promise.all([
        getUsageSummary({
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
        }),
        getTopTenants(10),
      ]);

      setUsageData(usage);
      setTopTenants(tenants.top_tenants);
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchUsageData();
  }, [dateRange]);

  // Handle sync all tenants
  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      await triggerUsageSync();
      setSuccessMessage('Usage sync initiated for all tenants. This may take several minutes. Data will refresh automatically.');
      setSuccessModalOpen(true);

      // Refresh data after a delay
      setTimeout(() => {
        fetchUsageData();
      }, 5000);
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setSyncing(false);
    }
  };

  // Handle date range change
  const handleDateRangeChange = (start: Date | null, end: Date | null) => {
    if (start && end) {
      setDateRange({
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      });
    }
  };

  // Handle current month button
  const handleCurrentMonth = () => {
    setDateRange({
      start_date: startOfMonth(new Date()).toISOString(),
      end_date: new Date().toISOString(),
    });
  };

  // Handle view tenant details
  const handleViewTenantUsage = (tenantId: string) => {
    router.push(`/admin/communications/twilio/usage/tenants/${tenantId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Sync Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Usage & Billing Dashboard
        </h1>
        <SyncUsageButton
          onClick={handleSyncAll}
          loading={syncing}
          label="Sync All Tenants"
        />
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <DateRangePicker
          startDate={new Date(dateRange.start_date)}
          endDate={new Date(dateRange.end_date)}
          onChange={handleDateRangeChange}
        />
        <Button variant="secondary" onClick={handleCurrentMonth}>
          Current Month
        </Button>
      </div>

      {/* Total Cost Card (Prominent) */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-8">
        <div className="text-lg opacity-90">Total Platform Cost</div>
        <div className="text-5xl font-bold mt-2">
          {formatCurrency(usageData?.total_cost || 0)}
        </div>
        <div className="text-sm opacity-75 mt-2">
          {format(new Date(dateRange.start_date), 'MMM dd')} - {format(new Date(dateRange.end_date), 'MMM dd, yyyy')}
        </div>
        <div className="text-sm opacity-75 mt-1">
          {usageData?.platform_totals.total_tenants || 0} active tenant{usageData?.platform_totals.total_tenants !== 1 ? 's' : ''}
        </div>
      </Card>

      {/* Usage Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <UsageCategoryCard
          title="Voice Calls"
          icon={Phone}
          count={usageData?.platform_totals.calls.count || 0}
          minutes={usageData?.platform_totals.calls.minutes}
          cost={usageData?.platform_totals.calls.cost || '0'}
          iconColor="text-blue-600 dark:text-blue-400"
          costColor="text-blue-600"
        />
        <UsageCategoryCard
          title="SMS Messages"
          icon={MessageSquare}
          count={usageData?.platform_totals.sms.count || 0}
          cost={usageData?.platform_totals.sms.cost || '0'}
          iconColor="text-green-600 dark:text-green-400"
          costColor="text-green-600"
        />
        <UsageCategoryCard
          title="Recordings"
          icon={Mic}
          count={usageData?.platform_totals.recordings.count || 0}
          storage={`${usageData?.platform_totals.recordings.storage_mb || 0} MB`}
          cost={usageData?.platform_totals.recordings.cost || '0'}
          iconColor="text-purple-600 dark:text-purple-400"
          costColor="text-purple-600"
        />
        <UsageCategoryCard
          title="Transcriptions"
          icon={FileText}
          count={usageData?.platform_totals.transcriptions.count || 0}
          cost={usageData?.platform_totals.transcriptions.cost || '0'}
          iconColor="text-orange-600 dark:text-orange-400"
          costColor="text-orange-600"
        />
      </div>

      {/* Usage Trends Chart - Placeholder for now */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Usage Trends
        </h2>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>Trend data visualization coming soon</p>
          <p className="text-sm mt-2">Historical data will be displayed here once collected</p>
        </div>
        {/* <UsageTrendsChart data={[]} /> */}
      </Card>

      {/* Top Tenants Table */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Top Tenants by Communication Volume
        </h2>
        <TopTenantsTable
          tenants={topTenants}
          onViewDetails={handleViewTenantUsage}
        />
      </Card>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Sync Initiated"
        message={successMessage}
      />
    </div>
  );
}
