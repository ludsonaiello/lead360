/**
 * LeadSourceBadge Component
 * Color-coded badge for lead source with icons
 */

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Globe, Users, Phone, MessageSquare, Webhook, Mail } from 'lucide-react';

interface LeadSourceBadgeProps {
  source: 'manual' | 'webhook' | 'ai_phone' | 'ai_sms' | 'website' | 'referral' | 'phone_call' | 'walk_in' | 'social_media' | 'email' | 'other';
  className?: string;
}

const sourceConfig = {
  manual: {
    variant: 'blue' as const,
    label: 'Manual',
    icon: Users,
  },
  webhook: {
    variant: 'purple' as const,
    label: 'Webhook',
    icon: Webhook,
  },
  ai_phone: {
    variant: 'info' as const,
    label: 'AI Phone',
    icon: Phone,
  },
  ai_sms: {
    variant: 'info' as const,
    label: 'AI SMS',
    icon: MessageSquare,
  },
  website: {
    variant: 'blue' as const,
    label: 'Website',
    icon: Globe,
  },
  referral: {
    variant: 'success' as const,
    label: 'Referral',
    icon: Users,
  },
  phone_call: {
    variant: 'info' as const,
    label: 'Phone Call',
    icon: Phone,
  },
  walk_in: {
    variant: 'neutral' as const,
    label: 'Walk-in',
    icon: Users,
  },
  social_media: {
    variant: 'purple' as const,
    label: 'Social Media',
    icon: Globe,
  },
  email: {
    variant: 'blue' as const,
    label: 'Email',
    icon: Mail,
  },
  other: {
    variant: 'neutral' as const,
    label: 'Other',
    icon: Users,
  },
};

export function LeadSourceBadge({ source, className = '' }: LeadSourceBadgeProps) {
  const config = sourceConfig[source] || sourceConfig.other;

  return (
    <Badge variant={config.variant} icon={config.icon} className={className}>
      {config.label}
    </Badge>
  );
}

export default LeadSourceBadge;
