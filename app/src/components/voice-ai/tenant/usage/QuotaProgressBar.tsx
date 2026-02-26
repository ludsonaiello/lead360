'use client';

// ============================================================================
// QuotaProgressBar Component
// ============================================================================
// Visual quota indicator with progress bar, warnings, and overage alerts
// ============================================================================

import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

interface QuotaProgressBarProps {
  used: number;
  total: number;
  planName: string;
  year: number;
  month: number;
  overageRate: number | null; // null = block calls, number = allow overage at that rate
}

/**
 * Get month name from month number
 */
const getMonthName = (month: number): string => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month - 1] || '';
};

/**
 * QuotaProgressBar Component
 */
export function QuotaProgressBar({
  used,
  total,
  planName,
  year,
  month,
  overageRate,
}: QuotaProgressBarProps) {
  const percentage = Math.min((used / total) * 100, 100);
  const isOverQuota = used > total;
  const overage = used - total;

  // Determine bar color based on usage
  const getBarColor = () => {
    if (isOverQuota) {
      return 'bg-red-500 dark:bg-red-600';
    }
    if (percentage > 80) {
      return 'bg-yellow-500 dark:bg-yellow-600';
    }
    return 'bg-green-500 dark:bg-green-600';
  };

  // Determine status icon and message
  const getStatusMessage = () => {
    if (isOverQuota) {
      return {
        icon: <AlertCircle className="h-5 w-5" />,
        message: overageRate === null
          ? 'Quota exceeded. Your plan blocks calls when quota is exceeded.'
          : `Overage charges apply at $${overageRate.toFixed(2)} per minute.`,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
      };
    }
    if (percentage > 80) {
      return {
        icon: <AlertTriangle className="h-5 w-5" />,
        message: 'You are approaching your quota limit.',
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
      };
    }
    return {
      icon: <CheckCircle className="h-5 w-5" />,
      message: 'You are within your quota limit.',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
    };
  };

  const status = getStatusMessage();

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Voice AI Usage - {getMonthName(month)} {year}
        </h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Plan: {planName} ({total.toLocaleString()} minutes/month)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Used: {used.toLocaleString()} minutes</span>
          <span>Limit: {total.toLocaleString()} minutes</span>
        </div>

        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all duration-300 ${getBarColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className={`font-semibold ${status.color}`}>
            {percentage.toFixed(1)}% used
          </span>
          {isOverQuota && (
            <span className="font-semibold text-red-600 dark:text-red-400">
              Overage: {overage.toLocaleString()} minutes
            </span>
          )}
        </div>
      </div>

      {/* Status Message */}
      <div className={`${status.bgColor} border ${status.borderColor} rounded-lg p-4`}>
        <div className="flex items-start gap-3">
          <div className={`${status.color} flex-shrink-0 mt-0.5`}>
            {status.icon}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${status.color}`}>
              {status.message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
