'use client';

import React from 'react';
import { Loader2, Play, Square } from 'lucide-react';
import type { ClockSessionStatus } from '@/lib/types/time-clock';

type ClockUIStatus = ClockSessionStatus | 'clocked_out';

interface ClockButtonProps {
  status: ClockUIStatus;
  loading: boolean;
  disabled?: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  disabledReason?: string;
}

const baseClasses =
  'group relative inline-flex w-full max-w-[480px] items-center justify-center gap-3 rounded-2xl px-6 text-xl font-bold text-white shadow-lg shadow-black/10 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none active:scale-[0.98] motion-reduce:transform-none';

const variantByStatus: Record<ClockUIStatus, string> = {
  clocked_out:
    'bg-green-600 hover:bg-green-700 focus:ring-green-400 dark:bg-green-600 dark:hover:bg-green-500',
  active:
    'bg-red-600 hover:bg-red-700 focus:ring-red-400 dark:bg-red-600 dark:hover:bg-red-500',
  on_break:
    'bg-amber-600 hover:bg-amber-700 focus:ring-amber-400 dark:bg-amber-600 dark:hover:bg-amber-500',
  completed:
    'bg-green-600 hover:bg-green-700 focus:ring-green-400 dark:bg-green-600 dark:hover:bg-green-500',
};

const labelByStatus: Record<ClockUIStatus, string> = {
  clocked_out: 'Clock In',
  active: 'Clock Out',
  on_break: 'Clock Out',
  completed: 'Clock In',
};

export function ClockButton({
  status,
  loading,
  disabled = false,
  onClockIn,
  onClockOut,
  disabledReason,
}: ClockButtonProps) {
  const isClockIn = status === 'clocked_out' || status === 'completed';
  const label = labelByStatus[status];
  const Icon = isClockIn ? Play : Square;

  const handleClick = () => {
    if (loading || disabled) return;
    if (isClockIn) onClockIn();
    else onClockOut();
  };

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        aria-label={label}
        aria-busy={loading}
        className={`${baseClasses} ${variantByStatus[status]}`}
        style={{ minHeight: 72 }}
      >
        {loading ? (
          <Loader2 className="h-6 w-6 motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <Icon className="h-6 w-6" aria-hidden="true" />
        )}
        <span className="tracking-wide">{loading ? 'Please wait…' : label}</span>
      </button>
      {disabled && disabledReason && !loading && (
        <p className="text-center text-xs font-medium text-gray-600 dark:text-gray-400">
          {disabledReason}
        </p>
      )}
    </div>
  );
}

export default ClockButton;
