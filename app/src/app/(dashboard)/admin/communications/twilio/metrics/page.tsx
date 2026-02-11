'use client';

import { useEffect, useState } from 'react';
import { Download, TrendingUp, Users, Phone, MessageSquare, FileText } from 'lucide-react';
import { getSystemWideMetrics, getTopTenants } from '@/lib/api/twilio-admin';
import type { SystemMetricsResponse, TopTenantsResponse } from '@/lib/types/twilio-admin';
import Papa from 'papaparse';

export default function SystemMetricsPage() {
  const [metrics, setMetrics] = useState<SystemMetricsResponse | null>(null);
  const [topTenants, setTopTenants] = useState<TopTenantsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [metricsData, tenantsData] = await Promise.all([
          getSystemWideMetrics(),
          getTopTenants(10),
        ]);
        setMetrics(metricsData);
        setTopTenants(tenantsData);
      } catch (error) {
        console.error('[SystemMetrics] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleExport = () => {
    if (!metrics || !topTenants) return;

    setExporting(true);
    try {
      const exportData = {
        'System Overview': {
          'Total Communications': metrics.total_communications,
          'Total Calls': metrics.total_calls,
          'Total SMS': metrics.total_sms,
          'Total WhatsApp': metrics.total_whatsapp,
          'Active Tenants': metrics.active_tenants,
          'Total Transcriptions': metrics.total_transcriptions,
          'Failed Transcriptions': metrics.failed_transcriptions,
          'Transcription Success Rate': metrics.transcription_success_rate,
        },
        'Tenant Configurations': {
          'Tenants with SMS': metrics.tenants_with_sms_config,
          'Tenants with WhatsApp': metrics.tenants_with_whatsapp_config,
          'Tenants with IVR': metrics.tenants_with_ivr_config,
        },
        '24h Activity': {
          'Calls (24h)': metrics.activity_last_24h.calls,
          'Messages (24h)': metrics.activity_last_24h.sms,
        },
      };

      // Convert to CSV format
      const csv = Papa.unparse([
        ...Object.entries(exportData).flatMap(([section, data]) => [
          { Section: section, Metric: '', Value: '' },
          ...Object.entries(data).map(([metric, value]) => ({
            Section: '',
            Metric: metric,
            Value: value,
          })),
          { Section: '', Metric: '', Value: '' }, // Empty row
        ]),
      ]);

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `twilio-metrics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[Export] Error:', error);
      alert('Failed to export metrics');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
            System-Wide Metrics
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Platform-level communication statistics across all tenants
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>{exporting ? 'Exporting...' : 'Export Report'}</span>
        </button>
      </div>

      {/* Platform Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span>Platform Overview</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard label="Total Tenants" value={metrics?.active_tenants || 0} />
          <MetricCard label="Total Communications" value={metrics?.total_communications || 0} />
        </div>
      </div>

      {/* Communications Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span>Communications Metrics</span>
        </h2>
        <div className="space-y-6">
          {/* Calls */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Calls</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics?.total_calls.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last 24h</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics?.activity_last_24h.calls.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          {/* SMS */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">SMS</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics?.total_sms.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last 24h</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics?.activity_last_24h.sms.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Configured Tenants</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics?.tenants_with_sms_config || 0}
                </p>
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">WhatsApp</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics?.total_whatsapp.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Configured Tenants</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics?.tenants_with_whatsapp_config || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Transcriptions */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Transcriptions</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics?.total_transcriptions.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {metrics?.failed_transcriptions || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {metrics?.transcription_success_rate || '0.00'}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Tenants */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Top Tenants by Volume
        </h2>
        {topTenants && topTenants.top_tenants.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    SMS
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    WhatsApp
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {topTenants.top_tenants.map((tenant) => (
                  <tr key={tenant.tenant_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      #{tenant.rank}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {tenant.tenant_name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {tenant.subdomain}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                      {tenant.calls.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                      {tenant.sms.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                      {tenant.whatsapp.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {tenant.total_communications.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">
            No tenant data available
          </p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
