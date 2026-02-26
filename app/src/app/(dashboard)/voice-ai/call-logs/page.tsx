/**
 * Voice AI Call Logs Page (Tenant)
 * Route: /(dashboard)/voice-ai/call-logs
 * Permission: Owner, Admin, Manager
 */

'use client';

import React from 'react';
import { Phone } from 'lucide-react';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { CallLogsList } from '@/components/voice-ai/tenant/call-logs/CallLogsList';

export default function CallLogsPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Voice AI', href: '/voice-ai/settings' },
    { label: 'Call Logs', href: '/voice-ai/call-logs' },
  ];

  return (
    <ProtectedRoute requiredRole={['Owner', 'Admin', 'Manager']}>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-4 flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Call Logs
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                View and analyze your Voice AI call history
              </p>
            </div>
          </div>
        </div>

        {/* Call Logs List */}
        <CallLogsList />
      </div>
    </ProtectedRoute>
  );
}
