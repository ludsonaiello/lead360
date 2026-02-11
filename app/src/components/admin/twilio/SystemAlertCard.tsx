/**
 * SystemAlertCard Component
 * Displays a system alert with details and acknowledgement status
 */

'use client';

import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, XCircle, Info, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { SystemAlert } from '@/lib/types/twilio-admin';

export interface SystemAlertCardProps {
  alert: SystemAlert;
}

export function SystemAlertCard({ alert }: SystemAlertCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Get severity badge properties
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          icon: <XCircle className="h-3 w-3" />,
          variant: 'danger' as const,
          color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
        };
      case 'HIGH':
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          variant: 'warning' as const,
          color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
        };
      case 'MEDIUM':
        return {
          icon: <AlertTriangle className="h-3 w-3" />,
          variant: 'warning' as const,
          color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
        };
      case 'LOW':
        return {
          icon: <Info className="h-3 w-3" />,
          variant: 'info' as const,
          color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        };
      default:
        return {
          icon: <Info className="h-3 w-3" />,
          variant: 'neutral' as const,
          color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300',
        };
    }
  };

  // Get alert type display name
  const getAlertTypeDisplay = (type: string): string => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const severityBadge = getSeverityBadge(alert.severity);

  return (
    <div className={`border rounded-lg p-4 ${
      alert.acknowledged
        ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Severity Icon */}
        <div className={`flex-shrink-0 p-2 rounded ${severityBadge.color}`}>
          {severityBadge.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {getAlertTypeDisplay(alert.type)}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {alert.message}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={severityBadge.variant}>
                {alert.severity}
              </Badge>
              {alert.acknowledged && (
                <Badge variant="success">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Acknowledged
                  </span>
                </Badge>
              )}
            </div>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(alert.created_at).toLocaleString()}
          </p>

          {/* Acknowledgement Info */}
          {alert.acknowledged && alert.acknowledged_at && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Acknowledged: {new Date(alert.acknowledged_at).toLocaleString()}
            </p>
          )}

          {/* Details Expansion */}
          {alert.details && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show Details
                  </>
                )}
              </button>

              {expanded && (
                <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                  <pre className="whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(alert.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
