/**
 * Quote Admin Tenant Management Page
 * View and manage tenant-specific quote data
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Search, Building2, TrendingUp, DollarSign, FileText } from 'lucide-react';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { listTenants, getTenantStats } from '@/lib/api/quote-admin-tenants';
import type { TenantWithQuoteStats, TenantStatsResponse } from '@/lib/types/quote-admin';

export default function TenantQuoteManagementPage() {
  const [tenants, setTenants] = useState<TenantWithQuoteStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [tenantStats, setTenantStats] = useState<TenantStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    loadTenants();
  }, [searchQuery]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const result = await listTenants({
        status: 'active',
        search: searchQuery || undefined,
        sort_by: 'revenue',
        limit: 50,
      });
      setTenants(result.tenants);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const loadTenantStats = async (tenantId: string) => {
    try {
      setStatsLoading(true);
      setSelectedTenant(tenantId);
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);

      const stats = await getTenantStats(tenantId, {
        date_from: dateFrom.toISOString(),
        date_to: new Date().toISOString(),
      });
      setTenantStats(stats);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load tenant stats');
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tenant Quote Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View and manage quotes for specific tenants
        </p>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenants by company name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenants List */}
        <Card className="lg:col-span-1 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Tenants</h3>
          </div>
          <div className="overflow-y-auto max-h-96">
            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {tenants.map((tenant) => (
                  <button
                    key={tenant.tenant_id}
                    onClick={() => loadTenantStats(tenant.tenant_id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                      selectedTenant === tenant.tenant_id
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {tenant.company_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {tenant.quote_stats.total_quotes} quotes
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Tenant Details */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedTenant ? (
            <Card className="p-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Select a tenant to view detailed statistics
              </p>
            </Card>
          ) : statsLoading ? (
            <LoadingSpinner size="lg" centered />
          ) : tenantStats ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Quotes</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {tenantStats.statistics.total_quotes}
                      </p>
                    </div>
                    <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        ${tenantStats.statistics.revenue.total.toLocaleString()}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Avg Quote Value</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        ${tenantStats.statistics.avg_quote_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Conversion Rate</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {tenantStats.statistics.conversion_rate.toFixed(1)}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                  </div>
                </Card>
              </div>

              {/* Quotes by Status */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Quotes by Status
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(tenantStats.statistics.quotes_by_status).map(([status, count]) => (
                    <div key={status} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">{status}</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{count}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
