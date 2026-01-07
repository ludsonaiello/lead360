/**
 * EmptyFileState Component
 * Displayed when no files are found
 */

'use client';

import React from 'react';
import { FileX, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface EmptyFileStateProps {
  title?: string;
  message?: string;
  showUploadButton?: boolean;
  onUploadClick?: () => void;
}

export function EmptyFileState({
  title = 'No files found',
  message = 'Upload your first file to get started',
  showUploadButton = true,
  onUploadClick,
}: EmptyFileStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
        <FileX className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>

      <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">{message}</p>

      {showUploadButton && onUploadClick && (
        <Button onClick={onUploadClick} variant="primary">
          <Upload className="w-4 h-4 mr-2" />
          Upload File
        </Button>
      )}
    </div>
  );
}
