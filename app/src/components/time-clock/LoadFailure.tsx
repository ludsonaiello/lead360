'use client';

/**
 * LoadFailure — inline error state with Retry action.
 *
 * Used across the Time Clock module whenever a page-level API fetch fails.
 * Keeps the user oriented (friendly headline + specific message) and always
 * offers a way forward (Retry button). Not a full-page crash fallback —
 * callers render it inside their normal layout so breadcrumbs, headers, and
 * navigation remain intact.
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface LoadFailureProps {
  title?: string;
  message?: string | null;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}

export function LoadFailure({
  title = 'We could not load this page',
  message,
  onRetry,
  retrying = false,
  className = '',
}: LoadFailureProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/40 dark:bg-red-950/20 ${className}`}
    >
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
        aria-hidden="true"
      >
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm text-red-800/90 dark:text-red-200/90">
        {message
          ? message
          : 'Something went wrong while fetching data. Check your connection and try again.'}
      </p>
      <div className="mt-6">
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={retrying}
          onClick={onRetry}
          className="min-h-[44px]"
        >
          {!retrying && <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      </div>
    </div>
  );
}

export default LoadFailure;
