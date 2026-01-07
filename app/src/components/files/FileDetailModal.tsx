/**
 * FileDetailModal Component
 * Display file details with large preview and actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Share2, Trash2, ExternalLink } from 'lucide-react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FileThumbnail } from './FileThumbnail';
import { ShareLinkInfo } from './ShareLinkInfo';
import { ChangeSharePasswordModal } from './ChangeSharePasswordModal';
import type { File, ShareLink } from '@/lib/types/files';
import {
  formatFileSize,
  formatFileDateTime,
  formatFileCategory,
  getFileCategoryColor,
  calculateCompressionRatio,
} from '@/lib/utils/file-helpers';
import { downloadFile, deleteFile, listShareLinks } from '@/lib/api/files';
import { getCurrentTenant } from '@/lib/api/tenant';
import { useAuth } from '@/lib/hooks/useAuth';
import toast from 'react-hot-toast';

interface FileDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onShare?: (file: File) => void;
  onDelete?: () => void;
}

export function FileDetailModal({
  isOpen,
  onClose,
  file,
  onShare,
  onDelete,
}: FileDetailModalProps) {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isLoadingShareLinks, setIsLoadingShareLinks] = useState(false);
  const [tenantSubdomain, setTenantSubdomain] = useState<string | undefined>();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [selectedShareLink, setSelectedShareLink] = useState<ShareLink | null>(null);

  // Fetch share links when modal opens
  useEffect(() => {
    const fetchShareLinks = async () => {
      if (!file || !isOpen) return;

      try {
        setIsLoadingShareLinks(true);
        const response = await listShareLinks(file.file_id);
        setShareLinks(response.share_links);
      } catch (error) {
        console.error('Failed to fetch share links:', error);
      } finally {
        setIsLoadingShareLinks(false);
      }
    };

    fetchShareLinks();
  }, [file?.file_id, isOpen]);

  // Fetch tenant subdomain
  useEffect(() => {
    const fetchTenantSubdomain = async () => {
      try {
        const tenant = await getCurrentTenant();
        setTenantSubdomain(tenant.subdomain);
      } catch (error) {
        console.error('Failed to fetch tenant subdomain:', error);
      }
    };

    if (user?.tenant_id && isOpen) {
      fetchTenantSubdomain();
    }
  }, [user?.tenant_id, isOpen]);

  if (!file) return null;

  const categoryColor = getFileCategoryColor(file.category);

  const handleDownload = () => {
    try {
      downloadFile(file);
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleShare = () => {
    onShare?.(file);
    onClose();
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteFile(file.file_id);
      toast.success('File deleted successfully');
      setShowDeleteConfirm(false);
      onClose();
      onDelete?.();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to delete file';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangePassword = (shareLink: ShareLink) => {
    setSelectedShareLink(shareLink);
    setShowChangePassword(true);
  };

  const handlePasswordChanged = async (newShareLink: ShareLink) => {
    // Refresh share links to show updated info
    try {
      const response = await listShareLinks(file.file_id);
      setShareLinks(response.share_links);
    } catch (error) {
      console.error('Failed to refresh share links:', error);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="" size="xl">
        <ModalContent>
          <div className="space-y-6">
            {/* Large Preview */}
            <div className="flex justify-center bg-gray-50 dark:bg-gray-900 rounded-lg p-8">
              <FileThumbnail file={file} size="lg" />
            </div>

            {/* File Info Grid */}
            <div className="space-y-4">
              {/* Filename & Category */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 break-words">
                    {file.original_filename}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={categoryColor as any} label={formatFileCategory(file.category)} />
                    {file.is_optimized && (
                      <Badge variant="success" label="Optimized" />
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                {/* File Size */}
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">File Size</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {formatFileSize(file.size_bytes)}
                    {file.original_size_bytes && file.original_size_bytes !== file.size_bytes && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        (original: {formatFileSize(file.original_size_bytes)},{' '}
                        {calculateCompressionRatio(file.original_size_bytes, file.size_bytes)} smaller)
                      </span>
                    )}
                  </p>
                </div>

                {/* File Type */}
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">File Type</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {file.mime_type}
                  </p>
                </div>

                {/* Dimensions (if image) */}
                {file.width && file.height && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Dimensions</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      {file.width} × {file.height} px
                    </p>
                  </div>
                )}

                {/* Entity */}
                {file.entity_name && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Related To</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      {file.entity_name}
                    </p>
                  </div>
                )}

                {/* Uploaded By */}
                {file.uploaded_by_name && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Uploaded By</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      {file.uploaded_by_name}
                    </p>
                  </div>
                )}

                {/* Upload Date */}
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Uploaded At</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {formatFileDateTime(file.created_at)}
                  </p>
                </div>

                {/* Thumbnail Available */}
                {file.has_thumbnail && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Thumbnail</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                      Available
                    </p>
                  </div>
                )}

                {/* File ID (for debugging) */}
                <div className="col-span-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">File ID</span>
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-1 break-all">
                    {file.file_id}
                  </p>
                </div>
              </div>

              {/* Share Links Section */}
              {isLoadingShareLinks ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner className="w-5 h-5 mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Loading share links...
                  </span>
                </div>
              ) : shareLinks.length > 0 ? (
                <div className="space-y-3">
                  {shareLinks.map((shareLink) => (
                    <ShareLinkInfo
                      key={shareLink.id}
                      shareLink={shareLink}
                      tenantSubdomain={tenantSubdomain}
                      onCopyUrl={() => {
                        // Optional: Could refresh share links here if backend updates view count
                      }}
                      onChangePassword={() => handleChangePassword(shareLink)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            {onShare && (
              <Button onClick={handleShare} variant="secondary">
                <Share2 className="w-4 h-4 mr-2" />
                Share Link
              </Button>
            )}
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="danger"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </ModalActions>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
        title="Delete File"
      >
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{file.original_filename}</strong>?
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                This action cannot be undone. The file will be permanently deleted.
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
          <Button onClick={handleDelete} variant="danger" disabled={isDeleting}>
            {isDeleting ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Deleting...
              </>
            ) : (
              'Delete File'
            )}
          </Button>
        </ModalActions>
      </Modal>

      {/* Change Share Password Modal */}
      {selectedShareLink && (
        <ChangeSharePasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          shareLink={selectedShareLink}
          onSuccess={handlePasswordChanged}
        />
      )}
    </>
  );
}
