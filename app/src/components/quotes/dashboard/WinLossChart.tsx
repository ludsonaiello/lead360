'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Card from '@/components/ui/Card';
import { formatMoney } from '@/lib/api/quotes-dashboard';
import type { WinLossAnalysisResponse } from '@/lib/types/quotes';

interface WinLossChartProps {
  data: WinLossAnalysisResponse | null;
  loading?: boolean;
}

const COLORS = {
  wins: '#10b981', // green
  losses: '#ef4444', // red
};

export default function WinLossChart({ data, loading }: WinLossChartProps) {
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

  if (!data) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Win/Loss Analysis
        </h3>
        <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  const chartData = [
    { name: 'Wins', value: data.total_wins, revenue: data.win_revenue },
    { name: 'Losses', value: data.total_losses, revenue: data.loss_revenue },
  ].filter((item) => item.value > 0);

  if (chartData.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Win/Loss Analysis
        </h3>
        <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No wins or losses in the selected period
        </div>
      </Card>
    );
  }

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="font-semibold text-sm"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Win/Loss Analysis
        </h3>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data.win_rate.toFixed(1)}%
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.name === 'Wins' ? COLORS.wins : COLORS.losses}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, name: string | undefined, props: any) => {
              const revenue = props.payload.revenue;
              return [
                `${value} quotes (${formatMoney(revenue)})`,
                name,
              ];
            }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Win Revenue</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-400">
            {formatMoney(data.win_revenue)}
          </p>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Lost Revenue</p>
          <p className="text-lg font-bold text-red-700 dark:text-red-400">
            {formatMoney(data.loss_revenue)}
          </p>
        </div>
      </div>
    </Card>
  );
}
