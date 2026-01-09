/**
 * FileGallery Component
 * Main orchestrator for file gallery with all features
 */

'use client';

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Grid, List, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { FileFilters } from './FileFilters';
import { FileGalleryGrid } from './FileGalleryGrid';
import { FileGalleryList } from './FileGalleryList';
import { BulkActionsMenu } from './BulkActionsMenu';
import { FileDetailModal } from './FileDetailModal';
import { ShareLinkModal } from './ShareLinkModal';
import { useFileGallery } from '@/lib/hooks/useFileGallery';
import { downloadFile, deleteFile } from '@/lib/api/files';
import toast from 'react-hot-toast';
import type { File, FileFilters as FileFiltersType } from '@/lib/types/files';

interface FileGalleryProps {
  initialFilters?: Partial<FileFiltersType>;
  showFilters?: boolean;
  showBulkActions?: boolean;
  showUploadButton?: boolean;
  onUploadClick?: () => void;
  customFetchFiles?: (filters: FileFiltersType) => Promise<{
    data: File[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>;
  customDeleteFile?: (fileId: string) => Promise<void>;
}

export interface FileGalleryRef {
  refresh: () => Promise<void>;
}

export const FileGallery = forwardRef<FileGalleryRef, FileGalleryProps>(
  (
    {
      initialFilters,
      showFilters = true,
      showBulkActions = true,
      showUploadButton = true,
      onUploadClick,
      customFetchFiles,
      customDeleteFile,
    },
    ref
  ) => {
    const {
      files,
      pagination,
      filters,
      viewMode,
      selectedFiles,
      isLoading,
      error,
      setFilters,
      setViewMode,
      toggleFileSelection,
      selectAll,
      deselectAll,
      nextPage,
      previousPage,
      refresh,
    } = useFileGallery({
      initialFilters,
      autoLoad: true,
      customFetchFiles,
    });

    const [selectedFileForDetail, setSelectedFileForDetail] = useState<File | null>(null);
    const [selectedFileForShare, setSelectedFileForShare] = useState<File | null>(null);

    // Expose refresh method via ref
    useImperativeHandle(ref, () => ({
      refresh,
    }));

  const handleFileClick = (file: File) => {
    setSelectedFileForDetail(file);
  };

  const handleDownload = (file: File) => {
    try {
      downloadFile(file);
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleShare = (file: File) => {
    setSelectedFileForShare(file);
  };

  const handleDelete = async (file: File) => {
    if (!confirm(`Delete ${file.original_filename}?`)) return;

    try {
      // Use custom delete function if provided, otherwise use default
      if (customDeleteFile) {
        await customDeleteFile(file.file_id);
      } else {
        await deleteFile(file.file_id);
      }
      toast.success('File deleted successfully');
      refresh();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to delete file';
      toast.error(message);
    }
  };

  const handleDetailModalDelete = () => {
    setSelectedFileForDetail(null);
    refresh();
  };

  const handleBulkDownloadComplete = () => {
    deselectAll();
  };

  const handleBulkDeleteComplete = () => {
    refresh();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      {showFilters && <FileFilters filters={filters} onFiltersChange={setFilters} />}

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Grid view"
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="List view"
            >
              <List className="w-5 h-5" />
            </button>

            {/* Results Count */}
            {pagination && (
              <span className="ml-4 text-sm text-gray-600 dark:text-gray-400">
                {pagination.total} file{pagination.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {showBulkActions && files.length > 0 && (
              <>
                <Button onClick={selectAll} variant="ghost" size="sm">
                  Select All
                </Button>
                {selectedFiles.size > 0 && (
                  <Button onClick={deselectAll} variant="ghost" size="sm">
                    Deselect All
                  </Button>
                )}
              </>
            )}

            {showUploadButton && onUploadClick && (
              <Button onClick={onUploadClick} variant="primary">
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 m-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <Button onClick={refresh} variant="ghost" size="sm" className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {/* Gallery Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'grid' ? (
          <FileGalleryGrid
            files={files}
            isLoading={isLoading}
            selectedFiles={selectedFiles}
            onFileSelect={toggleFileSelection}
            onFileClick={handleFileClick}
            onDownload={handleDownload}
            onShare={handleShare}
            onDelete={handleDelete}
          />
        ) : (
          <FileGalleryList
            files={files}
            isLoading={isLoading}
            selectedFiles={selectedFiles}
            onFileSelect={toggleFileSelection}
            onFileClick={handleFileClick}
            onDownload={handleDownload}
            onShare={handleShare}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <PaginationControls
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onGoToPage={(page) => setFilters({ page })}
            onPrevious={previousPage}
            onNext={nextPage}
          />
        </div>
      )}

      {/* Bulk Actions Menu */}
      {showBulkActions && selectedFiles.size > 0 && (
        <BulkActionsMenu
          selectedFileIds={Array.from(selectedFiles)}
          onDownloadComplete={handleBulkDownloadComplete}
          onDeleteComplete={handleBulkDeleteComplete}
          onDeselectAll={deselectAll}
        />
      )}

      {/* File Detail Modal */}
      <FileDetailModal
        isOpen={!!selectedFileForDetail}
        onClose={() => setSelectedFileForDetail(null)}
        file={selectedFileForDetail}
        onShare={handleShare}
        onDelete={handleDetailModalDelete}
      />

      {/* Share Link Modal */}
      <ShareLinkModal
        isOpen={!!selectedFileForShare}
        onClose={() => setSelectedFileForShare(null)}
        file={selectedFileForShare}
      />
    </div>
  );
});
