'use client';

// ============================================================================
// TransferNumbersList Component
// ============================================================================
// Main component for displaying and managing transfer numbers
// Includes drag-and-drop reordering, create, edit, delete
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Plus, AlertCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SortableList } from '@/components/ui/SortableList';
import { TransferNumberCard } from './TransferNumberCard';
import { TransferNumberModal } from './TransferNumberModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { TransferNumber } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';

interface TransferNumbersListProps {
  canEdit: boolean;
}

const MAX_TRANSFER_NUMBERS = 10;

/**
 * TransferNumbersList - Main list component with CRUD operations
 */
export function TransferNumbersList({ canEdit }: TransferNumbersListProps) {
  const [transferNumbers, setTransferNumbers] = useState<TransferNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTransferNumber, setEditingTransferNumber] = useState<TransferNumber | null>(null);
  const [deletingTransferNumber, setDeletingTransferNumber] = useState<TransferNumber | null>(null);

  /**
   * Load transfer numbers
   */
  const loadTransferNumbers = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await voiceAiApi.getAllTransferNumbers();
      setTransferNumbers(data);
    } catch (err: any) {
      console.error('[TransferNumbersList] Failed to load transfer numbers:', err);
      const errorMessage = err.response?.data?.message || 'Failed to load transfer numbers';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadTransferNumbers();
  }, []);

  /**
   * Handle reorder (drag-and-drop)
   */
  const handleReorder = async (reorderedItems: TransferNumber[]) => {
    // Optimistically update UI
    setTransferNumbers(reorderedItems);
    setReordering(true);

    try {
      // Build reorder payload
      const reorderData = {
        items: reorderedItems.map((item, index) => ({
          id: item.id,
          display_order: index,
        })),
      };

      // Call API
      const updatedTransferNumbers = await voiceAiApi.reorderTransferNumbers(reorderData);
      setTransferNumbers(updatedTransferNumbers);
      toast.success('Transfer numbers reordered successfully');
    } catch (err: any) {
      console.error('[TransferNumbersList] Failed to reorder:', err);
      const errorMessage = err.response?.data?.message || 'Failed to reorder transfer numbers';
      toast.error(errorMessage);

      // Reload to revert optimistic update
      loadTransferNumbers();
    } finally {
      setReordering(false);
    }
  };

  /**
   * Handle create button click
   */
  const handleCreateClick = () => {
    if (transferNumbers.length >= MAX_TRANSFER_NUMBERS) {
      toast.error(`Maximum of ${MAX_TRANSFER_NUMBERS} transfer numbers reached`);
      return;
    }
    setCreateModalOpen(true);
  };

  /**
   * Handle edit
   */
  const handleEdit = (transferNumber: TransferNumber) => {
    setEditingTransferNumber(transferNumber);
  };

  /**
   * Handle delete
   */
  const handleDelete = (transferNumber: TransferNumber) => {
    setDeletingTransferNumber(transferNumber);
  };

  /**
   * Handle modal success (reload data)
   */
  const handleModalSuccess = () => {
    loadTransferNumbers();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-1">
              Failed to Load Transfer Numbers
            </h3>
            <p className="text-sm text-red-800 dark:text-red-200 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={loadTransferNumbers}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {transferNumbers.length} of {MAX_TRANSFER_NUMBERS} transfer numbers configured
          </p>
          {canEdit && transferNumbers.length > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Drag cards to reorder priority
            </p>
          )}
        </div>

        {canEdit && (
          <Button
            variant="primary"
            onClick={handleCreateClick}
            disabled={transferNumbers.length >= MAX_TRANSFER_NUMBERS}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Transfer Number
          </Button>
        )}
      </div>

      {/* Max Limit Warning */}
      {canEdit && transferNumbers.length >= MAX_TRANSFER_NUMBERS && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-900 dark:text-yellow-100">
            <span className="font-semibold">Maximum Limit Reached:</span> You have configured the
            maximum of {MAX_TRANSFER_NUMBERS} transfer numbers. Delete an existing number to add a
            new one.
          </p>
        </div>
      )}

      {/* Empty State */}
      {transferNumbers.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-200 dark:bg-gray-700 rounded-full">
              <Plus className="h-8 w-8 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                No Transfer Numbers Configured
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Add transfer numbers to enable call transfers from your Voice AI agent
              </p>
              {canEdit && (
                <Button variant="primary" onClick={handleCreateClick}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Transfer Number
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Numbers List with Drag-and-Drop */}
      {transferNumbers.length > 0 && (
        <div className="relative">
          {reordering && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          )}

          <SortableList
            items={transferNumbers}
            onReorder={handleReorder}
            getItemId={(item) => item.id}
            disabled={!canEdit || reordering}
          >
            {(transferNumber) => (
              <TransferNumberCard
                key={transferNumber.id}
                transferNumber={transferNumber}
                canEdit={canEdit}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </SortableList>
        </div>
      )}

      {/* Create Modal */}
      <TransferNumberModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

      {/* Edit Modal */}
      {editingTransferNumber && (
        <TransferNumberModal
          transferNumber={editingTransferNumber}
          isOpen={!!editingTransferNumber}
          onClose={() => setEditingTransferNumber(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTransferNumber && (
        <DeleteConfirmModal
          transferNumber={deletingTransferNumber}
          isOpen={!!deletingTransferNumber}
          onClose={() => setDeletingTransferNumber(null)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
