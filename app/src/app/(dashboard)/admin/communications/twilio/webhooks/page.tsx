/**
 * Webhook Configuration Page
 * Main page for webhook management
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Webhook, ArrowRight } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { WebhookConfigCard } from '@/components/admin/twilio/WebhookConfigCard';
import { WebhookEndpointsCard } from '@/components/admin/twilio/WebhookEndpointsCard';
import { WebhookEventsTable } from '@/components/admin/twilio/WebhookEventsTable';
import { EditWebhookConfigModal } from '@/components/admin/twilio/EditWebhookConfigModal';
import { WebhookEventDetailModal } from '@/components/admin/twilio/WebhookEventDetailModal';
import {
  getWebhookConfig,
  updateWebhookConfig,
  testWebhookEndpoint,
  getWebhookEvents,
  retryWebhookEvent
} from '@/lib/api/twilio-admin';
import type {
  WebhookConfig,
  UpdateWebhookConfigDto,
  WebhookEvent,
  WebhookTestResult
} from '@/lib/types/twilio-admin';

export default function WebhookConfigurationPage() {
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [recentEvents, setRecentEvents] = useState<WebhookEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [testingEndpoints, setTestingEndpoints] = useState<Record<string, boolean>>({});
  const [retryingEvents, setRetryingEvents] = useState<Record<string, boolean>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configData, eventsData] = await Promise.all([
        getWebhookConfig(),
        getWebhookEvents({ limit: 10 })
      ]);
      setConfig(configData);
      setRecentEvents(eventsData.data);
    } catch (error: any) {
      console.error('[WebhookConfig] Error loading data:', error);
      setErrorMessage(error?.message || 'Failed to load webhook configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (dto: UpdateWebhookConfigDto) => {
    try {
      const result = await updateWebhookConfig(dto);
      // Reload full config after update (API returns partial config)
      const fullConfig = await getWebhookConfig();
      setConfig(fullConfig);
      setSuccessMessage(result.message || 'Webhook configuration updated successfully');
      setEditModalOpen(false);
    } catch (error: any) {
      throw error;
    }
  };

  const handleRotateSecret = async () => {
    try {
      const result = await updateWebhookConfig({ rotate_secret: true });
      // Reload full config after secret rotation
      const fullConfig = await getWebhookConfig();
      setConfig(fullConfig);
      setSuccessMessage('Webhook secret rotated successfully');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to rotate webhook secret');
    }
  };

  const handleTestEndpoint = async (type: string) => {
    setTestingEndpoints((prev) => ({ ...prev, [type]: true }));
    try {
      const result: WebhookTestResult = await testWebhookEndpoint({ type: type as any });
      if (result.status === 'success') {
        setSuccessMessage(`${type.toUpperCase()} webhook test successful (${result.response_time_ms}ms) - ${result.processing_result}`);
      } else {
        setErrorMessage(`${type.toUpperCase()} webhook test failed: ${result.processing_result}`);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || `Failed to test ${type} webhook`);
    } finally {
      setTestingEndpoints((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleRetryEvent = async (id: string) => {
    setRetryingEvents((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await retryWebhookEvent(id);
      setSuccessMessage(result.message || 'Webhook event retry queued');
      // Reload events to show updated status
      const eventsData = await getWebhookEvents({ limit: 10 });
      setRecentEvents(eventsData.data);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to retry webhook event');
    } finally {
      setRetryingEvents((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleViewDetails = (event: WebhookEvent) => {
    setSelectedEvent(event);
    setDetailModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center p-12">
        <p className="text-gray-500 dark:text-gray-400">
          Failed to load webhook configuration
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <Link href="/admin/communications/twilio" className="hover:text-gray-700 dark:hover:text-gray-300">
            Twilio Admin
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100">Webhooks</span>
        </div>
        <div className="flex items-center gap-3">
          <Webhook className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Webhook Configuration
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage webhook settings, test endpoints, and monitor webhook events
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Card */}
      <WebhookConfigCard
        config={config}
        onEdit={() => setEditModalOpen(true)}
        onRotateSecret={handleRotateSecret}
      />

      {/* Endpoints Card */}
      <WebhookEndpointsCard
        baseUrl={config.base_url}
        endpoints={config.endpoints}
        onTest={handleTestEndpoint}
        testing={testingEndpoints}
      />

      {/* Recent Webhook Events */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Recent Webhook Events
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Latest webhook deliveries and their status
            </p>
          </div>
          <Link
            href="/admin/communications/twilio/webhooks/events"
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View All Events
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <WebhookEventsTable
          events={recentEvents}
          onRetry={handleRetryEvent}
          onViewDetails={handleViewDetails}
          retrying={retryingEvents}
        />
      </div>

      {/* Edit Configuration Modal */}
      <EditWebhookConfigModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        currentConfig={config}
        onSave={handleUpdateConfig}
      />

      {/* Event Detail Modal */}
      <WebhookEventDetailModal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={!!successMessage}
        onClose={() => setSuccessMessage(null)}
        title="Success"
        message={successMessage || ''}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        message={errorMessage || ''}
      />
    </div>
  );
}
