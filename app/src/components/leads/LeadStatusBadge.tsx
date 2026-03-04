/**
 * LeadStatusBadge Component
 * Color-coded badge for lead status with icons
 */

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { UserPlus, UserCheck, CheckCircle2, XCircle } from 'lucide-react';

interface LeadStatusBadgeProps {
  status: 'lead' | 'prospect' | 'customer' | 'lost';
  className?: string;
}

const statusConfig = {
  lead: {
    variant: 'blue' as const,
    label: 'Lead',
    icon: UserPlus,
  },
  prospect: {
    variant: 'warning' as const,
    label: 'Prospect',
    icon: UserCheck,
  },
  customer: {
    variant: 'success' as const,
    label: 'Customer',
    icon: CheckCircle2,
  },
  lost: {
    variant: 'neutral' as const,
    label: 'Lost',
    icon: XCircle,
  },
  unknown: {
    variant: 'neutral' as const,
    label: 'Unknown',
    icon: UserPlus,
  },
};

export function LeadStatusBadge({ status, className = '' }: LeadStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.unknown;

  return (
    <Badge variant={config.variant} icon={config.icon} className={className}>
      {config.label}
    </Badge>
  );
}

export default LeadStatusBadge;
