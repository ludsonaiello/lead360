'use client';

// ============================================================================
// ProtectedMenuItem Component
// ============================================================================
// Menu item wrapper that only renders if user has required permissions/roles.
// Used in sidebar navigation to hide unauthorized menu items.
// ============================================================================

import React from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import type { ProtectedMenuItemProps } from '@/lib/types/rbac';

/**
 * ProtectedMenuItem - Menu item that only renders if user has required permissions/roles
 *
 * This is a simple wrapper that conditionally renders its children based on
 * permissions/roles. Used in navigation menus to hide unauthorized items.
 *
 * @param children - Menu item content (usually a Link or button)
 * @param requiredPermission - Permission code(s) required (e.g., "leads:view")
 * @param requiredRole - Role name(s) required (e.g., "Owner")
 * @param requireAll - If true, user must have ALL permissions/roles. If false, user needs ANY (default: false)
 *
 * @example
 * // In Sidebar.tsx - show menu item only if user can view leads
 * <ProtectedMenuItem requiredPermission="leads:view">
 *   <Link href="/leads" className="nav-link">
 *     <Users className="w-5 h-5" />
 *     <span>Leads</span>
 *   </Link>
 * </ProtectedMenuItem>
 *
 * @example
 * // Show admin menu only for Owners
 * <ProtectedMenuItem requiredRole="Owner">
 *   <Link href="/admin" className="nav-link">
 *     <Settings className="w-5 h-5" />
 *     <span>Admin</span>
 *   </Link>
 * </ProtectedMenuItem>
 *
 * @example
 * // Show menu item if user has ANY of these permissions
 * <ProtectedMenuItem requiredPermission={['quotes:view', 'invoices:view']}>
 *   <Link href="/financials" className="nav-link">
 *     <DollarSign className="w-5 h-5" />
 *     <span>Financials</span>
 *   </Link>
 * </ProtectedMenuItem>
 */
export default function ProtectedMenuItem({
  children,
  requiredPermission,
  requiredRole,
  requireAll = false,
}: ProtectedMenuItemProps) {
  const { hasPermission, hasRole, loading } = useRBAC();

  // Don't render anything while loading (prevents flash of unauthorized menu items)
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

  // Only render children if authorized
  return hasAccess ? <>{children}</> : null;
}
