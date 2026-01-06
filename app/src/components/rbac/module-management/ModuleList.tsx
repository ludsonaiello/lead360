'use client';

// ============================================================================
// ModuleList Component
// ============================================================================
// List all modules with search, filtering, and actions.
// ============================================================================

import React, { useState } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import type { ModuleWithPermissions } from '@/lib/types/rbac';
import ModuleCard from './ModuleCard';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ModuleListProps {
  modules: ModuleWithPermissions[];
  loading?: boolean;
  onEdit?: (moduleId: string) => void;
  onCreate?: () => void;
}

/**
 * ModuleList - Display and filter modules
 *
 * @param modules - Array of modules to display
 * @param loading - Whether modules are loading
 * @param onEdit - Callback when module edit is clicked
 * @param onCreate - Callback when create new module is clicked
 *
 * @example
 * <ModuleList
 *   modules={modules}
 *   loading={loading}
 *   onEdit={(id) => router.push(`/admin/rbac/modules/${id}`)}
 *   onCreate={() => router.push('/admin/rbac/modules/new')}
 * />
 */
export default function ModuleList({
  modules,
  loading = false,
  onEdit,
  onCreate,
}: ModuleListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  /**
   * Filter modules by search query and active status
   */
  const filteredModules = modules.filter((module) => {
    // Filter by active status
    if (!showInactive && !module.is_active) {
      return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        module.name.toLowerCase().includes(query) ||
        module.display_name.toLowerCase().includes(query) ||
        module.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  /**
   * Sort modules by sort_order
   */
  const sortedModules = [...filteredModules].sort((a, b) => a.sort_order - b.sort_order);

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
              placeholder="Search modules..."
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
        Showing <strong className="text-gray-900 dark:text-gray-100">{filteredModules.length}</strong> of{' '}
        <strong className="text-gray-900 dark:text-gray-100">{modules.length}</strong> modules
      </div>

      {/* Module grid */}
      {sortedModules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Filter className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {searchQuery ? 'No modules match your search' : 'No modules found'}
          </p>
          {searchQuery && (
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search query
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
