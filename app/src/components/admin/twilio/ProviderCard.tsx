/**
 * ProviderCard Component
 * Displays Twilio provider information with action buttons
 */

'use client';

import React from 'react';
import { CheckCircle, XCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { SystemProviderConfigured } from '@/lib/types/twilio-admin';

export interface ProviderCardProps {
  provider: SystemProviderConfigured;
  onUpdate: () => void;
  onTest: () => void;
  testing?: boolean;
}

export function ProviderCard({ provider, onUpdate, onTest, testing = false }: ProviderCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {provider.provider_name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            System-Level Twilio Provider
          </p>
        </div>
        <Badge variant={provider.is_active ? 'success' : 'danger'}>
          {provider.is_active ? (
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Active
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Inactive
            </span>
          )}
        </Badge>
      </div>

      {/* Model B Tenant Count */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Model B Tenants
            </p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100 mt-0.5">
              {provider.model_b_tenant_count}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          Tenants using the system-provided Twilio account
        </p>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Created
          </p>
          <p className="text-gray-900 dark:text-gray-100">
            {new Date(provider.created_at).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Updated
          </p>
          <p className="text-gray-900 dark:text-gray-100">
            {new Date(provider.updated_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          onClick={onUpdate}
          variant="secondary"
          className="flex-1"
        >
          Update Credentials
        </Button>
        <Button
          onClick={onTest}
          variant="primary"
          disabled={testing}
          className="flex-1"
        >
          {testing ? 'Testing...' : 'Test Connectivity'}
        </Button>
      </div>
    </div>
  );
}
