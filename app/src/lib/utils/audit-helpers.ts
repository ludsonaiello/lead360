// Audit Log Utility Functions

import { formatDistanceToNow, format, parseISO } from 'date-fns';
import type { LucideIcon } from 'lucide-react';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  XCircle,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { AuditLog, ActionType, Status } from '@/lib/types/audit';

/**
 * Format timestamp as relative time ("2 hours ago")
 *
 * @param timestamp - ISO-8601 timestamp string
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime("2026-01-06T10:30:00Z") // "2 hours ago"
 */
export function formatRelativeTime(timestamp: string): string {
  try {
    return formatDistanceToNow(parseISO(timestamp), { addSuffix: true });
  } catch (error) {
    return 'Unknown time';
  }
}

/**
 * Format timestamp as absolute time ("Jan 5, 2026 at 10:30 AM")
 *
 * @param timestamp - ISO-8601 timestamp string
 * @returns Formatted date string
 *
 * @example
 * formatAbsoluteTime("2026-01-06T10:30:45.123Z") // "Jan 6, 2026 at 10:30 AM"
 */
export function formatAbsoluteTime(timestamp: string): string {
  try {
    return format(parseISO(timestamp), "MMM d, yyyy 'at' h:mm a");
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format timestamp for display with both relative and absolute
 *
 * @param timestamp - ISO-8601 timestamp string
 * @returns Object with relative and absolute time strings
 *
 * @example
 * formatTimestamp("2026-01-06T10:30:00Z")
 * // { relative: "2 hours ago", absolute: "Jan 6, 2026 at 10:30 AM" }
 */
export function formatTimestamp(timestamp: string): { relative: string; absolute: string } {
  return {
    relative: formatRelativeTime(timestamp),
    absolute: formatAbsoluteTime(timestamp)
  };
}

/**
 * Format actor display name
 *
 * @param log - Audit log entry
 * @returns Display name for actor
 *
 * @example
 * formatActorName(log) // "John Doe" or "System" or "Platform Admin"
 */
export function formatActorName(log: AuditLog): string {
  // System actions
  if (log.actor_type === 'system' || log.actor_type === 'cron_job') {
    return 'System';
  }

  // Platform admin
  if (log.actor_type === 'platform_admin') {
    return log.actor
      ? `${log.actor.first_name} ${log.actor.last_name} (Admin)`
      : 'Platform Admin';
  }

  // Regular user
  if (log.actor) {
    return `${log.actor.first_name} ${log.actor.last_name}`;
  }

  return 'Unknown User';
}

/**
 * Get initials from actor name for avatar
 *
 * @param log - Audit log entry
 * @returns Initials (e.g., "JD")
 */
export function getActorInitials(log: AuditLog): string {
  if (log.actor_type === 'system' || log.actor_type === 'cron_job') {
    return 'SYS';
  }

  if (log.actor) {
    const first = log.actor.first_name?.[0] || '';
    const last = log.actor.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  return '?';
}

/**
 * Format entity type for display
 * Converts database names to user-friendly labels
 *
 * @param entityType - Entity type from database
 * @returns User-friendly label
 *
 * @example
 * formatEntityType("tenant") // "Business Profile"
 * formatEntityType("user") // "User"
 * formatEntityType("tenant_address") // "Business Address"
 */
export function formatEntityType(entityType: string): string {
  const entityMap: Record<string, string> = {
    // Tenant-related
    tenant: 'Business Profile',
    tenant_address: 'Business Address',
    tenant_license: 'Professional License',
    tenant_insurance: 'Insurance',
    tenant_payment_terms: 'Payment Terms',
    tenant_business_hours: 'Business Hours',
    tenant_service_area: 'Service Area',

    // User & Auth
    user: 'User',
    auth_session: 'Login Session',
    auth_attempt: 'Login Attempt',
    password_reset_token: 'Password Reset',

    // RBAC
    role: 'Role',
    permission: 'Permission',
    user_role: 'User Role Assignment',
    role_permission: 'Role Permission',
    module: 'Module',

    // Files
    file: 'File',

    // Generic
    api_request: 'API Request'
  };

  return entityMap[entityType] || entityType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get icon component for action type
 *
 * @param actionType - Action type enum
 * @returns Lucide icon component
 */
export function getActionIcon(actionType: ActionType): LucideIcon {
  const iconMap: Record<ActionType, LucideIcon> = {
    created: Plus,
    updated: Edit,
    deleted: Trash2,
    accessed: Eye,
    failed: XCircle
  };

  return iconMap[actionType] || AlertCircle;
}

/**
 * Get Tailwind color classes for action type badge
 *
 * @param actionType - Action type enum
 * @returns Tailwind CSS classes for background and text color
 */
export function getActionColorClasses(actionType: ActionType): string {
  const colorMap: Record<ActionType, string> = {
    created: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    updated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    deleted: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    accessed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  };

  return colorMap[actionType] || 'bg-gray-100 text-gray-800';
}

/**
 * Get icon component for status
 *
 * @param status - Status enum
 * @returns Lucide icon component
 */
export function getStatusIcon(status: Status): LucideIcon {
  return status === 'success' ? CheckCircle : XCircle;
}

/**
 * Get Tailwind color classes for status
 *
 * @param status - Status enum
 * @returns Tailwind CSS classes
 */
export function getStatusColorClasses(status: Status): string {
  return status === 'success'
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
}

/**
 * Truncate text to specified length
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format IP address for display
 * Anonymizes if needed for privacy
 *
 * @param ipAddress - IP address string
 * @param anonymize - Whether to anonymize last octet
 * @returns Formatted IP address
 */
export function formatIpAddress(ipAddress: string | null, anonymize: boolean = false): string {
  if (!ipAddress) return 'N/A';

  if (anonymize && ipAddress.includes('.')) {
    // IPv4 anonymization: replace last octet with 0
    const parts = ipAddress.split('.');
    parts[parts.length - 1] = '0';
    return parts.join('.');
  }

  return ipAddress;
}

/**
 * Format user agent string to be more readable
 *
 * @param userAgent - User agent string
 * @returns Shortened user agent or browser name
 */
export function formatUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown';

  // Extract browser and OS info (simplified)
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';

  // Truncate if too long
  return truncateText(userAgent, 50);
}

/**
 * Deep compare two JSON objects and find differences
 *
 * @param before - Before state
 * @param after - After state
 * @returns Array of changed field paths
 */
export function getChangedFields(
  before: Record<string, any> | null,
  after: Record<string, any> | null
): string[] {
  if (!before || !after) return [];

  const changed: string[] = [];

  const compareObjects = (obj1: any, obj2: any, path: string = '') => {
    const allKeys = new Set([
      ...Object.keys(obj1 || {}),
      ...Object.keys(obj2 || {})
    ]);

    allKeys.forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        changed.push(currentPath);
      }
    });
  };

  compareObjects(before, after);
  return changed;
}

/**
 * Check if a value is a redacted placeholder
 *
 * @param value - Value to check
 * @returns True if value appears to be redacted
 */
export function isRedacted(value: any): boolean {
  return typeof value === 'string' && value === '[REDACTED]';
}
