// ============================================================================
// Edit Module Page
// ============================================================================
// Page for editing an existing module.
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import type { Module } from '@/lib/types/rbac';
import ModuleForm from '@/components/rbac/module-management/ModuleForm';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import * as rbacApi from '@/lib/api/rbac';
import toast from 'react-hot-toast';

interface EditModulePageProps {
  params: Promise<{ id: string }>;
}

export default function EditModulePage({ params }: EditModulePageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const moduleId = resolvedParams.id;

  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Load module data
   */
  useEffect(() => {
    const loadModule = async () => {
      setLoading(true);
      try {
        const moduleData = await rbacApi.getModuleById(moduleId);
        setModule(moduleData);
      } catch (err) {
        console.error('[EditModulePage] Failed to load module:', err);
        toast.error('Failed to load module');
        router.push('/admin/rbac/modules');
      } finally {
        setLoading(false);
      }
    };

    loadModule();
  }, [moduleId, router]);

  if (loading) {
    return (
      <ProtectedRoute requiredPermission="rbac:edit-modules">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </ProtectedRoute>
    );
  }

  if (!module) {
    return null;
  }

  return (
    <ProtectedRoute requiredPermission="rbac:edit-modules">
      <div className="max-w-3xl mx-auto">
        <ModuleForm
          module={module}
          onSuccess={() => router.push('/admin/rbac/modules')}
          onCancel={() => router.back()}
        />
      </div>
    </ProtectedRoute>
  );
}
