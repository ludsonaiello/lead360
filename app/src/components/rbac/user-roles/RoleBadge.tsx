'use client';

// ============================================================================
// RoleBadge Component
// ============================================================================
// Badge component for displaying a single role with optional remove action.
// Supports different sizes and system role indicators.
// ============================================================================

import React from 'react';
import { X, Shield, Crown } from 'lucide-react';
import type { RoleBadgeProps } from '@/lib/types/rbac';
import Badge from '@/components/ui/Badge';

/**
 * RoleBadge - Display a single role as a badge
 *
 * @param role - Role object to display
 * @param onRemove - Optional callback when remove button is clicked
 * @param removable - Whether to show the remove button (default: false)
 * @param size - Badge size: sm, md, lg (default: md)
 *
 * @example
 * // Simple role badge
 * <RoleBadge role={role} />
 *
 * @example
 * // Removable role badge
 * <RoleBadge
 *   role={role}
 *   removable
 *   onRemove={(roleId) => handleRemoveRole(roleId)}
 * />
 *
 * @example
 * // Large badge
 * <RoleBadge role={role} size="lg" />
 */
export default function RoleBadge({
  role,
  onRemove,
  removable = false,
  size = 'md',
}: RoleBadgeProps) {
  /**
   * Get badge variant based on role properties
   */
  const getBadgeVariant = (): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    if (!role.is_active) return 'neutral';
    if (role.name === 'Owner') return 'warning'; // Use warning for Owner (yellow/amber)
    if (role.name === 'Admin') return 'info'; // Use info for Admin (blue)
    if (role.is_system) return 'info';
    return 'success'; // Use success for custom roles (green)
  };

  /**
   * Handle remove click
   */
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemove) {
      onRemove(role.id);
    }
  };

  // Build badge label with inactive indicator
  const badgeLabel = role.is_active ? role.name : `${role.name} (Inactive)`;

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={getBadgeVariant()} label={badgeLabel} />

      {/* Remove button */}
      {removable && onRemove && role.is_active && (
        <button
          onClick={handleRemove}
          className="hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-full p-1 transition-colors"
          title={`Remove ${role.name} role`}
          type="button"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
