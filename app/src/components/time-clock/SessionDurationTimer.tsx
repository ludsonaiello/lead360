'use client';

import React, { useEffect, useState } from 'react';
import { differenceInSeconds } from 'date-fns';
import { Coffee } from 'lucide-react';

interface SessionDurationTimerProps {
  clockInAt: string;
  isPaused?: boolean;
  className?: string;
  label?: string;
}

function formatElapsed(seconds: number): string {
  const safe = seconds < 0 ? 0 : seconds;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function SessionDurationTimer({
  clockInAt,
  isPaused = false,
  className = '',
  label,
}: SessionDurationTimerProps) {
  const computeElapsed = () => {
    const start = new Date(clockInAt);
    if (Number.isNaN(start.getTime())) return 0;
    return differenceInSeconds(new Date(), start);
  };

  const [elapsed, setElapsed] = useState<number>(computeElapsed);

  useEffect(() => {
    setElapsed(computeElapsed());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockInAt]);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setElapsed((prev) => {
        const start = new Date(clockInAt);
        if (Number.isNaN(start.getTime())) return prev;
        return differenceInSeconds(new Date(), start);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [clockInAt, isPaused]);

  const display = formatElapsed(elapsed);
  const colorClass = isPaused
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-gray-900 dark:text-white';

  return (
    <div
      className={`flex flex-col items-center gap-1 ${className}`}
      aria-live="polite"
      aria-atomic="true"
      role="timer"
    >
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </span>
      )}
      <span
        className={`font-mono text-5xl font-bold leading-none tabular-nums sm:text-6xl ${colorClass}`}
        aria-label={`Elapsed time ${display}${isPaused ? ' (on break)' : ''}`}
      >
        {display}
      </span>
      {isPaused && (
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <Coffee className="h-3 w-3" aria-hidden="true" />
          On Break
        </span>
      )}
    </div>
  );
}

export default SessionDurationTimer;
