'use client';

import { useEffect, useState } from 'react';
import { Clock, RefreshCw, CheckCircle, XCircle, Settings, AlertCircle } from 'lucide-react';
import { getCronJobStatus, reloadCronSchedules } from '@/lib/api/twilio-admin';
import type { CronJobStatusResponse } from '@/lib/types/twilio-admin';
import cronstrue from 'cronstrue';

export default function CronJobsPage() {
  const [cronStatus, setCronStatus] = useState<CronJobStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [showReloadConfirm, setShowReloadConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadCronStatus = async () => {
    try {
      const data = await getCronJobStatus();
      setCronStatus(data);
    } catch (error) {
      console.error('[CronJobs] Error loading status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCronStatus();
    // Refresh every 30 seconds
    const interval = setInterval(loadCronStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleReload = async () => {
    setShowReloadConfirm(false);
    setReloading(true);

    try {
      const result = await reloadCronSchedules();
      setCronStatus(result.status);
      setShowSuccess(true);
    } catch (error: any) {
      console.error('[CronJobs] Reload failed:', error);
      setErrorMessage(error?.response?.data?.message || 'Failed to reload schedules');
      setShowError(true);
    } finally {
      setReloading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Cron Jobs Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor and manage scheduled Twilio tasks
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Schedules are configured in System Settings. After updating cron settings
              (twilio_usage_sync_cron, twilio_health_check_cron, cron_timezone), use the
              Reload Schedules button to apply changes.
            </p>
            <div className="mt-3 flex items-center space-x-4">
              <a
                href="/admin/settings"
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center space-x-1"
              >
                <Settings className="h-4 w-4" />
                <span>View System Settings →</span>
              </a>
              <button
                onClick={() => setShowReloadConfirm(true)}
                disabled={reloading}
                className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors inline-flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${reloading ? 'animate-spin' : ''}`} />
                <span>{reloading ? 'Reloading...' : 'Reload Schedules'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cron Jobs */}
      <div className="space-y-4">
        {/* Usage Sync Job */}
        <CronJobCard
          title="Usage Sync Job"
          description="Syncs usage data from Twilio API for all active tenants"
          job={cronStatus?.usage_sync}
        />

        {/* Health Check Job */}
        <CronJobCard
          title="Health Check Job"
          description="Monitors system health and provider connectivity"
          job={cronStatus?.health_check}
        />
      </div>

      {/* Reload Confirmation Modal */}
      {showReloadConfirm && (
        <Modal
          title="Reload Cron Schedules"
          onClose={() => setShowReloadConfirm(false)}
        >
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              This will reload all cron job schedules from the system settings. Any changes
              made to cron settings will take effect immediately.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to continue?
            </p>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowReloadConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Reload
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <Modal
          title="Schedules Reloaded"
          onClose={() => setShowSuccess(false)}
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-3 text-green-600 dark:text-green-400">
              <CheckCircle className="h-6 w-6" />
              <p className="text-gray-700 dark:text-gray-300">
                Cron job schedules have been successfully reloaded from system settings.
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowSuccess(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Error Modal */}
      {showError && (
        <Modal
          title="Reload Failed"
          onClose={() => setShowError(false)}
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <XCircle className="h-6 w-6" />
              <p className="text-gray-700 dark:text-gray-300">
                {errorMessage}
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowError(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CronJobCard({
  title,
  description,
  job,
}: {
  title: string;
  description: string;
  job?: {
    enabled: boolean;
    schedule: string;
    timezone: string;
    status: 'running' | 'stopped';
  };
}) {
  if (!job) return null;

  let humanReadable: string;
  try {
    humanReadable = cronstrue.toString(job.schedule);
  } catch (error) {
    humanReadable = 'Invalid cron expression';
  }

  const statusColor = job.status === 'running'
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  const statusBgColor = job.status === 'running'
    ? 'bg-green-100 dark:bg-green-900/20'
    : 'bg-red-100 dark:bg-red-900/20';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {description}
            </p>
          </div>
        </div>
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${statusBgColor}`}>
          {job.status === 'running' ? (
            <CheckCircle className={`h-4 w-4 ${statusColor}`} />
          ) : (
            <XCircle className={`h-4 w-4 ${statusColor}`} />
          )}
          <span className={`text-sm font-medium ${statusColor}`}>
            {job.status === 'running' ? 'Running' : 'Stopped'}
          </span>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Schedule</p>
          <div className="flex items-center space-x-2 mt-1">
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
              {job.schedule}
            </code>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({job.timezone})
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {humanReadable}
          </p>
        </div>

        {!job.enabled && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              This job is currently disabled in system settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
