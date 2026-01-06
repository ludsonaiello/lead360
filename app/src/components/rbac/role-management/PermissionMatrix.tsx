'use client';

// ============================================================================
// PermissionMatrix Component
// ============================================================================
// Read-only display of permission matrix showing which roles have which
// permissions. Used for visualization and reference.
// ============================================================================

import React from 'react';
import { Check, X } from 'lucide-react';
import type { PermissionMatrixResponse } from '@/lib/types/rbac';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface PermissionMatrixProps {
  matrix: PermissionMatrixResponse | null;
  loading?: boolean;
}

/**
 * PermissionMatrix - Read-only permission matrix display
 *
 * Shows a table of:
 * - Rows: Modules and their actions
 * - Columns: Roles
 * - Cells: Checkmark if role has permission, X if not
 *
 * @param matrix - Permission matrix data
 * @param loading - Whether matrix is loading
 *
 * @example
 * const { matrix, loading } = usePermissionMatrix();
 *
 * <PermissionMatrix matrix={matrix} loading={loading} />
 */
export default function PermissionMatrix({
  matrix,
  loading = false,
}: PermissionMatrixProps) {
  /**
   * Render loading state
   */
  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  /**
   * Render empty state
   */
  if (!matrix || matrix.modules.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-gray-500">
          <p className="font-medium">No permissions available</p>
          <p className="text-sm mt-1">Permission matrix is empty.</p>
        </div>
      </Card>
    );
  }

  /**
   * Get all role names from matrix
   */
  const roleNames = Object.keys(matrix.matrix);

  /**
   * Check if role has permission
   */
  const hasPermission = (roleName: string, moduleName: string, action: string): boolean => {
    const rolePerms = matrix.matrix[roleName];
    if (!rolePerms) return false;

    const modulePerms = rolePerms[moduleName];
    if (!modulePerms) return false;

    return modulePerms.includes(action);
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Module/Action column */}
              <th
                scope="col"
                className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Module / Permission
              </th>

              {/* Role columns */}
              {roleNames.map((roleName) => (
                <th
                  key={roleName}
                  scope="col"
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {roleName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {matrix.modules.map((module) => (
              <React.Fragment key={module.id}>
                {/* Module header row */}
                <tr className="bg-gray-100">
                  <td
                    colSpan={roleNames.length + 1}
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    {module.display_name}
                    {module.description && (
                      <span className="ml-2 text-xs font-normal text-gray-600">
                        — {module.description}
                      </span>
                    )}
                  </td>
                </tr>

                {/* Permission rows for this module */}
                {module.permissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-gray-50">
                    {/* Permission name */}
                    <td className="sticky left-0 z-10 bg-white px-6 py-4 text-sm text-gray-900 border-r border-gray-200">
                      <span className="font-medium">{permission.display_name}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({module.name}:{permission.action})
                      </span>
                    </td>

                    {/* Permission status per role */}
                    {roleNames.map((roleName) => (
                      <td
                        key={`${permission.id}-${roleName}`}
                        className="px-6 py-4 text-center"
                      >
                        {hasPermission(roleName, module.name, permission.action) ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
