/**
 * AlertCard Component
 * Displays system alert with severity badges and action buttons
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { SystemAlertDetail } from '@/lib/types/twilio-admin';

export interface AlertCardProps {
  alert: SystemAlertDetail;
  onAcknowledge: (id: string, comment?: string) => void;
  onResolve: (id: string, resolution: string) => void;
  onSelect?: (id: string, selected: boolean) => void;
  selected?: boolean;
}

export function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  onSelect,
  selected = false,
}: AlertCardProps) {
  return (
    <Card
      className={`border-l-4 ${getSeverityBorderColor(alert.severity)} hover:shadow-md transition-shadow`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {onSelect && (
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect(alert.id, checked as boolean)}
                className="mt-1"
              />
            )}
            <div className="flex-1">
              {/* Badges Row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant={getSeverityVariant(alert.severity)} className="font-semibold">
                  {alert.severity}
                </Badge>
                <Badge variant="outline">{formatAlertType(alert.type)}</Badge>
                {alert.acknowledged && !alert.resolved && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Acknowledged
                  </Badge>
                )}
                {alert.resolved && (
                  <Badge variant="success" className="flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle className="h-3 w-3" />
                    Resolved
                  </Badge>
                )}
              </div>

              {/* Message */}
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                {alert.message}
              </h4>

              {/* Timestamp */}
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>

        {/* Details Section */}
        {(alert.details || alert.acknowledged_by || alert.resolved_by) && (
          <div className="mt-4 space-y-2 text-sm">
            {/* Alert Details */}
            {alert.details && (
              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">Details:</p>
                <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto border border-gray-200 dark:border-gray-700">
                  {JSON.stringify(alert.details, null, 2)}
                </pre>
              </div>
            )}

            {/* Acknowledged Info */}
            {alert.acknowledged_by && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  Acknowledged
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  By: {alert.acknowledged_by.name}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {formatDistanceToNow(new Date(alert.acknowledged_at!), { addSuffix: true })}
                </p>
                {alert.comment && (
                  <p className="text-xs text-blue-900 dark:text-blue-200 mt-2 p-2 bg-blue-100 dark:bg-blue-900 rounded">
                    {alert.comment}
                  </p>
                )}
              </div>
            )}

            {/* Resolved Info */}
            {alert.resolved_by && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-xs font-semibold text-green-900 dark:text-green-200 mb-1">
                  Resolved
                </p>
                <p className="text-xs text-green-800 dark:text-green-300 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  By: {alert.resolved_by.name}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  {formatDistanceToNow(new Date(alert.resolved_at!), { addSuffix: true })}
                </p>
                {alert.resolution && (
                  <p className="text-xs text-green-900 dark:text-green-200 mt-2 p-2 bg-green-100 dark:bg-green-900 rounded">
                    {alert.resolution}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          {!alert.acknowledged && (
            <Button
              onClick={() => onAcknowledge(alert.id)}
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Acknowledge
            </Button>
          )}
          {!alert.resolved && (
            <Button
              onClick={() => onResolve(alert.id, '')}
              variant="default"
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Resolve
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Utility Functions

function getSeverityBorderColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'border-l-red-600';
    case 'HIGH':
      return 'border-l-orange-500';
    case 'MEDIUM':
      return 'border-l-yellow-500';
    case 'LOW':
      return 'border-l-blue-500';
    default:
      return 'border-l-gray-400';
  }
}

function getSeverityVariant(severity: string): 'destructive' | 'default' | 'secondary' {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'destructive';
    case 'MEDIUM':
      return 'default';
    default:
      return 'secondary';
  }
}

function formatAlertType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
