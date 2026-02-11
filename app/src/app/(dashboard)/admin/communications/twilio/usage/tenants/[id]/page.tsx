/**
 * Tenant Usage Detail Page
 * Sprint 3: Usage Tracking & Billing
 * Display detailed usage for a specific tenant
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Phone, MessageSquare, Mic, FileText, AlertTriangle, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useParams, useRouter } from 'next/navigation';
import {
  getTenantUsage,
  syncTenantUsage,
  getTenantCostEstimate,
} from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import { formatCurrency } from '@/lib/utils/currency-formatter';
import SyncUsageButton from '@/components/admin/twilio/SyncUsageButton';
import Card from '@/components/ui/Card';
import { Select, SelectOption } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { Button } from '@/components/ui/Button';
import type {
  TenantUsageResponse,
  CostEstimateResponse,
} from '@/lib/types/twilio-admin';

export default function TenantUsageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  // Generate month options (last 12 months)
  const generateMonthOptions = (): SelectOption[] => {
    const options: SelectOption[] = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy');
      options.push({ value, label });
    }

    return options;
  };

  // State
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [usageData, setUsageData] = useState<TenantUsageResponse | null>(null);
  const [costEstimate, setCostEstimate] = useState<CostEstimateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Modal state
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch tenant usage
  const fetchTenantUsage = async () => {
    try {
      setLoading(true);
      const [usage, estimate] = await Promise.all([
        getTenantUsage(tenantId, { month: selectedMonth }),
        getTenantCostEstimate(tenantId, selectedMonth).catch(() => null), // Optional
      ]);

      setUsageData(usage);
      setCostEstimate(estimate);
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
    fetchTenantUsage();
  }, [tenantId, selectedMonth]);

  // Handle sync tenant
  const handleSyncTenant = async () => {
    try {
      setSyncing(true);
      await syncTenantUsage(tenantId);
      setSuccessMessage('Usage sync initiated for this tenant. Data will refresh in a few moments.');
      setSuccessModalOpen(true);

      // Refresh data after a delay
      setTimeout(() => {
        fetchTenantUsage();
      }, 5000);
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setSyncing(false);
    }
  };

  // Handle month change
  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
  };

  // Handle back navigation
  const handleBack = () => {
    router.push('/admin/communications/twilio/usage');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">No usage data available for this tenant.</p>
          <Button onClick={handleBack} className="mt-4">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Usage Dashboard
      </button>

      {/* Header with Sync */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {usageData.tenant_name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Last synced: {format(new Date(usageData.synced_at), 'MMM dd, yyyy HH:mm:ss')}
          </p>
        </div>
        <SyncUsageButton
          onClick={handleSyncTenant}
          loading={syncing}
          label="Sync This Tenant"
        />
      </div>

      {/* Month Selector */}
      <div className="max-w-xs">
        <Select
          label="Select Month"
          value={selectedMonth}
          onChange={handleMonthChange}
          options={generateMonthOptions()}
        />
      </div>

      {/* Total Cost Card */}
      <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6">
        <div className="text-sm opacity-90">
          Total Cost for {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
        </div>
        <div className="text-4xl font-bold mt-2">
          {formatCurrency(usageData.total_cost)}
        </div>
      </Card>

      {/* Usage Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calls */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Voice Calls</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {usageData.usage_breakdown.calls.count.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 dark:text-gray-400">Minutes</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {usageData.usage_breakdown.calls.minutes?.toLocaleString() || 0}
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cost</span>
              <span className="text-xl font-bold text-blue-600">
                {formatCurrency(usageData.usage_breakdown.calls.cost)}
              </span>
            </div>
          </div>
        </Card>

        {/* SMS */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">SMS Messages</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {usageData.usage_breakdown.sms.count.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cost</span>
              <span className="text-xl font-bold text-green-600">
                {formatCurrency(usageData.usage_breakdown.sms.cost)}
              </span>
            </div>
          </div>
        </Card>

        {/* Recordings */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Mic className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recordings</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {usageData.usage_breakdown.recordings.count.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 dark:text-gray-400">Storage</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {usageData.usage_breakdown.recordings.storage_mb || 0} MB
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cost</span>
              <span className="text-xl font-bold text-purple-600">
                {formatCurrency(usageData.usage_breakdown.recordings.cost)}
              </span>
            </div>
          </div>
        </Card>

        {/* Transcriptions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Transcriptions</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {usageData.usage_breakdown.transcriptions.count.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cost</span>
              <span className="text-xl font-bold text-orange-600">
                {formatCurrency(usageData.usage_breakdown.transcriptions.cost)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Cost Estimation (if available) */}
      {costEstimate && (
        <Card className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                Month-to-Date Cost Estimate
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                Estimated total: {formatCurrency(costEstimate.cost_estimate.total)}
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                Updated: {format(new Date(costEstimate.estimated_at), 'MMM dd, yyyy HH:mm:ss')}
              </p>
            </div>
          </div>
        </Card>
      )}

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
