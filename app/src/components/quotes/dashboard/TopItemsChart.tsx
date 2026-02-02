'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import { formatMoney } from '@/lib/api/quotes-dashboard';
import type { TopItemsResponse } from '@/lib/types/quotes';

interface TopItemsChartProps {
  data: TopItemsResponse | null;
  loading?: boolean;
}

export default function TopItemsChart({ data, loading }: TopItemsChartProps) {
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

  if (!data || !data.top_items || data.top_items.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top Items
        </h3>
        <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No item data available
        </div>
      </Card>
    );
  }

  const chartData = data.top_items.slice(0, 10).map((item) => ({
    name: item.title.length > 25 ? item.title.substring(0, 25) + '...' : item.title,
    fullName: item.title,
    usage: item.usage_count,
    revenue: item.total_revenue,
    avgPrice: item.avg_price,
  }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Top Items by Usage
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis type="number" className="text-xs" stroke="#9ca3af" />
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
                  <div className="font-semibold">{props.payload.fullName}</div>
                  <div>Usage: {value} times</div>
                  <div>Revenue: {formatMoney(props.payload.revenue)}</div>
                  <div>Avg Price: {formatMoney(props.payload.avgPrice)}</div>
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
          <Bar dataKey="usage" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
