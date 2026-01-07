/**
 * FileUploader Component
 * Drag-drop file upload with react-dropzone, validation, and progress tracking
 */

'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FileThumbnail } from './FileThumbnail';
import { useFileUpload } from '@/lib/hooks/useFileUpload';
import type { FileCategory, EntityType, File as FileType } from '@/lib/types/files';
import {
  getCategoryConfig,
  formatFileSize,
  truncateFilename,
} from '@/lib/utils/file-helpers';

interface FileUploaderProps {
  category: FileCategory;
  entityType?: EntityType;
  entityId?: string;
  onUploadComplete?: (file: FileType) => void;
  onCancel?: () => void;
  showPreview?: boolean;
  multiple?: boolean;
  className?: string;
}

export function FileUploader({
  category,
  entityType,
  entityId,
  onUploadComplete,
  onCancel,
  showPreview = true,
  multiple = false,
  className = '',
}: FileUploaderProps) {
  const { uploadFile, uploadProgress, isUploading, error, resetError, reset } = useFileUpload();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = React.useState<FileType | null>(null);

  const config = getCategoryConfig(category);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedFile(file);
        resetError();
      }
    },
    [resetError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: config.accept.reduce((acc, mimeType) => {
      acc[mimeType] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: config.maxSize * 1024 * 1024, // Convert MB to bytes
    multiple,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    const result = await uploadFile(selectedFile, {
      category,
      entity_type: entityType,
      entity_id: entityId,
    });

    if (result) {
      setUploadedFile(result.file);
      setSelectedFile(null);
      onUploadComplete?.(result.file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadedFile(null);
    reset();
  };

  const handleCancel = () => {
    handleRemoveFile();
    onCancel?.();
  };

  // Show success state if upload complete
  if (uploadedFile && showPreview) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Upload Successful
                </h3>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {uploadedFile.original_filename}
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-center">
            <FileThumbnail file={uploadedFile} size="md" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-green-700 dark:text-green-300">Size:</span>{' '}
              <span className="text-green-900 dark:text-green-100">
                {formatFileSize(uploadedFile.size_bytes)}
              </span>
            </div>
            <div>
              <span className="text-green-700 dark:text-green-300">Type:</span>{' '}
              <span className="text-green-900 dark:text-green-100">{config.label}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show selected file preview
  if (selectedFile && showPreview) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <File className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {truncateFilename(selectedFile.name, 40)}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            {!isUploading && (
              <button
                onClick={handleRemoveFile}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {uploadProgress}%
                </span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isUploading && (
            <div className="mt-6 flex gap-2">
              <Button onClick={handleUpload} variant="primary" className="flex-1" disabled={!!error}>
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </Button>
              <Button onClick={handleCancel} variant="ghost">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show drop zone
  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${
            isDragActive
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <Upload className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </div>

          <div>
            <p className="text-base font-medium text-gray-900 dark:text-gray-100">
              {isDragActive ? 'Drop file here' : 'Drag and drop file here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">or click to browse</p>
          </div>

          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Accepted: {config.accept.join(', ')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Max size: {config.maxSize}MB
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
