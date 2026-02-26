'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorModal from '@/components/ui/ErrorModal';
import SuccessModal from '@/components/ui/SuccessModal';
import AgentStatusCard from '@/components/voice-ai/admin/monitoring/AgentStatusCard';
import ActiveCallsList from '@/components/voice-ai/admin/monitoring/ActiveCallsList';
import ForceEndCallModal from '@/components/voice-ai/admin/monitoring/ForceEndCallModal';
import LogStreamViewer from '@/components/voice-ai/admin/monitoring/LogStreamViewer';
import voiceAiApi from '@/lib/api/voice-ai';
import { getAccessToken } from '@/lib/utils/token';
import type { AgentStatus, ActiveRoom } from '@/lib/types/voice-ai';
import { Activity, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

/**
 * Voice AI Monitoring Dashboard (Platform Admin Only)
 * Route: /admin/voice-ai/monitoring
 *
 * Features:
 * - Real-time agent status and KPIs
 * - Active calls list with live duration counter
 * - Force end call capability
 * - Real-time log stream (SSE)
 */
export default function MonitoringPage() {
  const router = useRouter();

  // State management
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [activeCalls, setActiveCalls] = useState<ActiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<ActiveRoom | null>(null);
  const [isForceEndModalOpen, setIsForceEndModalOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');

  // Get auth token for SSE connection
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      setAuthToken(token);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchAllData();
  }, []);

  // Auto-refresh agent status every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAgentStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Auto-refresh active calls every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveCalls();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchAgentStatus(), fetchActiveCalls()]);
    } catch (err: any) {
      console.error('Failed to fetch monitoring data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentStatus = async () => {
    try {
      const data = await voiceAiApi.getAgentStatus();
      setAgentStatus(data);
    } catch (err: any) {
      console.error('Failed to fetch agent status:', err);
      if (!agentStatus) {
        // Only show error if we don't have any data yet
        setError(err.response?.data?.message || err.message || 'Failed to fetch agent status');
      }
    }
  };

  const fetchActiveCalls = async () => {
    try {
      const data = await voiceAiApi.getActiveRooms();
      setActiveCalls(data);
    } catch (err: any) {
      console.error('Failed to fetch active calls:', err);
      if (!activeCalls.length) {
        // Only show error if we don't have any data yet
        setError(err.response?.data?.message || err.message || 'Failed to fetch active calls');
      }
    }
  };

  const handleForceEndCall = (call: ActiveRoom) => {
    setSelectedCall(call);
    setIsForceEndModalOpen(true);
  };

  const handleConfirmForceEnd = async (roomName: string) => {
    try {
      await voiceAiApi.forceEndCall(roomName);
      setSuccessMessage('Call ended successfully');

      // Refresh active calls immediately
      await fetchActiveCalls();
      await fetchAgentStatus();

      setIsForceEndModalOpen(false);
      setSelectedCall(null);
    } catch (err: any) {
      console.error('Failed to force end call:', err);
      setError(err.response?.data?.message || err.message || 'Failed to end call');
    }
  };

  const handleRefresh = () => {
    fetchAllData();
  };

  const breadcrumbItems = [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: 'Voice AI', href: '/admin/voice-ai/providers' },
    { label: 'Monitoring', href: '/admin/voice-ai/monitoring' },
  ];

  // SSE endpoint URL (Note: EventSource doesn't support custom headers, so we pass token via query param)
  const sseUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/system/voice-ai/agent/logs`;

  return (
    <ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-100 dark:bg-brand-900/20 rounded-lg">
                <Activity className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Voice AI Monitoring
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Real-time agent status, active calls, and logs
                </p>
              </div>
            </div>

            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && !agentStatus ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* Agent Status KPIs */}
            {agentStatus && (
              <div>
                <AgentStatusCard status={agentStatus} />
              </div>
            )}

            {/* Active Calls List */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Active Calls ({activeCalls.length})
              </h2>
              <ActiveCallsList calls={activeCalls} onForceEnd={handleForceEndCall} />
            </div>

            {/* Log Stream Viewer */}
            <div>
              <LogStreamViewer apiUrl={sseUrl} authToken={authToken} />
            </div>
          </>
        )}
      </div>

      {/* Force End Call Modal */}
      <ForceEndCallModal
        isOpen={isForceEndModalOpen}
        onClose={() => {
          setIsForceEndModalOpen(false);
          setSelectedCall(null);
        }}
        call={selectedCall}
        onConfirm={handleConfirmForceEnd}
      />

      {/* Error Modal */}
      {error && (
        <ErrorModal
          isOpen={!!error}
          onClose={() => setError(null)}
          title="Error"
          message={error}
        />
      )}

      {/* Success Modal */}
      {successMessage && (
        <SuccessModal
          isOpen={!!successMessage}
          onClose={() => setSuccessMessage(null)}
          title="Success"
          message={successMessage}
        />
      )}
    </ProtectedRoute>
  );
}
