/**
 * StatusBadge Component
 * Color-coded status badges for communication events
 */

import React from 'react';

type CommunicationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';

interface StatusBadgeProps {
  status: CommunicationStatus;
  className?: string;
}

const statusConfig: Record<CommunicationStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  sent: {
    label: 'Sent',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  },
  bounced: {
    label: 'Bounced',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}

export default StatusBadge;
