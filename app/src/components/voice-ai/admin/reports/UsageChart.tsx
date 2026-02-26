import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartDataItem {
  name: string;
  calls: number;
  minutes: number;
  cost: number;
}

interface UsageChartProps {
  data: ChartDataItem[];
}

/**
 * Usage Chart Component
 * Bar chart showing per-tenant breakdown of calls, minutes, and cost
 */
export default function UsageChart({ data }: UsageChartProps) {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Per-Tenant Usage Breakdown
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
          <XAxis
            dataKey="name"
            className="text-xs fill-gray-600 dark:fill-gray-400"
            angle={-45}
            textAnchor="end"
            height={120}
          />
          <YAxis className="text-xs fill-gray-600 dark:fill-gray-400" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg)',
              border: '1px solid var(--tooltip-border)',
              borderRadius: '0.5rem',
            }}
            formatter={(value: any, name: string) => {
              if (name === 'cost') return [formatCurrency(value), 'Cost'];
              if (name === 'minutes') return [value.toFixed(1), 'Minutes'];
              return [value, 'Calls'];
            }}
          />
          <Legend />
          <Bar dataKey="calls" fill="#3b82f6" name="Calls" />
          <Bar dataKey="minutes" fill="#10b981" name="Minutes" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
