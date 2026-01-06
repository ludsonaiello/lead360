// ============================================================================
// Edit Role Page
// ============================================================================
// Page for editing an existing role and its permissions.
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { RoleWithPermissions } from '@/lib/types/rbac';
import RoleForm from '@/components/rbac/role-management/RoleForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import * as rbacApi from '@/lib/api/rbac';
import toast from 'react-hot-toast';

export default function EditRolePage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.id as string;

  const [role, setRole] = useState<RoleWithPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load role data
   */
  useEffect(() => {
    const loadRole = async () => {
      setLoading(true);
      setError(null);

      try {
        const roleData = await rbacApi.getRoleById(roleId);
        setRole(roleData);
      } catch (err) {
        console.error('[EditRolePage] Failed to load role:', err);
        setError('Failed to load role');
        toast.error('Failed to load role');
      } finally {
        setLoading(false);
      }
    };

    if (roleId) {
      loadRole();
    }
  }, [roleId]);

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <ProtectedRoute requiredPermission="rbac:edit-roles">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </ProtectedRoute>
    );
  }

  /**
   * Render error state
   */
  if (error || !role) {
    return (
      <ProtectedRoute requiredPermission="rbac:edit-roles">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">{error || 'Role not found'}</p>
            <button
              onClick={() => router.push('/admin/rbac/roles')}
              className="mt-4 text-blue-600 hover:underline"
            >
              Back to Roles
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission="rbac:edit-roles">
      <div className="max-w-5xl mx-auto">
        <RoleForm
          role={role}
          onSuccess={() => router.push('/admin/rbac/roles')}
          onCancel={() => router.back()}
        />
      </div>
    </ProtectedRoute>
  );
}
