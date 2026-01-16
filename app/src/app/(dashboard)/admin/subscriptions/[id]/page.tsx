/**
 * Subscription Plan Detail Page
 * Shows plan information and tenants using the plan
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Users, DollarSign, Calendar, CheckCircle, XCircle, Search, Calendar as CalendarIcon } from 'lucide-react';
import { getSubscriptionPlanTenants } from '@/lib/api/admin';
import type { SubscriptionPlan } from '@/lib/types/admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface PlanTenant {
  id: string;
  subdomain: string;
  company_name: string;
  subscription_plan_id: string;
  subscription_status: 'trial' | 'active' | 'cancelled' | 'past_due' | 'expired';
  trial_end_date: string | null;
  billing_cycle: 'monthly' | 'annual' | null;
  next_billing_date: string | null;
  is_active: boolean;
  created_at: string;
}

interface PlanTenantsResponse {
  plan: SubscriptionPlan;
  tenant_count: number;
  tenants: PlanTenant[];
}

export default function SubscriptionPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [tenants, setTenants] = useState<PlanTenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<PlanTenant[]>([]);
  const [tenantCount, setTenantCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPlanDetails();
  }, [planId]);

  useEffect(() => {
    // Filter tenants based on search query
    if (!searchQuery.trim()) {
      setFilteredTenants(tenants);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = tenants.filter(tenant =>
        tenant.company_name.toLowerCase().includes(query) ||
        tenant.subdomain.toLowerCase().includes(query)
      );
      setFilteredTenants(filtered);
    }
  }, [searchQuery, tenants]);

  const loadPlanDetails = async () => {
    try {
      setLoading(true);

      // Use the API client which properly handles authentication
      // Import dynamically to access the apiClient directly
      const { apiClient } = await import('@/lib/api/axios');
      const response = await apiClient.get(`/admin/subscription-plans/${planId}/tenants`);
      const data: PlanTenantsResponse = response.data;

      // Transform plan data (parse strings to numbers and JSON)
      const transformedPlan: SubscriptionPlan = {
        ...data.plan,
        monthly_price: typeof data.plan.monthly_price === 'string' ? parseFloat(data.plan.monthly_price) : data.plan.monthly_price,
        annual_price: typeof data.plan.annual_price === 'string' ? parseFloat(data.plan.annual_price) : data.plan.annual_price,
        max_storage_gb: data.plan.max_storage_gb && typeof data.plan.max_storage_gb === 'string' ? parseFloat(data.plan.max_storage_gb) : data.plan.max_storage_gb,
        feature_flags: typeof data.plan.feature_flags === 'string' ? JSON.parse(data.plan.feature_flags) : data.plan.feature_flags,
      };

      setPlan(transformedPlan);
      setTenants(data.tenants);
      setFilteredTenants(data.tenants);
      setTenantCount(data.tenant_count);
    } catch (error) {
      console.error('Failed to load plan details:', error);
      toast.error('Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'trial':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'expired':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading plan details...</span>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Plan not found</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">The subscription plan you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/admin/subscriptions')}
            className="mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Subscription Plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/admin/subscriptions')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Plans
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{plan.name}</h1>
            {plan.is_default && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                Default
              </span>
            )}
            {plan.offers_trial && plan.trial_days && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                {plan.trial_days}-day trial
              </span>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                plan.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
              }`}
            >
              {plan.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {plan.description && (
            <p className="mt-1 text-gray-600 dark:text-gray-400">{plan.description}</p>
          )}
        </div>
        <Link
          href={`/admin/subscriptions?edit=${planId}`}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Plan
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'tenants'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Tenants ({tenantCount})
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pricing Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pricing</h2>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Monthly Price:</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${plan.monthly_price.toFixed(2)}<span className="text-sm font-normal text-gray-500">/month</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Annual Price:</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${plan.annual_price.toFixed(2)}<span className="text-sm font-normal text-gray-500">/year</span>
                </span>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-green-600 dark:text-green-400">
                  Save ${((plan.monthly_price * 12) - plan.annual_price).toFixed(2)} with annual billing
                </p>
              </div>
            </div>
          </Card>

          {/* Limits Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Limits</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Max Users:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {plan.max_users ? plan.max_users.toLocaleString() : 'Unlimited'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Storage:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {plan.max_storage_gb ? `${plan.max_storage_gb} GB` : 'Unlimited'}
                </span>
              </div>
            </div>
          </Card>

          {/* Feature Flags Card */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Features</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(plan.feature_flags || {}).map(([key, enabled]) => (
                <div
                  key={key}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    enabled
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  {enabled ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400 dark:text-gray-600 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${
                    enabled
                      ? 'text-green-900 dark:text-green-300'
                      : 'text-gray-500 dark:text-gray-500'
                  }`}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tenants Tab */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          {/* Search */}
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by company name or subdomain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </Card>

          {/* Tenants Table */}
          <Card className="overflow-hidden">
            {filteredTenants.length === 0 ? (
              <div className="p-8 text-center">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  {searchQuery ? 'No tenants found' : 'No tenants using this plan'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'When tenants are assigned this plan, they will appear here'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Subdomain
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Billing
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Next Billing / Trial Ends
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-4">
                          <Link
                            href={`/admin/tenants/${tenant.id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            {tenant.company_name}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-900 dark:text-white">{tenant.subdomain}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                              tenant.subscription_status
                            )}`}
                          >
                            {tenant.subscription_status.charAt(0).toUpperCase() + tenant.subscription_status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {tenant.billing_cycle ? (
                            <span className="text-sm text-gray-900 dark:text-white capitalize">
                              {tenant.billing_cycle}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-white">
                            <CalendarIcon className="w-4 h-4 text-gray-400" />
                            {tenant.subscription_status === 'trial' && tenant.trial_end_date
                              ? formatDate(tenant.trial_end_date)
                              : tenant.next_billing_date
                              ? formatDate(tenant.next_billing_date)
                              : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(tenant.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Results count */}
          {searchQuery && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Showing {filteredTenants.length} of {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
