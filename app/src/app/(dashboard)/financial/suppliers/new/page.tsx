/**
 * New Supplier Page
 * Create a new supplier using the shared SupplierForm component
 * Sprint 6 — Financial Frontend
 */

'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import SupplierForm from '../components/SupplierForm';

const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];

export default function NewSupplierPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canManage = hasRole(CAN_MANAGE_ROLES);

  if (rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have permission to create suppliers.
        </p>
      </div>
    );
  }

  return <SupplierForm />;
}
