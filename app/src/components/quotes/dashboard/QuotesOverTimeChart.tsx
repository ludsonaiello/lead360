'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import { formatMoney } from '@/lib/api/quotes-dashboard';
import type { QuotesOverTimeResponse } from '@/lib/types/quotes';
import { format, parseISO } from 'date-fns';

interface QuotesOverTimeChartProps {
  data: QuotesOverTimeResponse | null;
  loading?: boolean;
}

const CHART_COLORS = {
  count: '#3b82f6', // blue
  totalValue: '#10b981', // green
  approved: '#8b5cf6', // purple
  rejected: '#ef4444', // red
};

export default function QuotesOverTimeChart({ data, loading }: QuotesOverTimeChartProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
          <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </Card>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quotes Over Time
        </h3>
        <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available for the selected date range
        </div>
      </Card>
    );
  }

  // Format data for chart
  const chartData = data.data.map((item) => ({
    date: format(parseISO(item.date), 'MMM d'),
    'Total Quotes': item.count,
    'Revenue': item.total_value,
    'Approved': item.approved_count,
    'Rejected': item.rejected_count,
  }));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Quotes Over Time
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Interval: {data.interval}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="date"
            className="text-xs"
            stroke="#9ca3af"
          />
          <YAxis
            yAxisId="left"
            className="text-xs"
            stroke="#9ca3af"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            className="text-xs"
            stroke="#9ca3af"
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
            formatter={(value: any, name: string | undefined) => {
              if (name === 'Revenue') {
                return [formatMoney(value), name];
              }
              return [value, name];
            }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="Total Quotes"
            stroke={CHART_COLORS.count}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="Approved"
            stroke={CHART_COLORS.approved}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="Rejected"
            stroke={CHART_COLORS.rejected}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="Revenue"
            stroke={CHART_COLORS.totalValue}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
