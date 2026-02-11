/**
 * System Health Dashboard Page
 * Monitor Twilio system health and performance
 * Sprint 1: System Health Monitoring
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import {
  getSystemHealth,
  testTwilioConnectivity,
  testWebhooks,
  testTranscriptionProvider,
  getProviderResponseTimes,
  getSystemAlerts,
} from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import { SystemHealthCard } from '@/components/admin/twilio/SystemHealthCard';
import { ResponseTimeChart } from '@/components/admin/twilio/ResponseTimeChart';
import { SystemAlertCard } from '@/components/admin/twilio/SystemAlertCard';
import { Button } from '@/components/ui/Button';
import { Select, SelectOption } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { Badge } from '@/components/ui/Badge';
import type {
  SystemHealthResponse,
  ResponseTimeMetrics,
  SystemAlert,
} from '@/lib/types/twilio-admin';

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [responseMetrics, setResponseMetrics] = useState<ResponseTimeMetrics | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [testingWebhooks, setTestingWebhooks] = useState(false);
  const [testingTranscription, setTestingTranscription] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<string>('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Fetch all health data
  const fetchHealthData = async () => {
    try {
      const [healthData, metricsData, alertsData] = await Promise.all([
        getSystemHealth(),
        getProviderResponseTimes(),
        getSystemAlerts({
          acknowledged: acknowledgedFilter ? acknowledgedFilter === 'true' : undefined,
          severity: severityFilter ? (severityFilter as any) : undefined,
          limit: 50,
        }),
      ]);

      setHealth(healthData);
      setResponseMetrics(metricsData);
      setAlerts(alertsData.data);
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchHealthData();
  }, [severityFilter, acknowledgedFilter]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      fetchHealthData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, severityFilter, acknowledgedFilter]);

  // Test Twilio API
  const handleTestTwilio = async () => {
    setTestingTwilio(true);

    try {
      await testTwilioConnectivity('system');
      await fetchHealthData(); // Refresh data after test
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setTestingTwilio(false);
    }
  };

  // Test Webhooks
  const handleTestWebhooks = async () => {
    setTestingWebhooks(true);

    try {
      await testWebhooks();
      await fetchHealthData(); // Refresh data after test
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setTestingWebhooks(false);
    }
  };

  // Test Transcription
  const handleTestTranscription = async () => {
    setTestingTranscription(true);

    try {
      await testTranscriptionProvider();
      await fetchHealthData(); // Refresh data after test
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setTestingTranscription(false);
    }
  };

  // Get overall status badge
  const getOverallStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return {
          icon: <CheckCircle className="h-5 w-5" />,
          variant: 'success' as const,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-800 dark:text-green-200',
        };
      case 'DEGRADED':
        return {
          icon: <AlertTriangle className="h-5 w-5" />,
          variant: 'warning' as const,
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-200',
        };
      case 'DOWN':
        return {
          icon: <XCircle className="h-5 w-5" />,
          variant: 'danger' as const,
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-200',
        };
      default:
        return {
          icon: <Activity className="h-5 w-5" />,
          variant: 'neutral' as const,
          bgColor: 'bg-gray-50 dark:bg-gray-900',
          borderColor: 'border-gray-200 dark:border-gray-700',
          textColor: 'text-gray-800 dark:text-gray-200',
        };
    }
  };

  const severityOptions: SelectOption[] = [
    { value: '', label: 'All Severities' },
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
  ];

  const acknowledgedOptions: SelectOption[] = [
    { value: '', label: 'All Alerts' },
    { value: 'false', label: 'Unacknowledged Only' },
    { value: 'true', label: 'Acknowledged Only' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            System Health Dashboard
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Monitor Twilio system health and performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            variant="secondary"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefreshEnabled ? 'animate-spin' : ''}`} />
            {autoRefreshEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button
            onClick={fetchHealthData}
            variant="primary"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Overall Status Banner */}
          {health && (() => {
            const overallStatus = health.isHealthy ? 'HEALTHY' : 'DOWN';
            const statusBadge = getOverallStatusBadge(overallStatus);
            return (
              <div className={`p-6 rounded-lg border ${statusBadge.bgColor} ${statusBadge.borderColor}`}>
                <div className="flex items-center gap-3">
                  <div className={statusBadge.textColor}>
                    {statusBadge.icon}
                  </div>
                  <div className="flex-1">
                    <h2 className={`text-lg font-semibold ${statusBadge.textColor}`}>
                      System Status: {overallStatus}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Last checked: {new Date(health.checked_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={statusBadge.variant} className="text-lg px-4 py-2">
                    {overallStatus}
                  </Badge>
                </div>
              </div>
            );
          })()}

          {/* Component Health Grid */}
          {health && health.checks && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SystemHealthCard
                title="Twilio API"
                component={health.checks.twilio_api}
                onTest={handleTestTwilio}
                testing={testingTwilio}
              />
              {health.checks.webhook_delivery && (
                <SystemHealthCard
                  title="Webhooks"
                  component={health.checks.webhook_delivery as any}
                  onTest={handleTestWebhooks}
                  testing={testingWebhooks}
                />
              )}
              {health.checks.transcription_provider && (
                <SystemHealthCard
                  title="Transcription"
                  component={health.checks.transcription_provider as any}
                  onTest={handleTestTranscription}
                  testing={testingTranscription}
                />
              )}
            </div>
          )}

          {/* Performance Metrics Chart */}
          <ResponseTimeChart metrics={responseMetrics} />

          {/* System Alerts Section */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                System Alerts
              </h2>
              <div className="flex gap-3">
                <Select
                  options={severityOptions}
                  value={severityFilter}
                  onChange={(value) => setSeverityFilter(value)}
                  className="w-40"
                />
                <Select
                  options={acknowledgedOptions}
                  value={acknowledgedFilter}
                  onChange={(value) => setAcknowledgedFilter(value)}
                  className="w-48"
                />
              </div>
            </div>

            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="mx-auto h-12 w-12 text-green-300 dark:text-green-600" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  No Alerts
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  All systems are running smoothly
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <SystemAlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        message={errorMessage}
      />
    </div>
  );
}
