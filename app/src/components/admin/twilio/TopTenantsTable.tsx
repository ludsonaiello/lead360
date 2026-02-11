'use client';

/**
 * TopTenantsTable Component
 * Sprint 3: Usage Tracking & Billing
 * Displays top tenants by communication volume
 */

import React from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { TopTenant } from '@/lib/types/twilio-admin';

interface TopTenantsTableProps {
  tenants: TopTenant[];
  onViewDetails: (tenantId: string) => void;
}

export default function TopTenantsTable({ tenants, onViewDetails }: TopTenantsTableProps) {
  if (tenants.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No tenant data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
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
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {tenants.map((tenant) => (
            <tr
              key={tenant.tenant_id}
              className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <td className="px-4 py-4 whitespace-nowrap">
                <Badge variant={tenant.rank <= 3 ? 'blue' : 'gray'}>
                  #{tenant.rank}
                </Badge>
              </td>
              <td className="px-4 py-4">
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {tenant.tenant_name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {tenant.subdomain}.lead360.app
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-right text-gray-900 dark:text-gray-100">
                {tenant.calls.toLocaleString()}
              </td>
              <td className="px-4 py-4 text-right text-gray-900 dark:text-gray-100">
                {tenant.sms.toLocaleString()}
              </td>
              <td className="px-4 py-4 text-right text-gray-900 dark:text-gray-100">
                {tenant.whatsapp.toLocaleString()}
              </td>
              <td className="px-4 py-4 text-right font-semibold text-gray-900 dark:text-gray-100">
                {tenant.total_communications.toLocaleString()}
              </td>
              <td className="px-4 py-4 text-right whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(tenant.tenant_id)}
                >
                  View Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
