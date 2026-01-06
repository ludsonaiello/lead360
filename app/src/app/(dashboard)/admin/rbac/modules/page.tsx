// ============================================================================
// Modules List Page
// ============================================================================
// List all modules with search, filtering, and actions.
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ModuleWithPermissions } from '@/lib/types/rbac';
import ModuleList from '@/components/rbac/module-management/ModuleList';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import * as rbacApi from '@/lib/api/rbac';
import toast from 'react-hot-toast';

export default function ModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState<ModuleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Load all modules
   */
  const loadModules = async () => {
    setLoading(true);
    try {
      const modulesData = await rbacApi.getAllModules();
      setModules(modulesData);
    } catch (err) {
      console.error('[ModulesPage] Failed to load modules:', err);
      toast.error('Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, []);

  /**
   * Handle edit module
   */
  const handleEdit = (moduleId: string) => {
    router.push(`/admin/rbac/modules/${moduleId}`);
  };

  /**
   * Handle create new module
   */
  const handleCreate = () => {
    router.push('/admin/rbac/modules/new');
  };

  return (
    <ProtectedRoute requiredPermission="rbac:view">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Modules
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage platform feature modules
          </p>
        </div>

        {/* Module List */}
        <ModuleList
          modules={modules}
          loading={loading}
          onEdit={handleEdit}
          onCreate={handleCreate}
        />
      </div>
    </ProtectedRoute>
  );
}
