/**
 * TemplateTypeBadge Component
 * Displays a colored badge indicating template type (platform/shared/tenant)
 */

'use client';

import React from 'react';
import { Shield, Users, Building2 } from 'lucide-react';

interface TemplateTypeBadgeProps {
  type: 'platform' | 'shared' | 'tenant';
  size?: 'sm' | 'md';
}

export function TemplateTypeBadge({ type, size = 'sm' }: TemplateTypeBadgeProps) {
  const config = {
    platform: {
      label: 'Platform',
      icon: Shield,
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      textColor: 'text-purple-700 dark:text-purple-300',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
    shared: {
      label: 'Shared',
      icon: Users,
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      textColor: 'text-blue-700 dark:text-blue-300',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    tenant: {
      label: 'Custom',
      icon: Building2,
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
      textColor: 'text-gray-700 dark:text-gray-300',
      borderColor: 'border-gray-200 dark:border-gray-700',
    },
  };

  const { label, icon: Icon, bgColor, textColor, borderColor } = config[type];

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${bgColor} ${textColor} ${borderColor} ${sizeClasses}`}
    >
      <Icon className={iconSize} />
      {label}
    </span>
  );
}

export default TemplateTypeBadge;
