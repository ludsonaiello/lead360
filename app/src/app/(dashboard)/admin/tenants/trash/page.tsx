/**
 * Admin Tenants Trash Page
 * View and manage soft-deleted tenants
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  AlertTriangle,
  RotateCcw,
  Search,
  ArrowLeft,
  Calendar,
  Building2,
} from 'lucide-react';
import { getAllTenants, permanentDeleteTenant, restoreTenant } from '@/lib/api/admin';
import type { TenantListItem, TenantListParams } from '@/lib/api/admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

export default function AdminTenantsTrashPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState<TenantListItem | null>(null);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 20;

  useEffect(() => {
    loadDeletedTenants();
  }, [page, searchTerm]);

  const loadDeletedTenants = async () => {
    try {
      setLoading(true);
      const params: TenantListParams = {
        page,
        limit,
        search: searchTerm || undefined,
        status: 'deleted', // Only fetch soft-deleted tenants
      };
      const response = await getAllTenants(params);

      console.log('Deleted tenants response:', JSON.stringify(response, null, 2));

      setTenants(response.data || []);
      setTotalPages(response.pagination?.total_pages || 1);
    } catch (error: any) {
      console.error('Load deleted tenants error:', error);
      toast.error(error.message || 'Failed to load deleted tenants');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handlePermanentDelete = async () => {
    if (!selectedTenant) return;
    if (deleteConfirmText !== 'DELETE PERMANENTLY') {
      toast.error('Please type DELETE PERMANENTLY to confirm');
      return;
    }

    try {
      setActionLoading(true);
      await permanentDeleteTenant(selectedTenant.id);
      toast.success(`${selectedTenant.company_name} permanently deleted`);
      setShowPermanentDeleteModal(false);
      setSelectedTenant(null);
      setDeleteConfirmText('');
      loadDeletedTenants();
    } catch (error: any) {
      console.error('Permanent delete error:', error);
      toast.error(error.message || 'Failed to permanently delete tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedTenant) return;

    try {
      setActionLoading(true);
      await restoreTenant(selectedTenant.id);
      toast.success(`${selectedTenant.company_name} restored successfully`);
      setShowRestoreModal(false);
      setSelectedTenant(null);
      loadDeletedTenants();
    } catch (error: any) {
      console.error('Restore tenant error:', error);
      toast.error(error.message || 'Failed to restore tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const getDaysUntilPermanentDelete = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const permanentDeleteDate = new Date(deleted.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
    const now = new Date();
    const daysRemaining = Math.ceil((permanentDeleteDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return daysRemaining > 0 ? daysRemaining : 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/tenants')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Trash2 className="w-8 h-8 text-red-600" />
                Tenant Trash
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Soft-deleted tenants (90-day retention)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search deleted tenants..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </form>
      </Card>

      {/* Warning Notice */}
      <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
              Retention Policy
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Soft-deleted tenants are retained for 90 days before automatic permanent deletion. You can restore them or permanently delete them manually during this period.
            </p>
          </div>
        </div>
      </Card>

      {/* Deleted Tenants List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12">
            <Trash2 className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No deleted tenants found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Trash is empty
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Subdomain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Deleted On
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Auto-Delete In
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {tenants.map((tenant) => {
                    const daysRemaining = tenant.deleted_at ? getDaysUntilPermanentDelete(tenant.deleted_at) : 0;
                    return (
                      <tr
                        key={tenant.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {tenant.company_name}
                              </div>
                              {tenant.legal_business_name && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {tenant.legal_business_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 dark:text-white font-mono">
                            {tenant.subdomain}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="w-4 h-4" />
                            {tenant.deleted_at
                              ? new Date(tenant.deleted_at).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {daysRemaining > 0 ? (
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                daysRemaining <= 7
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : daysRemaining <= 30
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {daysRemaining} days
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Expired
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedTenant(tenant);
                                setShowRestoreModal(true);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Restore
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTenant(tenant);
                                setShowPermanentDeleteModal(true);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Forever
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Restore Confirmation Modal */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => {
          setShowRestoreModal(false);
          setSelectedTenant(null);
        }}
        title="Restore Tenant"
        size="md"
      >
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to restore <strong>{selectedTenant?.company_name}</strong>?
            </p>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>Note:</strong> This will restore the tenant from trash and reactivate it. Users will regain access to the platform.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="secondary"
            onClick={() => {
              setShowRestoreModal(false);
              setSelectedTenant(null);
            }}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRestore} loading={actionLoading}>
            Restore Tenant
          </Button>
        </ModalActions>
      </Modal>

      {/* Permanent Delete Confirmation Modal */}
      <Modal
        isOpen={showPermanentDeleteModal}
        onClose={() => {
          setShowPermanentDeleteModal(false);
          setSelectedTenant(null);
          setDeleteConfirmText('');
        }}
        title="⚠️ Permanent Delete Tenant"
        size="md"
      >
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to <strong className="text-red-600 dark:text-red-400">PERMANENTLY DELETE</strong>{' '}
              <strong>{selectedTenant?.company_name}</strong>?
            </p>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
              <p className="text-sm text-red-800 dark:text-red-200 font-semibold">
                ⚠️ CRITICAL WARNING - THIS ACTION CANNOT BE UNDONE!
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                <li>All tenant data will be permanently deleted</li>
                <li>All users under this tenant will be removed</li>
                <li>All files, jobs, and business data will be erased</li>
                <li>The subdomain will be freed for reuse</li>
                <li>This action is irreversible - data cannot be recovered</li>
              </ul>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <strong>DELETE PERMANENTLY</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE PERMANENTLY"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="secondary"
            onClick={() => {
              setShowPermanentDeleteModal(false);
              setSelectedTenant(null);
              setDeleteConfirmText('');
            }}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handlePermanentDelete}
            loading={actionLoading}
            disabled={deleteConfirmText !== 'DELETE PERMANENTLY'}
          >
            Delete Permanently
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}