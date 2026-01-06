'use client';

// ============================================================================
// UserRoleHistory Component
// ============================================================================
// Timeline display of user's role assignment history (audit log).
// Shows when roles were added/removed and by whom.
// ============================================================================

import React from 'react';
import { Calendar, UserPlus, UserMinus, User } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Card from '@/components/ui/Card';

interface RoleHistoryEntry {
  id: string;
  action: 'assigned' | 'removed';
  role_name: string;
  timestamp: string;
  performed_by?: {
    id: string;
    name: string;
  };
}

interface UserRoleHistoryProps {
  history: RoleHistoryEntry[];
}

/**
 * UserRoleHistory - Display role assignment history timeline
 *
 * Shows a chronological timeline of role changes for a user.
 * Each entry shows:
 * - Action (assigned/removed)
 * - Role name
 * - Timestamp
 * - Who performed the action
 *
 * @param history - Array of role history entries
 *
 * @example
 * <UserRoleHistory history={roleHistory} />
 */
export default function UserRoleHistory({ history }: UserRoleHistoryProps) {
  /**
   * Render empty state
   */
  if (history.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No history available</p>
          <p className="text-sm mt-1">Role changes will appear here.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry, index) => (
        <Card key={entry.id} className="p-4">
          <div className="flex items-start gap-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              {/* Icon */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${
                    entry.action === 'assigned'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-red-100 text-red-600'
                  }
                `}
              >
                {entry.action === 'assigned' ? (
                  <UserPlus className="w-5 h-5" />
                ) : (
                  <UserMinus className="w-5 h-5" />
                )}
              </div>

              {/* Connecting line (not for last item) */}
              {index < history.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 mt-2" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-1">
              {/* Action description */}
              <p className="text-sm font-medium text-gray-900">
                {entry.action === 'assigned' ? (
                  <>
                    Role <span className="text-blue-600">{entry.role_name}</span> assigned
                  </>
                ) : (
                  <>
                    Role <span className="text-red-600">{entry.role_name}</span> removed
                  </>
                )}
              </p>

              {/* Metadata */}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                {/* Timestamp */}
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span title={format(new Date(entry.timestamp), 'PPpp')}>
                    {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                  </span>
                </div>

                {/* Performed by */}
                {entry.performed_by && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>by {entry.performed_by.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
