/**
 * Tenant Communication Detail Page
 * Sprint 2: Cross-Tenant Communication Monitoring
 * View detailed communication metrics for a specific tenant
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Building2, Phone, MessageSquare, FileText, ChevronLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { getTenantConfigs, getTenantMetrics } from '@/lib/api/twilio-admin';
import { getAllTenants } from '@/lib/api/admin';
import type { TenantConfigsResponse, TenantMetricsResponse } from '@/lib/types/twilio-admin';
import { TenantMetricsTable } from '@/components/admin/twilio/TenantMetricsTable';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

// Metric Card Component
function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'blue',
}: {
  title: string;
  value: number | string;
  subtext?: string;
  icon: any;
  color?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
          {subtext && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtext}</div>}
        </div>
      </div>
    </Card>
  );
}

// Config Card Component
function ConfigCard({
  title,
  config,
}: {
  title: string;
  config: {
    is_active?: boolean;
    is_verified?: boolean;
    from_phone?: string;
    ivr_enabled?: boolean;
    greeting_message?: string;
  } | null;
}) {
  if (!config) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">Not configured</div>
      </Card>
    );
  }

  const isActive = 'is_active' in config ? config.is_active : config.ivr_enabled;
  const isVerified = 'is_verified' in config ? config.is_verified : true;

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
          <span
            className={`text-sm font-medium ${
              isActive
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        {config.from_phone && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Phone:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {config.from_phone}
            </span>
          </div>
        )}
        {'is_verified' in config && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Verified:</span>
            <span
              className={`text-sm font-medium ${
                config.is_verified
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}
            >
              {config.is_verified ? 'Yes' : 'Pending'}
            </span>
          </div>
        )}
        {config.greeting_message && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-600 dark:text-gray-400">Greeting:</span>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
              {config.greeting_message}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function TenantCommunicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [configs, setConfigs] = useState<TenantConfigsResponse | null>(null);
  const [metrics, setMetrics] = useState<TenantMetricsResponse | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchTenantData();
    }
  }, [tenantId]);

  const fetchTenantData = async () => {
    try {
      setLoading(true);
      const [configsData, metricsData, tenantsData] = await Promise.all([
        getTenantConfigs(tenantId),
        getTenantMetrics(tenantId),
        getAllTenants({ limit: 1000 }), // Get tenant name
      ]);
      setConfigs(configsData);
      setMetrics(metricsData);

      // Find tenant name from tenants list or configs
      const tenant = tenantsData.data?.find((t) => t.id === tenantId);
      if (tenant) {
        setTenantName(tenant.company_name);
      } else if (configsData.sms_configs[0]?.tenant) {
        setTenantName(configsData.sms_configs[0].tenant.company_name);
      } else if (configsData.whatsapp_configs[0]?.tenant) {
        setTenantName(configsData.whatsapp_configs[0].tenant.company_name);
      } else if (configsData.ivr_configs[0]?.tenant) {
        setTenantName(configsData.ivr_configs[0].tenant.company_name);
      } else {
        setTenantName('Unknown Tenant');
      }
    } catch (error: any) {
      console.error('Failed to load tenant data:', error);
      toast.error(error.response?.data?.message || 'Failed to load tenant data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!metrics || !configs) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Tenant not found
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Unable to load tenant data.
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link
          href="/admin/communications/twilio/tenants"
          className="hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          All Tenants
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">{tenantName}</span>
      </nav>

      {/* Tenant Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {tenantName}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Tenant ID: {metrics.tenant?.id || tenantId}
              </p>
            </div>
          </div>
          <Link href={`/admin/tenants/${tenantId}`}>
            <Button variant="secondary" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Tenant Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Configurations */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Communication Configurations
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ConfigCard title="SMS Configuration" config={configs.sms_configs[0] || null} />
          <ConfigCard title="WhatsApp Configuration" config={configs.whatsapp_configs[0] || null} />
          <ConfigCard title="IVR Configuration" config={configs.ivr_configs[0] || null} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Communication Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Calls"
            value={metrics.calls?.total || 0}
            subtext={`${Math.floor((metrics.calls?.average_duration_seconds || 0) / 60)}m avg duration`}
            icon={Phone}
            color="blue"
          />
          <MetricCard
            title="SMS Messages"
            value={metrics.sms?.total || 0}
            subtext={`${metrics.sms?.inbound || 0} inbound, ${metrics.sms?.outbound || 0} outbound`}
            icon={MessageSquare}
            color="green"
          />
          <MetricCard
            title="WhatsApp"
            value={metrics.whatsapp?.total || 0}
            subtext={`${metrics.whatsapp?.inbound || 0} inbound, ${metrics.whatsapp?.outbound || 0} outbound`}
            icon={MessageSquare}
            color="purple"
          />
          <MetricCard
            title="Transcriptions"
            value={metrics.transcriptions?.total || 0}
            subtext={`${metrics.transcriptions?.success_rate || '0%'} success rate`}
            icon={FileText}
            color="orange"
          />
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Detailed Communication Breakdown
        </h2>
        <TenantMetricsTable metrics={metrics} />
      </div>
    </div>
  );
}
