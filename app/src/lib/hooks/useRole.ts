'use client';

// ============================================================================
// useRole Hook
// ============================================================================
// Custom hook for checking user roles. Wraps RBACContext for convenience.
// ============================================================================

import { useCallback } from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import type { UseRoleResult } from '@/lib/types/rbac';

/**
 * Hook for checking user roles
 *
 * @returns UseRoleResult with role checking methods
 *
 * @example
 * const { hasRole, hasAnyRole, hasAllRoles, roles, loading } = useRole();
 *
 * if (hasRole('Owner')) {
 *   // Show owner-only content
 * }
 *
 * if (hasAnyRole(['Owner', 'Admin'])) {
 *   // Show content for either Owner or Admin
 * }
 *
 * if (hasAllRoles(['Admin', 'Estimator'])) {
 *   // User must have BOTH roles
 * }
 */
export function useRole(): UseRoleResult {
  const { roles, roleNames, loading, hasRole: contextHasRole } = useRBAC();

  /**
   * Check if user has a specific role or any role from an array
   * Supports single role name or array (checks if user has ANY of the roles)
   *
   * @param roleName - Single role name or array of role names
   * @returns boolean
   */
  const hasRole = useCallback(
    (roleName: string | string[]): boolean => {
      return contextHasRole(roleName);
    },
    [contextHasRole]
  );

  /**
   * Check if user has ANY of the specified roles
   *
   * @param roleNames - Array of role names
   * @returns boolean
   *
   * @example
   * if (hasAnyRole(['Owner', 'Admin'])) {
   *   // User has at least one of these roles
   * }
   */
  const hasAnyRole = useCallback(
    (roleNames: string[]): boolean => {
      if (loading) return false;
      return roleNames.some((name) => roleNames.includes(name));
    },
    [roleNames, loading]
  );

  /**
   * Check if user has ALL of the specified roles
   *
   * @param roleNames - Array of role names
   * @returns boolean
   *
   * @example
   * if (hasAllRoles(['Admin', 'Estimator'])) {
   *   // User has both roles
   * }
   */
  const hasAllRoles = useCallback(
    (roleNames: string[]): boolean => {
      if (loading) return false;
      return roleNames.every((name) => roleNames.includes(name));
    },
    [roleNames, loading]
  );

  return {
    hasRole,
    hasAnyRole,
    hasAllRoles,
    roles,
    roleNames,
    loading,
  };
}

export default useRole;
