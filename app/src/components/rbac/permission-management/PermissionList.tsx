'use client';

// ============================================================================
// PermissionList Component
// ============================================================================
// List all permissions with search, filtering by module, and actions.
// ============================================================================

import React, { useState } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import type { PermissionWithModule, Module } from '@/lib/types/rbac';
import PermissionGrouper from './PermissionGrouper';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface PermissionListProps {
  permissions: PermissionWithModule[];
  modules: Module[];
  loading?: boolean;
  onPermissionClick?: (permissionId: string) => void;
  onCreate?: () => void;
}

/**
 * PermissionList - Display and filter permissions
 *
 * @param permissions - Array of permissions to display
 * @param modules - Array of modules for filtering
 * @param loading - Whether permissions are loading
 * @param onPermissionClick - Callback when permission is clicked
 * @param onCreate - Callback when create new permission is clicked
 *
 * @example
 * <PermissionList
 *   permissions={permissions}
 *   modules={modules}
 *   loading={loading}
 *   onPermissionClick={(id) => router.push(`/admin/rbac/permissions/${id}`)}
 *   onCreate={() => router.push('/admin/rbac/permissions/new')}
 * />
 */
export default function PermissionList({
  permissions,
  modules,
  loading = false,
  onPermissionClick,
  onCreate,
}: PermissionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);

  /**
   * Filter permissions by search query, module, and active status
   */
  const filteredPermissions = permissions.filter((permission) => {
    // Filter by active status
    if (!showInactive && !permission.is_active) {
      return false;
    }

    // Filter by module
    if (selectedModuleId && permission.module_id !== selectedModuleId) {
      return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        permission.display_name.toLowerCase().includes(query) ||
        permission.action.toLowerCase().includes(query) ||
        permission.module.name.toLowerCase().includes(query) ||
        permission.module.display_name.toLowerCase().includes(query) ||
        permission.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  /**
   * Get module options for filter dropdown
   */
  const moduleOptions = [
    { value: '', label: 'All Modules' },
    ...modules.map((module) => ({
      value: module.id,
      label: module.display_name,
    })),
  ];

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
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Module filter */}
          <div className="flex-1 sm:flex-none sm:w-48">
            <Select
              value={selectedModuleId}
              onChange={(value) => setSelectedModuleId(value)}
              options={moduleOptions}
            />
          </div>

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
        Showing <strong className="text-gray-900 dark:text-gray-100">{filteredPermissions.length}</strong> of{' '}
        <strong className="text-gray-900 dark:text-gray-100">{permissions.length}</strong> permissions
      </div>

      {/* Permission list (grouped by module) */}
      {filteredPermissions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Filter className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {searchQuery || selectedModuleId ? 'No permissions match your filters' : 'No permissions found'}
          </p>
          {(searchQuery || selectedModuleId) && (
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search or filters
            </p>
          )}
        </div>
      ) : (
        <PermissionGrouper
          permissions={filteredPermissions}
          onPermissionClick={onPermissionClick}
        />
      )}
    </div>
  );
}
