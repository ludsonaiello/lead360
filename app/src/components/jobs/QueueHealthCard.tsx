/**
 * Queue Health Card Component
 * Displays queue health metrics with auto-refresh
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { getQueueHealth } from '@/lib/api/jobs';
import { QueueHealth } from '@/lib/types/jobs';
import { Activity, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface QueueHealthCardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}

export function QueueHealthCard({
  autoRefresh = false, // Changed to manual refresh only
  refreshInterval = 30000, // If enabled, refresh every 30 seconds
  className = '',
}: QueueHealthCardProps) {
  const [health, setHealth] = useState<QueueHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchHealth = async (isManualRefresh = false) => {
    try {
      console.log('[QueueHealthCard] Fetching queue health...');
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const data = await getQueueHealth();
      console.log('[QueueHealthCard] Received health data:', data);
      console.log("MountedRef: ",isMountedRef);
      if (isMountedRef.current) {
        setHealth(data);
        setLastUpdate(new Date());
      }
    } catch (err: any) {
      console.error('[QueueHealthCard] Error fetching health:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load queue health');
      }
    } finally {
      console.log("Fecha", isMountedRef);
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  const handleManualRefresh = () => {
    fetchHealth(true);
  };

  useEffect(() => {
    fetchHealth();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchHealth, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getHealthStatus = (): 'healthy' | 'warning' | 'unhealthy' => {
    if (!health) return 'unhealthy';

    const totalFailed = health.database.failed;
    const totalWaiting = health.queues.email.waiting + health.queues.scheduled.waiting;

    if (totalFailed > 10) return 'unhealthy';
    if (totalFailed > 5 || totalWaiting > 50) return 'warning';
    return 'healthy';
  };

  const healthStatus = getHealthStatus();
  const healthColors = {
    healthy: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    warning: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    unhealthy: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="p-6 flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <div className="p-6 flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      </Card>
    );
  }

  if (!health) return null;

  return (
    <Card className={className}>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Queue Health</h3>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              loading={isRefreshing}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${healthColors[healthStatus]}`}>
              {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
            </div>
          </div>
        </div>

        {/* Queue Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {health.queues.email.active + health.queues.scheduled.active}
              </p>
            </div>
          </div>

          {/* Waiting */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Waiting</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {health.queues.email.waiting + health.queues.scheduled.waiting}
              </p>
            </div>
          </div>

          {/* Completed */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {health.database.completed}
              </p>
            </div>
          </div>

          {/* Failed */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Failed</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {health.database.failed}
              </p>
            </div>
          </div>
        </div>

        {/* Queue Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* Email Queue */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Email Queue</h4>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Waiting:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{health.queues.email.waiting}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Active:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{health.queues.email.active}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Failed:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{health.queues.email.failed}</span>
              </div>
            </div>
          </div>

          {/* Scheduled Queue */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Scheduled Queue</h4>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Waiting:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{health.queues.scheduled.waiting}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Active:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{health.queues.scheduled.active}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Failed:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{health.queues.scheduled.failed}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Last Update */}
        {lastUpdate && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>
    </Card>
  );
}

export default QueueHealthCard;
