// ============================================================================
// Calendar Integration Settings Page
// ============================================================================
// Connect/disconnect Google Calendar and manage sync settings
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Unplug,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/dashboard/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import SuccessModal from '@/components/ui/SuccessModal';
import ErrorModal from '@/components/ui/ErrorModal';
import DeleteConfirmationModal from '@/components/ui/DeleteConfirmationModal';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import * as calendarApi from '@/lib/api/calendar';
import type { CalendarIntegrationStatusResponse } from '@/lib/types/calendar';

export default function CalendarIntegrationPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CalendarIntegrationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: '',
  });
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: '',
  });
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    loadStatus();

    // Handle success/error query parameters
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');

    if (success === 'true') {
      setSuccessModal({
        isOpen: true,
        title: 'Calendar Connected',
        message: 'Google Calendar has been connected successfully. Your appointments will now sync automatically.',
      });
      // Clean URL
      window.history.replaceState({}, '', '/settings/calendar/integration');
    } else if (errorParam) {
      setErrorModal({
        isOpen: true,
        title: 'Connection Failed',
        message: `Failed to connect Google Calendar: ${decodeURIComponent(errorParam)}`,
      });
      // Clean URL
      window.history.replaceState({}, '', '/settings/calendar/integration');
    }
  }, [searchParams]);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await calendarApi.getIntegrationStatus();
      setStatus(data);
    } catch (err: any) {
      console.error('[CalendarIntegration] Failed to load status:', err);
      // Don't set error for 404 (no connection) - just show disconnected state
      if (err.status !== 404) {
        setError(err.message || 'Failed to load integration status');
      } else {
        setStatus({ connected: false });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const { authUrl } = await calendarApi.getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (err: any) {
      console.error('[CalendarIntegration] Failed to get auth URL:', err);
      setError(err.message || 'Failed to connect to Google Calendar');
    }
  };

  const handleDisconnectConfirm = async () => {
    setIsDisconnecting(true);
    try {
      await calendarApi.disconnectGoogleCalendar();
      setSuccessModal({
        isOpen: true,
        title: 'Calendar Disconnected',
        message: 'Google Calendar has been disconnected successfully. Syncing has stopped.',
      });
      await loadStatus();
    } catch (err: any) {
      console.error('[CalendarIntegration] Failed to disconnect:', err);
      setErrorModal({
        isOpen: true,
        title: 'Disconnect Failed',
        message: err.message || 'Failed to disconnect Google Calendar',
      });
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectModal(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await calendarApi.manualSyncGoogleCalendar();
      setSuccessModal({
        isOpen: true,
        title: 'Sync Started',
        message: 'Manual sync has been triggered. This may take a few moments. Your calendar will update shortly.',
      });
      await loadStatus();
    } catch (err: any) {
      console.error('[CalendarIntegration] Failed to sync:', err);
      setErrorModal({
        isOpen: true,
        title: 'Sync Failed',
        message: err.message || 'Failed to trigger sync',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await calendarApi.testGoogleCalendarConnection();
      setSuccessModal({
        isOpen: true,
        title: 'Connection Healthy',
        message: result.message || 'Calendar connection is working properly.',
      });
    } catch (err: any) {
      console.error('[CalendarIntegration] Test failed:', err);
      setErrorModal({
        isOpen: true,
        title: 'Connection Test Failed',
        message: err.message || 'Unknown error occurred during connection test.',
      });
    } finally {
      setTesting(false);
    }
  };

  const getSyncStatusColor = (syncStatus: string) => {
    switch (syncStatus) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'syncing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ProtectedRoute requiredPermission="calendar:edit">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-brand-600 dark:text-brand-400" />
            Calendar Integration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Connect your Google Calendar to sync appointments automatically
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <LoadingSpinner />
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading integration status...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-red-600 dark:text-red-400 mb-2">
                <XCircle className="w-12 h-12 mx-auto mb-2" />
                <p className="text-lg font-semibold">Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
              <Button onClick={loadStatus} variant="primary" size="sm" className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : !status?.connected ? (
          /* Not Connected */
          <Card>
            <CardContent className="p-8">
              <div className="text-center max-w-2xl mx-auto">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Connect Google Calendar
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Sync your appointments with Google Calendar to see them on your phone and block time
                  when you have personal events.
                </p>

                <div className="space-y-3 text-left mb-6 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Benefits:
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-7">
                    <li>• See appointments on your phone automatically</li>
                    <li>• Personal events block appointment slots</li>
                    <li>• Two-way sync keeps everything up to date</li>
                    <li>• Never double-book again</li>
                  </ul>
                </div>

                <Button onClick={handleConnect} variant="primary" size="lg">
                  <CalendarIcon className="w-5 h-5 mr-2" />
                  Connect Google Calendar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Connected */
          <div className="space-y-6">
            {/* Connection Status Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Connected to Google Calendar
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {status.connectedCalendarName || status.connectedCalendarId}
                      </p>
                    </div>
                  </div>

                  {status.syncStatus && (
                    <Badge className={getSyncStatusColor(status.syncStatus)}>
                      <div className="flex items-center gap-1">
                        {status.syncStatus === 'active' && <Activity className="w-4 h-4" />}
                        {status.syncStatus === 'syncing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                        {status.syncStatus === 'error' && <AlertTriangle className="w-4 h-4" />}
                        <span className="capitalize">{status.syncStatus}</span>
                      </div>
                    </Badge>
                  )}
                </div>

                {/* Sync Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                      Last Synced
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatDate(status.lastSyncAt)}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                      Provider
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {status.providerType === 'google_calendar' ? 'Google Calendar' : status.providerType}
                    </p>
                  </div>
                </div>

                {/* Error Message */}
                {status.errorMessage && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg mb-6">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                          Sync Error
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          {status.errorMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleManualSync}
                    variant="secondary"
                    size="md"
                    disabled={syncing}
                  >
                    {syncing ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                  <Button onClick={handleTest} variant="secondary" size="md" disabled={testing}>
                    {testing ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Activity className="w-4 h-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                  <Button onClick={() => setShowDisconnectModal(true)} variant="danger" size="md">
                    <Unplug className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* How It Works */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  How It Works
                </h3>
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">1</span>
                    </div>
                    <p>
                      <strong className="text-gray-900 dark:text-gray-100">Appointments sync to Google:</strong>{' '}
                      When you create or update an appointment, it automatically appears on your Google Calendar
                      with all the details.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">2</span>
                    </div>
                    <p>
                      <strong className="text-gray-900 dark:text-gray-100">Personal events block slots:</strong>{' '}
                      When you add a personal event to Google Calendar, those time slots become unavailable for
                      booking in Lead360.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">3</span>
                    </div>
                    <p>
                      <strong className="text-gray-900 dark:text-gray-100">Real-time updates:</strong>{' '}
                      Changes sync automatically within a few minutes through webhooks and periodic sync.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Success Modal */}
        <SuccessModal
          isOpen={successModal.isOpen}
          onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
          title={successModal.title}
          message={successModal.message}
        />

        {/* Error Modal */}
        <ErrorModal
          isOpen={errorModal.isOpen}
          onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
          title={errorModal.title}
          message={errorModal.message}
        />

        {/* Disconnect Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={showDisconnectModal}
          onClose={() => setShowDisconnectModal(false)}
          onConfirm={handleDisconnectConfirm}
          title="Disconnect Google Calendar"
          message="Are you sure you want to disconnect Google Calendar? This will stop syncing your appointments and external calendar blocks will no longer be visible."
          confirmText="Disconnect"
          cancelText="Keep Connected"
          isDeleting={isDisconnecting}
        />
      </div>
    </ProtectedRoute>
  );
}
