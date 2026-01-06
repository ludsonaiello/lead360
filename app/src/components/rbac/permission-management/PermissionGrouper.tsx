'use client';

// ============================================================================
// PermissionGrouper Component
// ============================================================================
// Groups permissions by module for organized display.
// ============================================================================

import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, Key } from 'lucide-react';
import type { PermissionWithModule } from '@/lib/types/rbac';
import PermissionBadge from './PermissionBadge';
import Card from '@/components/ui/Card';

interface PermissionGrouperProps {
  permissions: PermissionWithModule[];
  expandedByDefault?: boolean;
  onPermissionClick?: (permissionId: string) => void;
}

/**
 * PermissionGrouper - Display permissions grouped by module
 *
 * @param permissions - Array of permissions with module data
 * @param expandedByDefault - Whether modules are expanded by default (default: true)
 * @param onPermissionClick - Callback when a permission is clicked
 *
 * @example
 * <PermissionGrouper
 *   permissions={permissions}
 *   onPermissionClick={(id) => router.push(`/admin/rbac/permissions/${id}`)}
 * />
 */
export default function PermissionGrouper({
  permissions,
  expandedByDefault = true,
  onPermissionClick,
}: PermissionGrouperProps) {
  const [expandedModules, setExpandedModules] = React.useState<Set<string>>(
    new Set()
  );

  /**
   * Group permissions by module
   */
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionWithModule[]>();

    permissions.forEach((permission) => {
      const moduleId = permission.module.id;
      if (!groups.has(moduleId)) {
        groups.set(moduleId, []);
      }
      groups.get(moduleId)!.push(permission);
    });

    // Sort permissions within each group by action
    groups.forEach((perms) => {
      perms.sort((a, b) => a.action.localeCompare(b.action));
    });

    return groups;
  }, [permissions]);

  /**
   * Initialize expanded modules
   */
  React.useEffect(() => {
    if (expandedByDefault) {
      const allModuleIds = Array.from(groupedPermissions.keys());
      setExpandedModules(new Set(allModuleIds));
    }
  }, [groupedPermissions, expandedByDefault]);

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
   * Get sorted modules (by sort_order)
   */
  const sortedModules = useMemo(() => {
    const modules = Array.from(groupedPermissions.entries()).map(([moduleId, perms]) => ({
      module: perms[0].module,
      permissions: perms,
    }));

    return modules.sort((a, b) => a.module.sort_order - b.module.sort_order);
  }, [groupedPermissions]);

  if (sortedModules.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-gray-500">
          <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No permissions found</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sortedModules.map(({ module, permissions: modulePermissions }) => {
        const isExpanded = expandedModules.has(module.id);

        return (
          <Card key={module.id}>
            {/* Module header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => toggleModule(module.id)}
            >
              <div className="flex items-center gap-3 flex-1">
                {/* Expand/collapse icon */}
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}

                {/* Module info */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {module.display_name}
                  </h3>
                  {module.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {module.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Permission count */}
              <span className="text-sm text-gray-500 ml-4">
                {modulePermissions.length} {modulePermissions.length === 1 ? 'permission' : 'permissions'}
              </span>
            </div>

            {/* Permissions list (expanded) */}
            {isExpanded && (
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {modulePermissions.map((permission) => (
                    <div
                      key={permission.id}
                      className={`
                        p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
                        ${onPermissionClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all' : ''}
                      `}
                      onClick={() => onPermissionClick?.(permission.id)}
                    >
                      <div className="flex items-start gap-2">
                        <Key className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {permission.display_name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 font-mono">
                            {permission.action}
                          </p>
                          {permission.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {permission.description}
                            </p>
                          )}
                          {!permission.is_active && (
                            <span className="inline-block mt-1 text-xs text-gray-500">
                              (Inactive)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
