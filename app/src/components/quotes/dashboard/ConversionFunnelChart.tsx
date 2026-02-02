'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Card from '@/components/ui/Card';
import { formatMoney } from '@/lib/api/quotes-dashboard';
import type { ConversionFunnelResponse } from '@/lib/types/quotes';

interface ConversionFunnelChartProps {
  data: ConversionFunnelResponse | null;
  loading?: boolean;
}

const STAGE_COLORS: Record<string, string> = {
  Sent: '#3b82f6', // blue
  Read: '#8b5cf6', // purple
  Approved: '#10b981', // green
  Rejected: '#ef4444', // red
};

export default function ConversionFunnelChart({ data, loading }: ConversionFunnelChartProps) {
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

  if (!data || !data.funnel || data.funnel.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Conversion Funnel
        </h3>
        <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No funnel data available
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Conversion Funnel
        </h3>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Overall Rate</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {data.overall_conversion_rate.toFixed(1)}%
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data.funnel}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis type="number" className="text-xs" stroke="#9ca3af" />
          <YAxis
            dataKey="stage"
            type="category"
            className="text-xs"
            stroke="#9ca3af"
          />
          <Tooltip
            formatter={(value: any, name: string | undefined, props: any) => {
              const item = props.payload;
              return [
                <div key="tooltip">
                  <div>Quotes: {value}</div>
                  <div>Value: {formatMoney(item.total_value)}</div>
                  {item.conversion_to_next !== null && (
                    <div>Conversion: {item.conversion_to_next.toFixed(1)}%</div>
                  )}
                  {item.drop_off_rate !== null && (
                    <div>Drop-off: {item.drop_off_rate.toFixed(1)}%</div>
                  )}
                </div>,
                'Stage Details',
              ];
            }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]}>
            {data.funnel.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={STAGE_COLORS[entry.stage] || '#6b7280'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Stage Details */}
      <div className="mt-4 space-y-2">
        {data.funnel.map((stage, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: STAGE_COLORS[stage.stage] || '#6b7280' }}
              ></div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {stage.stage}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
              <span>{stage.count} quotes</span>
              {stage.conversion_to_next !== null && (
                <span className="text-green-600 dark:text-green-400">
                  {stage.conversion_to_next.toFixed(0)}% →
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
