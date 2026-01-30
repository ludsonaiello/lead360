/**
 * MultiFileUpload Component
 * Allows selecting multiple files with drag-drop and preview gallery
 * Used for grid photo attachments
 */

'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface MultiFileUploadProps {
  label?: string;
  error?: string;
  helperText?: string;
  accept?: string;
  maxSize?: number; // in MB
  maxFiles: number; // Maximum number of files allowed
  onFilesSelect: (files: File[]) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const MultiFileUpload: React.FC<MultiFileUploadProps> = ({
  label,
  error,
  helperText,
  accept,
  maxSize = 20, // 20MB default per file
  maxFiles,
  onFilesSelect,
  disabled = false,
  required = false,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ [key: string]: string }>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return `${file.name}: File size must be less than ${maxSize}MB`;
    }

    // Check file type
    if (accept) {
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      const fileExtension = `.${file.name.split('.').pop()}`;
      const mimeType = file.type;

      const isValid = acceptedTypes.some((type) => {
        // Handle wildcard types (e.g., "image/*")
        if (type.includes('/*')) {
          const prefix = type.split('/*')[0];
          return mimeType.startsWith(prefix + '/');
        }
        // Handle exact match or file extension
        return type === mimeType || type === fileExtension || type === '*';
      });

      if (!isValid) {
        return `${file.name}: File type not accepted`;
      }
    }

    return null;
  };

  const generatePreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  };

  const handleFilesAdd = async (newFiles: File[]) => {
    setValidationError(null);

    // Check total count
    const totalFiles = selectedFiles.length + newFiles.length;
    if (totalFiles > maxFiles) {
      setValidationError(`Maximum ${maxFiles} files allowed. You selected ${totalFiles} files.`);
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    for (const file of newFiles) {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        return;
      }
      validFiles.push(file);
    }

    // Generate previews
    const newPreviews: { [key: string]: string } = {};
    for (const file of validFiles) {
      const preview = await generatePreview(file);
      newPreviews[file.name] = preview;
    }

    const updatedFiles = [...selectedFiles, ...validFiles];
    setSelectedFiles(updatedFiles);
    setFilePreviews({ ...filePreviews, ...newPreviews });
    onFilesSelect(updatedFiles);
  };

  const handleFileRemove = (fileName: string) => {
    const updatedFiles = selectedFiles.filter((f) => f.name !== fileName);
    const updatedPreviews = { ...filePreviews };
    delete updatedPreviews[fileName];

    setSelectedFiles(updatedFiles);
    setFilePreviews(updatedPreviews);
    onFilesSelect(updatedFiles);
    setValidationError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    handleFilesAdd(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesAdd(Array.from(files));
    }
    // Reset input to allow selecting same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {label}
          {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
        </label>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 transition-all duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : error || validationError
            ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          multiple
          className="hidden"
        />

        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {accept && `Accepted: ${accept}`} • Max {maxSize}MB per file • {maxFiles} files max
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
            Selected: {selectedFiles.length} / {maxFiles} files
          </p>
        </div>
      </div>

      {/* File Gallery Preview */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Selected Photos ({selectedFiles.length})
            </p>
            {selectedFiles.length < maxFiles && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={disabled}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                + Add More
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {selectedFiles.map((file) => (
              <div key={file.name} className="relative group">
                <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                  {filePreviews[file.name] ? (
                    <img
                      src={filePreviews[file.name]}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileRemove(file.name);
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {(error || validationError) && (
        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <p>{error || validationError}</p>
        </div>
      )}

      {/* Helper Text */}
      {helperText && !error && !validationError && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
};

export default MultiFileUpload;
