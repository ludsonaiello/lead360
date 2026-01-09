/**
 * Job Helper Functions
 * Format durations, job types, and status colors
 */

import type { JobStatus } from '@/lib/types/jobs';
import { Clock, Loader2, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react';

/**
 * Format duration in milliseconds to human-readable string
 * Examples:
 * - 2300 → "2.3s"
 * - 65000 → "1.1m"
 * - 3600000 → "1.0h"
 */
export function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return '0s';

  if (ms < 1000) {
    return `${ms}ms`;
  }

  if (ms < 60000) {
    // Less than 1 minute
    return `${(ms / 1000).toFixed(1)}s`;
  }

  if (ms < 3600000) {
    // Less than 1 hour
    return `${(ms / 60000).toFixed(1)}m`;
  }

  // 1 hour or more
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format job type to human-readable label
 * Examples:
 * - "send-email" → "Send Email"
 * - "expiry-check" → "Expiry Check"
 * - "data-cleanup" → "Data Cleanup"
 */
export function formatJobType(jobType: string): string {
  return jobType
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get status badge color classes for Tailwind
 */
export function getStatusColor(status: JobStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-800 dark:text-yellow-300',
        border: 'border-yellow-200 dark:border-yellow-800',
      };
    case 'processing':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-800 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
      };
    case 'completed':
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-800 dark:text-green-300',
        border: 'border-green-200 dark:border-green-800',
      };
    case 'failed':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-800 dark:text-red-300',
        border: 'border-red-200 dark:border-red-800',
      };
    default:
      return {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-800 dark:text-gray-300',
        border: 'border-gray-200 dark:border-gray-600',
      };
  }
}

/**
 * Get status icon (Lucide React component)
 */
export function getStatusIcon(status: JobStatus): LucideIcon {
  switch (status) {
    case 'pending':
      return Clock;
    case 'processing':
      return Loader2;
    case 'completed':
      return CheckCircle2;
    case 'failed':
      return XCircle;
    default:
      return Clock;
  }
}

/**
 * Get log level color classes
 */
export function getLogLevelColor(level: 'debug' | 'info' | 'warn' | 'error'): {
  bg: string;
  text: string;
} {
  switch (level) {
    case 'debug':
      return {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-700 dark:text-gray-300',
      };
    case 'info':
      return {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
      };
    case 'warn':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-300',
      };
    case 'error':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
      };
    default:
      return {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-700 dark:text-gray-300',
      };
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

/**
 * Format absolute time (e.g., "Jan 5, 2026 at 10:30 AM")
 */
export function formatAbsoluteTime(dateString: string | null): string {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get priority label
 */
export function getPriorityLabel(priority: number): string {
  if (priority <= 2) return 'Critical';
  if (priority <= 5) return 'High';
  if (priority <= 7) return 'Normal';
  return 'Low';
}

/**
 * Get priority color classes
 */
export function getPriorityColor(priority: number): {
  bg: string;
  text: string;
} {
  if (priority <= 2) {
    return {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-300',
    };
  }
  if (priority <= 5) {
    return {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-800 dark:text-orange-300',
    };
  }
  if (priority <= 7) {
    return {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-800 dark:text-blue-300',
    };
  }
  return {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-800 dark:text-gray-300',
  };
}
