'use client';

// ============================================================================
// ModalActions Component
// ============================================================================
// Modal footer with action buttons (cancel, submit, etc.)
// ============================================================================

import React from 'react';

interface ModalActionsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ModalActions - Modal footer with action buttons
 *
 * @param children - Action buttons
 * @param className - Additional CSS classes
 */
export default function ModalActions({ children, className = '' }: ModalActionsProps) {
  return (
    <div className={`flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  );
}
