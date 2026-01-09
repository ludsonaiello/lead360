/**
 * Failed Jobs Page
 * Manage and retry failed jobs
 */

'use client';

import React, { useState } from 'react';
import { useJobs } from '@/lib/hooks/useJobs';
import { retryJob, retryAllFailedJobs, clearAllFailedJobs } from '@/lib/api/jobs';
import { JobList } from '@/components/jobs/JobList';
import { JobDetailModal } from '@/components/jobs/JobDetailModal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Button } from '@/components/ui/Button';
import { Job } from '@/lib/types/jobs';
import { RotateCw, Trash2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function FailedJobsPage() {
  const {
    jobs,
    pagination,
    isLoading,
    error,
    nextPage,
    previousPage,
    goToPage,
    refresh,
  } = useJobs({ autoRefresh: false, failedOnly: true }); // Manual refresh only

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleJobClick = (job: Job) => {
    setSelectedJobId(job.id);
    setIsDetailModalOpen(true);
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryJob(jobId);
      toast.success('Job queued for retry');
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry job');
    }
  };

  const handleRetryAll = async () => {
    if (!confirm('Are you sure you want to retry all failed jobs?')) {
      return;
    }

    try {
      setIsRetryingAll(true);
      const result = await retryAllFailedJobs();
      toast.success(result.message);
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry jobs');
    } finally {
      setIsRetryingAll(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all failed jobs? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClearing(true);
      const result = await clearAllFailedJobs();
      toast.success(result.message);
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear jobs');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/jobs">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Jobs Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Failed Jobs
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review and retry jobs that failed to complete
        </p>
      </div>

      {/* Bulk Actions */}
      {jobs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{pagination.total_count}</strong> failed job{pagination.total_count !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleRetryAll}
                disabled={isRetryingAll || isClearing}
              >
                <RotateCw className={`w-4 h-4 mr-1 ${isRetryingAll ? 'animate-spin' : ''}`} />
                Retry All
              </Button>
              <Button
                variant="danger"
                onClick={handleClearAll}
                disabled={isRetryingAll || isClearing}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear Queue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Job List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        {error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button variant="secondary" onClick={refresh} className="mt-4">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <JobList
              jobs={jobs}
              isLoading={isLoading}
              onJobClick={handleJobClick}
              onRetry={handleRetry}
            />

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <PaginationControls
                  currentPage={pagination.current_page}
                  totalPages={pagination.total_pages}
                  onGoToPage={goToPage}
                  onNext={nextPage}
                  onPrevious={previousPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      <JobDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        jobId={selectedJobId}
        onJobUpdated={refresh}
      />
    </div>
  );
}
