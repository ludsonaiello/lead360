'use client';

import React from 'react';
import { Loader2, Check, X, AlertTriangle, MapPin, RotateCw } from 'lucide-react';
import type { GPSStatus } from '@/lib/hooks/useGPSPosition';

interface GPSStatusIndicatorProps {
  status: GPSStatus;
  accuracy?: number | null;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

const containerBase =
  'flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors';

const iconWrap = 'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full';

export function GPSStatusIndicator({
  status,
  accuracy,
  error,
  onRetry,
  className = '',
}: GPSStatusIndicatorProps) {
  if (status === 'idle') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${containerBase} border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400 ${className}`}
      >
        <div className={`${iconWrap} bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400`}>
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </div>
        <span>Location idle</span>
      </div>
    );
  }

  if (status === 'acquiring') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${containerBase} border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 ${className}`}
      >
        <div className={`${iconWrap} bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300`}>
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
        </div>
        <span>Acquiring GPS…</span>
      </div>
    );
  }

  if (status === 'confirmed') {
    const acc = accuracy != null ? Math.round(accuracy) : null;
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${containerBase} border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300 ${className}`}
      >
        <div className={`${iconWrap} bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300`}>
          <Check className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">GPS Confirmed</span>
          {acc != null && (
            <span className="flex-shrink-0 text-xs font-medium text-green-700/80 dark:text-green-300/80">
              ±{acc}m
            </span>
          )}
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`${containerBase} border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 ${className}`}
      >
        <div className={`${iconWrap} bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300`}>
          <X className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate">GPS Denied</p>
          <p className="truncate text-xs font-medium text-red-700/80 dark:text-red-300/80">
            {error || 'Enable location in your browser settings.'}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-900/70"
            aria-label="Retry GPS"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`${containerBase} border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}
    >
      <div className={`${iconWrap} bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200`}>
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate">GPS Unavailable</p>
        {error && (
          <p className="truncate text-xs font-medium text-amber-800/80 dark:text-amber-200/80">
            {error}
          </p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/70"
          aria-label="Retry GPS"
        >
          <RotateCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

export default GPSStatusIndicator;
