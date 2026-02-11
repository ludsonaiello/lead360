'use client';

/**
 * SyncUsageButton Component
 * Sprint 3: Usage Tracking & Billing
 * Reusable button for triggering sync operations
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

interface SyncUsageButtonProps {
  onClick: () => void;
  loading: boolean;
  label?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export default function SyncUsageButton({
  onClick,
  loading,
  label = 'Sync Now',
  variant = 'primary',
  size = 'md',
}: SyncUsageButtonProps) {
  return (
    <Button
      onClick={onClick}
      loading={loading}
      disabled={loading}
      variant={variant}
      size={size}
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {label}
    </Button>
  );
}
