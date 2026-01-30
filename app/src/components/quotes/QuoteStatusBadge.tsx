/**
 * QuoteStatusBadge Component
 * Color-coded badge for quote status with icons
 */

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  FileText,
  CheckCircle2,
  Send,
  Eye,
  ThumbsUp,
  XCircle,
  Ban,
  Shield,
  MailCheck,
  MailOpen,
  MailX,
  Download,
  PlayCircle,
  CheckCircle,
} from 'lucide-react';
import type { QuoteStatus } from '@/lib/types/quotes';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
  className?: string;
}

const statusConfig: Record<
  QuoteStatus,
  {
    variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'blue' | 'purple' | 'green' | 'gray' | 'yellow' | 'indigo' | 'cyan' | 'orange';
    label: string;
    icon: typeof FileText;
  }
> = {
  draft: {
    variant: 'gray',
    label: 'Draft',
    icon: FileText,
  },
  pending_approval: {
    variant: 'yellow',
    label: 'Pending Approval',
    icon: Shield,
  },
  approved: {
    variant: 'success',
    label: 'Approved',
    icon: ThumbsUp,
  },
  ready: {
    variant: 'blue',
    label: 'Ready',
    icon: CheckCircle2,
  },
  sent: {
    variant: 'purple',
    label: 'Sent',
    icon: Send,
  },
  delivered: {
    variant: 'indigo',
    label: 'Delivered',
    icon: MailCheck,
  },
  read: {
    variant: 'cyan',
    label: 'Read',
    icon: Eye,
  },
  opened: {
    variant: 'purple',
    label: 'Email Opened',
    icon: MailOpen,
  },
  downloaded: {
    variant: 'info',
    label: 'Downloaded',
    icon: Download,
  },
  email_failed: {
    variant: 'orange',
    label: 'Email Failed',
    icon: MailX,
  },
  denied: {
    variant: 'danger',
    label: 'Denied',
    icon: XCircle,
  },
  lost: {
    variant: 'neutral',
    label: 'Lost',
    icon: Ban,
  },
  started: {
    variant: 'info',
    label: 'Started',
    icon: PlayCircle,
  },
  concluded: {
    variant: 'success',
    label: 'Concluded',
    icon: CheckCircle,
  },
};

export function QuoteStatusBadge({ status, className = '' }: QuoteStatusBadgeProps) {
  const config = statusConfig[status];

  if (!config) {
    return (
      <Badge variant="neutral" className={className}>
        Unknown
      </Badge>
    );
  }

  return (
    <Badge variant={config.variant} icon={config.icon} className={className}>
      {config.label}
    </Badge>
  );
}

export default QuoteStatusBadge;
