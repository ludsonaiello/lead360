'use client';

// ============================================================================
// useCurrentUserRoles Hook
// ============================================================================
// Hook for accessing the current user's roles and permissions.
// This is a thin wrapper around RBACContext for convenience.
// ============================================================================

import { useRBAC } from '@/contexts/RBACContext';
import type { UseCurrentUserRolesResult } from '@/lib/types/rbac';

/**
 * Hook for accessing the current user's roles and permissions
 *
 * This is a convenience wrapper around RBACContext that returns
 * only the data properties (not the checking methods).
 *
 * Use this when you need to display the user's roles/permissions
 * in the UI (e.g., profile page, settings page).
 *
 * For permission checks, use usePermission() or useRole() instead.
 *
 * @returns UseCurrentUserRolesResult
 *
 * @example
 * const { roles, permissions, loading, error, refresh } = useCurrentUserRoles();
 *
 * if (loading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return (
 *   <div>
 *     <h2>Your Roles</h2>
 *     {roles.map(role => (
 *       <RoleBadge key={role.id} role={role} />
 *     ))}
 *   </div>
 * );
 */
export function useCurrentUserRoles(): UseCurrentUserRolesResult {
  const { roles, permissions, loading, error, refresh } = useRBAC();

  return {
    roles,
    permissions,
    loading,
    error,
    refresh,
  };
}

export default useCurrentUserRoles;
