'use client';

import { useState, useEffect } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DateRangeSelector from '@/components/quotes/dashboard/DateRangeSelector';
import DashboardOverview from '@/components/quotes/dashboard/DashboardOverview';
import QuotesOverTimeChart from '@/components/quotes/dashboard/QuotesOverTimeChart';
import WinLossChart from '@/components/quotes/dashboard/WinLossChart';
import ConversionFunnelChart from '@/components/quotes/dashboard/ConversionFunnelChart';
import RevenueByVendorChart from '@/components/quotes/dashboard/RevenueByVendorChart';
import TopItemsChart from '@/components/quotes/dashboard/TopItemsChart';
import AvgPricingChart from '@/components/quotes/dashboard/AvgPricingChart';
import ExportDashboardModal from '@/components/quotes/dashboard/ExportDashboardModal';
import {
  getDashboardOverview,
  getQuotesOverTime,
  getTopItems,
  getWinLossAnalysis,
  getConversionFunnel,
  getRevenueByVendor,
  getAvgPricingByTask,
} from '@/lib/api/quotes-dashboard';
import type {
  DashboardOverviewResponse,
  QuotesOverTimeResponse,
  TopItemsResponse,
  WinLossAnalysisResponse,
  ConversionFunnelResponse,
  RevenueByVendorResponse,
  AvgPricingByTaskResponse,
} from '@/lib/types/quotes';
import { format, subDays } from 'date-fns';

export default function QuotesDashboardPage() {
  const [dateFrom, setDateFrom] = useState<string>(
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [dateTo, setDateTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Dashboard data state
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [quotesOverTime, setQuotesOverTime] = useState<QuotesOverTimeResponse | null>(null);
  const [topItems, setTopItems] = useState<TopItemsResponse | null>(null);
  const [winLoss, setWinLoss] = useState<WinLossAnalysisResponse | null>(null);
  const [funnel, setFunnel] = useState<ConversionFunnelResponse | null>(null);
  const [revenueByVendor, setRevenueByVendor] = useState<RevenueByVendorResponse | null>(null);
  const [avgPricing, setAvgPricing] = useState<AvgPricingByTaskResponse | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
      };

      // Load all data in parallel
      const results = await Promise.allSettled([
        getDashboardOverview(params),
        getQuotesOverTime({ ...params, interval: 'week' }),
        getTopItems({ ...params, limit: 10 }),
        getWinLossAnalysis(params),
        getConversionFunnel(params),
        getRevenueByVendor(params),
        getAvgPricingByTask(params),
      ]);

      // Process results
      if (results[0].status === 'fulfilled') setOverview(results[0].value);
      if (results[1].status === 'fulfilled') setQuotesOverTime(results[1].value);
      if (results[2].status === 'fulfilled') setTopItems(results[2].value);
      if (results[3].status === 'fulfilled') setWinLoss(results[3].value);
      if (results[4].status === 'fulfilled') setFunnel(results[4].value);
      if (results[5].status === 'fulfilled') setRevenueByVendor(results[5].value);
      if (results[6].status === 'fulfilled') setAvgPricing(results[6].value);

      // Check for errors
      const errors = results.filter((r) => r.status === 'rejected');
      if (errors.length > 0) {
        console.error('Some dashboard requests failed:', errors);
      }
    } catch (err: any) {
      console.error('Dashboard error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [dateFrom, dateTo]);

  const handleDateChange = (from: string | null, to: string | null) => {
    if (from && to) {
      setDateFrom(from);
      setDateTo(to);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Quotes Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Analytics and insights for your quote performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadDashboardData}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Date Range
        </h2>
        <DateRangeSelector onDateChange={handleDateChange} defaultPreset="last_30" />
      </Card>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Dashboard Overview (KPI Cards) */}
      <DashboardOverview data={overview} loading={loading} />

      {/* Charts Grid */}
      <div className="space-y-6">
        {/* Full Width: Quotes Over Time */}
        <QuotesOverTimeChart data={quotesOverTime} loading={loading} />

        {/* Two Columns: Win/Loss + Funnel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WinLossChart data={winLoss} loading={loading} />
          <ConversionFunnelChart data={funnel} loading={loading} />
        </div>

        {/* Full Width: Revenue by Vendor */}
        <RevenueByVendorChart data={revenueByVendor} loading={loading} />

        {/* Two Columns: Top Items + Avg Pricing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopItemsChart data={topItems} loading={loading} />
          <AvgPricingChart data={avgPricing} loading={loading} />
        </div>
      </div>

      {/* Export Modal */}
      <ExportDashboardModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  );
}
