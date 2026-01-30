/**
 * DeleteGroupModal Component
 * Confirmation modal for deleting groups with option to keep or delete items
 */

'use client';

import React, { useState } from 'react';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertCircle } from 'lucide-react';
import type { QuoteGroup } from '@/lib/types/quotes';

interface DeleteGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (keepItems: boolean) => Promise<void>;
  group: QuoteGroup | null;
  loading?: boolean;
}

export function DeleteGroupModal({
  isOpen,
  onClose,
  onConfirm,
  group,
  loading = false,
}: DeleteGroupModalProps) {
  const [keepItems, setKeepItems] = useState(true);

  const handleConfirm = async () => {
    await onConfirm(keepItems);
  };

  const handleClose = () => {
    if (!loading) {
      setKeepItems(true); // Reset to default
      onClose();
    }
  };

  if (!group) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete Group" size="md">
      <ModalContent>
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
              Are you sure you want to delete "{group.name}"?
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This group contains {group.items_count}{' '}
              {group.items_count === 1 ? 'item' : 'items'}. What would you like
              to do with {group.items_count === 1 ? 'it' : 'them'}?
            </p>
          </div>
        </div>

        <div className="space-y-3 ml-9">
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <input
              type="radio"
              name="keep_items"
              checked={keepItems === true}
              onChange={() => setKeepItems(true)}
              className="mt-1 w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              disabled={loading}
            />
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Keep items (move to ungrouped)
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Items will be removed from this group but remain in the quote
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
            <input
              type="radio"
              name="keep_items"
              checked={keepItems === false}
              onChange={() => setKeepItems(false)}
              className="mt-1 w-4 h-4 text-red-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-red-500"
              disabled={loading}
            />
            <div className="flex-1">
              <p className="font-semibold text-red-900 dark:text-red-100">
                Delete all items in group
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Both the group and all items inside will be permanently deleted
              </p>
            </div>
          </label>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm} loading={loading}>
          Delete Group
        </Button>
      </ModalActions>
    </Modal>
  );
}
