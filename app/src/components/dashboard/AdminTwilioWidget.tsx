'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, MessageSquare, TrendingUp, AlertCircle } from 'lucide-react';
import { getSystemHealth } from '@/lib/api/twilio-admin';
import type { SystemHealthResponse } from '@/lib/types/twilio-admin';

export function AdminTwilioWidget() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHealth() {
      try {
        const data = await getSystemHealth();
        setHealth(data);
      } catch (error) {
        console.error('[AdminTwilioWidget] Failed to load Twilio health:', error);
      } finally {
        setLoading(false);
      }
    }
    loadHealth();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const statusColor =
    health?.overall_status === 'HEALTHY'
      ? 'text-green-600 dark:text-green-400'
      : health?.overall_status === 'DEGRADED'
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';

  const statusBgColor =
    health?.overall_status === 'HEALTHY'
      ? 'bg-green-100 dark:bg-green-900/20'
      : health?.overall_status === 'DEGRADED'
      ? 'bg-yellow-100 dark:bg-yellow-900/20'
      : 'bg-red-100 dark:bg-red-900/20';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Twilio Communications
          </h3>
          <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="space-y-3">
          {/* System Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">System Status</span>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBgColor} ${statusColor}`}>
                {health?.overall_status || 'UNKNOWN'}
              </span>
            </div>
          </div>

          {/* Warning if not healthy */}
          {health?.overall_status !== 'HEALTHY' && (
            <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                System requires attention. Check health dashboard for details.
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/admin/communications/twilio/calls"
              className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-1" />
              <span className="text-xs text-gray-600 dark:text-gray-400 text-center">Calls</span>
            </Link>
            <Link
              href="/admin/communications/twilio/messages"
              className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
              <span className="text-xs text-gray-600 dark:text-gray-400 text-center">Messages</span>
            </Link>
            <Link
              href="/admin/communications/twilio/metrics"
              className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400 mb-1" />
              <span className="text-xs text-gray-600 dark:text-gray-400 text-center">Metrics</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Link */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        <Link
          href="/admin/communications/twilio"
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        >
          View Twilio Admin →
        </Link>
      </div>
    </div>
  );
}
