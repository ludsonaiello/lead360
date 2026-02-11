/**
 * Transcription Status Badge Component
 * Sprint 4: Transcription Monitoring
 * Displays color-coded status badges for transcription states
 */

'use client';

import React from 'react';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface TranscriptionStatusBadgeProps {
  status: 'completed' | 'failed' | 'queued' | 'processing';
  size?: 'sm' | 'md';
}

const statusConfig = {
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  queued: {
    label: 'Queued',
    icon: Clock,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
};

export function TranscriptionStatusBadge({ status, size = 'sm' }: TranscriptionStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full border
        ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses}
      `}
    >
      <Icon className={`${iconSize} ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}

export default TranscriptionStatusBadge;
