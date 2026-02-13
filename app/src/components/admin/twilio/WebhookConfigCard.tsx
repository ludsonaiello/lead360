/**
 * WebhookConfigCard Component
 * Displays webhook configuration with action buttons
 */

'use client';

import React from 'react';
import { CheckCircle, XCircle, Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { WebhookConfig } from '@/lib/types/twilio-admin';
import { formatDistanceToNow } from 'date-fns';

export interface WebhookConfigCardProps {
  config: WebhookConfig;
  onEdit: () => void;
  onRotateSecret: () => void;
  loading?: boolean;
}

export function WebhookConfigCard({
  config,
  onEdit,
  onRotateSecret,
  loading = false
}: WebhookConfigCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Current Configuration
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Webhook settings and security configuration
          </p>
        </div>
      </div>

      {/* Configuration Details */}
      <div className="space-y-4 mb-6">
        {/* Base URL */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Base URL
          </p>
          <p className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 p-2 rounded">
            {config.base_url}
          </p>
        </div>

        {/* Signature Verification */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className={`h-4 w-4 ${config.security.signature_verification ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Signature Verification
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                {config.security.signature_verification ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
          <Badge variant={config.security.signature_verification ? 'success' : 'warning'}>
            {config.security.signature_verification ? (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Enabled
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Disabled
              </span>
            )}
          </Badge>
        </div>

        {/* Secret Status */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Secret Status
          </p>
          <div className="flex items-center gap-2">
            {config.security.secret_configured ? (
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {config.security.secret_configured ? 'Configured' : 'Not configured'}
            </span>
          </div>
          {config.security.last_rotated && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Last rotated {formatDistanceToNow(new Date(config.security.last_rotated), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onEdit}
          variant="secondary"
          size="sm"
          disabled={loading}
        >
          Edit Configuration
        </Button>
        <Button
          onClick={onRotateSecret}
          variant="secondary"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Rotate Secret
        </Button>
      </div>
    </div>
  );
}
