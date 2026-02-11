/**
 * SystemHealthCard Component
 * Displays health status of a system component with test functionality
 */

'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { ComponentHealth, TranscriptionHealth } from '@/lib/types/twilio-admin';

export interface SystemHealthCardProps {
  title: string;
  component: ComponentHealth | TranscriptionHealth | undefined;
  onTest: () => void;
  testing?: boolean;
}

export function SystemHealthCard({ title, component, onTest, testing = false }: SystemHealthCardProps) {
  if (!component) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  // Get status badge properties
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          variant: 'success' as const,
          color: 'text-green-600 dark:text-green-400',
        };
      case 'DEGRADED':
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          variant: 'warning' as const,
          color: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'DOWN':
        return {
          icon: <XCircle className="h-4 w-4" />,
          variant: 'danger' as const,
          color: 'text-red-600 dark:text-red-400',
        };
      default:
        return {
          icon: <Activity className="h-4 w-4" />,
          variant: 'neutral' as const,
          color: 'text-gray-600 dark:text-gray-400',
        };
    }
  };

  const statusBadge = getStatusBadge(component.status);

  // Check if this is a transcription health component (has providers)
  const isTranscriptionHealth = 'providers' in component;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <Badge variant={statusBadge.variant}>
          <span className="flex items-center gap-1">
            {statusBadge.icon}
            {component.status}
          </span>
        </Badge>
      </div>

      {/* Response Time (if not transcription with multiple providers) */}
      {!isTranscriptionHealth && 'response_time_ms' in component && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Response Time
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {component.response_time_ms}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">ms</span>
          </p>
        </div>
      )}

      {/* Transcription Providers (if applicable) */}
      {isTranscriptionHealth && component.providers && (
        <div className="mb-4 space-y-2">
          {Object.entries(component.providers).map(([providerName, providerHealth]) => {
            const providerStatus = getStatusBadge(providerHealth.status);
            return (
              <div
                key={providerName}
                className="p-3 bg-gray-50 dark:bg-gray-900 rounded"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {providerName.replace(/_/g, ' ')}
                  </p>
                  <span className={`text-xs font-semibold ${providerStatus.color}`}>
                    {providerHealth.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Response: {providerHealth.response_time_ms}ms
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Status Message */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {'message' in component ? component.message : 'No message available'}
        </p>
      </div>

      {/* Test Button */}
      <Button
        onClick={onTest}
        variant="secondary"
        disabled={testing}
        className="w-full"
      >
        {testing ? (
          <>
            <Activity className="h-4 w-4 mr-2 animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <Activity className="h-4 w-4 mr-2" />
            Run Test
          </>
        )}
      </Button>
    </div>
  );
}
