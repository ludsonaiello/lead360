/**
 * BulkActionsMenu Component
 * Actions for multiple selected files (download ZIP, bulk delete)
 */

'use client';

import React, { useState } from 'react';
import { Download, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { bulkDownloadFiles, bulkDeleteFiles } from '@/lib/api/files';
import toast from 'react-hot-toast';

interface BulkActionsMenuProps {
  selectedFileIds: string[];
  onDownloadComplete?: () => void;
  onDeleteComplete?: () => void;
  onDeselectAll: () => void;
}

export function BulkActionsMenu({
  selectedFileIds,
  onDownloadComplete,
  onDeleteComplete,
  onDeselectAll,
}: BulkActionsMenuProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedCount = selectedFileIds.length;

  if (selectedCount === 0) {
    return null;
  }

  const handleDownloadZip = async () => {
    if (selectedFileIds.length > 50) {
      toast.error('Maximum 50 files can be downloaded at once');
      return;
    }

    try {
      setIsDownloading(true);
      toast.loading('Creating ZIP file...');

      const zipName = `files_${new Date().getTime()}.zip`;
      await bulkDownloadFiles(selectedFileIds, zipName);

      toast.dismiss();
      toast.success('ZIP file downloaded successfully');
      onDownloadComplete?.();
    } catch (error: any) {
      toast.dismiss();
      const message = error?.response?.data?.message || 'Failed to download files';
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);

      await bulkDeleteFiles(selectedFileIds);

      toast.success(`${selectedCount} file${selectedCount > 1 ? 's' : ''} deleted successfully`);
      setShowDeleteConfirm(false);
      onDeleteComplete?.();
      onDeselectAll();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to delete files';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Selection Info */}
            <div className="flex items-center gap-4">
              <button
                onClick={onDeselectAll}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Deselect all"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {selectedCount} file{selectedCount > 1 ? 's' : ''} selected
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownloadZip}
                variant="secondary"
                disabled={isDownloading || selectedCount > 50}
                className="flex items-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <LoadingSpinner className="w-4 h-4" />
                    Creating ZIP...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download ZIP
                    {selectedCount > 50 && (
                      <span className="text-xs text-gray-500">(max 50)</span>
                    )}
                  </>
                )}
              </Button>

              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="danger"
                disabled={isDeleting}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </Button>

              <Button onClick={onDeselectAll} variant="ghost">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
        title="Delete Files"
      >
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{selectedCount}</strong> file
              {selectedCount > 1 ? 's' : ''}?
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                This action cannot be undone. The files will be permanently deleted.
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            onClick={() => setShowDeleteConfirm(false)}
            variant="ghost"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="danger" disabled={isDeleting}>
            {isDeleting ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Deleting...
              </>
            ) : (
              'Delete Files'
            )}
          </Button>
        </ModalActions>
      </Modal>
    </>
  );
}
