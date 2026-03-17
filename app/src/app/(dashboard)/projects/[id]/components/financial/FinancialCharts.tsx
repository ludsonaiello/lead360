'use client';

import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/api/projects';
import {
  getCrewPayments,
  getSubcontractorPayments,
} from '@/lib/api/financial';
import type { ProjectFinancialSummary } from '@/lib/types/projects';

interface FinancialChartsProps {
  projectId: string;
  summary: ProjectFinancialSummary;
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#6b7280'];

export default function FinancialCharts({ projectId, summary }: FinancialChartsProps) {
  const [crewPaymentsTotal, setCrewPaymentsTotal] = useState<number>(0);
  const [subPaymentsTotal, setSubPaymentsTotal] = useState<number>(0);
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const [crewData, subData] = await Promise.all([
          getCrewPayments({ project_id: projectId, limit: 100 }),
          getSubcontractorPayments({ project_id: projectId, limit: 100 }),
        ]);

        const crewTotal = crewData.data.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const subTotal = subData.data.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        setCrewPaymentsTotal(crewTotal);
        setSubPaymentsTotal(subTotal);
      } catch {
        // Non-blocking — summaries will show 0
      } finally {
        setLoadingPayments(false);
      }
    };
    loadPayments();
  }, [projectId]);

  // Pie chart data
  const pieData = [
    { name: 'Labor', value: summary.cost_by_category.labor },
    { name: 'Materials', value: summary.cost_by_category.material },
    { name: 'Subcontractor', value: summary.cost_by_category.subcontractor },
    { name: 'Equipment', value: summary.cost_by_category.equipment },
    { name: 'Other', value: summary.cost_by_category.other },
  ].filter((d) => d.value > 0);

  // Bar chart data
  const barData = [];
  if (summary.contract_value !== null) {
    barData.push({
      name: 'Contract Value',
      value: summary.contract_value,
      fill: '#3b82f6',
    });
  }
  if (summary.estimated_cost !== null) {
    barData.push({
      name: 'Estimated Cost',
      value: summary.estimated_cost,
      fill: '#6b7280',
    });
  }
  barData.push({
    name: 'Actual Cost',
    value: summary.total_actual_cost,
    fill: summary.margin_actual !== null && summary.margin_actual !== undefined && summary.margin_actual < 0 ? '#ef4444' : '#22c55e',
  });

  const hasPieData = pieData.length > 0;
  const hasBarData = barData.length > 0;

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{payload[0].name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Cost Breakdown Pie Chart */}
      <Card className="p-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Cost Breakdown</h4>
        {hasPieData ? (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  <span className="text-gray-600 dark:text-gray-400">{entry.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            No cost data to display
          </div>
        )}
      </Card>

      {/* Contract vs Actual Bar Chart */}
      <Card className="p-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Contract vs. Actual Cost</h4>
        {hasBarData ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                type="number"
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                className="text-xs"
                stroke="#9ca3af"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                className="text-xs"
                stroke="#9ca3af"
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value as number), 'Amount']}
                contentStyle={{
                  backgroundColor: 'rgb(255, 255, 255)',
                  border: '1px solid rgb(229, 231, 235)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            No contract data to display
          </div>
        )}

        {/* Margin Indicator */}
        {summary.margin_actual !== null && summary.margin_actual !== undefined && (
          <div className={`mt-4 p-3 rounded-lg ${
            summary.margin_actual >= 0
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Actual Margin</span>
              <span className={`text-lg font-bold ${
                summary.margin_actual >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(summary.margin_actual)}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Crew Payment Summary */}
      <Card className="p-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Crew Payment Summary</h4>
        {loadingPayments ? (
          <div className="py-8"><LoadingSpinner size="md" centered /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Labor Costs (entries)</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(summary.cost_by_category.labor)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Crew Payments Made</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(crewPaymentsTotal)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Subcontractor Payment Summary */}
      <Card className="p-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Subcontractor Payment Summary</h4>
        {loadingPayments ? (
          <div className="py-8"><LoadingSpinner size="md" centered /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Subcontractor Costs (entries)</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(summary.cost_by_category.subcontractor)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Subcontractor Payments Made</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(subPaymentsTotal)}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
