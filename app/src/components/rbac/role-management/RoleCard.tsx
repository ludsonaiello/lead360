'use client';

// ============================================================================
// RoleCard Component
// ============================================================================
// Card displaying role summary with actions (edit, clone, delete).
// Shows role name, description, permission count, and user count.
// ============================================================================

import React from 'react';
import { Shield, Users, Key, Edit2, Copy, Trash2, Crown } from 'lucide-react';
import type { RoleCardProps } from '@/lib/types/rbac';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

/**
 * RoleCard - Display role summary with actions
 *
 * @param role - Role with permissions and user count
 * @param showActions - Whether to show action buttons (default: true)
 * @param onEdit - Callback when edit button is clicked
 * @param onClone - Callback when clone button is clicked
 * @param onDelete - Callback when delete button is clicked
 *
 * @example
 * <RoleCard
 *   role={role}
 *   onEdit={(roleId) => router.push(`/admin/rbac/roles/${roleId}`)}
 *   onClone={(roleId) => setCloneModalOpen(true)}
 *   onDelete={(roleId) => setDeleteModalOpen(true)}
 * />
 */
export default function RoleCard({
  role,
  showActions = true,
  onEdit,
  onClone,
  onDelete,
}: RoleCardProps) {
  /**
   * Get badge variant for role type
   */
  const getRoleBadge = () => {
    if (role.name === 'Owner') return { variant: 'warning' as const, label: 'Owner' };
    if (role.name === 'Admin') return { variant: 'info' as const, label: 'Admin' };
    if (role.is_system) return { variant: 'info' as const, label: 'System Role' };
    return { variant: 'success' as const, label: 'Custom Role' };
  };

  const badge = getRoleBadge();
  // Handle both role_permissions (plural) and role_permission (singular) from backend
  const rolePerms = role.role_permissions || (role as any).role_permission;
  const permissionCount = rolePerms?.length || 0;
  // Backend returns user_role (singular) not user_roles (plural)
  const userCount = role._count?.user_role || role._count?.user_roles || 0;

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        {/* Role info */}
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            {/* Icon */}
            <div className={`
              p-2 rounded-lg
              ${role.name === 'Owner' ? 'bg-yellow-100 text-yellow-600' : ''}
              ${role.name === 'Admin' ? 'bg-blue-100 text-blue-600' : ''}
              ${role.is_system && role.name !== 'Owner' && role.name !== 'Admin' ? 'bg-indigo-100 text-indigo-600' : ''}
              ${!role.is_system && role.name !== 'Owner' && role.name !== 'Admin' ? 'bg-green-100 text-green-600' : ''}
            `}>
              {role.name === 'Owner' ? (
                <Crown className="w-5 h-5" />
              ) : (
                <Shield className="w-5 h-5" />
              )}
            </div>

            {/* Name and badge */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {role.name}
                </h3>
                <Badge variant={badge.variant} label={badge.label} />
                {!role.is_active && (
                  <Badge variant="neutral" label="Inactive" />
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {role.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {role.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            {/* Permission count */}
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              <span>
                <strong className="text-gray-900 dark:text-gray-100">{permissionCount}</strong>{' '}
                {permissionCount === 1 ? 'permission' : 'permissions'}
              </span>
            </div>

            {/* User count */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>
                <strong className="text-gray-900 dark:text-gray-100">{userCount}</strong>{' '}
                {userCount === 1 ? 'user' : 'users'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-2 ml-4">
            {/* Edit */}
            {onEdit && (
              <Button
                onClick={() => onEdit(role.id)}
                variant="ghost"
                size="sm"
                title="Edit role"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}

            {/* Clone */}
            {onClone && (
              <Button
                onClick={() => onClone(role.id)}
                variant="ghost"
                size="sm"
                title="Clone role"
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}

            {/* Delete (only for custom roles with no users) */}
            {onDelete && !role.is_system && userCount === 0 && (
              <Button
                onClick={() => onDelete(role.id)}
                variant="ghost"
                size="sm"
                title="Delete role"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
