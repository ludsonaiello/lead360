/**
 * Edit Supplier Page
 * Load existing supplier and edit using the shared SupplierForm component
 * Sprint 6 — Financial Frontend
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Shield, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SupplierForm from '../../components/SupplierForm';
import { getSupplier } from '@/lib/api/financial';
import type { Supplier } from '@/lib/types/financial';

const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];

export default function EditSupplierPage() {
  const params = useParams();
  const supplierId = params.id as string;
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canManage = hasRole(CAN_MANAGE_ROLES);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadSupplier = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getSupplier(supplierId);
      setSupplier(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load supplier';
      setFetchError(message);
      console.error('Failed to load supplier:', error);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    if (canManage && supplierId) {
      loadSupplier();
    }
  }, [canManage, supplierId, loadSupplier]);

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
          You don&apos;t have permission to edit suppliers.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (fetchError || !supplier) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="p-8 sm:p-12">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {fetchError || 'Supplier Not Found'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              The supplier you&apos;re trying to edit could not be loaded. Please try again or go back to the list.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="primary" onClick={loadSupplier} size="sm">
                Try Again
              </Button>
              <Link href="/financial/suppliers">
                <Button variant="secondary" size="sm">
                  Back to Suppliers
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <SupplierForm supplier={supplier} />;
}
