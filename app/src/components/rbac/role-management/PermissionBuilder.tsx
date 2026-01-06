'use client';

// ============================================================================
// PermissionBuilder Component
// ============================================================================
// Interactive permission builder for creating/editing roles.
// Most complex component in RBAC module - handles 100+ permissions.
//
// Features:
// - Checkbox matrix grouped by module
// - Collapsible sections
// - "Select All" / "Deselect All" per module
// - Search/filter across all permissions
// - Real-time change tracking
// - Loading skeleton for initial load
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import type { PermissionBuilderProps, ModuleWithPermissions } from '@/lib/types/rbac';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import * as rbacApi from '@/lib/api/rbac';

/**
 * PermissionBuilder - Interactive permission selection UI
 *
 * Displays all available permissions grouped by module with checkboxes.
 * Supports search, bulk selection, and collapsible sections.
 *
 * @param selectedPermissionIds - Array of currently selected permission IDs
 * @param onChange - Callback when selection changes
 * @param disabled - Whether the builder is disabled
 * @param loading - Whether permissions are loading (external)
 *
 * @example
 * const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
 *
 * <PermissionBuilder
 *   selectedPermissionIds={selectedPermissionIds}
 *   onChange={setSelectedPermissionIds}
 * />
 */
export default function PermissionBuilder({
  selectedPermissionIds,
  onChange,
  disabled = false,
  loading: externalLoading = false,
}: PermissionBuilderProps) {
  const [modules, setModules] = useState<ModuleWithPermissions[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const loading = externalLoading || internalLoading;

  /**
   * Load all modules and their permissions
   */
  useEffect(() => {
    const loadModules = async () => {
      setInternalLoading(true);
      setError(null);

      try {
        const modulesData = await rbacApi.getAllModules();
        // Filter active modules only
        const activeModules = modulesData.filter((m) => m.is_active);
        // Sort by sort_order
        activeModules.sort((a, b) => a.sort_order - b.sort_order);

        setModules(activeModules);

        // Expand all modules by default
        setExpandedModules(new Set(activeModules.map((m) => m.id)));
      } catch (err) {
        console.error('[PermissionBuilder] Failed to load modules:', err);
        setError(err instanceof Error ? err : new Error('Failed to load permissions'));
        setModules([]);
      } finally {
        setInternalLoading(false);
      }
    };

    loadModules();
  }, []);

  /**
   * Filter modules/permissions by search query
   */
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) {
      return modules;
    }

    const query = searchQuery.toLowerCase();

    return modules
      .map((module) => {
        // Filter permissions within module
        const matchingPermissions = module.permissions.filter((perm) => {
          return (
            perm.display_name.toLowerCase().includes(query) ||
            perm.action.toLowerCase().includes(query) ||
            module.name.toLowerCase().includes(query) ||
            module.display_name.toLowerCase().includes(query)
          );
        });

        // Return module if it has matching permissions or matches itself
        if (
          matchingPermissions.length > 0 ||
          module.name.toLowerCase().includes(query) ||
          module.display_name.toLowerCase().includes(query)
        ) {
          return {
            ...module,
            permissions: matchingPermissions.length > 0 ? matchingPermissions : module.permissions,
          };
        }

        return null;
      })
      .filter((m): m is ModuleWithPermissions => m !== null);
  }, [modules, searchQuery]);

  /**
   * Toggle module expansion
   */
  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  /**
   * Check if permission is selected
   */
  const isPermissionSelected = (permissionId: string): boolean => {
    return selectedPermissionIds.includes(permissionId);
  };

  /**
   * Toggle permission selection
   */
  const togglePermission = (permissionId: string) => {
    if (disabled) return;

    const newSelection = isPermissionSelected(permissionId)
      ? selectedPermissionIds.filter((id) => id !== permissionId)
      : [...selectedPermissionIds, permissionId];

    onChange(newSelection);
  };

  /**
   * Check if all permissions in module are selected
   */
  const isModuleFullySelected = (module: ModuleWithPermissions): boolean => {
    return module.permissions.every((perm) => isPermissionSelected(perm.id));
  };

  /**
   * Check if some (but not all) permissions in module are selected
   */
  const isModulePartiallySelected = (module: ModuleWithPermissions): boolean => {
    const selectedCount = module.permissions.filter((perm) =>
      isPermissionSelected(perm.id)
    ).length;
    return selectedCount > 0 && selectedCount < module.permissions.length;
  };

  /**
   * Select all permissions in module
   */
  const selectAllInModule = (module: ModuleWithPermissions) => {
    if (disabled) return;

    const modulePermissionIds = module.permissions.map((p) => p.id);
    const newSelection = [
      ...selectedPermissionIds.filter((id) => !modulePermissionIds.includes(id)),
      ...modulePermissionIds,
    ];

    onChange(newSelection);
  };

  /**
   * Deselect all permissions in module
   */
  const deselectAllInModule = (module: ModuleWithPermissions) => {
    if (disabled) return;

    const modulePermissionIds = module.permissions.map((p) => p.id);
    const newSelection = selectedPermissionIds.filter(
      (id) => !modulePermissionIds.includes(id)
    );

    onChange(newSelection);
  };

  /**
   * Select all permissions globally
   */
  const selectAll = () => {
    if (disabled) return;

    const allPermissionIds = filteredModules.flatMap((m) => m.permissions.map((p) => p.id));
    onChange(allPermissionIds);
  };

  /**
   * Deselect all permissions globally
   */
  const deselectAll = () => {
    if (disabled) return;
    onChange([]);
  };

  /**
   * Render loading state
   */
  if (loading && modules.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center text-red-600">
          <p className="font-medium">Failed to load permissions</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </Card>
    );
  }

  /**
   * Render empty state
   */
  if (modules.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-gray-500">
          <p className="font-medium">No permissions available</p>
          <p className="text-sm mt-1">Create modules and permissions first.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={selectAll}
              variant="ghost"
              size="sm"
              disabled={disabled}
            >
              Select All
            </Button>
            <Button
              onClick={deselectAll}
              variant="ghost"
              size="sm"
              disabled={disabled}
            >
              Deselect All
            </Button>
          </div>
        </div>

        {/* Selection count */}
        <div className="mt-2 text-sm text-gray-600">
          {selectedPermissionIds.length} permission(s) selected
        </div>
      </div>

      {/* Permission list */}
      <div className="max-h-[600px] overflow-y-auto">
        {filteredModules.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No permissions match your search.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredModules.map((module) => {
              const isExpanded = expandedModules.has(module.id);
              const isFullySelected = isModuleFullySelected(module);
              const isPartiallySelected = isModulePartiallySelected(module);

              return (
                <div key={module.id} className="bg-white">
                  {/* Module header */}
                  <div
                    className={`
                      flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={() => !disabled && toggleModule(module.id)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* Expand/collapse icon */}
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}

                      {/* Module name */}
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {module.display_name}
                        </h3>
                        {module.description && (
                          <p className="text-sm text-gray-500">{module.description}</p>
                        )}
                      </div>

                      {/* Permission count */}
                      <span className="text-sm text-gray-500 ml-auto mr-4">
                        {module.permissions.filter((p) => isPermissionSelected(p.id)).length} /{' '}
                        {module.permissions.length}
                      </span>
                    </div>

                    {/* Module-level actions */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {isFullySelected ? (
                        <Button
                          onClick={() => deselectAllInModule(module)}
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          className="flex items-center gap-1"
                        >
                          <X className="w-4 h-4" />
                          Deselect All
                        </Button>
                      ) : (
                        <Button
                          onClick={() => selectAllInModule(module)}
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          className="flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          Select All
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Permissions list (expanded) */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-200">
                      {module.permissions.map((permission) => {
                        const isSelected = isPermissionSelected(permission.id);

                        return (
                          <label
                            key={permission.id}
                            className={`
                              flex items-center gap-3 px-4 py-3 cursor-pointer
                              hover:bg-gray-100 border-b border-gray-100 last:border-b-0
                              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                              ${isSelected ? 'bg-blue-50' : ''}
                            `}
                          >
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePermission(permission.id)}
                              disabled={disabled}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />

                            {/* Permission info */}
                            <div className="flex-1 ml-8">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {permission.display_name}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                  {module.name}:{permission.action}
                                </span>
                              </div>
                              {permission.description && (
                                <p className="text-sm text-gray-600 mt-0.5">
                                  {permission.description}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
