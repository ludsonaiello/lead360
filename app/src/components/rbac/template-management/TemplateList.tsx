'use client';

// ============================================================================
// TemplateList Component
// ============================================================================
// List all role templates with search, filtering, and actions.
// ============================================================================

import React, { useState } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import type { RoleTemplateWithPermissions } from '@/lib/types/rbac';
import TemplateCard from './TemplateCard';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface TemplateListProps {
  templates: RoleTemplateWithPermissions[];
  loading?: boolean;
  onApply?: (templateId: string) => void;
  onDelete?: (templateId: string) => void;
  onCreate?: () => void;
}

/**
 * TemplateList - Display and filter templates
 *
 * @param templates - Array of templates to display
 * @param loading - Whether templates are loading
 * @param onApply - Callback when apply template is clicked
 * @param onDelete - Callback when delete is clicked
 * @param onCreate - Callback when create new template is clicked
 *
 * @example
 * <TemplateList
 *   templates={templates}
 *   loading={loading}
 *   onApply={(id) => router.push(`/admin/rbac/templates/${id}/apply`)}
 *   onDelete={(id) => handleDelete(id)}
 *   onCreate={() => router.push('/admin/rbac/templates/new')}
 * />
 */
export default function TemplateList({
  templates,
  loading = false,
  onApply,
  onDelete,
  onCreate,
}: TemplateListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showSystemOnly, setShowSystemOnly] = useState(false);

  /**
   * Filter templates by search query and active status
   */
  const filteredTemplates = templates.filter((template) => {
    // Filter by active status
    if (!showInactive && !template.is_active) {
      return false;
    }

    // Filter by system templates
    if (showSystemOnly && !template.is_system_template) {
      return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  /**
   * Sort templates (system first, then alphabetical)
   */
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.is_system_template && !b.is_system_template) return -1;
    if (!a.is_system_template && b.is_system_template) return 1;
    return a.name.localeCompare(b.name);
  });

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 w-full sm:max-w-md">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Show inactive toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Inactive
          </label>

          {/* Show system only toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
            <input
              type="checkbox"
              checked={showSystemOnly}
              onChange={(e) => setShowSystemOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            System Only
          </label>

          {/* Create button */}
          {onCreate && (
            <Button
              onClick={onCreate}
              variant="primary"
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Create
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing <strong className="text-gray-900 dark:text-gray-100">{filteredTemplates.length}</strong> of{' '}
        <strong className="text-gray-900 dark:text-gray-100">{templates.length}</strong> templates
      </div>

      {/* Template grid */}
      {sortedTemplates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Filter className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {searchQuery ? 'No templates match your search' : 'No templates found'}
          </p>
          {searchQuery && (
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search query
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onApply={onApply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
