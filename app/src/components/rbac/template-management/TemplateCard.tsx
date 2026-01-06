'use client';

// ============================================================================
// TemplateCard Component
// ============================================================================
// Card display for a role template with preview and actions.
// ============================================================================

import React from 'react';
import { FileText, Shield, Trash2 } from 'lucide-react';
import type { RoleTemplateWithPermissions } from '@/lib/types/rbac';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface TemplateCardProps {
  template: RoleTemplateWithPermissions;
  onApply?: (templateId: string) => void;
  onDelete?: (templateId: string) => void;
}

/**
 * TemplateCard - Display template preview with actions
 *
 * @param template - Template to display
 * @param onApply - Callback when apply is clicked
 * @param onDelete - Callback when delete is clicked
 *
 * @example
 * <TemplateCard
 *   template={template}
 *   onApply={(id) => router.push(`/admin/rbac/templates/${id}/apply`)}
 *   onDelete={(id) => handleDelete(id)}
 * />
 */
export default function TemplateCard({
  template,
  onApply,
  onDelete,
}: TemplateCardProps) {
  const permissionCount = template.role_template_permissions?.length || 0;
  const canDelete = !template.is_system_template;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {template.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!template.is_active && (
              <Badge variant="neutral" label="Inactive" />
            )}
            {template.is_system_template && (
              <Badge variant="info" label="System" />
            )}
          </div>
        </div>

        {/* Description */}
        {template.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {template.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Shield className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-gray-100">{permissionCount}</strong>{' '}
            {permissionCount === 1 ? 'permission' : 'permissions'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          {onApply && (
            <Button
              onClick={() => onApply(template.id)}
              variant="primary"
              size="sm"
              className="flex-1"
            >
              Apply Template
            </Button>
          )}
          {onDelete && canDelete && (
            <Button
              onClick={() => onDelete(template.id)}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
