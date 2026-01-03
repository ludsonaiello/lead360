/**
 * FileUpload Component
 * File upload with drag-drop, validation, progress, and preview
 * Shows uploaded file (image or PDF) with view/download/delete options
 */

'use client';

import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Upload, X, File, Image as ImageIcon, FileText, CheckCircle, AlertCircle, Download, Eye, Trash2 } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface FileUploadProps {
  label?: string;
  error?: string;
  helperText?: string;
  accept?: string;
  maxSize?: number; // in MB
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  preview?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  currentFileUrl?: string;
  currentFileName?: string;
  currentFileMimeType?: string;
}

export interface FileUploadRef {
  reset: () => void;
}

export const FileUpload = forwardRef<FileUploadRef, FileUploadProps>(
  (
    {
      label,
      error,
      helperText,
      accept,
      maxSize = 5, // 5MB default
      onUpload,
      onDelete,
      preview = true,
      disabled = false,
      required = false,
      className = '',
      currentFileUrl,
      currentFileName,
      currentFileMimeType,
    },
    ref
  ) => {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(currentFileUrl || null);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(currentFileName || null);
    const [uploadedFileMimeType, setUploadedFileMimeType] = useState<string | null>(currentFileMimeType || null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Update when currentFileUrl changes
    useEffect(() => {
      setUploadedFileUrl(currentFileUrl || null);
      setUploadedFileName(currentFileName || null);
      setUploadedFileMimeType(currentFileMimeType || null);
    }, [currentFileUrl, currentFileName, currentFileMimeType]);

    useImperativeHandle(ref, () => ({
      reset: () => {
        setUploadedFileUrl(currentFileUrl || null);
        setUploadedFileName(currentFileName || null);
        setUploadProgress(0);
        setUploadError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
    }));

    const validateFile = (file: File): string | null => {
      // Check file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        return `File size must be less than ${maxSize}MB`;
      }

      // Check file type
      if (accept) {
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const fileExtension = `.${file.name.split('.').pop()}`;
        const mimeType = file.type;

        const isValid = acceptedTypes.some(
          (type) => type === mimeType || type === fileExtension || type === '*'
        );

        if (!isValid) {
          return `File type not accepted. Allowed: ${accept}`;
        }
      }

      return null;
    };

    const handleFileSelect = async (file: File) => {
      setUploadError(null);

      const validationError = validateFile(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }

      // Auto-upload
      try {
        setIsUploading(true);
        setUploadProgress(0);

        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        await onUpload(file);

        clearInterval(progressInterval);
        setUploadProgress(100);

        // Set uploaded file info
        setUploadedFileName(file.name);
        setUploadedFileMimeType(file.type);

        // For images, create preview
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setUploadedFileUrl(reader.result as string);
          };
          reader.readAsDataURL(file);
        } else {
          // For non-images, we'll show it when props update with the URL
          setUploadedFileUrl(null);
        }
      } catch (err: any) {
        setUploadError(err.message || 'Upload failed');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    const handleDelete = async () => {
      if (!onDelete) return;

      try {
        setIsDeleting(true);
        await onDelete();
        setUploadedFileUrl(null);
        setUploadedFileName(null);
        setUploadedFileMimeType(null);
        setUploadError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err: any) {
        setUploadError(err.message || 'Delete failed');
      } finally {
        setIsDeleting(false);
      }
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
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    };

    const handleViewFile = () => {
      if (uploadedFileUrl) {
        window.open(uploadedFileUrl, '_blank');
      }
    };

    const handleDownloadFile = () => {
      if (uploadedFileUrl && uploadedFileName) {
        const link = document.createElement('a');
        link.href = uploadedFileUrl;
        link.download = uploadedFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };

    // Detect file type from MIME type (if available) or filename
    const isImage = uploadedFileMimeType?.startsWith('image/') ||
                    uploadedFileUrl?.startsWith('data:image') ||
                    uploadedFileName?.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i);
    const isPDF = uploadedFileMimeType === 'application/pdf' ||
                  uploadedFileName?.match(/\.pdf$/i);

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
            {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        {/* Show uploaded file */}
        {uploadedFileUrl && !isUploading ? (
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700">
            {/* Image Preview */}
            {isImage ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={uploadedFileUrl}
                    alt={uploadedFileName || 'Uploaded file'}
                    className="max-h-64 rounded-lg object-contain border border-gray-200 dark:border-gray-600"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {uploadedFileName || 'Uploaded image'}
                  </p>
                </div>
              </div>
            ) : isPDF ? (
              /* PDF Display */
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <FileText className="w-12 h-12 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {uploadedFileName || 'Uploaded PDF'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF Document</p>
                </div>
              </div>
            ) : (
              /* Generic File Display */
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <File className="w-12 h-12 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {uploadedFileName || 'Uploaded file'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Document</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={handleViewFile}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4" />
                View
              </button>
              <button
                type="button"
                onClick={handleDownloadFile}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Upload Card */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-6 transition-all duration-200
              ${isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : error || uploadError
                ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'}
              ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleInputChange}
              disabled={disabled || isUploading}
              className="hidden"
            />

            {isUploading ? (
              /* Upload Progress */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {uploadProgress}%
                  </span>
                </div>
                <LoadingSpinner size="sm" className="mx-auto" />
                <p className="text-sm text-center text-gray-600 dark:text-gray-400">Uploading...</p>
              </div>
            ) : (
              /* Upload Prompt */
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Drop file here or click to browse
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {accept && `Accepted: ${accept}`} {maxSize && `• Max ${maxSize}MB`}
                </p>
              </div>
            )}
          </div>
        )}

        {(error || uploadError) && (
          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <p>{error || uploadError}</p>
          </div>
        )}

        {helperText && !error && !uploadError && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

FileUpload.displayName = 'FileUpload';

export default FileUpload;
