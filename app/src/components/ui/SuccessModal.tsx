/**
 * Success Modal Component
 * Reusable modal for displaying success messages
 * Modern UX with success styling
 */

'use client';

import React from 'react';
import { CheckCircle, X } from 'lucide-react';
import { Button } from './Button';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  closeText?: string;
}

export function SuccessModal({
  isOpen,
  onClose,
  title,
  message,
  closeText = 'Close',
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="primary"
            onClick={onClose}
          >
            {closeText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SuccessModal;
