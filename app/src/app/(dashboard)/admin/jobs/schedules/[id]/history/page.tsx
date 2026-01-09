/**
 * Job History Page
 * View execution history for a scheduled job
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getScheduledJob, getScheduledJobHistory } from '@/lib/api/jobs';
import { ScheduledJob, ScheduledJobHistory } from '@/lib/types/jobs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { JobStatusBadge } from '@/components/jobs/JobStatusBadge';
import { formatAbsoluteTime, formatDuration } from '@/lib/utils/job-helpers';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function JobHistoryPage() {
  const params = useParams();
  const scheduleId = params.id as string;

  const [schedule, setSchedule] = useState<ScheduledJob | null>(null);
  const [history, setHistory] = useState<ScheduledJobHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [scheduleId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[JobHistoryPage] Fetching data for schedule ID:', scheduleId);
      const [scheduleData, historyData] = await Promise.all([
        getScheduledJob(scheduleId),
        getScheduledJobHistory(scheduleId, 100),
      ]);
      console.log('[JobHistoryPage] Schedule data:', scheduleData);
      console.log('[JobHistoryPage] History data:', historyData);
      console.log('[JobHistoryPage] History length:', historyData?.length);
      setSchedule(scheduleData);
      setHistory(historyData);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
      console.error('[JobHistoryPage] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/jobs?tab=scheduled-jobs">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Schedules
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {schedule ? `History: ${schedule.name}` : 'Job History'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Last 100 executions
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button variant="secondary" onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Run Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Completed
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No execution history found
                    </td>
                  </tr>
                ) : (
                  history.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {formatAbsoluteTime(run.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <JobStatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {run.duration_ms ? formatDuration(run.duration_ms) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {run.completed_at ? formatAbsoluteTime(run.completed_at) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No execution history found
              </div>
            ) : (
              history.map((run) => (
                <div key={run.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatAbsoluteTime(run.created_at)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Duration: {run.duration_ms ? formatDuration(run.duration_ms) : '-'}
                      </p>
                    </div>
                    <JobStatusBadge status={run.status} />
                  </div>
                  {run.completed_at && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Completed: {formatAbsoluteTime(run.completed_at)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
