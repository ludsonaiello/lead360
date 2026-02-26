import React from 'react';
import { Phone, Clock, DollarSign } from 'lucide-react';

interface UsageDashboardProps {
  totalCalls: number;
  totalMinutes: number;
  totalCost: number;
}

/**
 * Usage Dashboard Component
 * KPI cards displaying total calls, minutes, and estimated cost
 */
export default function UsageDashboard({
  totalCalls,
  totalMinutes,
  totalCost,
}: UsageDashboardProps) {
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Calls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Calls</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {formatNumber(totalCalls)}
            </p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Phone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Total Minutes */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Minutes</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {formatNumber(totalMinutes)}
            </p>
          </div>
          <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
            <Clock className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

      {/* Estimated Cost */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Estimated Cost</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {formatCurrency(totalCost)}
            </p>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
            <DollarSign className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
