// ============================================================================
// Apply Template Page
// ============================================================================
// Page for applying a template to create a new role.
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Save, X, AlertCircle } from 'lucide-react';
import type { RoleTemplateWithPermissions, ApplyTemplateRequest, PermissionWithModule } from '@/lib/types/rbac';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import PermissionGrouper from '@/components/rbac/permission-management/PermissionGrouper';
import * as rbacApi from '@/lib/api/rbac';
import { formatErrorForDisplay } from '@/lib/utils/errors';
import toast from 'react-hot-toast';

// Form validation schema
const applyTemplateSchema = z.object({
  role_name: z
    .string()
    .min(1, 'Role name is required')
    .max(50, 'Role name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s_-]+$/, 'Role name can only contain letters, numbers, spaces, hyphens, and underscores'),
  description: z
    .string()
    .max(200, 'Description must be less than 200 characters')
    .optional()
    .nullable(),
});

type ApplyTemplateSchemaData = z.infer<typeof applyTemplateSchema>;

interface ApplyTemplatePageProps {
  params: Promise<{ id: string }>;
}

export default function ApplyTemplatePage({ params }: ApplyTemplatePageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const templateId = resolvedParams.id;

  const [template, setTemplate] = useState<RoleTemplateWithPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplyTemplateSchemaData>({
    resolver: zodResolver(applyTemplateSchema),
    defaultValues: {
      role_name: '',
      description: '',
    },
  });

  /**
   * Load template data
   */
  useEffect(() => {
    const loadTemplate = async () => {
      setLoading(true);
      try {
        const templateData = await rbacApi.getTemplateById(templateId);
        setTemplate(templateData);
      } catch (err) {
        console.error('[ApplyTemplatePage] Failed to load template:', err);
        toast.error('Failed to load template');
        router.push('/admin/rbac/templates');
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [templateId, router]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: ApplyTemplateSchemaData) => {
    if (!template) return;

    setSubmitting(true);
    setError(null);

    try {
      const requestData: ApplyTemplateRequest = {
        role_name: data.role_name.trim(),
        description: data.description?.trim() || null,
      };

      const newRole = await rbacApi.applyTemplate(template.id, requestData);
      toast.success(`Role "${newRole.name}" created from template successfully`);
      router.push(`/admin/rbac/roles/${newRole.id}`);
    } catch (err) {
      console.error('[ApplyTemplatePage] Failed to apply template:', err);
      const errorInfo = formatErrorForDisplay(err);
      setError(errorInfo.message);
      toast.error(errorInfo.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission="rbac:create-roles">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </ProtectedRoute>
    );
  }

  if (!template) {
    return null;
  }

  const permissionCount = template.role_template_permissions?.length || 0;

  // Extract permissions from junction table (should include module from API)
  const permissions = (template.role_template_permissions?.map(tp => tp.permission) || []) as PermissionWithModule[];

  return (
    <ProtectedRoute requiredPermission="rbac:create-roles">
      <div className="max-w-5xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Apply Template: {template.name}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create a new role with {permissionCount} permission{permissionCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Template Info */}
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Template Information
              </h3>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                {template.name}
              </p>
              {template.description && (
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  {template.description}
                </p>
              )}
            </div>
          </Card>

          {/* Role Details */}
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                New Role Details
              </h3>
            </div>
            <div className="space-y-4">
              {/* Role Name */}
              <div>
                <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="role_name"
                  type="text"
                  {...register('role_name')}
                  placeholder="e.g., Sales Manager - North"
                  disabled={submitting}
                />
                {errors.role_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.role_name.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Optional description for this role..."
                  rows={3}
                  disabled={submitting}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Permissions Preview */}
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Included Permissions ({permissionCount})
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The new role will be created with the following permissions
              </p>
            </div>

            <PermissionGrouper permissions={permissions} />
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={submitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating Role...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Role
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
}
