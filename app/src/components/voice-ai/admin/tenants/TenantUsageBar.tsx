'use client';

// ============================================================================
// TenantUsageBar Component
// ============================================================================
// Visual usage indicator for tenant Voice AI minutes
// ============================================================================

import React from 'react';

interface TenantUsageBarProps {
  used: number;
  limit: number;
  percentage: number;
}

/**
 * TenantUsageBar - Visual progress bar showing usage percentage
 */
export default function TenantUsageBar({
  used,
  limit,
  percentage,
}: TenantUsageBarProps) {
  /**
   * Get color based on usage percentage
   */
  const getColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-amber-500';
    return 'bg-green-500';
  };

  /**
   * Get background color
   */
  const getBgColor = () => {
    if (percentage >= 90) return 'bg-red-100 dark:bg-red-900/20';
    if (percentage >= 75) return 'bg-amber-100 dark:bg-amber-900/20';
    return 'bg-green-100 dark:bg-green-900/20';
  };

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      {/* Progress Bar */}
      <div className={`flex-1 h-2 rounded-full ${getBgColor()}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Percentage Text */}
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[40px] text-right">
        {percentage}%
      </span>
    </div>
  );
}
