// ============================================================================
// RBAC Dashboard Page
// ============================================================================
// Overview of roles, permissions, and modules with quick stats.
// Entry point for Platform Admin RBAC management.
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Users, Key, Layers, Plus, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/dashboard/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import * as rbacApi from '@/lib/api/rbac';

export default function RBACDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalRoles: 0,
    totalPermissions: 0,
    totalModules: 0,
    systemRoles: 0,
    customRoles: 0,
  });
  const [loading, setLoading] = useState(true);

  /**
   * Load dashboard stats
   */
  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const [roles, permissions, modules] = await Promise.all([
          rbacApi.getAllRoles(),
          rbacApi.getAllPermissions(),
          rbacApi.getAllModules(),
        ]);

        setStats({
          totalRoles: roles.length,
          totalPermissions: permissions.length,
          totalModules: modules.length,
          systemRoles: roles.filter((r) => r.is_system).length,
          customRoles: roles.filter((r) => !r.is_system).length,
        });
      } catch (err) {
        console.error('[RBACDashboard] Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <ProtectedRoute requiredPermission="rbac:view">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Role & Permission Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage roles, permissions, and access control for your organization
          </p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Roles */}
            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Total Roles
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {stats.totalRoles}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.systemRoles} system, {stats.customRoles} custom
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Permissions */}
            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Total Permissions
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {stats.totalPermissions}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Across all modules
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <Key className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Modules */}
            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Modules
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {stats.totalModules}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Feature modules
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <Layers className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manage Roles */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Roles
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Create and manage roles with specific permission sets
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push('/admin/rbac/roles')}
                      variant="secondary"
                      size="sm"
                    >
                      View All
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button
                      onClick={() => router.push('/admin/rbac/roles/new')}
                      variant="primary"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create Role
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manage Permissions */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <Key className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Permissions
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Define granular permissions for platform features
                  </p>
                  <Button
                    onClick={() => router.push('/admin/rbac/permissions')}
                    variant="secondary"
                    size="sm"
                  >
                    View All
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
