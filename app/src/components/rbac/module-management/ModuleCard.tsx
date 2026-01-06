'use client';

// ============================================================================
// ModuleCard Component
// ============================================================================
// Card display for a single module with details and actions.
// ============================================================================

import React from 'react';
import { Layers, Shield, Edit } from 'lucide-react';
import type { ModuleWithPermissions } from '@/lib/types/rbac';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface ModuleCardProps {
  module: ModuleWithPermissions;
  onEdit?: (moduleId: string) => void;
}

/**
 * ModuleCard - Display module summary with actions
 *
 * @param module - Module to display
 * @param onEdit - Callback when edit is clicked
 *
 * @example
 * <ModuleCard
 *   module={module}
 *   onEdit={(id) => router.push(`/admin/rbac/modules/${id}`)}
 * />
 */
export default function ModuleCard({ module, onEdit }: ModuleCardProps) {
  const permissionCount = module._count?.permissions || 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {module.display_name}
              </h3>
              <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {module.name}
              </code>
            </div>
          </div>

          {!module.is_active && (
            <Badge variant="neutral" label="Inactive" />
          )}
        </div>

        {/* Description */}
        {module.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {module.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-gray-100">{permissionCount}</strong>{' '}
              {permissionCount === 1 ? 'permission' : 'permissions'}
            </span>
          </div>
          <div className="text-gray-400">•</div>
          <div className="text-gray-600 dark:text-gray-400">
            Sort Order: <strong className="text-gray-900 dark:text-gray-100">{module.sort_order}</strong>
          </div>
        </div>

        {/* Actions */}
        {onEdit && (
          <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={() => onEdit(module.id)}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
