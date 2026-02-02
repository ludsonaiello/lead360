'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import { formatMoney } from '@/lib/api/quotes-dashboard';
import type { AvgPricingByTaskResponse } from '@/lib/types/quotes';

interface AvgPricingChartProps {
  data: AvgPricingByTaskResponse | null;
  loading?: boolean;
}

export default function AvgPricingChart({ data, loading }: AvgPricingChartProps) {
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

  if (!data || !data.benchmarks || data.benchmarks.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Average Pricing Benchmarks
        </h3>
        <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No pricing data available
        </div>
      </Card>
    );
  }

  // Sort by usage count and take top 15
  const topTasks = [...data.benchmarks]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 15)
    .map((task) => ({
      name: task.task_title.length > 20
        ? task.task_title.substring(0, 20) + '...'
        : task.task_title,
      fullName: task.task_title,
      avgPrice: task.avg_price,
      minPrice: task.min_price,
      maxPrice: task.max_price,
      medianPrice: task.median_price,
      usage: task.usage_count,
    }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Average Pricing Benchmarks (Top 15)
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={topTasks}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            type="number"
            className="text-xs"
            stroke="#9ca3af"
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <YAxis
            dataKey="name"
            type="category"
            className="text-xs"
            stroke="#9ca3af"
          />
          <Tooltip
            formatter={(value: any, name: string | undefined, props: any) => {
              return [
                <div key="tooltip">
                  <div className="font-semibold mb-1">{props.payload.fullName}</div>
                  <div>Average: {formatMoney(props.payload.avgPrice)}</div>
                  <div>Median: {formatMoney(props.payload.medianPrice)}</div>
                  <div>Min: {formatMoney(props.payload.minPrice)}</div>
                  <div>Max: {formatMoney(props.payload.maxPrice)}</div>
                  <div>Usage: {props.payload.usage} times</div>
                </div>,
                '',
              ];
            }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
          />
          <Bar dataKey="avgPrice" fill="#10b981" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <p>* Bars show average price. Hover for min/max range and usage count.</p>
      </div>
    </Card>
  );
}
