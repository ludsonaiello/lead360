// ============================================================================
// Create Template Page
// ============================================================================
// Page for creating a new role template.
// ============================================================================

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import TemplateForm from '@/components/rbac/template-management/TemplateForm';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';

export default function CreateTemplatePage() {
  const router = useRouter();

  return (
    <ProtectedRoute requiredPermission="rbac:create-templates">
      <div className="max-w-5xl mx-auto">
        <TemplateForm
          onSuccess={() => router.push('/admin/rbac/templates')}
          onCancel={() => router.back()}
        />
      </div>
    </ProtectedRoute>
  );
}
