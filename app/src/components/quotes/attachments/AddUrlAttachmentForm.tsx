/**
 * Add URL Attachment Form Component
 * Form for creating URL attachments with auto-generated QR codes
 */

'use client';

import React from 'react';
import { Link as LinkIcon, QrCode, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';

interface AddUrlAttachmentFormProps {
  url: string;
  title: string;
  onUrlChange: (url: string) => void;
  onTitleChange: (title: string) => void;
  isSubmitting?: boolean;
  error?: string;
}

export function AddUrlAttachmentForm({
  url,
  title,
  onUrlChange,
  onTitleChange,
  isSubmitting = false,
  error,
}: AddUrlAttachmentFormProps) {
  const isValidUrl = (urlString: string): boolean => {
    if (!urlString) return false;
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const urlIsValid = isValidUrl(url);
  const showValidation = url.length > 0;

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          URL <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LinkIcon className="w-5 h-5 text-gray-400" />
          </div>
          <Input
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com/product-page"
            maxLength={500}
            disabled={isSubmitting}
            className={`pl-10 ${
              showValidation
                ? urlIsValid
                  ? 'border-green-500 dark:border-green-600'
                  : 'border-red-500 dark:border-red-600'
                : ''
            }`}
          />
        </div>

        {/* Validation Message */}
        {showValidation && !urlIsValid && (
          <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Please enter a valid URL starting with http:// or https://</span>
          </div>
        )}

        {showValidation && urlIsValid && (
          <div className="flex items-center gap-2 mt-2 text-sm text-green-600 dark:text-green-400">
            <QrCode className="w-4 h-4 flex-shrink-0" />
            <span>QR code will be automatically generated for this URL</span>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Link to product pages, specifications, or any relevant web content
        </p>
      </div>

      {/* Title Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Title (Optional)
        </label>
        <Input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Product Specifications, Material Details"
          maxLength={200}
          disabled={isSubmitting}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Descriptive label for this link
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">QR Code Generation</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>QR code is automatically generated for the URL you provide</li>
              <li>QR code size: 200×200 pixels (optimized for printing)</li>
              <li>Customers can scan the QR code to visit the URL</li>
              <li>Perfect for product links, video walkthroughs, or documentation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddUrlAttachmentForm;
