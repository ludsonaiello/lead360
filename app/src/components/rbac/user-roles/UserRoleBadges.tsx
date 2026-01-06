'use client';

// ============================================================================
// UserRoleBadges Component
// ============================================================================
// Compact display of user's roles as badges with optional edit action.
// Automatically fetches and displays roles for a given user.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Edit2, Plus } from 'lucide-react';
import type { UserRoleBadgesProps, Role } from '@/lib/types/rbac';
import RoleBadge from './RoleBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import * as rbacApi from '@/lib/api/rbac';

/**
 * UserRoleBadges - Display user's roles as badges
 *
 * Automatically fetches roles for the given user and displays them as badges.
 * Optionally shows an "Edit" button and role count.
 *
 * @param userId - User ID to fetch roles for
 * @param maxDisplay - Maximum number of roles to display before showing "+N more" (default: 3)
 * @param showCount - Whether to show total role count (default: false)
 * @param editable - Whether to show edit button (default: false)
 * @param onEdit - Callback when edit button is clicked
 *
 * @example
 * // Simple role display
 * <UserRoleBadges userId="user-123" />
 *
 * @example
 * // With edit button
 * <UserRoleBadges
 *   userId="user-123"
 *   editable
 *   onEdit={() => setEditModalOpen(true)}
 * />
 *
 * @example
 * // Limit display to 2 roles, show count
 * <UserRoleBadges
 *   userId="user-123"
 *   maxDisplay={2}
 *   showCount
 * />
 */
export default function UserRoleBadges({
  userId,
  maxDisplay = 3,
  showCount = false,
  editable = false,
  onEdit,
}: UserRoleBadgesProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch user roles
   */
  useEffect(() => {
    const fetchRoles = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await rbacApi.getUserRoles(userId);
        // Extract role objects from UserRole array
        const userRoles = response.roles.map((ur) => ur.role);
        setRoles(userRoles);
      } catch (err) {
        console.error('[UserRoleBadges] Failed to fetch roles:', err);
        setError(err instanceof Error ? err : new Error('Failed to load roles'));
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [userId]);

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-gray-500">Loading roles...</span>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="text-sm text-red-600">
        Failed to load roles
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (roles.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">No roles assigned</span>
        {editable && onEdit && (
          <Button
            onClick={onEdit}
            variant="ghost"
            size="sm"
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Assign Role
          </Button>
        )}
      </div>
    );
  }

  /**
   * Determine which roles to display
   */
  const displayedRoles = roles.slice(0, maxDisplay);
  const remainingCount = roles.length - maxDisplay;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Role badges */}
      {displayedRoles.map((role) => (
        <RoleBadge key={role.id} role={role} size="sm" />
      ))}

      {/* "+N more" indicator */}
      {remainingCount > 0 && (
        <span className="text-xs text-gray-500 font-medium">
          +{remainingCount} more
        </span>
      )}

      {/* Total count */}
      {showCount && (
        <span className="text-xs text-gray-500">
          ({roles.length} {roles.length === 1 ? 'role' : 'roles'})
        </span>
      )}

      {/* Edit button */}
      {editable && onEdit && (
        <Button
          onClick={onEdit}
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 ml-1"
        >
          <Edit2 className="w-3 h-3" />
          Edit
        </Button>
      )}
    </div>
  );
}
