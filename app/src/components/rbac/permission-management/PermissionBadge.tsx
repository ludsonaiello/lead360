'use client';

// ============================================================================
// PermissionBadge Component
// ============================================================================
// Badge displaying a single permission with module and action.
// ============================================================================

import React from 'react';
import { Key } from 'lucide-react';
import type { Permission } from '@/lib/types/rbac';
import Badge from '@/components/ui/Badge';

interface PermissionBadgeProps {
  permission: Permission;
  showModule?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * PermissionBadge - Display a single permission as a badge
 *
 * @param permission - Permission object to display
 * @param showModule - Whether to show module name (default: true)
 * @param size - Badge size (default: md)
 *
 * @example
 * <PermissionBadge permission={permission} />
 *
 * @example
 * <PermissionBadge permission={permission} showModule={false} />
 */
export default function PermissionBadge({
  permission,
  showModule = true,
  size = 'md',
}: PermissionBadgeProps) {
  /**
   * Get permission label
   */
  const getLabel = () => {
    if (showModule && permission.module) {
      return `${permission.module.name}:${permission.action}`;
    }
    return permission.display_name;
  };

  /**
   * Get badge variant based on permission status
   */
  const getVariant = (): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    if (!permission.is_active) return 'neutral';
    return 'info';
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={getVariant()} label={getLabel()} />
      {!permission.is_active && (
        <span className="text-xs text-gray-500">(Inactive)</span>
      )}
    </span>
  );
}
