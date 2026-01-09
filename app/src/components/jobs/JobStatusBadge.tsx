/**
 * Job Status Badge Component
 * Displays job status with color-coded badge and icon
 */

'use client';

import React from 'react';
import Badge from '@/components/ui/Badge';
import { JobStatus } from '@/lib/types/jobs';
import { getStatusColor, getStatusIcon } from '@/lib/utils/job-helpers';

interface JobStatusBadgeProps {
  status: JobStatus;
  showIcon?: boolean;
  className?: string;
}

export function JobStatusBadge({ status, showIcon = true, className = '' }: JobStatusBadgeProps) {
  const variant = getStatusColor(status);
  const Icon = showIcon ? getStatusIcon(status) : undefined;

  return (
    <Badge
      variant={variant as any}
      icon={Icon}
      className={className}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default JobStatusBadge;
