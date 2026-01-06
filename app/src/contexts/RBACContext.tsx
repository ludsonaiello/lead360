'use client';

// ============================================================================
// RBAC Context
// ============================================================================
// Global RBAC state provider that loads and caches the current user's roles
// and permissions. Provides hooks for permission checking throughout the app.
// ============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import rbacApi from '@/lib/api/rbac';
import type { Role, Permission, RBACContextState } from '@/lib/types/rbac';
import { useAuth } from './AuthContext';

// ============================================================================
// Context Definition
// ============================================================================

const RBACContext = createContext<RBACContextState | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface RBACProviderProps {
  children: ReactNode;
}

export function RBACProvider({ children }: RBACProviderProps) {
  const { user, isLoading: authLoading } = useAuth(); // Get current user and loading state from AuthContext

  // State
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleNames, setRoleNames] = useState<Set<string>>(new Set());
  const [permissionCodes, setPermissionCodes] = useState<Set<string>>(new Set());
  const [rbacLoading, setRbacLoading] = useState(true); // Start as true to prevent race condition
  const [error, setError] = useState<Error | null>(null);

  // Combined loading state: loading if auth is loading OR if we're fetching RBAC data
  const loading = authLoading || rbacLoading;

  /**
   * Fetch current user's roles and permissions from API
   */
  const fetchUserPermissions = useCallback(async () => {
    if (!user?.id) {
      // No user logged in
      setRbacLoading(false); // No user means no RBAC to load
      setRoles([]);
      setPermissions([]);
      setRoleNames(new Set());
      setPermissionCodes(new Set());
      return;
    }

    // Platform admins don't have tenant-scoped roles/permissions
    // They bypass RBAC entirely (full access)
    if (user.is_platform_admin) {
      setRbacLoading(false);
      setRoles([]);
      setPermissions([]);
      setRoleNames(new Set(['PlatformAdmin']));
      setPermissionCodes(new Set(['*:*'])); // Full access wildcard
      return;
    }

    // Regular tenant users - must have tenant_id
    if (!user.tenant_id) {
      console.error('[RBACContext] User is not platform admin but has no tenant_id');
      setRbacLoading(false);
      setError(new Error('User has no tenant_id'));
      return;
    }

    setRbacLoading(true);
    setError(null);

    try {
      // Fetch roles and permissions in parallel
      const [rolesResponse, permissionsResponse] = await Promise.all([
        rbacApi.getUserRoles(user.id),
        rbacApi.getUserPermissions(user.id),
      ]);

      // API returns array of UserRole objects directly (not wrapped)
      // Extract role objects from UserRole array
      const userRoles = Array.isArray(rolesResponse)
        ? rolesResponse.map((ur) => ur.role)
        : [];

      // API returns array of Permission objects directly (not wrapped)
      const userPermissions = Array.isArray(permissionsResponse)
        ? permissionsResponse
        : [];

      // Update state
      setRoles(userRoles);
      setPermissions(userPermissions);

      // Build lookup sets for O(1) checking
      // Role names: "Owner", "Admin", etc.
      setRoleNames(new Set(userRoles.map((r) => r.name)));

      // Permission codes: "module:action" format
      // We'll derive this from module.name:permission.action
      const permCodes = new Set(
        userPermissions.map((p) => {
          // If module is nested, use module.name, otherwise use module_id as fallback
          const moduleName = p.module?.name || p.module_id;
          return `${moduleName}:${p.action}`;
        })
      );
      setPermissionCodes(permCodes);
    } catch (err) {
      console.error('[RBACContext] Failed to load user permissions:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));

      // Set empty permissions on error (fail closed - no permissions)
      setRoles([]);
      setPermissions([]);
      setRoleNames(new Set());
      setPermissionCodes(new Set());
    } finally {
      setRbacLoading(false);
    }
  }, [user]); // Only depend on user - authLoading/rbacLoading handled in useEffect

  /**
   * Check if user has specific role(s)
   * Supports single role name or array (checks if user has ANY of the roles)
   */
  const hasRole = useCallback(
    (roleName: string | string[]): boolean => {
      if (loading) return false; // Don't grant permissions while loading

      const names = Array.isArray(roleName) ? roleName : [roleName];
      return names.some((name) => roleNames.has(name));
    },
    [roleNames, loading]
  );

  /**
   * Check if user has specific permission(s)
   * Supports single permission code or array (checks if user has ANY of the permissions)
   *
   * Permission code format: "module:action"
   * Example: "leads:view", "quotes:create"
   */
  const hasPermission = useCallback(
    (moduleAction: string | string[]): boolean => {
      const codes = Array.isArray(moduleAction) ? moduleAction : [moduleAction];

      if (loading) return false; // Don't grant permissions while loading

      // Platform admins have wildcard permission (*:*)
      if (permissionCodes.has('*:*')) return true;

      return codes.some((code) => permissionCodes.has(code));
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
      if (loading) return false;

      const permissionCode = `${module}:${action}`;
      return permissionCodes.has(permissionCode);
    },
    [permissionCodes, loading]
  );

  /**
   * Refresh permissions from API
   * Call this after role changes or when permissions may be stale
   */
  const refresh = useCallback(async () => {
    await fetchUserPermissions();
  }, [fetchUserPermissions]);

  // Load permissions on mount and when user changes
  useEffect(() => {
    // Don't process if auth is still loading
    if (authLoading) {
      return;
    }

    // Process user synchronously in useEffect to avoid race conditions
    if (!user?.id) {
      setRbacLoading(false);
      setRoles([]);
      setPermissions([]);
      setRoleNames(new Set());
      setPermissionCodes(new Set());
      return;
    }

    // Platform admin - grant immediately
    if (user.is_platform_admin) {
      setRoles([]);
      setPermissions([]);
      setRoleNames(new Set(['PlatformAdmin']));
      setPermissionCodes(new Set(['*:*']));
      setRbacLoading(false);
      return;
    }

    // Regular user - fetch permissions
    fetchUserPermissions();
  }, [user, authLoading, fetchUserPermissions]);

  // Context value
  const value: RBACContextState = {
    currentUserId: user?.id || null,
    roles,
    permissions,
    roleNames,
    permissionCodes,
    loading,
    error,
    hasRole,
    hasPermission,
    canPerform,
    refresh,
  };

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
}

// ============================================================================
// Hook to access RBAC context
// ============================================================================

/**
 * Hook to access RBAC context
 *
 * @returns RBACContextState
 * @throws Error if used outside RBACProvider
 *
 * @example
 * const { hasRole, hasPermission, canPerform, loading } = useRBAC();
 *
 * if (hasRole('Owner')) {
 *   // Show owner-only UI
 * }
 *
 * if (canPerform('leads', 'create')) {
 *   // Show "Create Lead" button
 * }
 */
export function useRBAC(): RBACContextState {
  const context = useContext(RBACContext);

  if (!context) {
    throw new Error('useRBAC must be used within RBACProvider');
  }

  return context;
}

// ============================================================================
// Export
// ============================================================================

export default RBACContext;
