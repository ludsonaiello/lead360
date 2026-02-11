/**
 * ResponseTimeChart Component
 * Displays response time metrics in a line chart
 */

'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import type { ResponseTimeMetrics } from '@/lib/types/twilio-admin';

export interface ResponseTimeChartProps {
  metrics: ResponseTimeMetrics | null;
}

export function ResponseTimeChart({ metrics }: ResponseTimeChartProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Response Time Metrics (24h)
        </h3>
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No metrics available</p>
        </div>
      </Card>
    );
  }

  // Convert array to chart data format
  const chartData = metrics.map((metric) => ({
    name: metric.check_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    avg: metric.avg_response_time_ms,
    max: metric.max_response_time_ms,
    min: metric.min_response_time_ms,
    count: metric.check_count,
  }));

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Response Time Metrics (24h)
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Performance metrics for the last 24 hours
        </p>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="name"
            className="text-xs"
            tick={{ fill: 'currentColor', className: 'fill-gray-600 dark:fill-gray-400' }}
          />
          <YAxis
            label={{
              value: 'Response Time (ms)',
              angle: -90,
              position: 'insideLeft',
              className: 'fill-gray-600 dark:fill-gray-400',
            }}
            className="text-xs"
            tick={{ fill: 'currentColor', className: 'fill-gray-600 dark:fill-gray-400' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg)',
              border: '1px solid var(--tooltip-border)',
              borderRadius: '0.375rem',
              padding: '0.5rem',
            }}
            labelStyle={{ color: 'var(--tooltip-text)' }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: '1rem',
            }}
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#3b82f6"
            name="Average"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="max"
            stroke="#ef4444"
            name="Max"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="min"
            stroke="#10b981"
            name="Min"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Stats Summary */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const colorClass = metric.check_type.includes('twilio')
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            : metric.check_type.includes('transcription')
            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400';

          return (
            <div key={metric.check_type} className={`p-4 rounded-lg ${colorClass}`}>
              <h4 className="text-xs font-medium uppercase tracking-wider mb-2">
                {metric.check_type.replace(/_/g, ' ')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Avg: <span className="font-semibold text-gray-900 dark:text-gray-100">{metric.avg_response_time_ms}ms</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Checks: <span className="font-semibold text-gray-900 dark:text-gray-100">{metric.check_count.toLocaleString()}</span>
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
