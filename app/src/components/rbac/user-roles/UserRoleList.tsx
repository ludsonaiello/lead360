'use client';

// ============================================================================
// UserRoleList Component
// ============================================================================
// Full list of user's roles with detailed information.
// Shows role descriptions, assignment dates, and assigned-by user.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Shield, Calendar, User } from 'lucide-react';
import type { UserRole } from '@/lib/types/rbac';
import RoleBadge from './RoleBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import * as rbacApi from '@/lib/api/rbac';
import { formatDistanceToNow } from 'date-fns';

interface UserRoleListProps {
  userId: string;
  onRoleRemove?: (roleId: string) => void;
  removable?: boolean;
}

/**
 * UserRoleList - Display full list of user's roles with details
 *
 * Shows complete role information including:
 * - Role name and badge
 * - Description
 * - Assignment date
 * - Who assigned the role
 *
 * @param userId - User ID to fetch roles for
 * @param onRoleRemove - Optional callback when role is removed
 * @param removable - Whether roles can be removed (default: false)
 *
 * @example
 * <UserRoleList userId="user-123" />
 *
 * @example
 * <UserRoleList
 *   userId="user-123"
 *   removable
 *   onRoleRemove={(roleId) => handleRemoveRole(roleId)}
 * />
 */
export default function UserRoleList({
  userId,
  onRoleRemove,
  removable = false,
}: UserRoleListProps) {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
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
        setUserRoles(response.roles);
      } catch (err) {
        console.error('[UserRoleList] Failed to fetch roles:', err);
        setError(err instanceof Error ? err : new Error('Failed to load roles'));
        setUserRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [userId]);

  /**
   * Handle role removal
   */
  const handleRemove = async (roleId: string) => {
    if (onRoleRemove) {
      onRoleRemove(roleId);
    }
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p className="font-medium">Failed to load roles</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </Card>
    );
  }

  /**
   * Render empty state
   */
  if (userRoles.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No roles assigned</p>
          <p className="text-sm mt-1">This user has not been assigned any roles yet.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {userRoles.map((userRole) => (
        <Card key={userRole.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            {/* Role info */}
            <div className="flex-1">
              {/* Role badge */}
              <div className="mb-2">
                <RoleBadge
                  role={userRole.role}
                  removable={removable && userRole.role.is_active}
                  onRemove={() => handleRemove(userRole.role_id)}
                />
              </div>

              {/* Description */}
              {userRole.role.description && (
                <p className="text-sm text-gray-600 mb-3">
                  {userRole.role.description}
                </p>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {/* Assignment date */}
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Assigned {formatDistanceToNow(new Date(userRole.assigned_at), { addSuffix: true })}
                  </span>
                </div>

                {/* Assigned by */}
                {userRole.assigned_by_user_id && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>Assigned by user</span>
                  </div>
                )}

                {/* System role indicator */}
                {userRole.role.is_system && (
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>System role</span>
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
