/**
 * Job List Component
 * Responsive table/card display of jobs
 */

'use client';

import React from 'react';
import { Job } from '@/lib/types/jobs';
import { JobStatusBadge } from './JobStatusBadge';
import { Button } from '@/components/ui/Button';
import {
  formatDuration,
  formatJobType,
  formatRelativeTime,
  formatAbsoluteTime,
} from '@/lib/utils/job-helpers';
import { RotateCw, Eye } from 'lucide-react';

interface JobListProps {
  jobs: Job[];
  isLoading: boolean;
  onJobClick: (job: Job) => void;
  onRetry?: (jobId: string) => void;
  className?: string;
}

export function JobList({ jobs, isLoading, onJobClick, onRetry, className = '' }: JobListProps) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-gray-100 dark:bg-gray-800 rounded-md animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No jobs found</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className={`hidden lg:block overflow-x-auto ${className}`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Job Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Started
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, index) => (
              <tr
                key={job.id}
                onClick={() => onJobClick(job)}
                className={`
                  cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
                  border-b border-gray-100 dark:border-gray-800
                  ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'}
                `}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatJobType(job.job_type)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <JobStatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  <span
                    title={job.started_at ? formatAbsoluteTime(job.started_at) : 'Not started'}
                  >
                    {job.started_at ? formatRelativeTime(job.started_at) : 'Not started'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {job.duration_ms ? formatDuration(job.duration_ms) : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-2">
                    {job.status === 'failed' && onRetry && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(job.id);
                        }}
                      >
                        <RotateCw className="w-3.5 h-3.5 mr-1" />
                        Retry
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onJobClick(job);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            onClick={() => onJobClick(job)}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatJobType(job.job_type)}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {job.started_at ? formatRelativeTime(job.started_at) : 'Not started'}
                </p>
              </div>
              <JobStatusBadge status={job.status} />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>Duration: {job.duration_ms ? formatDuration(job.duration_ms) : '-'}</span>
              <span>Attempts: {job.attempts}/{job.max_retries}</span>
            </div>

            {job.status === 'failed' && onRetry && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(job.id);
                  }}
                  className="w-full"
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1" />
                  Retry Job
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default JobList;
