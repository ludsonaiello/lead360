// ============================================================================
// Create Role Page
// ============================================================================
// Page for creating a new role with permissions.
// ============================================================================

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import RoleForm from '@/components/rbac/role-management/RoleForm';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';

export default function CreateRolePage() {
  const router = useRouter();

  return (
    <ProtectedRoute requiredPermission="rbac:create-roles">
      <div className="max-w-5xl mx-auto">
        <RoleForm
          onSuccess={() => router.push('/admin/rbac/roles')}
          onCancel={() => router.back()}
        />
      </div>
    </ProtectedRoute>
  );
}
