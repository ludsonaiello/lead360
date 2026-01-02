/**
 * Loading Spinner Component
 * Reusable loading indicator with size variants
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  centered?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ size = 'md', className = '', centered = false }: LoadingSpinnerProps) {
  const spinner = (
    <Loader2 className={`animate-spin text-blue-600 dark:text-blue-400 ${sizeClasses[size]} ${className}`} />
  );

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[200px]">
        {spinner}
      </div>
    );
  }

  return spinner;
}

export default LoadingSpinner;
