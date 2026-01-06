// ============================================================================
// Templates List Page
// ============================================================================
// List all role templates with search, filtering, and actions.
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RoleTemplateWithPermissions } from '@/lib/types/rbac';
import TemplateList from '@/components/rbac/template-management/TemplateList';
import ApplyTemplateModal from '@/components/rbac/template-management/ApplyTemplateModal';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import * as rbacApi from '@/lib/api/rbac';
import toast from 'react-hot-toast';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<RoleTemplateWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplateWithPermissions | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  /**
   * Load all templates
   */
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const templatesData = await rbacApi.getAllTemplates();
      setTemplates(templatesData);
    } catch (err) {
      console.error('[TemplatesPage] Failed to load templates:', err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  /**
   * Handle apply template
   */
  const handleApply = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setApplyModalOpen(true);
    }
  };

  /**
   * Handle delete template
   */
  const handleDelete = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    if (!confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      return;
    }

    try {
      await rbacApi.deleteTemplate(templateId);
      toast.success(`Template "${template.name}" deleted successfully`);
      loadTemplates();
    } catch (err) {
      console.error('[TemplatesPage] Failed to delete template:', err);
      toast.error('Failed to delete template');
    }
  };

  /**
   * Handle create new template
   */
  const handleCreate = () => {
    router.push('/admin/rbac/templates/new');
  };

  return (
    <ProtectedRoute requiredPermission="rbac:view">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Role Templates
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage reusable role templates for quick role creation
          </p>
        </div>

        {/* Template List */}
        <TemplateList
          templates={templates}
          loading={loading}
          onApply={handleApply}
          onDelete={handleDelete}
          onCreate={handleCreate}
        />

        {/* Apply Template Modal */}
        {selectedTemplate && (
          <ApplyTemplateModal
            template={selectedTemplate}
            isOpen={applyModalOpen}
            onClose={() => {
              setApplyModalOpen(false);
              setSelectedTemplate(null);
            }}
            onSuccess={(role) => {
              setApplyModalOpen(false);
              setSelectedTemplate(null);
              router.push(`/admin/rbac/roles/${role.id}`);
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
