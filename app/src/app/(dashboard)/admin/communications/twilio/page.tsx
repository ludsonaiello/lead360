'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  MessageSquare,
  AlertTriangle,
  Settings,
  Activity,
  BarChart3,
  FileText,
  Clock,
  TrendingUp
} from 'lucide-react';
import { getSystemHealth, getSystemWideMetrics } from '@/lib/api/twilio-admin';
import type { SystemHealthResponse, SystemMetricsResponse } from '@/lib/types/twilio-admin';

export default function TwilioAdminOverviewPage() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [metrics, setMetrics] = useState<SystemMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [healthData, metricsData] = await Promise.all([
          getSystemHealth(),
          getSystemWideMetrics(),
        ]);
        console.log('[TwilioAdminOverview] Health Data:', healthData);
        console.log('[TwilioAdminOverview] Checks:', healthData?.checks);
        console.log('[TwilioAdminOverview] Twilio API:', healthData?.checks?.twilio_api);
        console.log('[TwilioAdminOverview] Twilio Status:', healthData?.checks?.twilio_api?.status);
        setHealth(healthData);
        setMetrics(metricsData);
      } catch (error) {
        console.error('[TwilioAdminOverview] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Get Twilio-specific component status from the health response
  // API uses 'checks' not 'components'
  const twilioStatus = (health as any)?.checks?.twilio_api?.status || null;
  const normalizedStatus = twilioStatus?.toUpperCase() || null;

  console.log('[TwilioAdminOverview] RENDER - twilioStatus:', twilioStatus);
  console.log('[TwilioAdminOverview] RENDER - normalizedStatus:', normalizedStatus);
  console.log('[TwilioAdminOverview] RENDER - health object:', health);

  const statusColor =
    normalizedStatus === 'HEALTHY'
      ? 'text-green-600 dark:text-green-400'
      : normalizedStatus === 'DEGRADED'
      ? 'text-yellow-600 dark:text-yellow-400'
      : normalizedStatus === 'DOWN'
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-600 dark:text-gray-400';

  const statusBgColor =
    normalizedStatus === 'HEALTHY'
      ? 'bg-green-100 dark:bg-green-900/20'
      : normalizedStatus === 'DEGRADED'
      ? 'bg-yellow-100 dark:bg-yellow-900/20'
      : normalizedStatus === 'DOWN'
      ? 'bg-red-100 dark:bg-red-900/20'
      : 'bg-gray-100 dark:bg-gray-900/20';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Twilio Communication System
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Platform-wide communication monitoring and management
        </p>
      </div>

      {/* System Health Status */}
      <div className={`${statusBgColor} rounded-lg p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className={`h-6 w-6 ${statusColor}`} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Twilio API Health
              </h2>
              <p className={`text-sm font-medium ${statusColor}`}>
                {normalizedStatus || 'UNKNOWN'}
              </p>
            </div>
          </div>
          <Link
            href="/admin/communications/twilio/health"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            View Details →
          </Link>
        </div>
      </div>

      {/* Quick Stats (Today) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Platform Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Calls"
            value={metrics?.total_calls.toLocaleString() || '0'}
            icon={Phone}
            iconColor="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-100 dark:bg-blue-900/20"
          />
          <StatCard
            title="Total SMS"
            value={metrics?.total_sms.toLocaleString() || '0'}
            icon={MessageSquare}
            iconColor="text-green-600 dark:text-green-400"
            bgColor="bg-green-100 dark:bg-green-900/20"
          />
          <StatCard
            title="WhatsApp Messages"
            value={metrics?.total_whatsapp.toLocaleString() || '0'}
            icon={MessageSquare}
            iconColor="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-100 dark:bg-purple-900/20"
          />
          <StatCard
            title="Active Tenants"
            value={metrics?.active_tenants.toLocaleString() || '0'}
            icon={TrendingUp}
            iconColor="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-100 dark:bg-orange-900/20"
          />
        </div>
      </div>

      {/* Activity Last 24h */}
      {metrics?.activity_last_24h && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Activity (Last 24 Hours)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              title="Calls (24h)"
              value={metrics.activity_last_24h.calls.toLocaleString()}
              icon={Phone}
              iconColor="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-50 dark:bg-blue-900/10"
            />
            <StatCard
              title="Messages (24h)"
              value={metrics.activity_last_24h.sms.toLocaleString()}
              icon={MessageSquare}
              iconColor="text-green-600 dark:text-green-400"
              bgColor="bg-green-50 dark:bg-green-900/10"
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionCard
            title="Provider Settings"
            description="Manage Twilio provider configuration"
            href="/admin/communications/twilio/provider"
            icon={Settings}
          />
          <ActionCard
            title="System Health"
            description="View health checks and alerts"
            href="/admin/communications/twilio/health"
            icon={Activity}
          />
          <ActionCard
            title="View Calls"
            description="Monitor all calls across tenants"
            href="/admin/communications/twilio/calls"
            icon={Phone}
          />
          <ActionCard
            title="Usage Dashboard"
            description="Track usage and billing"
            href="/admin/communications/twilio/usage"
            icon={BarChart3}
          />
          <ActionCard
            title="Transcriptions"
            description="Monitor transcription status"
            href="/admin/communications/twilio/transcriptions"
            icon={FileText}
          />
          <ActionCard
            title="System Metrics"
            description="View platform-wide metrics"
            href="/admin/communications/twilio/metrics"
            icon={TrendingUp}
          />
          <ActionCard
            title="Cron Jobs"
            description="Manage scheduled tasks"
            href="/admin/communications/twilio/cron"
            icon={Clock}
          />
          <ActionCard
            title="Tenant Configs"
            description="View tenant configurations"
            href="/admin/communications/twilio/tenants"
            icon={AlertTriangle}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  bgColor,
}: {
  title: string;
  value: string;
  icon: any;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center space-x-4">
        <div className={`${bgColor} p-3 rounded-lg`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: any;
}) {
  return (
    <Link
      href={href}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 group"
    >
      <div className="flex items-start space-x-4">
        <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/40 transition-colors">
          <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {title}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
