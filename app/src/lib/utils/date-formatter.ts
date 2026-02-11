/**
 * Date Formatting Utilities
 * Sprint 4: Transcription Monitoring
 */

import { format, formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Format a date string or Date object to a readable format
 * @param date - ISO date string or Date object
 * @param formatString - date-fns format string (default: 'MMM dd, yyyy HH:mm')
 * @returns Formatted date string
 */
export function formatDateTime(date: string | Date, formatString: string = 'MMM dd, yyyy HH:mm'): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatString);
  } catch (error) {
    console.error('[formatDateTime] Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * Format a date as a relative time (e.g., "2 hours ago")
 * @param date - ISO date string or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.error('[formatRelativeTime] Error formatting date:', error);
    return 'Unknown';
  }
}

/**
 * Format date as just the date (no time)
 * @param date - ISO date string or Date object
 * @returns Date string (e.g., "Jan 15, 2026")
 */
export function formatDate(date: string | Date): string {
  return formatDateTime(date, 'MMM dd, yyyy');
}

/**
 * Format date as just the time
 * @param date - ISO date string or Date object
 * @returns Time string (e.g., "14:32")
 */
export function formatTime(date: string | Date): string {
  return formatDateTime(date, 'HH:mm');
}

/**
 * Format duration in seconds to human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted duration (e.g., "3m 45s", "1h 23m")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${secs}s`;
}
