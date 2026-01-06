'use client';

// ============================================================================
// usePermission Hook
// ============================================================================
// Custom hook for checking user permissions. Wraps RBACContext for convenience.
// ============================================================================

import { useCallback } from 'react';
import { useRBAC } from '@/contexts/RBACContext';
import type { UsePermissionResult } from '@/lib/types/rbac';

/**
 * Hook for checking user permissions
 *
 * @returns UsePermissionResult with permission checking methods
 *
 * @example
 * const { hasPermission, canPerform, permissions, loading } = usePermission();
 *
 * if (hasPermission('leads:view')) {
 *   // Show leads section
 * }
 *
 * if (canPerform('quotes', 'create')) {
 *   // Show "Create Quote" button
 * }
 *
 * if (hasAnyPermission(['leads:edit', 'leads:delete'])) {
 *   // User can either edit or delete leads
 * }
 */
export function usePermission(): UsePermissionResult {
  const {
    permissions,
    permissionCodes,
    loading,
    hasPermission: contextHasPermission,
    canPerform: contextCanPerform,
  } = useRBAC();

  /**
   * Check if user has a specific permission or any permission from an array
   * Supports single permission code or array (checks if user has ANY of the permissions)
   *
   * Permission code format: "module:action"
   * Example: "leads:view", "quotes:create"
   *
   * @param moduleAction - Single permission code or array of permission codes
   * @returns boolean
   */
  const hasPermission = useCallback(
    (moduleAction: string | string[]): boolean => {
      return contextHasPermission(moduleAction);
    },
    [contextHasPermission]
  );

  /**
   * Check if user has ANY of the specified permissions
   *
   * @param moduleActions - Array of permission codes
   * @returns boolean
   *
   * @example
   * if (hasAnyPermission(['leads:edit', 'leads:delete'])) {
   *   // User can do at least one of these actions
   * }
   */
  const hasAnyPermission = useCallback(
    (moduleActions: string[]): boolean => {
      if (loading) return false;
      return moduleActions.some((code) => permissionCodes.has(code));
    },
    [permissionCodes, loading]
  );

  /**
   * Check if user has ALL of the specified permissions
   *
   * @param moduleActions - Array of permission codes
   * @returns boolean
   *
   * @example
   * if (hasAllPermissions(['leads:view', 'leads:edit'])) {
   *   // User can both view and edit leads
   * }
   */
  const hasAllPermissions = useCallback(
    (moduleActions: string[]): boolean => {
      if (loading) return false;
      return moduleActions.every((code) => permissionCodes.has(code));
    },
    [permissionCodes, loading]
  );

  /**
   * Check if user can perform a specific action on a module
   * Convenience method that builds the permission code
   *
   * @param module - Module name (e.g., "leads", "quotes")
   * @param action - Action name (e.g., "view", "create", "edit")
   * @returns boolean
   *
   * @example
   * if (canPerform('leads', 'create')) {
   *   // Show "Create Lead" button
   * }
   */
  const canPerform = useCallback(
    (module: string, action: string): boolean => {
      return contextCanPerform(module, action);
    },
    [contextCanPerform]
  );

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canPerform,
    permissions,
    permissionCodes,
    loading,
  };
}

export default usePermission;
