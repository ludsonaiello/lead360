/**
 * Edit Attachment Modal Component
 * Modal for updating attachment title, URL, or grid layout
 * Cannot change attachment_type or file_id (delete and recreate instead)
 */

'use client';

import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import toast from 'react-hot-toast';
import type { QuoteAttachment, GridLayout } from '@/lib/types/quotes';
import { updateAttachment } from '@/lib/api/quote-attachments';

interface EditAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: QuoteAttachment;
  quoteId: string;
  onSuccess: () => void;
}

export function EditAttachmentModal({
  isOpen,
  onClose,
  attachment,
  quoteId,
  onSuccess,
}: EditAttachmentModalProps) {
  const [title, setTitle] = useState(attachment.title || '');
  const [url, setUrl] = useState(attachment.url || '');
  const [gridLayout, setGridLayout] = useState<GridLayout | ''>(
    attachment.grid_layout || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const updateData: any = {};

      // Only include changed fields
      if (title !== (attachment.title || '')) {
        updateData.title = title || null;
      }

      if (attachment.attachment_type === 'url_attachment' && url !== attachment.url) {
        updateData.url = url;
      }

      if (
        attachment.attachment_type === 'grid_photo' &&
        gridLayout &&
        gridLayout !== attachment.grid_layout
      ) {
        updateData.grid_layout = gridLayout;
      }

      // Check if there are changes
      if (Object.keys(updateData).length === 0) {
        toast.error('No changes detected');
        setIsSubmitting(false);
        return;
      }

      await updateAttachment(quoteId, attachment.id, updateData);
      toast.success('Attachment updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update attachment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const gridLayoutOptions = [
    { value: 'grid_2', label: '2×2 Grid (4 photos)' },
    { value: 'grid_4', label: '4×4 Grid (16 photos)' },
    { value: 'grid_6', label: '6×6 Grid (36 photos)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Attachment
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
              maxLength={200}
              disabled={isSubmitting}
            />
          </div>

          {/* URL (only for url_attachment) */}
          {attachment.attachment_type === 'url_attachment' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                URL <span className="text-red-500">*</span>
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                maxLength={500}
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ⚠️ Changing URL will regenerate the QR code
              </p>
            </div>
          )}

          {/* Grid Layout (only for grid_photo) */}
          {attachment.attachment_type === 'grid_photo' && (
            <div>
              <Select
                label="Grid Layout"
                options={gridLayoutOptions}
                value={gridLayout}
                onChange={(value) => setGridLayout(value as GridLayout)}
                placeholder="Select grid layout..."
                disabled={isSubmitting}
                required
              />
            </div>
          )}

          {/* Info about non-editable fields */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>Note:</strong> To change the attachment type or replace the file/photo, delete this attachment and create a new one.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              loading={isSubmitting}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditAttachmentModal;
