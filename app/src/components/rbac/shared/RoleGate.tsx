'use client';

// ============================================================================
// RoleGate Component
// ============================================================================
// Simplified permission gate that only checks roles (not permissions).
// Useful for role-based UI sections.
// ============================================================================

import React from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import type { RoleGateProps } from '@/lib/types/rbac';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

/**
 * RoleGate - Conditionally render children based on user roles
 *
 * This is a simplified version of PermissionGate that only checks roles.
 *
 * @param children - Content to show if user has required role(s)
 * @param requiredRole - Role name(s) required (e.g., "Owner", ["Admin", "Owner"])
 * @param requireAll - If true, user must have ALL roles. If false, user needs ANY (default: false)
 * @param fallback - Content to show if user lacks role (default: null)
 * @param loading - Content to show while loading (default: LoadingSpinner)
 *
 * @example
 * // Show content only for Owners
 * <RoleGate requiredRole="Owner">
 *   <OwnerSettings />
 * </RoleGate>
 *
 * @example
 * // Show content for either Owner or Admin
 * <RoleGate requiredRole={['Owner', 'Admin']}>
 *   <AdminPanel />
 * </RoleGate>
 *
 * @example
 * // Show content only if user has BOTH roles
 * <RoleGate requiredRole={['Admin', 'Estimator']} requireAll>
 *   <EstimatorAdminPanel />
 * </RoleGate>
 */
export default function RoleGate({
  children,
  requiredRole,
  requireAll = false,
  fallback = null,
  loading: loadingContent = <LoadingSpinner />,
}: RoleGateProps) {
  const { hasRole, loading } = useRBAC();

  // Show loading state while permissions are being fetched
  if (loading) {
    return <>{loadingContent}</>;
  }

  // Check roles
  let hasAccess = false;

  if (requireAll) {
    // User must have ALL roles
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    hasAccess = roles.every((role) => hasRole(role));
  } else {
    // User needs ANY role
    hasAccess = hasRole(requiredRole);
  }

  // Render children if authorized, fallback if not
  return <>{hasAccess ? children : fallback}</>;
}
