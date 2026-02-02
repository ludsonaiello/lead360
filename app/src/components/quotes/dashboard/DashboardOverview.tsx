'use client';

import { DollarSign, FileText, TrendingUp, PercentCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import { formatMoney, formatPercentageChange } from '@/lib/api/quotes-dashboard';
import type { DashboardOverviewResponse } from '@/lib/types/quotes';

interface DashboardOverviewProps {
  data: DashboardOverviewResponse | null;
  loading?: boolean;
}

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  loading?: boolean;
}

function KPICard({ title, value, change, icon, loading }: KPICardProps) {
  const getChangeColor = (changeValue: number) => {
    if (changeValue > 0) return 'text-green-600 dark:text-green-400';
    if (changeValue < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getChangeIcon = (changeValue: number) => {
    if (changeValue > 0) return '↑';
    if (changeValue < 0) return '↓';
    return '→';
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
          {change !== undefined && (
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
          {change !== undefined && (
            <p className={`text-sm font-medium ${getChangeColor(change)}`}>
              {getChangeIcon(change)} {formatPercentageChange(change)}
            </p>
          )}
        </div>
        <div className="ml-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <div className="text-blue-600 dark:text-blue-300">{icon}</div>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardOverview({ data, loading }: DashboardOverviewProps) {
  if (!data && !loading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No data available for the selected date range.
      </div>
    );
  }

  const kpis = [
    {
      title: 'Total Quotes',
      value: data?.total_quotes || 0,
      change: data?.velocity_comparison?.change_percent,
      icon: <FileText className="w-6 h-6" />,
    },
    {
      title: 'Total Revenue',
      value: data ? formatMoney(data.total_revenue) : '$0',
      icon: <DollarSign className="w-6 h-6" />,
    },
    {
      title: 'Average Quote Value',
      value: data ? formatMoney(data.avg_quote_value) : '$0',
      icon: <TrendingUp className="w-6 h-6" />,
    },
    {
      title: 'Conversion Rate',
      value: data ? `${data.conversion_rate.toFixed(1)}%` : '0%',
      icon: <PercentCircle className="w-6 h-6" />,
    },
  ];

  return (
    <div>
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi, index) => (
          <KPICard
            key={index}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            icon={kpi.icon}
            loading={loading}
          />
        ))}
      </div>

      {/* Status Breakdown */}
      {!loading && data && data.by_status && data.by_status.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quotes by Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.by_status.map((statusData, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize mb-1">
                  {statusData.status.replace('_', ' ')}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {statusData.count}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {formatMoney(statusData.total_revenue)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
