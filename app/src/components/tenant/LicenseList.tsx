/**
 * LicenseList Component
 * Display and manage professional licenses with expiry tracking
 */

'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Edit2, Trash2, Plus, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import { tenantApi } from '@/lib/api/tenant';
import { License } from '@/lib/types/tenant';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import LicenseFormModal from './LicenseFormModal';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';

export function LicenseList() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [deletingLicense, setDeletingLicense] = useState<License | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadLicenses();
  }, []);

  const loadLicenses = async () => {
    try {
      setIsLoading(true);
      const data = await tenantApi.getAllLicenses();
      setLicenses(data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load licenses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (license: License) => {
    setEditingLicense(license);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingLicense(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingLicense(null);
  };

  const handleSuccess = () => {
    loadLicenses();
    handleModalClose();
  };

  const handleDeleteClick = (license: License) => {
    setDeletingLicense(license);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingLicense) return;

    try {
      setIsDeleting(true);
      await tenantApi.deleteLicense(deletingLicense.id);
      toast.success('License deleted successfully');
      setDeletingLicense(null);
      loadLicenses();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete license');
    } finally {
      setIsDeleting(false);
    }
  };

  const getExpiryStatus = (expiryDate: string) => {
    const daysUntilExpiry = differenceInDays(new Date(expiryDate), new Date());

    if (daysUntilExpiry < 0) {
      return {
        label: 'EXPIRED',
        variant: 'danger' as const,
        icon: AlertCircle,
        daysText: `Expired ${Math.abs(daysUntilExpiry)} days ago`,
      };
    } else if (daysUntilExpiry <= 30) {
      return {
        label: `EXPIRING IN ${daysUntilExpiry} DAYS`,
        variant: 'warning' as const,
        icon: Clock,
        daysText: `Expires in ${daysUntilExpiry} days`,
      };
    } else {
      return {
        label: 'ACTIVE',
        variant: 'success' as const,
        icon: CheckCircle,
        daysText: `Expires in ${daysUntilExpiry} days`,
      };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Professional Licenses</h2>
        <Button onClick={handleAdd} size="md">
          <Plus className="w-5 h-5" />
          Add License
        </Button>
      </div>

      {/* Empty state */}
      {licenses.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <FileText className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No licenses found
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Add your professional licenses to get started
          </p>
          <Button onClick={handleAdd} size="md">
            <Plus className="w-5 h-5" />
            Add License
          </Button>
        </div>
      ) : (
        /* Licenses table */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    License Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    State
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Expiry Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {licenses.map((license) => {
                  const status = getExpiryStatus(license.expiry_date);

                  return (
                    <tr key={license.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {license.license_type?.name || license.custom_license_type}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {license.license_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {license.issuing_state}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {format(new Date(license.expiry_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {status.daysText}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={status.variant} label={status.label} icon={status.icon} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleEdit(license)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(license)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <LicenseFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
          license={editingLicense}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingLicense && (
        <Modal
          isOpen={!!deletingLicense}
          onClose={() => setDeletingLicense(null)}
          title="Delete License"
          size="md"
        >
          <ModalContent>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete this license?
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {deletingLicense.license_type?.name || deletingLicense.custom_license_type}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                License #: {deletingLicense.license_number}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                State: {deletingLicense.issuing_state}
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              This action cannot be undone.
            </p>
          </ModalContent>

          <ModalActions>
            <Button
              variant="secondary"
              onClick={() => setDeletingLicense(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete License'}
            </Button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
}

export default LicenseList;
