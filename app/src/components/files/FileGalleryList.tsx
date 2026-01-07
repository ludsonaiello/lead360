/**
 * FileGalleryList Component
 * List/table view container for files
 */

'use client';

import React from 'react';
import { FileRow } from './FileRow';
import { EmptyFileState } from './EmptyFileState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { File } from '@/lib/types/files';

interface FileGalleryListProps {
  files: File[];
  isLoading?: boolean;
  selectedFiles: Set<string>;
  onFileSelect: (fileId: string) => void;
  onFileClick: (file: File) => void;
  onDownload: (file: File) => void;
  onShare: (file: File) => void;
  onDelete: (file: File) => void;
}

export function FileGalleryList({
  files,
  isLoading,
  selectedFiles,
  onFileSelect,
  onFileClick,
  onDownload,
  onShare,
  onDelete,
}: FileGalleryListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner className="w-8 h-8" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading files...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return <EmptyFileState />;
  }

  return (
    <div className="bg-white dark:bg-gray-800">
      {/* Header Row */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        <div className="col-span-1">Select</div>
        <div className="col-span-1">Preview</div>
        <div className="col-span-3">Filename</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-2">Entity</div>
        <div className="col-span-1">Size</div>
        <div className="col-span-1">Date</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>

      {/* Rows */}
      {files.map((file) => (
        <FileRow
          key={file.file_id}
          file={file}
          isSelected={selectedFiles.has(file.file_id)}
          onSelect={onFileSelect}
          onClick={onFileClick}
          onDownload={onDownload}
          onShare={onShare}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
