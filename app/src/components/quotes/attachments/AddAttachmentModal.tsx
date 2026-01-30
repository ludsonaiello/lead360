/**
 * Add Attachment Modal Component
 * Multi-step modal for creating attachments
 * Step 1: Select attachment type
 * Step 2: Type-specific form (photo upload or URL input)
 */

'use client';

import React, { useState } from 'react';
import { X, ArrowLeft, Plus, Image as ImageIcon, Link as LinkIcon, Grid3x3, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/axios';
import type { AttachmentType, GridLayout } from '@/lib/types/quotes';
import { createAttachment } from '@/lib/api/quote-attachments';
import { UploadPhotoForm } from './UploadPhotoForm';
import { AddUrlAttachmentForm } from './AddUrlAttachmentForm';

interface AddAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  onSuccess: () => void;
}

export function AddAttachmentModal({
  isOpen,
  onClose,
  quoteId,
  onSuccess,
}: AddAttachmentModalProps) {
  const [step, setStep] = useState<'select' | 'form'>('select');
  const [selectedType, setSelectedType] = useState<AttachmentType | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [gridLayout, setGridLayout] = useState<GridLayout | ''>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // For multi-file grid photos
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<string>(''); // e.g., "Uploading 2/4 photos..."

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('select');
    setSelectedType(null);
    setTitle('');
    setUrl('');
    setGridLayout('');
    setSelectedFile(null);
    setSelectedFiles([]);
    setUploadError('');
    setUploadProgress('');
  };

  const handleClose = () => {
    if (!isSubmitting) {
      handleReset();
      onClose();
    }
  };

  const handleTypeSelect = (type: AttachmentType) => {
    setSelectedType(type);
    setStep('form');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedType(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setUploadError('');
    setUploadProgress('');

    try {
      // BULK UPLOAD for grid_photo with multiple files
      if (selectedType === 'grid_photo' && selectedFiles.length > 0) {
        const uploadedFileIds: string[] = [];
        const failedUploads: { fileName: string; error: string }[] = [];

        // Step 1: Upload all files sequentially
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setUploadProgress(`Uploading ${i + 1}/${selectedFiles.length} photos...`);

          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('category', 'photo');
            formData.append('entity_type', 'quote');
            formData.append('entity_id', quoteId);

            const uploadResponse = await apiClient.post('/files/upload', formData, {
              headers: {
                'Content-Type': undefined,
              },
            });

            uploadedFileIds.push(uploadResponse.data.file_id);
          } catch (error: any) {
            failedUploads.push({
              fileName: file.name,
              error: error.response?.data?.message || error.message || 'Upload failed',
            });
          }
        }

        // Step 2: Create multiple attachments with consecutive order_index
        if (uploadedFileIds.length > 0) {
          setUploadProgress(`Creating ${uploadedFileIds.length} attachments...`);

          // Get current max order_index to group new attachments together
          // For now, we'll let backend handle order_index (it auto-increments)
          for (let i = 0; i < uploadedFileIds.length; i++) {
            await createAttachment(quoteId, {
              attachment_type: 'grid_photo',
              file_id: uploadedFileIds[i],
              grid_layout: gridLayout as GridLayout,
              title: title || undefined,
            });
          }
        }

        // Show results
        if (failedUploads.length === 0) {
          toast.success(`Successfully uploaded ${uploadedFileIds.length} photos`);
        } else if (uploadedFileIds.length > 0) {
          toast.success(
            `${uploadedFileIds.length} photos uploaded. ${failedUploads.length} failed.`,
            { duration: 5000 }
          );
          console.error('Failed uploads:', failedUploads);
        } else {
          throw new Error(`All uploads failed. First error: ${failedUploads[0]?.error}`);
        }

        onSuccess();
        handleClose();
        return;
      }

      // SINGLE FILE UPLOAD for cover_photo, full_page_photo, or single grid_photo
      let fileId: string | undefined;

      // Step 1: Upload file to FilesService (for photo types)
      if (selectedType !== 'url_attachment' && selectedFile) {
        setUploadProgress('Uploading photo...');

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('category', 'photo');
        formData.append('entity_type', 'quote');
        formData.append('entity_id', quoteId);

        // Use apiClient which automatically adds auth token
        // CRITICAL: Remove default Content-Type header so axios can set proper multipart/form-data with boundary
        const uploadResponse = await apiClient.post('/files/upload', formData, {
          headers: {
            'Content-Type': undefined, // Remove default application/json header
          },
        });

        fileId = uploadResponse.data.file_id;
      }

      // Step 2: Create attachment
      setUploadProgress('Creating attachment...');

      const attachmentData: any = {
        attachment_type: selectedType,
      };

      if (selectedType === 'url_attachment') {
        attachmentData.url = url;
      } else {
        attachmentData.file_id = fileId;
      }

      if (title) {
        attachmentData.title = title;
      }

      if (selectedType === 'grid_photo' && gridLayout) {
        attachmentData.grid_layout = gridLayout;
      }

      await createAttachment(quoteId, attachmentData);
      toast.success('Attachment added successfully');
      onSuccess();
      handleClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to add attachment';
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  const isFormValid = () => {
    if (!selectedType) return false;

    if (selectedType === 'url_attachment') {
      return url.length > 0 && url.startsWith('http');
    }

    if (selectedType === 'grid_photo') {
      // Grid photos can have either multiple files OR single file
      const hasFiles = selectedFiles.length > 0 || selectedFile !== null;
      return hasFiles && gridLayout !== '';
    }

    return selectedFile !== null;
  };

  const attachmentTypes = [
    {
      type: 'cover_photo' as AttachmentType,
      icon: <FileImage className="w-8 h-8" />,
      title: 'Cover Photo',
      description: 'First page of PDF. Only one allowed per quote.',
      color: 'border-purple-200 hover:border-purple-500 dark:border-purple-800 dark:hover:border-purple-600',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      type: 'full_page_photo' as AttachmentType,
      icon: <ImageIcon className="w-8 h-8" />,
      title: 'Full Page Photo',
      description: 'Photo occupies a full page. Multiple allowed.',
      color: 'border-blue-200 hover:border-blue-500 dark:border-blue-800 dark:hover:border-blue-600',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      type: 'grid_photo' as AttachmentType,
      icon: <Grid3x3 className="w-8 h-8" />,
      title: 'Grid Photo',
      description: 'Multiple photos in a grid layout (2×2, 4×4, or 6×6).',
      color: 'border-green-200 hover:border-green-500 dark:border-green-800 dark:hover:border-green-600',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      type: 'url_attachment' as AttachmentType,
      icon: <LinkIcon className="w-8 h-8" />,
      title: 'URL + QR Code',
      description: 'Link with auto-generated QR code for easy scanning.',
      color: 'border-orange-200 hover:border-orange-500 dark:border-orange-800 dark:hover:border-orange-600',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center gap-3">
            {step === 'form' && (
              <button
                onClick={handleBack}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={isSubmitting}
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {step === 'select' ? 'Add Attachment' : `Add ${attachmentTypes.find(t => t.type === selectedType)?.title}`}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Type Selection */}
          {step === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attachmentTypes.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleTypeSelect(item.type)}
                  className={`p-6 border-2 rounded-xl text-left transition-all hover:shadow-md ${item.color}`}
                >
                  <div className={`mb-3 ${item.iconColor}`}>{item.icon}</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Type-specific Form */}
          {step === 'form' && (
            <>
              {selectedType === 'url_attachment' ? (
                <AddUrlAttachmentForm
                  url={url}
                  title={title}
                  onUrlChange={setUrl}
                  onTitleChange={setTitle}
                  isSubmitting={isSubmitting}
                  error={uploadError}
                />
              ) : selectedType && (
                <UploadPhotoForm
                  attachmentType={selectedType}
                  onFileSelect={setSelectedFile}
                  onFilesSelect={selectedType === 'grid_photo' ? setSelectedFiles : undefined}
                  onTitleChange={setTitle}
                  onGridLayoutChange={selectedType === 'grid_photo' ? setGridLayout : undefined}
                  title={title}
                  gridLayout={selectedType === 'grid_photo' ? (gridLayout || undefined) : undefined}
                  isUploading={isSubmitting}
                  error={uploadError}
                />
              )}

              {/* Upload Progress Indicator */}
              {uploadProgress && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {uploadProgress}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={!isFormValid() || isSubmitting}
                  loading={isSubmitting}
                  className="flex-1"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Attachment
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddAttachmentModal;
