'use client';

/**
 * RBAC Debugger Component
 * Displays current user's roles and permissions for troubleshooting
 * Only renders in development mode
 */

import React, { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRBAC } from '@/contexts/RBACContext';
import { ChevronDown, ChevronUp, Shield } from 'lucide-react';

export function RBACDebugger() {
  const { user } = useAuth();
  const { roles, permissions, hasPermission, hasRole, loading } = useRBAC();
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Don't show if not logged in
  if (!user) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors"
      >
        <Shield className="h-4 w-4" />
        <span className="text-sm font-semibold">RBAC Debug</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 max-w-md max-h-96 overflow-y-auto">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
            RBAC Debug Info
          </h3>

          {/* Loading State */}
          {loading && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-3">
              ⏳ Loading permissions...
            </p>
          )}

          {/* User Info */}
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              User Info
            </h4>
            <div className="space-y-1 text-xs">
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-mono">ID:</span> {user.id}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-mono">Email:</span> {user.email}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-mono">Tenant ID:</span> {user.tenant_id || 'N/A'}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-mono">Platform Admin:</span>{' '}
                {user.is_platform_admin ? '✅ Yes' : '❌ No'}
              </p>
            </div>
          </div>

          {/* Roles */}
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Roles ({roles.length})
            </h4>
            {roles.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No roles assigned</p>
            ) : (
              <ul className="space-y-1">
                {roles.map((role) => (
                  <li
                    key={role.id}
                    className="text-xs text-gray-600 dark:text-gray-400 font-mono"
                  >
                    • {role.name}
                    {role.description && (
                      <span className="text-gray-500 dark:text-gray-500 ml-2">
                        ({role.description})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Permissions */}
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Permissions ({permissions.length})
            </h4>
            {permissions.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No permissions assigned</p>
            ) : (
              <div className="space-y-2">
                {/* Group by module */}
                {Object.entries(
                  permissions.reduce((acc, perm) => {
                    const module = perm.module?.name || perm.module_id || 'unknown';
                    if (!acc[module]) acc[module] = [];
                    acc[module].push(perm);
                    return acc;
                  }, {} as Record<string, typeof permissions>)
                ).map(([module, perms]) => (
                  <div key={module}>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {module}:
                    </p>
                    <ul className="ml-3 space-y-0.5">
                      {perms.map((perm) => (
                        <li
                          key={perm.id}
                          className="text-xs text-gray-600 dark:text-gray-400 font-mono"
                        >
                          • {perm.action}
                          {perm.description && (
                            <span className="text-gray-500 dark:text-gray-500 ml-2">
                              ({perm.description})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Test Specific Permissions */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Communications Module Test
            </h4>
            <ul className="space-y-1 text-xs">
              <li className="text-gray-600 dark:text-gray-400 font-mono">
                communications:view:{' '}
                {hasPermission('communications:view') ? (
                  <span className="text-green-600 dark:text-green-400">✅ Yes</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">❌ No</span>
                )}
              </li>
              <li className="text-gray-600 dark:text-gray-400 font-mono">
                communications:create:{' '}
                {hasPermission('communications:create') ? (
                  <span className="text-green-600 dark:text-green-400">✅ Yes</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">❌ No</span>
                )}
              </li>
              <li className="text-gray-600 dark:text-gray-400 font-mono">
                communications:edit:{' '}
                {hasPermission('communications:edit') ? (
                  <span className="text-green-600 dark:text-green-400">✅ Yes</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">❌ No</span>
                )}
              </li>
              <li className="text-gray-600 dark:text-gray-400 font-mono">
                communications:delete:{' '}
                {hasPermission('communications:delete') ? (
                  <span className="text-green-600 dark:text-green-400">✅ Yes</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">❌ No</span>
                )}
              </li>
            </ul>
          </div>

          {/* Instructions */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              💡 If "communications:view" shows ❌ No, you need to assign this permission to your
              role in the backend.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default RBACDebugger;
