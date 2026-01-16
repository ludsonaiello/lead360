/**
 * Admin Dashboard Page
 * Platform admin overview with metrics, charts, and activity
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Building2,
  CheckCircle2,
  HardDrive,
  Activity,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import MetricCard from '@/components/admin/dashboard/MetricCard';
import { useDashboardMetrics, useRecentActivity } from '@/lib/hooks/useAdminDashboard';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AdminDashboardPage() {
  const router = useRouter();

  // Fetch dashboard data with auto-refresh (every 30 seconds)
  const { metrics, loading: metricsLoading, error: metricsError } = useDashboardMetrics(true, 30000);
  const { activity, loading: activityLoading } = useRecentActivity(10, true, 30000);

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (metricsError || !metrics) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>{metricsError || 'Failed to load dashboard metrics'}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Platform Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Overview of all tenants, users, and system health
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Active Tenants"
          value={metrics.activeTenants.count}
          growth={metrics.activeTenants.growth}
          sparkline={metrics.activeTenants.sparkline}
          icon={<Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        />

        <MetricCard
          title="Total Users"
          value={metrics.totalUsers.count}
          growth={metrics.totalUsers.growth}
          sparkline={metrics.totalUsers.sparkline}
          icon={<Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
        />

        <MetricCard
          title="Job Success Rate"
          value={metrics.jobSuccessRate.percentage}
          format="percentage"
          status={metrics.jobSuccessRate.status}
          icon={<CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />}
        />

        <MetricCard
          title="Storage Used"
          value={metrics.storageUsed.current}
          format="storage"
          icon={<HardDrive className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
        />

        <MetricCard
          title="System Health"
          value={metrics.systemHealth.status === 'healthy' ? 100 : 0}
          format="percentage"
          status={metrics.systemHealth.status}
          icon={<Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        />

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Database</span>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  metrics.systemHealth.checks.database
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {metrics.systemHealth.checks.database ? 'Connected' : 'Disconnected'}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Redis</span>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  metrics.systemHealth.checks.redis
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {metrics.systemHealth.checks.redis ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Activity</h2>
          <button
            onClick={() => router.push('/admin/audit-logs')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View All
          </button>
        </div>

        {activityLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : activity.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No recent activity
          </p>
        ) : (
          <div className="space-y-3">
            {activity.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-2 ${
                    item.status === 'success'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">{item.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.actor ? `${item.actor.name} • ` : ''}
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => router.push('/admin/tenants/create')}
            className="px-4 py-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
          >
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">Create Tenant</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Add a new organization</p>
          </button>

          <button
            onClick={() => router.push('/admin/tenants')}
            className="px-4 py-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
          >
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">Manage Tenants</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">View and edit tenants</p>
          </button>

          <button
            onClick={() => router.push('/admin/tenants/trash')}
            className="px-4 py-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">Tenant Trash</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Restore or delete</p>
          </button>

          <button
            onClick={() => router.push('/admin/settings')}
            className="px-4 py-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
          >
            <Activity className="w-5 h-5 text-green-600 dark:text-green-400 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">System Settings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Configure platform</p>
          </button>
        </div>
      </Card>
    </div>
  );
}
