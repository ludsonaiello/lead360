'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Search, X, Loader2 } from 'lucide-react';
import { getAllTenantConfigs } from '@/lib/api/twilio-admin';
import type { Tenant } from '@/lib/types/twilio-admin';
import { toast } from 'react-hot-toast';

export default function TenantAssistancePage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await getAllTenantConfigs();
      const uniqueTenants = new Map<string, Tenant>();
      
      if (data.sms_configs) {
        data.sms_configs.forEach((config: any) => {
          if (config.tenant) {
            uniqueTenants.set(config.tenant.id, config.tenant);
          }
        });
      }
      if (data.whatsapp_configs) {
        data.whatsapp_configs.forEach((config: any) => {
          if (config.tenant) {
            uniqueTenants.set(config.tenant.id, config.tenant);
          }
        });
      }

      setTenants(Array.from(uniqueTenants.values()).sort((a, b) =>
        a.company_name.localeCompare(b.company_name)
      ));
    } catch (error: any) {
      console.error('Failed to load tenants:', error);
      toast.error(error?.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = useMemo(() => {
    if (!debouncedSearch.trim()) return tenants;
    const query = debouncedSearch.toLowerCase();
    return tenants.filter(
      (t) =>
        t.company_name.toLowerCase().includes(query) ||
        t.subdomain.toLowerCase().includes(query)
    );
  }, [tenants, debouncedSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            Tenant Assistance
          </h1>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
            Select a tenant to manage their communication configurations
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants by company name or subdomain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Results count */}
        {searchQuery && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Found <span className="font-semibold">{filteredTenants.length}</span> of{" "}
            <span className="font-semibold">{tenants.length}</span> tenants
          </p>
        )}

        {/* Tenant grid */}
        {filteredTenants.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <Building2 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {searchQuery ? 'No tenants found' : 'No tenants available'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery ? 'Try a different search term' : 'No tenants have been configured yet'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => router.push(`/admin/communications/twilio/tenant-assistance/${tenant.id}`)}
                className="group relative bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6 text-left hover:border-blue-500 hover:shadow-xl transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                    <Building2 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {tenant.company_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {tenant.subdomain}.lead360.app
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
