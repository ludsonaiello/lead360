/**
 * Add Bundle to Quote Modal
 * Allows selecting a bundle and adding all its items to the quote
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Package, Check, X, AlertCircle } from 'lucide-react';
import { getBundles, addBundleToQuote } from '@/lib/api/bundles';
import toast from 'react-hot-toast';
import type { Bundle } from '@/lib/types/quotes';

interface AddBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  onSuccess: () => void;
}

export function AddBundleModal({
  isOpen,
  onClose,
  quoteId,
  onSuccess,
}: AddBundleModalProps) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [createGroup, setCreateGroup] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load bundles when modal opens
  useEffect(() => {
    if (isOpen) {
      loadBundles();
    }
  }, [isOpen]);

  // Update group name when bundle is selected
  useEffect(() => {
    if (selectedBundle && createGroup) {
      setGroupName(selectedBundle.name);
    }
  }, [selectedBundle, createGroup]);

  const loadBundles = async () => {
    try {
      setLoadingBundles(true);
      const response = await getBundles({ is_active: true, limit: 100 });
      setBundles(response.data);
    } catch (error: any) {
      toast.error('Failed to load bundles');
      console.error(error);
    } finally {
      setLoadingBundles(false);
    }
  };

  const handleAddBundle = async () => {
    if (!selectedBundle) return;

    setIsSubmitting(true);
    try {
      const result = await addBundleToQuote(quoteId, selectedBundle.id, {
        create_group: createGroup,
        group_name: createGroup && groupName ? groupName : undefined,
      });

      toast.success(result.message);
      onSuccess();
      handleClose();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message || 'Failed to add bundle';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedBundle(null);
      setCreateGroup(true);
      setGroupName('');
      onClose();
    }
  };

  const formatMoney = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Bundle to Quote" size="lg">
      <ModalContent>
        {loadingBundles ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
          </div>
        ) : bundles.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No bundles available
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Create bundles in the Library section to quickly add groups of items to quotes.
            </p>
          </div>
        ) : !selectedBundle ? (
          // Step 1: Select Bundle
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select a bundle to add all its items to this quote
            </p>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {bundles.map((bundle) => (
                <button
                  key={bundle.id}
                  onClick={() => setSelectedBundle(bundle)}
                  className="w-full text-left p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {bundle.name}
                      </h4>
                      {bundle.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {bundle.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{bundle._count?.items || 0} items</span>
                        <span>•</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formatMoney(bundle.total_cost || 0)}
                        </span>
                      </div>
                    </div>
                    <Package className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Step 2: Configure Bundle Options
          <div>
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {selectedBundle.name}
                  </h4>
                  {selectedBundle.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {selectedBundle.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>{selectedBundle._count?.items || 0} items</span>
                    <span>•</span>
                    <span className="font-semibold">
                      {formatMoney(selectedBundle.total_cost || 0)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBundle(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Create Group Option */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <input
                  type="checkbox"
                  id="createGroup"
                  checked={createGroup}
                  onChange={(e) => setCreateGroup(e.target.checked)}
                  disabled={isSubmitting}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                />
                <div className="flex-1">
                  <label
                    htmlFor="createGroup"
                    className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer block mb-1"
                  >
                    Create group for bundle items
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Bundle items will be organized in a group for easier management
                  </p>
                </div>
              </div>

              {/* Group Name Input */}
              {createGroup && (
                <div>
                  <Input
                    label="Group Name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder={selectedBundle.name}
                    disabled={isSubmitting}
                    helperText="Leave empty to use bundle name"
                    maxLength={200}
                  />
                </div>
              )}

              {/* Info Box */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">
                    {selectedBundle._count?.items || 0} items will be added
                  </p>
                  <p className="text-xs">
                    All items can be edited or removed individually after adding the bundle.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </ModalContent>

      <ModalActions>
        <Button
          type="button"
          variant="secondary"
          onClick={handleClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        {selectedBundle && (
          <Button
            type="button"
            onClick={handleAddBundle}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            <Check className="w-4 h-4 mr-2" />
            Add {selectedBundle._count?.items || 0} Items
          </Button>
        )}
      </ModalActions>
    </Modal>
  );
}

export default AddBundleModal;
