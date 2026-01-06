'use client';

// ============================================================================
// ProtectedRoute Component
// ============================================================================
// Route protection wrapper that redirects unauthorized users to 403 page.
// Used in page layouts to enforce permission requirements.
// ============================================================================

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRBAC } from '@/contexts/RBACContext';
import type { ProtectedRouteProps } from '@/lib/types/rbac';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

/**
 * ProtectedRoute - Protect entire pages/routes based on permissions/roles
 *
 * This component checks if the user has the required permissions/roles.
 * If unauthorized, redirects to /forbidden (403 page).
 * If authorized, renders children.
 *
 * @param children - Page content to protect
 * @param requiredPermission - Permission code(s) required (e.g., "leads:view")
 * @param requiredRole - Role name(s) required (e.g., "Owner")
 * @param requireAll - If true, user must have ALL permissions/roles. If false, user needs ANY (default: false)
 * @param fallback - Content to show while checking permissions (default: LoadingSpinner)
 * @param redirectTo - Path to redirect unauthorized users (default: "/forbidden")
 *
 * @example
 * // In page.tsx - protect entire page
 * export default function LeadsPage() {
 *   return (
 *     <ProtectedRoute requiredPermission="leads:view">
 *       <LeadsList />
 *     </ProtectedRoute>
 *   );
 * }
 *
 * @example
 * // Protect admin pages - only Owners
 * export default function AdminPage() {
 *   return (
 *     <ProtectedRoute requiredRole="Owner">
 *       <AdminDashboard />
 *     </ProtectedRoute>
 *   );
 * }
 *
 * @example
 * // Require multiple permissions (user needs ALL)
 * export default function EditRolePage() {
 *   return (
 *     <ProtectedRoute
 *       requiredPermission={['rbac:view', 'rbac:edit-roles']}
 *       requireAll
 *     >
 *       <EditRoleForm />
 *     </ProtectedRoute>
 *   );
 * }
 */
export default function ProtectedRoute({
  children,
  requiredPermission,
  requiredRole,
  requireAll = false,
  fallback = (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner />
    </div>
  ),
  redirectTo = '/forbidden',
}: ProtectedRouteProps) {
  const router = useRouter();
  const { hasPermission, hasRole, loading } = useRBAC();

  // Check permissions and redirect if unauthorized
  useEffect(() => {
    if (loading) return; // Wait for permissions to load

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

    // Redirect if unauthorized
    if (!hasAccess) {
      router.push(redirectTo);
    }
  }, [
    loading,
    hasPermission,
    hasRole,
    requiredPermission,
    requiredRole,
    requireAll,
    redirectTo,
    router,
  ]);

  // Show loading state while checking permissions
  if (loading) {
    return <>{fallback}</>;
  }

  // Check permissions before rendering
  let hasAccess = true;

  if (requiredPermission) {
    if (requireAll) {
      const permissions = Array.isArray(requiredPermission)
        ? requiredPermission
        : [requiredPermission];
      hasAccess = permissions.every((perm) => hasPermission(perm));
    } else {
      hasAccess = hasPermission(requiredPermission);
    }
  }

  if (requiredRole && hasAccess) {
    if (requireAll) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      hasAccess = roles.every((role) => hasRole(role));
    } else {
      hasAccess = hasRole(requiredRole);
    }
  }

  // Render children only if authorized
  return hasAccess ? <>{children}</> : null;
}
