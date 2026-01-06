'use client';

// ============================================================================
// ModalContent Component
// ============================================================================
// Enhanced modal content wrapper with title, description, and icon support.
// Extends the basic ModalContent from Modal.tsx with additional features.
// ============================================================================

import React from 'react';

interface ModalContentProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * ModalContent - Enhanced modal content with header
 *
 * @param children - Content to display
 * @param title - Modal title
 * @param description - Modal description
 * @param icon - Optional icon to display next to title
 * @param className - Additional CSS classes
 */
export default function ModalContent({
  children,
  title,
  description,
  icon,
  className = '',
}: ModalContentProps) {
  return (
    <div className={className}>
      {/* Header with icon, title, and description */}
      {(title || description || icon) && (
        <div className="mb-6">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="flex-shrink-0 mt-0.5">
                {icon}
              </div>
            )}
            <div className="flex-1">
              {title && (
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="text-sm text-gray-700 dark:text-gray-300">
        {children}
      </div>
    </div>
  );
}
