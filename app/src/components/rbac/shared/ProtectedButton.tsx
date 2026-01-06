'use client';

// ============================================================================
// ProtectedButton Component
// ============================================================================
// Button component that only renders if user has required permissions/roles.
// Optionally shows fallback content if unauthorized.
// ============================================================================

import React from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import type { ProtectedButtonProps } from '@/lib/types/rbac';
import Button from '@/components/ui/Button';

/**
 * ProtectedButton - Button that only renders if user has required permissions/roles
 *
 * This wraps the standard Button component with permission checking.
 * If the user lacks permissions, the button is not rendered (or fallback is shown).
 *
 * @param requiredPermission - Permission code(s) required (e.g., "leads:create")
 * @param requiredRole - Role name(s) required (e.g., "Owner")
 * @param requireAll - If true, user must have ALL permissions/roles. If false, user needs ANY (default: false)
 * @param fallback - Content to show if user lacks permissions (default: null - button hidden)
 * @param children - Button content
 * @param ...props - All standard button props (onClick, disabled, variant, etc.)
 *
 * @example
 * // Show "Create Lead" button only if user has permission
 * <ProtectedButton
 *   requiredPermission="leads:create"
 *   onClick={handleCreateLead}
 * >
 *   Create Lead
 * </ProtectedButton>
 *
 * @example
 * // Show "Delete" button only for Owners
 * <ProtectedButton
 *   requiredRole="Owner"
 *   onClick={handleDelete}
 *   variant="danger"
 * >
 *   Delete
 * </ProtectedButton>
 *
 * @example
 * // Show disabled button as fallback if unauthorized
 * <ProtectedButton
 *   requiredPermission="quotes:approve"
 *   onClick={handleApprove}
 *   fallback={
 *     <Button disabled title="You don't have permission to approve quotes">
 *       Approve Quote
 *     </Button>
 *   }
 * >
 *   Approve Quote
 * </ProtectedButton>
 */
export default function ProtectedButton({
  requiredPermission,
  requiredRole,
  requireAll = false,
  fallback = null,
  children,
  ...props
}: ProtectedButtonProps) {
  const { hasPermission, hasRole, loading } = useRBAC();

  // Don't render anything while loading (prevents flash of unauthorized button)
  if (loading) {
    return null;
  }

  // Check permissions and roles
  let hasAccess = true;

  if (requiredPermission) {
    if (requireAll) {
      // User must have ALL permissions
      const permissions = Array.isArray(requiredPermission)
        ? requiredPermission
        : [requiredPermission];
      hasAccess = permissions.every((perm) => hasPermission(perm));
    } else {
      // User needs ANY permission
      hasAccess = hasPermission(requiredPermission);
    }
  }

  if (requiredRole && hasAccess) {
    if (requireAll) {
      // User must have ALL roles
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      hasAccess = roles.every((role) => hasRole(role));
    } else {
      // User needs ANY role
      hasAccess = hasRole(requiredRole);
    }
  }

  // Render button if authorized, fallback if not
  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <Button {...props}>{children}</Button>;
}
