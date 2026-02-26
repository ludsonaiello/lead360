import React from 'react';
import { Activity, Phone, Calendar, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import StatusBadge from './StatusBadge';
import type { AgentStatus } from '@/lib/types/voice-ai';

interface AgentStatusCardProps {
  status: AgentStatus;
}

/**
 * Agent Status Card Component
 * Displays KPI cards showing agent health and metrics
 */
export default function AgentStatusCard({ status }: AgentStatusCardProps) {
  const getAgentStatusVariant = () => {
    if (status.is_running && status.livekit_connected) return 'success';
    if (status.is_running && !status.livekit_connected) return 'warning';
    return 'error';
  };

  const getAgentStatusLabel = () => {
    if (status.is_running && status.livekit_connected) return 'Running & Connected';
    if (status.is_running && !status.livekit_connected) return 'Running (Disconnected)';
    return 'Stopped';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {/* Agent Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-brand-100 dark:bg-brand-900/20 rounded-lg">
            <Activity className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Agent Status</p>
          </div>
        </div>
        <div className="space-y-2">
          <StatusBadge variant={getAgentStatusVariant()} label={getAgentStatusLabel()} size="sm" />
          <div className="flex items-center gap-2 text-xs">
            {status.livekit_connected ? (
              <Wifi className="h-3 w-3 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-600 dark:text-red-400" />
            )}
            <span className="text-gray-600 dark:text-gray-400">
              {status.livekit_connected ? 'LiveKit Connected' : 'LiveKit Disconnected'}
            </span>
          </div>
          {!status.agent_enabled && (
            <p className="text-xs text-amber-600 dark:text-amber-400">⚠️ Agent disabled in config</p>
          )}
        </div>
      </div>

      {/* Active Calls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active Calls</p>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <p
            className={`text-3xl font-bold ${
              status.active_calls > 0
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {status.active_calls}
          </p>
          {status.active_calls > 0 && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">in progress</span>
          )}
        </div>
      </div>

      {/* Today's Calls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Today's Calls</p>
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{status.today_calls}</p>
      </div>

      {/* This Month */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">This Month</p>
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {status.this_month_calls}
        </p>
      </div>

      {/* Max Concurrent (Placeholder for future enhancement) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
            <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Peak Today</p>
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {status.active_calls}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Highest concurrent</p>
      </div>
    </div>
  );
}
