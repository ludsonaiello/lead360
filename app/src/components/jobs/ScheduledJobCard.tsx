/**
 * Scheduled Job Card Component
 * Display for a single scheduled job with actions
 */

'use client';

import React from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { ScheduledJob } from '@/lib/types/jobs';
import { cronToReadable } from '@/lib/utils/cron-helpers';
import { formatRelativeTime, formatAbsoluteTime, formatDuration, formatTimeFromNow } from '@/lib/utils/job-helpers';
import { Calendar, Play, Edit, History, CheckCircle, XCircle } from 'lucide-react';

interface ScheduledJobCardProps {
  schedule: ScheduledJob;
  onEdit: (schedule: ScheduledJob) => void;
  onTrigger: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onViewHistory: (id: string) => void;
  className?: string;
}

export function ScheduledJobCard({
  schedule,
  onEdit,
  onTrigger,
  onToggle,
  onViewHistory,
  className = '',
}: ScheduledJobCardProps) {
  // Handle both is_active (new) and is_enabled (old) for backwards compatibility
  const isEnabled = schedule.is_active ?? schedule.is_enabled ?? true;
  const timezone = schedule.metadata?.timezone || schedule.timezone || 'UTC';

  return (
    <Card
      className={`
        ${isEnabled ? 'border-green-200 dark:border-green-800' : 'border-gray-200 dark:border-gray-700'}
        ${className}
      `}
    >
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isEnabled ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              )}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {schedule.name}
              </h3>
              {schedule.type === 'quote-report' && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  Quote Report
                </span>
              )}
            </div>
            {schedule.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{schedule.description}</p>
            )}
          </div>
          <ToggleSwitch
            enabled={isEnabled}
            onChange={(checked) => onToggle(schedule.id, checked)}
            label=""
          />
        </div>

        {/* Schedule Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {cronToReadable(schedule.schedule)}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              ({timezone})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Next Run</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {schedule.next_run_at ? formatTimeFromNow(schedule.next_run_at) : 'Not scheduled'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Last Run</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {schedule.last_run_at ? formatRelativeTime(schedule.last_run_at) : 'Never'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" size="sm" onClick={() => onEdit(schedule)}>
            <Edit className="w-3.5 h-3.5 mr-1" />
            Edit Schedule
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onTrigger(schedule.id)}
            disabled={!isEnabled}
          >
            <Play className="w-3.5 h-3.5 mr-1" />
            Run Now
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onViewHistory(schedule.id)}>
            <History className="w-3.5 h-3.5 mr-1" />
            View History
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default ScheduledJobCard;
