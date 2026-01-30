/**
 * Upload Photo Form Component
 * File upload form for cover_photo, full_page_photo, and grid_photo attachments
 * Supports single file for cover/full_page, multiple files for grid_photo
 */

'use client';

import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import FileUpload from '@/components/ui/FileUpload';
import MultiFileUpload from '@/components/ui/MultiFileUpload';
import type { AttachmentType, GridLayout } from '@/lib/types/quotes';

interface UploadPhotoFormProps {
  attachmentType: 'cover_photo' | 'full_page_photo' | 'grid_photo';
  onFileSelect: (file: File) => void; // For single file uploads
  onFilesSelect?: (files: File[]) => void; // For multi-file uploads (grid_photo)
  onTitleChange: (title: string) => void;
  onGridLayoutChange?: (layout: GridLayout) => void;
  title?: string;
  gridLayout?: GridLayout;
  isUploading?: boolean;
  error?: string;
}

export function UploadPhotoForm({
  attachmentType,
  onFileSelect,
  onFilesSelect,
  onTitleChange,
  onGridLayoutChange,
  title = '',
  gridLayout,
  isUploading = false,
  error,
}: UploadPhotoFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleFileDelete = async () => {
    setSelectedFile(null);
  };

  const handleMultiFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
    if (onFilesSelect) {
      onFilesSelect(files);
    }
  };

  const gridLayoutOptions = [
    { value: 'grid_2', label: '2×2 Grid (4 photos)' },
    { value: 'grid_4', label: '4×4 Grid (16 photos)' },
    { value: 'grid_6', label: '6×6 Grid (36 photos)' },
  ];

  const getMaxFilesForGrid = (): number => {
    switch (gridLayout) {
      case 'grid_2': return 4;
      case 'grid_4': return 16;
      case 'grid_6': return 36;
      default: return 4; // Default to 4 if not selected
    }
  };

  const getHelperText = () => {
    switch (attachmentType) {
      case 'cover_photo':
        return 'This will be the first page of your PDF. Only one cover photo allowed per quote.';
      case 'full_page_photo':
        return 'Photo will occupy a full page in the PDF. Multiple allowed.';
      case 'grid_photo':
        return `Select up to ${getMaxFilesForGrid()} photos for this grid. All photos will be uploaded and displayed together.`;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Grid Layout Selector (show FIRST for grid_photo so user selects size first) */}
      {attachmentType === 'grid_photo' && (
        <div>
          <Select
            label="Grid Layout"
            options={gridLayoutOptions}
            value={gridLayout || ''}
            onChange={(value) => onGridLayoutChange?.(value as GridLayout)}
            placeholder="Select grid layout first..."
            disabled={isUploading}
            helperText="Choose grid size first - this determines how many photos you can upload"
            required
            className="w-full"
          />
        </div>
      )}

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {attachmentType === 'grid_photo' ? 'Photos' : 'Photo'} <span className="text-red-500">*</span>
        </label>

        {attachmentType === 'grid_photo' ? (
          /* Multi-file upload for grid photos */
          <MultiFileUpload
            accept="image/*"
            maxSize={20} // 20MB max per photo
            maxFiles={getMaxFilesForGrid()}
            onFilesSelect={handleMultiFilesSelect}
            disabled={isUploading || !gridLayout} // Disable until grid layout is selected
            helperText={gridLayout ? getHelperText() : 'Select grid layout first'}
            error={error}
            required
          />
        ) : (
          /* Single file upload for cover/full_page photos */
          <FileUpload
            accept="image/*"
            maxSize={20} // 20MB max for photos
            onUpload={handleFileUpload}
            onDelete={handleFileDelete}
            preview={true}
            disabled={isUploading}
            helperText={getHelperText()}
            error={error}
          />
        )}
      </div>

      {/* Title (Optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Title (Optional)
        </label>
        <Input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Before Photos, Material Samples"
          maxLength={200}
          disabled={isUploading}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Descriptive label for this photo attachment
        </p>
      </div>

      {/* Preview Info - Single File */}
      {selectedFile && attachmentType !== 'grid_photo' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold">File selected: {selectedFile.name}</p>
              <p className="text-xs mt-1">
                Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Info - Multiple Files */}
      {selectedFiles.length > 0 && attachmentType === 'grid_photo' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold">{selectedFiles.length} photos selected</p>
              <p className="text-xs mt-1">
                Total size: {(selectedFiles.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadPhotoForm;
