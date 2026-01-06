// ============================================================================
// Create Module Page
// ============================================================================
// Page for creating a new module.
// ============================================================================

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ModuleForm from '@/components/rbac/module-management/ModuleForm';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';

export default function CreateModulePage() {
  const router = useRouter();

  return (
    <ProtectedRoute requiredPermission="rbac:create-modules">
      <div className="max-w-3xl mx-auto">
        <ModuleForm
          onSuccess={() => router.push('/admin/rbac/modules')}
          onCancel={() => router.back()}
        />
      </div>
    </ProtectedRoute>
  );
}
