/**
 * AddressList Component
 * Display and manage all tenant addresses
 */

'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Edit2, Trash2, Star, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tenantApi } from '@/lib/api/tenant';
import { Address } from '@/lib/types/tenant';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import AddressFormModal from './AddressFormModal';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';

export function AddressList() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<Address | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      setIsLoading(true);
      const data = await tenantApi.getAllAddresses();
      setAddresses(data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingAddress(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingAddress(null);
  };

  const handleSuccess = () => {
    loadAddresses();
    handleModalClose();
  };

  const handleSetDefault = async (id: string) => {
    try {
      await tenantApi.setAddressAsDefault(id);
      toast.success('Default address updated');
      loadAddresses();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to set default address');
    }
  };

  const handleDeleteClick = (address: Address) => {
    setDeletingAddress(address);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAddress) return;

    try {
      setIsDeleting(true);
      await tenantApi.deleteAddress(deletingAddress.id);
      toast.success('Address deleted successfully');
      setDeletingAddress(null);
      loadAddresses();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete address');
    } finally {
      setIsDeleting(false);
    }
  };

  const getAddressTypeBadge = (type: string) => {
    const variants: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
      legal: 'info',
      billing: 'success',
      service: 'warning',
      mailing: 'neutral',
      office: 'neutral',
    };

    return (
      <Badge
        variant={variants[type] || 'neutral'}
        label={type.charAt(0).toUpperCase() + type.slice(1)}
      />
    );
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Addresses</h2>
        <Button onClick={handleAdd} size="md">
          <Plus className="w-5 h-5" />
          Add Address
        </Button>
      </div>

      {/* Empty state */}
      {addresses.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <MapPin className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No addresses found
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Add your first address to get started
          </p>
          <Button onClick={handleAdd} size="md">
            <Plus className="w-5 h-5" />
            Add Address
          </Button>
        </div>
      ) : (
        /* Address grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getAddressTypeBadge(address.address_type)}
                  {address.is_default && (
                    <Badge variant="success" label="Default" icon={Star} />
                  )}
                  {address.is_po_box && <Badge variant="warning" label="PO Box" />}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(address)}
                    className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(address)}
                    className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {address.line1}
                </p>
                {address.line2 && (
                  <p className="text-gray-600 dark:text-gray-400">{address.line2}</p>
                )}
                <p className="text-gray-600 dark:text-gray-400">
                  {address.city}, {address.state} {address.zip_code}
                </p>
                <p className="text-gray-500 dark:text-gray-500">{address.country}</p>
              </div>

              {!address.is_default && (
                <button
                  onClick={() => handleSetDefault(address.id)}
                  className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Set as default
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <AddressFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
          address={editingAddress}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingAddress && (
        <Modal
          isOpen={!!deletingAddress}
          onClose={() => setDeletingAddress(null)}
          title="Delete Address"
          size="md"
        >
          <ModalContent>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete this address?
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-1 text-sm">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {deletingAddress.line1}
              </p>
              {deletingAddress.line2 && (
                <p className="text-gray-600 dark:text-gray-400">{deletingAddress.line2}</p>
              )}
              <p className="text-gray-600 dark:text-gray-400">
                {deletingAddress.city}, {deletingAddress.state} {deletingAddress.zip_code}
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              This action cannot be undone.
            </p>
          </ModalContent>

          <ModalActions>
            <Button
              variant="secondary"
              onClick={() => setDeletingAddress(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Address'}
            </Button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
}

export default AddressList;
