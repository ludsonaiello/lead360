// ============================================================================
// Permissions List Page
// ============================================================================
// List all permissions grouped by module with search and filtering.
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PermissionWithModule, Module } from '@/lib/types/rbac';
import PermissionList from '@/components/rbac/permission-management/PermissionList';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import * as rbacApi from '@/lib/api/rbac';
import toast from 'react-hot-toast';

export default function PermissionsPage() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<PermissionWithModule[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Load permissions and modules
   */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [permissionsData, modulesData] = await Promise.all([
          rbacApi.getAllPermissions(),
          rbacApi.getAllModules(),
        ]);

        setPermissions(permissionsData);
        setModules(modulesData);
      } catch (err) {
        console.error('[PermissionsPage] Failed to load data:', err);
        toast.error('Failed to load permissions');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  /**
   * Handle permission click
   */
  const handlePermissionClick = (permissionId: string) => {
    // For now, just log - edit functionality can be added later if needed
    console.log('Permission clicked:', permissionId);
  };

  /**
   * Handle create new permission
   */
  const handleCreate = () => {
    router.push('/admin/rbac/permissions/new');
  };

  return (
    <ProtectedRoute requiredPermission="rbac:view">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Permissions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage granular permissions for platform features
          </p>
        </div>

        {/* Permission List */}
        <PermissionList
          permissions={permissions}
          modules={modules}
          loading={loading}
          onPermissionClick={handlePermissionClick}
          onCreate={handleCreate}
        />
      </div>
    </ProtectedRoute>
  );
}
