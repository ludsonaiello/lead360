'use client';

// ============================================================================
// CallOutcomeBadge Component
// ============================================================================
// Badge component for displaying call outcome with appropriate colors
// ============================================================================

import React from 'react';

interface CallOutcomeBadgeProps {
  outcome: 'lead_created' | 'transferred' | 'abandoned' | 'completed' | null;
}

/**
 * CallOutcomeBadge - Outcome badge with color coding
 */
export function CallOutcomeBadge({ outcome }: CallOutcomeBadgeProps) {
  if (!outcome) return null;

  const colors = {
    lead_created: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    transferred: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    abandoned: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  };

  const labels = {
    lead_created: 'Lead Created',
    transferred: 'Transferred',
    abandoned: 'Abandoned',
    completed: 'Completed',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[outcome]}`}
    >
      {labels[outcome]}
    </span>
  );
}
