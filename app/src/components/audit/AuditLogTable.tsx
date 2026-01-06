// Audit Log Table Component
// Main table display with responsive card layout on mobile

'use client';

import { AuditLog } from '@/lib/types/audit';
import { ActionTypeBadge } from './ActionTypeBadge';
import { StatusBadge } from './StatusBadge';
import { EmptyAuditState } from './EmptyAuditState';
import {
  formatTimestamp,
  formatActorName,
  formatEntityType,
  truncateText,
  getActorInitials
} from '@/lib/utils/audit-helpers';
import { User, Settings } from 'lucide-react';

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  onRowClick: (log: AuditLog) => void;
  emptyMessage?: string;
  showTenantColumn?: boolean;
  className?: string;
}

/**
 * Audit log table with loading states, empty state, and responsive design
 *
 * Features:
 * - Desktop: Full table layout
 * - Mobile: Card-based layout
 * - Loading skeleton (5-10 rows)
 * - Clickable rows
 * - Hover effects
 * - Zebra striping
 *
 * Columns:
 * 1. Timestamp (relative + absolute on hover)
 * 2. Actor (name + avatar)
 * 3. Action (badge)
 * 4. Entity Type
 * 5. Description (truncated)
 * 6. Status (icon)
 *
 * @example
 * ```tsx
 * <AuditLogTable
 *   logs={logs}
 *   isLoading={isLoading}
 *   onRowClick={(log) => setSelectedLog(log)}
 * />
 * ```
 */
export function AuditLogTable({
  logs,
  isLoading,
  onRowClick,
  emptyMessage,
  showTenantColumn = false,
  className = ''
}: AuditLogTableProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-gray-100 dark:bg-gray-800 rounded-md animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (logs.length === 0) {
    return <EmptyAuditState message={emptyMessage} />;
  }

  return (
    <>
      {/* Desktop Table */}
      <div className={`hidden lg:block overflow-x-auto ${className}`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actor
              </th>
              {showTenantColumn && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tenant
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Entity Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {logs.map((log, index) => {
              const timestamp = formatTimestamp(log.created_at);
              const actorName = formatActorName(log);
              const actorInitials = getActorInitials(log);

              return (
                <tr
                  key={log.id}
                  onClick={() => onRowClick(log)}
                  className={`
                    border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors
                    hover:bg-blue-50 dark:hover:bg-blue-900/10
                    ${index % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800/50'}
                  `}
                >
                  {/* Timestamp */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-900 dark:text-gray-100">
                        {timestamp.relative}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {timestamp.absolute}
                      </span>
                    </div>
                  </td>

                  {/* Actor */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {/* Avatar */}
                      <div className={`
                        h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium
                        ${log.actor_type === 'system' || log.actor_type === 'cron_job'
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          : log.actor_type === 'platform_admin'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }
                      `}>
                        {log.actor_type === 'system' || log.actor_type === 'cron_job' ? (
                          <Settings className="h-4 w-4" />
                        ) : (
                          actorInitials
                        )}
                      </div>

                      {/* Name */}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {actorName}
                        </span>
                        {log.actor?.email && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {log.actor.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Tenant (Platform Admin view only) */}
                  {showTenantColumn && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {log.tenant?.legal_name || 'N/A'}
                    </td>
                  )}

                  {/* Action */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ActionTypeBadge actionType={log.action_type} />
                  </td>

                  {/* Entity Type */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatEntityType(log.entity_type)}
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-md">
                    <span title={log.description}>
                      {truncateText(log.description, 80)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={log.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {logs.map((log) => {
          const timestamp = formatTimestamp(log.created_at);
          const actorName = formatActorName(log);
          const actorInitials = getActorInitials(log);

          return (
            <div
              key={log.id}
              onClick={() => onRowClick(log)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              {/* Header: Timestamp + Status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {timestamp.relative}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {timestamp.absolute}
                  </span>
                </div>
                <StatusBadge status={log.status} />
              </div>

              {/* Actor */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`
                  h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium
                  ${log.actor_type === 'system' || log.actor_type === 'cron_job'
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  }
                `}>
                  {log.actor_type === 'system' || log.actor_type === 'cron_job' ? (
                    <Settings className="h-4 w-4" />
                  ) : (
                    actorInitials
                  )}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {actorName}
                </span>
              </div>

              {/* Action + Entity */}
              <div className="flex items-center gap-2 mb-2">
                <ActionTypeBadge actionType={log.action_type} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {formatEntityType(log.entity_type)}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {truncateText(log.description, 100)}
              </p>

              {/* Tenant (if shown) */}
              {showTenantColumn && log.tenant && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Tenant: {log.tenant.legal_name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
