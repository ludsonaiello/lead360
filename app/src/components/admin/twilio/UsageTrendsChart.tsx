'use client';

/**
 * UsageTrendsChart Component
 * Sprint 3: Usage Tracking & Billing
 * Displays usage trends over time using recharts
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface UsageTrendsData {
  date: string;
  calls: number;
  sms: number;
  cost: number;
}

interface UsageTrendsChartProps {
  data: UsageTrendsData[];
}

export default function UsageTrendsChart({ data }: UsageTrendsChartProps) {
  // Custom tooltip formatter
  const formatTooltip = (value: number | undefined, name: string | undefined) => {
    if (value === undefined) return '';
    if (name === 'cost') {
      return `$${value.toFixed(2)}`;
    }
    return value.toLocaleString();
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          stroke="#6b7280"
          tick={{ fill: '#6b7280' }}
        />
        <YAxis
          yAxisId="left"
          stroke="#6b7280"
          tick={{ fill: '#6b7280' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#6b7280"
          tick={{ fill: '#6b7280' }}
        />
        <Tooltip
          formatter={formatTooltip}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="calls"
          stroke="#3b82f6"
          name="Calls"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="sms"
          stroke="#10b981"
          name="SMS"
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cost"
          stroke="#f59e0b"
          name="Cost ($)"
          strokeWidth={3}
          dot={{ fill: '#f59e0b', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
