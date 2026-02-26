import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Circle } from 'lucide-react';

interface StatusBadgeProps {
  variant: 'success' | 'error' | 'warning' | 'idle';
  label: string;
  size?: 'sm' | 'md';
}

/**
 * Status Badge Component
 * Displays colored status indicators with icons
 */
export default function StatusBadge({ variant, label, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
  };

  const variantConfig = {
    success: {
      bg: 'bg-green-100 dark:bg-green-900/20',
      text: 'text-green-800 dark:text-green-400',
      icon: CheckCircle,
    },
    error: {
      bg: 'bg-red-100 dark:bg-red-900/20',
      text: 'text-red-800 dark:text-red-400',
      icon: XCircle,
    },
    warning: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/20',
      text: 'text-yellow-800 dark:text-yellow-400',
      icon: AlertCircle,
    },
    idle: {
      bg: 'bg-gray-100 dark:bg-gray-700',
      text: 'text-gray-700 dark:text-gray-300',
      icon: Circle,
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]} ${config.bg} ${config.text}`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {label}
    </span>
  );
}
