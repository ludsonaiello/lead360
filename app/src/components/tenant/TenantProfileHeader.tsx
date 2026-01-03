/**
 * TenantProfileHeader Component
 * Display tenant profile summary with quick stats
 */

'use client';

import React from 'react';
import { Building2, RefreshCw, Users, MapPin, FileText, AlertCircle, Shield } from 'lucide-react';
import { TenantProfile, TenantStatistics } from '@/lib/types/tenant';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface TenantProfileHeaderProps {
  tenant: TenantProfile | null;
  statistics?: TenantStatistics | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function TenantProfileHeader({
  tenant,
  statistics,
  onRefresh,
  isRefreshing = false,
}: TenantProfileHeaderProps) {
  if (!tenant) {
    return null;
  }

  const statCards = [
    {
      label: 'Total Users',
      value: statistics?.users || 0,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Addresses',
      value: statistics?.addresses || 0,
      icon: MapPin,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Active Licenses',
      value: statistics?.licenses || 0,
      icon: FileText,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      label: 'Expiring Licenses',
      value: statistics?.expiring_licenses || 0,
      icon: AlertCircle,
      color: statistics?.expiring_licenses ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400',
      bgColor: statistics?.expiring_licenses ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-gray-100 dark:bg-gray-800',
    },
  ];

  const hasInsuranceExpiring =
    statistics?.insurance_expiring_soon?.gl || statistics?.insurance_expiring_soon?.wc;

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {tenant.company_name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge
                  variant="info"
                  label={`${tenant.subdomain}.lead360.app`}
                />
                {tenant.is_active ? (
                  <Badge variant="success" label="Active" />
                ) : (
                  <Badge variant="danger" label="Inactive" />
                )}
                {tenant.subscription_status && (
                  <Badge
                    variant={tenant.subscription_status === 'active' ? 'success' : 'warning'}
                    label={tenant.subscription_status}
                  />
                )}
              </div>
            </div>
          </div>

          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex-shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Warnings */}
      {(statistics && (statistics.expiring_licenses > 0 || hasInsuranceExpiring)) && (
        <div className="space-y-3">
          {statistics.expiring_licenses > 0 && (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                {statistics.expiring_licenses} professional license{statistics.expiring_licenses > 1 ? 's' : ''} expiring soon
              </p>
            </div>
          )}

          {hasInsuranceExpiring && (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                {statistics.insurance_expiring_soon.gl && statistics.insurance_expiring_soon.wc
                  ? 'GL and WC insurance expiring soon'
                  : statistics.insurance_expiring_soon.gl
                  ? 'GL insurance expiring soon'
                  : 'WC insurance expiring soon'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TenantProfileHeader;
