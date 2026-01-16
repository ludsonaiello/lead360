/**
 * Job Detail Modal Component
 * Shows full job details with tabs for logs, payload, and result
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { JobDetail } from '@/lib/types/jobs';
import { getJobDetail, retryJob, deleteJob } from '@/lib/api/jobs';
import { JobStatusBadge } from './JobStatusBadge';
import {
  formatDuration,
  formatJobType,
  formatAbsoluteTime,
  getLogLevelColor,
} from '@/lib/utils/job-helpers';
import { RotateCw, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface JobDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  onJobUpdated?: () => void;
}

export function JobDetailModal({ isOpen, onClose, jobId, onJobUpdated }: JobDetailModalProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (isOpen && jobId) {
      fetchJobDetail();
      setActiveTab('details'); // Reset to details tab when opening
    }
  }, [isOpen, jobId]);

  const fetchJobDetail = async () => {
    if (!jobId) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await getJobDetail(jobId);
      setJob(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load job details');
      console.error('[JobDetailModal] Error fetching job:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!job) return;

    try {
      setIsRetrying(true);
      await retryJob(job.id);
      toast.success('Job queued for retry');
      onJobUpdated?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry job');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;

    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteJob(job.id);
      toast.success('Job deleted successfully');
      onJobUpdated?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete job');
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'logs', label: 'Logs' },
    { id: 'payload', label: 'Payload' },
    { id: 'result', label: 'Result' },
  ];

  const renderTabContent = () => {
    if (!job) return null;

    switch (activeTab) {
      case 'details':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</p>
                <div className="mt-1">
                  <JobStatusBadge status={job.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Job Type</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{formatJobType(job.job_type)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Created</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{formatAbsoluteTime(job.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Started</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                  {job.started_at ? formatAbsoluteTime(job.started_at) : 'Not started'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                  {job.completed_at ? formatAbsoluteTime(job.completed_at) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Duration</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                  {job.duration_ms ? formatDuration(job.duration_ms) : '-'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Attempts</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                  {job.attempts} / {job.max_retries}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Priority</p>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{job.priority}</p>
              </div>
            </div>

            {job.error_message && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">Error Message</p>
                    <p className="text-xs text-red-700 dark:text-red-400 font-mono">{job.error_message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'logs':
        return (
          <div className="space-y-2">
            {job.job_log.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No logs available</p>
            ) : (
              job.job_log.map((log) => (
                <div
                  key={log.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-md p-3 text-xs font-mono"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`font-semibold uppercase whitespace-nowrap ${getLogLevelColor(log.level).text}`}
                    >
                      [{log.level}]
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 flex-1">{log.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case 'payload':
        return (
          <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-x-auto">
            {JSON.stringify(job.payload, null, 2)}
          </pre>
        );

      case 'result':
        return job.result ? (
          <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-x-auto">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No result available</p>
        );

      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={job ? formatJobType(job.job_type) : 'Job Details'} size="xl">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button variant="secondary" onClick={fetchJobDetail} className="mt-4">
            Retry
          </Button>
        </div>
      ) : job ? (
        <>
          <ModalContent>
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
            <div className="mt-6">
              {renderTabContent()}
            </div>
          </ModalContent>

          <ModalActions>
            {job.status === 'failed' && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleRetry}
                  disabled={isRetrying}
                >
                  <RotateCw className={`w-4 h-4 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                  Retry
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </ModalActions>
        </>
      ) : null}
    </Modal>
  );
}

export default JobDetailModal;
