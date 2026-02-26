'use client';

import React from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { FileText, TrendingUp, ArrowRight } from 'lucide-react';

/**
 * Voice AI Reports Landing Page (Platform Admin Only)
 * Route: /admin/voice-ai/reports
 *
 * Features:
 * - Navigation to Call Logs
 * - Navigation to Usage Analytics
 */
export default function ReportsPage() {
  const breadcrumbItems = [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: 'Voice AI', href: '/admin/voice-ai/providers' },
    { label: 'Reports', href: '/admin/voice-ai/reports' },
  ];

  const reports = [
    {
      title: 'Call Logs',
      description: 'View detailed call logs with filtering and export capabilities',
      href: '/admin/voice-ai/reports/call-logs',
      icon: FileText,
      color: 'blue',
    },
    {
      title: 'Usage Analytics',
      description: 'Platform-wide usage reports with per-tenant breakdown',
      href: '/admin/voice-ai/reports/usage',
      icon: TrendingUp,
      color: 'green',
    },
  ];

  return (
    <ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Voice AI Reports
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              View call logs and usage analytics across all tenants
            </p>
          </div>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((report) => {
            const Icon = report.icon;
            const colorClasses = {
              blue: {
                bg: 'bg-blue-100 dark:bg-blue-900/20',
                text: 'text-blue-600 dark:text-blue-400',
                hover: 'hover:border-blue-300 dark:hover:border-blue-700',
              },
              green: {
                bg: 'bg-green-100 dark:bg-green-900/20',
                text: 'text-green-600 dark:text-green-400',
                hover: 'hover:border-green-300 dark:hover:border-green-700',
              },
            }[report.color];

            return (
              <Link
                key={report.href}
                href={report.href}
                className={`
                  block p-6 rounded-lg border border-gray-200 dark:border-gray-700
                  bg-white dark:bg-gray-800 shadow-sm
                  ${colorClasses.hover}
                  transition-all duration-200
                  group
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-3 ${colorClasses.bg} rounded-lg`}>
                        <Icon className={`h-6 w-6 ${colorClasses.text}`} />
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {report.title}
                      </h2>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {report.description}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-shrink-0 ml-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </ProtectedRoute>
  );
}
