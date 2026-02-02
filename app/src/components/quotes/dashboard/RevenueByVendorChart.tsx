'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import { formatMoney } from '@/lib/api/quotes-dashboard';
import type { RevenueByVendorResponse } from '@/lib/types/quotes';

interface RevenueByVendorChartProps {
  data: RevenueByVendorResponse | null;
  loading?: boolean;
}

export default function RevenueByVendorChart({ data, loading }: RevenueByVendorChartProps) {
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

  if (!data || !data.vendors || data.vendors.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Revenue by Vendor
        </h3>
        <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No vendor data available
        </div>
      </Card>
    );
  }

  // Sort by revenue and take top 10
  const topVendors = [...data.vendors]
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10)
    .map((vendor) => ({
      name: vendor.vendor_name.length > 20
        ? vendor.vendor_name.substring(0, 20) + '...'
        : vendor.vendor_name,
      fullName: vendor.vendor_name,
      revenue: vendor.total_revenue,
      quotes: vendor.quote_count,
      avgValue: vendor.avg_quote_value,
      approvalRate: vendor.approval_rate,
    }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Revenue by Vendor (Top 10)
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={topVendors}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            type="number"
            className="text-xs"
            stroke="#9ca3af"
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
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
                  <div className="font-semibold">{props.payload.fullName}</div>
                  <div>Revenue: {formatMoney(value)}</div>
                  <div>Quotes: {props.payload.quotes}</div>
                  <div>Avg Value: {formatMoney(props.payload.avgValue)}</div>
                  <div>Approval Rate: {props.payload.approvalRate}%</div>
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
          <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
