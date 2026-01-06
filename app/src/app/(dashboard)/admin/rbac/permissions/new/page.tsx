// ============================================================================
// Create Permission Page
// ============================================================================
// Page for creating a new permission.
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Module } from '@/lib/types/rbac';
import PermissionForm from '@/components/rbac/permission-management/PermissionForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import * as rbacApi from '@/lib/api/rbac';
import toast from 'react-hot-toast';

export default function CreatePermissionPage() {
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Load modules
   */
  useEffect(() => {
    const loadModules = async () => {
      setLoading(true);
      try {
        const modulesData = await rbacApi.getAllModules();
        setModules(modulesData);
      } catch (err) {
        console.error('[CreatePermissionPage] Failed to load modules:', err);
        toast.error('Failed to load modules');
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, []);

  if (loading) {
    return (
      <ProtectedRoute requiredPermission="rbac:create-permissions">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission="rbac:create-permissions">
      <div className="max-w-3xl mx-auto">
        <PermissionForm
          modules={modules}
          onSuccess={() => router.push('/admin/rbac/permissions')}
          onCancel={() => router.back()}
        />
      </div>
    </ProtectedRoute>
  );
}
