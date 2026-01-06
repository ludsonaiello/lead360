'use client';

// ============================================================================
// RoleList Component
// ============================================================================
// Table view of all roles with filtering, sorting, and actions.
// ============================================================================

import React, { useState } from 'react';
import { Search, Plus, Shield } from 'lucide-react';
import type { RoleWithPermissions } from '@/lib/types/rbac';
import RoleCard from './RoleCard';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface RoleListProps {
  roles: RoleWithPermissions[];
  loading?: boolean;
  onEdit?: (roleId: string) => void;
  onClone?: (roleId: string) => void;
  onDelete?: (roleId: string) => void;
  onCreate?: () => void;
}

/**
 * RoleList - Display list of roles with search and actions
 *
 * @param roles - Array of roles to display
 * @param loading - Whether roles are loading
 * @param onEdit - Callback when edit is clicked
 * @param onClone - Callback when clone is clicked
 * @param onDelete - Callback when delete is clicked
 * @param onCreate - Callback when create new role is clicked
 *
 * @example
 * <RoleList
 *   roles={roles}
 *   loading={loading}
 *   onEdit={(id) => router.push(`/admin/rbac/roles/${id}`)}
 *   onClone={(id) => handleClone(id)}
 *   onDelete={(id) => handleDelete(id)}
 *   onCreate={() => router.push('/admin/rbac/roles/new')}
 * />
 */
export default function RoleList({
  roles,
  loading = false,
  onEdit,
  onClone,
  onDelete,
  onCreate,
}: RoleListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  /**
   * Filter roles by search query and active status
   */
  const filteredRoles = roles.filter((role) => {
    // Filter by active status
    if (!showInactive && !role.is_active) {
      return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        role.name.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  /**
   * Sort roles: System roles first, then by name
   */
  const sortedRoles = [...filteredRoles].sort((a, b) => {
    // Owner always first
    if (a.name === 'Owner') return -1;
    if (b.name === 'Owner') return 1;

    // Admin second
    if (a.name === 'Admin') return -1;
    if (b.name === 'Admin') return 1;

    // System roles before custom
    if (a.is_system && !b.is_system) return -1;
    if (!a.is_system && b.is_system) return 1;

    // Alphabetical by name
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Show inactive toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show inactive
          </label>

          {/* Create button */}
          {onCreate && (
            <Button
              onClick={onCreate}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing <strong className="text-gray-900 dark:text-gray-100">{sortedRoles.length}</strong> of{' '}
        <strong className="text-gray-900 dark:text-gray-100">{roles.length}</strong> roles
      </div>

      {/* Role list */}
      {sortedRoles.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {searchQuery ? 'No roles match your search' : 'No roles found'}
          </p>
          {searchQuery && (
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search or filters
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedRoles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={onEdit}
              onClone={onClone}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
