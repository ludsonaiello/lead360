'use client';

// ============================================================================
// Card Component
// ============================================================================
// Simple card wrapper component for consistent styling
// ============================================================================

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Card - Simple card container with border and shadow
 *
 * @param children - Card content
 * @param className - Additional CSS classes
 */
export default function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        rounded-lg
        shadow-sm
        ${className}
      `}
    >
      {children}
    </div>
  );
}
