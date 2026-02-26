'use client';

// ============================================================================
// CallStatusBadge Component
// ============================================================================
// Badge component for displaying call status with appropriate colors
// ============================================================================

import React from 'react';

interface CallStatusBadgeProps {
  status: 'completed' | 'failed' | 'in_progress' | 'transferred';
}

/**
 * CallStatusBadge - Status badge with color coding
 */
export function CallStatusBadge({ status }: CallStatusBadgeProps) {
  const colors = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    transferred: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  };

  const labels = {
    completed: 'Completed',
    failed: 'Failed',
    in_progress: 'In Progress',
    transferred: 'Transferred',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}
    >
      {labels[status]}
    </span>
  );
}
