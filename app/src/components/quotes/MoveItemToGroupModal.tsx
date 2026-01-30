/**
 * MoveItemToGroupModal Component
 * Modal for moving an item to a different group or removing it from a group
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Folder, FolderMinus } from 'lucide-react';
import type { QuoteItem, QuoteGroup } from '@/lib/types/quotes';

interface MoveItemToGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: QuoteItem | null;
  groups: QuoteGroup[];
  onMove: (itemId: string, groupId: string | null) => Promise<void>;
  loading?: boolean;
}

export function MoveItemToGroupModal({
  isOpen,
  onClose,
  item,
  groups,
  onMove,
  loading = false,
}: MoveItemToGroupModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  // Initialize selected group when modal opens
  useEffect(() => {
    if (isOpen && item) {
      setSelectedGroupId(item.quote_group_id || null);
    }
  }, [isOpen, item]);

  if (!item) return null;

  const handleMove = async () => {
    if (selectedGroupId === item.quote_group_id) {
      // No change - just close
      onClose();
      return;
    }

    try {
      setMoving(true);
      await onMove(item.id, selectedGroupId);
      onClose();
    } catch (err) {
      // Error handled by parent
      setMoving(false);
    }
  };

  const isCurrentGroup = (groupId: string | null) => {
    if (groupId === null && !item.quote_group_id) return true;
    return groupId === item.quote_group_id;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Move Item to Group"
      size="md"
    >
      <ModalContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Moving: <span className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</span>
          </p>

          {/* Remove from Group Option */}
          <button
            onClick={() => setSelectedGroupId(null)}
            disabled={moving || loading}
            className={`w-full p-4 text-left border-2 rounded-lg transition-colors ${
              selectedGroupId === null && !item.quote_group_id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            } ${
              moving || loading
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3">
              <FolderMinus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  No Group (Ungrouped)
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Remove from any group
                </p>
              </div>
              {isCurrentGroup(null) && (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                  Current
                </span>
              )}
            </div>
          </button>

          {/* Group Options */}
          {groups.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Folder className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No groups available</p>
              <p className="text-xs mt-1">Create a group first to organize items</p>
            </div>
          ) : (
            groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                disabled={moving || loading}
                className={`w-full p-4 text-left border-2 rounded-lg transition-colors ${
                  selectedGroupId === group.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                } ${
                  moving || loading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {group.name}
                    </p>
                    {group.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {group.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {group.items_count} {group.items_count === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  {isCurrentGroup(group.id) && (
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                      Current
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ModalContent>

      <ModalActions>
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={moving || loading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleMove}
          loading={moving || loading}
          disabled={selectedGroupId === item.quote_group_id}
        >
          Move Item
        </Button>
      </ModalActions>
    </Modal>
  );
}
