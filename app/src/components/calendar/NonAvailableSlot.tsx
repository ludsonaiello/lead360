// ============================================================================
// NonAvailableSlot Component
// ============================================================================
// Displays non-available hours (outside business hours based on appointment
// type schedule) as grayed/hatched overlay on the calendar view
// Sprint 31: External Blocks & Non-Available Hours
// ============================================================================

'use client';

import React from 'react';

// ============================================================================
// Types
// ============================================================================

interface NonAvailableSlotProps {
  style?: React.CSSProperties;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function NonAvailableSlot({ style, className = '' }: NonAvailableSlotProps) {
  return (
    <div
      className={`absolute left-0 right-0 bg-gray-200/40 dark:bg-gray-700/40 pointer-events-none z-5 ${className}`}
      style={{
        ...style,
        backgroundImage:
          'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,.03) 10px, rgba(0,0,0,.03) 20px)',
      }}
      title="Non-available hours (outside business schedule)"
    />
  );
}
