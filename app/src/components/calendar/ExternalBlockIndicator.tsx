// ============================================================================
// ExternalBlockIndicator Component
// ============================================================================
// Displays external calendar blocks (from Google Calendar integration) as
// gray "Busy — Blocked (External)" indicators on the calendar view
// Sprint 31: External Blocks & Non-Available Hours
// ============================================================================

'use client';

import React from 'react';
import type { ExternalBlock } from '@/lib/types/calendar';

// ============================================================================
// Types
// ============================================================================

interface ExternalBlockIndicatorProps {
  block: ExternalBlock;
  style?: React.CSSProperties;
  variant?: 'week' | 'day';
}

// ============================================================================
// Main Component
// ============================================================================

export default function ExternalBlockIndicator({
  block,
  style,
  variant = 'week',
}: ExternalBlockIndicatorProps) {
  const isCompact = variant === 'week';

  return (
    <div
      className="absolute left-0 right-0 bg-gray-300/50 dark:bg-gray-600/50 border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center pointer-events-none z-10"
      style={style}
      title={`External Block (${block.source})\n${new Date(block.start_datetime_utc).toLocaleString()} - ${new Date(block.end_datetime_utc).toLocaleString()}`}
    >
      <div className="flex flex-col items-center justify-center p-1">
        {!block.is_all_day && (
          <span className={`text-gray-600 dark:text-gray-300 font-medium text-center leading-tight ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
            Busy — Blocked
          </span>
        )}
        {block.is_all_day && (
          <span className={`text-gray-600 dark:text-gray-300 font-medium text-center leading-tight ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
            All Day Block
          </span>
        )}
        {!isCompact && (
          <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
            (External)
          </span>
        )}
      </div>
    </div>
  );
}
