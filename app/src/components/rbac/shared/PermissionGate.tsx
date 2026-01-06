'use client';

// ============================================================================
// PermissionGate Component
// ============================================================================
// Conditional rendering wrapper that shows/hides content based on permissions
// or roles. Supports loading and fallback states.
// ============================================================================

import React from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import type { PermissionGateProps } from '@/lib/types/rbac';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

/**
 * PermissionGate - Conditionally render children based on permissions/roles
 *
 * @param children - Content to show if user has required permissions
 * @param requiredPermission - Permission code(s) required (e.g., "leads:view")
 * @param requiredRole - Role name(s) required (e.g., "Owner")
 * @param requireAll - If true, user must have ALL permissions/roles. If false, user needs ANY (default: false)
 * @param fallback - Content to show if user lacks permissions (default: null)
 * @param loading - Content to show while loading (default: LoadingSpinner)
 *
 * @example
 * // Show content only if user can view leads
 * <PermissionGate requiredPermission="leads:view">
 *   <LeadsList />
 * </PermissionGate>
 *
 * @example
 * // Show content only if user has Owner role
 * <PermissionGate requiredRole="Owner">
 *   <OwnerDashboard />
 * </PermissionGate>
 *
 * @example
 * // Show content if user has ANY of these permissions
 * <PermissionGate requiredPermission={['leads:edit', 'leads:delete']}>
 *   <LeadActions />
 * </PermissionGate>
 *
 * @example
 * // Show content if user has ALL of these permissions
 * <PermissionGate requiredPermission={['leads:view', 'leads:edit']} requireAll>
 *   <LeadEditor />
 * </PermissionGate>
 *
 * @example
 * // Show fallback content if unauthorized
 * <PermissionGate
 *   requiredPermission="admin:access"
 *   fallback={<p>You do not have permission to view this content.</p>}
 * >
 *   <AdminPanel />
 * </PermissionGate>
 */
export default function PermissionGate({
  children,
  requiredPermission,
  requiredRole,
  requireAll = false,
  fallback = null,
  loading: loadingContent = <LoadingSpinner />,
}: PermissionGateProps) {
  const { hasPermission, hasRole, loading } = useRBAC();

  // Show loading state while permissions are being fetched
  if (loading) {
    return <>{loadingContent}</>;
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

  // Render children if authorized, fallback if not
  return <>{hasAccess ? children : fallback}</>;
}
