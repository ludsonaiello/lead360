'use client';

// ============================================================================
// usePermissionMatrix Hook
// ============================================================================
// Hook for loading the full permission matrix (Platform Admin only).
// Used for displaying role/permission relationships in admin UI.
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import rbacApi from '@/lib/api/rbac';
import type {
  PermissionMatrixResponse,
  UsePermissionMatrixResult,
} from '@/lib/types/rbac';

/**
 * Hook for loading the full permission matrix
 *
 * This is used by Platform Admins to view the complete mapping of
 * which roles have which permissions. Not needed for normal users.
 *
 * @param autoLoad - Whether to automatically load the matrix on mount (default: true)
 * @returns UsePermissionMatrixResult
 *
 * @example
 * const { matrix, loading, error, refresh } = usePermissionMatrix();
 *
 * if (loading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * // Access matrix data
 * const adminPermissions = matrix.matrix['Admin'];
 * const leadsPermissions = adminPermissions['leads']; // ['view', 'create', 'edit']
 */
export function usePermissionMatrix(
  autoLoad: boolean = true
): UsePermissionMatrixResult {
  const [matrix, setMatrix] = useState<PermissionMatrixResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(autoLoad);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load the permission matrix from API
   */
  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await rbacApi.getPermissionMatrix();
      setMatrix(data);
    } catch (err) {
      console.error('[usePermissionMatrix] Failed to load permission matrix:', err);
      setError(err instanceof Error ? err : new Error('Failed to load permission matrix'));
      setMatrix(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh the permission matrix
   * Call this after role/permission changes to update the UI
   */
  const refresh = useCallback(async () => {
    await loadMatrix();
  }, [loadMatrix]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad) {
      loadMatrix();
    }
  }, [autoLoad, loadMatrix]);

  return {
    matrix,
    loading,
    error,
    refresh,
  };
}

export default usePermissionMatrix;
