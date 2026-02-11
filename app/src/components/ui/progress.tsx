/**
 * Progress Component
 * Progress bar indicator
 */

'use client';

import React from 'react';

interface ProgressProps {
  value?: number;
  max?: number;
  className?: string;
}

export function Progress({ value = 0, max = 100, className = '' }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={`
        relative h-2 w-full overflow-hidden rounded-full
        bg-gray-200 dark:bg-gray-700
        ${className}
      `}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-in-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
