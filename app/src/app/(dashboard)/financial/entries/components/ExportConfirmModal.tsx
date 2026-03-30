/**
 * Export Confirmation Modal
 * Sprint 11 — Shows entry count and active filter summary before CSV export
 */

'use client';

import React from 'react';
import { Download, Filter } from 'lucide-react';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ActiveFilter {
  label: string;
  value: string;
}

interface ExportConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  entryCount: number;
  activeFilters: ActiveFilter[];
  loading: boolean;
}

export function ExportConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  entryCount,
  activeFilters,
  loading,
}: ExportConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Entries" size="md">
      <ModalContent>
        <div className="space-y-4">
          {/* Entry count message */}
          <p className="text-base text-gray-700 dark:text-gray-300">
            Export{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {entryCount.toLocaleString()}
            </span>{' '}
            {entryCount === 1 ? 'entry' : 'entries'} matching your current filters as CSV?
          </p>

          {/* Active filter summary */}
          {activeFilters.length > 0 && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <Filter className="w-3.5 h-3.5" />
                Active Filters
              </div>
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter, idx) => (
                  <Badge key={idx} variant="info">
                    <span className="font-medium">{filter.label}:</span>{' '}
                    {filter.value}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* No filters note */}
          {activeFilters.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No filters applied — all entries will be exported.
            </p>
          )}

          {/* Max rows note */}
          {entryCount > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Maximum 10,000 rows per export.
            </p>
          )}
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          loading={loading}
          disabled={loading || entryCount === 0}
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
      </ModalActions>
    </Modal>
  );
}
