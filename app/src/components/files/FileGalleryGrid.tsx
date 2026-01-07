/**
 * FileGalleryGrid Component
 * Grid view container for files
 */

'use client';

import React from 'react';
import { FileCard } from './FileCard';
import { EmptyFileState } from './EmptyFileState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { File } from '@/lib/types/files';

interface FileGalleryGridProps {
  files: File[];
  isLoading?: boolean;
  selectedFiles: Set<string>;
  onFileSelect: (fileId: string) => void;
  onFileClick: (file: File) => void;
  onDownload: (file: File) => void;
  onShare: (file: File) => void;
  onDelete: (file: File) => void;
}

export function FileGalleryGrid({
  files,
  isLoading,
  selectedFiles,
  onFileSelect,
  onFileClick,
  onDownload,
  onShare,
  onDelete,
}: FileGalleryGridProps) {
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
      {files.map((file) => (
        <FileCard
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
