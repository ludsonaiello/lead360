/**
 * Voice AI Transfer Numbers Page
 * Route: /(dashboard)/voice-ai/transfer-numbers
 * Permission: Owner, Admin, Manager (view); Owner, Admin (create/edit/delete)
 */

'use client';

import React from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { Phone } from 'lucide-react';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { TransferNumbersList } from '@/components/voice-ai/tenant/transfer-numbers/TransferNumbersList';

export default function TransferNumbersPage() {
  const { user } = useAuth();

  // View: Owner, Admin, Manager
  // Edit: Owner, Admin only
  const canEdit = user?.roles?.includes('Owner') || user?.roles?.includes('Admin');

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Voice AI', href: '/voice-ai/settings' },
    { label: 'Transfer Numbers', href: '/voice-ai/transfer-numbers' },
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
                Transfer Numbers
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage call transfer destinations for your Voice AI agent
              </p>
            </div>
          </div>
        </div>

        {/* Read-only notice for Managers */}
        {!canEdit && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-semibold">View-Only Mode:</span> You have read-only access.
              Contact an Owner or Admin to create, edit, or delete transfer numbers.
            </p>
          </div>
        )}

        {/* Transfer Numbers List */}
        <TransferNumbersList canEdit={canEdit} />
      </div>
    </ProtectedRoute>
  );
}
