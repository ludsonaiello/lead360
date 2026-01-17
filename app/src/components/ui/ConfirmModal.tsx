/**
 * ConfirmModal Component
 * Reusable confirmation dialog
 */

'use client';

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  loading = false,
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    if (!loading) {
      onClose();
    }
  };

  const variantColors = {
    danger: 'text-red-600 dark:text-red-500',
    warning: 'text-yellow-600 dark:text-yellow-500',
    info: 'text-blue-600 dark:text-blue-500',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex gap-3">
          <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${variantColors[variant]}`} />
          <p className="text-gray-700 dark:text-gray-300">{message}</p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
