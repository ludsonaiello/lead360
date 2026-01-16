/**
 * Admin Tenants List Page
 * View and manage all tenants across the platform
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Search,
  Plus,
  MoreVertical,
  Eye,
  Edit,
  Pause,
  Play,
  Trash2,
  Users,
  X,
  Activity,
  CreditCard,
} from 'lucide-react';
import { getAllTenants, suspendTenant, activateTenant, deleteTenant } from '@/lib/api/admin';
import { listIndustries } from '@/lib/api/admin-industries';
import type { TenantListItem, TenantListParams } from '@/lib/api/admin';
import type { Industry } from '@/lib/types/admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { IndustryMultiSelect } from '@/components/admin/shared/IndustryMultiSelect';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>(''); // Filter by is_active
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>(''); // Filter by subscription_status
  const [industryFilter, setIndustryFilter] = useState<string[]>([]); // Filter by industries
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loadingIndustries, setLoadingIndustries] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Modal states
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load industries on mount
  useEffect(() => {
    async function loadIndustries() {
      try {
        setLoadingIndustries(true);
        const data = await listIndustries(true); // Only active industries
        setIndustries(data);
      } catch (error) {
        console.error('Failed to load industries:', error);
      } finally {
        setLoadingIndustries(false);
      }
    }
    loadIndustries();
  }, []);

  useEffect(() => {
    loadTenants();
  }, [page, activeFilter, subscriptionFilter, searchTerm, industryFilter]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const params: TenantListParams = {
        page,
        limit,
        search: searchTerm || undefined,
        status: activeFilter || undefined, // Backend expects "active", "suspended", or "deleted"
        industry_ids: industryFilter.length > 0 ? industryFilter : undefined, // Pass industry filter as array
      };
      const response = await getAllTenants(params);

      // Debug: Log raw API response
      console.log('RAW API RESPONSE:', JSON.stringify(response, null, 2));
      console.log('Filters applied:', { activeFilter, subscriptionFilter, searchTerm });
      console.log('Response data count:', response.data?.length);

      // Client-side filter by subscription_status if needed
      let filteredData = response.data || [];
      if (subscriptionFilter) {
        filteredData = filteredData.filter(tenant => tenant.subscription_status === subscriptionFilter);
      }

      setTenants(filteredData);
      setTotalPages(response.pagination?.total_pages || 1);
    } catch (error: any) {
      console.error('Load tenants error:', error);
      toast.error(error.message || 'Failed to load tenants');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setActiveFilter('');
    setSubscriptionFilter('');
    setIndustryFilter([]);
    setPage(1);
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || activeFilter || subscriptionFilter || industryFilter.length > 0;

  const handleSuspendClick = (tenant: TenantListItem) => {
    setSelectedTenant(tenant);
    setShowSuspendModal(true);
  };

  const handleActivateClick = (tenant: TenantListItem) => {
    setSelectedTenant(tenant);
    setShowActivateModal(true);
  };

  const handleDeleteClick = (tenant: TenantListItem) => {
    setSelectedTenant(tenant);
    setShowDeleteModal(true);
  };

  const confirmSuspend = async () => {
    if (!selectedTenant) return;

    try {
      setActionLoading(true);
      await suspendTenant(selectedTenant.id);
      toast.success(`${selectedTenant.company_name} has been suspended`);
      setShowSuspendModal(false);
      setSelectedTenant(null);
      loadTenants();
    } catch (error: any) {
      toast.error(error.message || 'Failed to suspend tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmActivate = async () => {
    if (!selectedTenant) return;

    try {
      setActionLoading(true);
      await activateTenant(selectedTenant.id);
      toast.success(`${selectedTenant.company_name} has been activated`);
      setShowActivateModal(false);
      setSelectedTenant(null);
      loadTenants();
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedTenant) return;

    try {
      setActionLoading(true);
      await deleteTenant(selectedTenant.id);
      toast.success(`${selectedTenant.company_name} has been moved to trash`);
      setShowDeleteModal(false);
      setSelectedTenant(null);
      loadTenants();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        Active
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
        Inactive
      </span>
    );
  };

  // Calculate stats
  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.is_active && !t.deleted_at).length,
    withSubscription: tenants.filter(t => t.subscription_status === 'active').length,
    trial: tenants.filter(t => t.subscription_status === 'trial').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tenants</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all organizations on the platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/tenants/trash')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            Trash
          </button>
          <button
            onClick={() => router.push('/admin/tenants/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Tenant
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tenants</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Tenants</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.active}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Subscribed</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.withSubscription}</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">On Trial</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.trial}</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Users className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by subdomain, company name, or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Status Filter (active/suspended/deleted) */}
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[150px]"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </select>

          {/* Subscription Filter */}
          <select
            value={subscriptionFilter}
            onChange={(e) => {
              setSubscriptionFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[150px]"
          >
            <option value="">All Subscriptions</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="past_due">Past Due</option>
          </select>

          {/* Industry Filter */}
          <div className="min-w-[250px]">
            <IndustryMultiSelect
              industries={industries}
              selectedIds={industryFilter}
              onChange={(ids) => {
                setIndustryFilter(ids);
                setPage(1);
              }}
              placeholder="Filter by industries"
              disabled={loadingIndustries}
            />
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
              title="Clear all filters"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </Card>

      {/* Tenants List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No tenants found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Subdomain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Industries
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {tenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {tenant.company_name}
                            </div>
                            {tenant.legal_business_name && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {tenant.legal_business_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white font-mono">
                          {tenant.subdomain}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {tenant.industries && tenant.industries.length > 0 ? (
                            tenant.industries.map((industry) => (
                              <span
                                key={industry.id}
                                className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded"
                              >
                                {industry.name}
                              </span>
                            ))
                          ) : tenant.industry ? (
                            <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                              {tenant.industry.name}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4 mr-1" />
                          {tenant.user_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(tenant.is_active)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {/* Plan Name */}
                          {tenant.subscription_plan?.name ? (
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {tenant.subscription_plan.name}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">No plan</span>
                          )}
                          {/* Status Badge */}
                          {(() => {
                            // Calculate if active subscription is due within 7 days (including today and past due)
                            const isDueSoon = tenant.subscription_status === 'active' && tenant.next_billing_date
                              ? (() => {
                                  // Normalize dates to start of day to avoid timezone issues
                                  const nextBillingDate = new Date(tenant.next_billing_date);
                                  nextBillingDate.setHours(0, 0, 0, 0);

                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);

                                  const daysUntilDue = Math.ceil((nextBillingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                  // Show yellow if due today, past due, or within next 7 days
                                  return daysUntilDue <= 7;
                                })()
                              : false;

                            const badgeClass = tenant.subscription_status === 'active' && isDueSoon
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : tenant.subscription_status === 'active'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : tenant.subscription_status === 'trial'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : tenant.subscription_status === 'cancelled'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : tenant.subscription_status === 'past_due'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : tenant.subscription_status === 'expired'
                              ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';

                            return (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full inline-flex items-center w-fit ${badgeClass}`}>
                                {tenant.subscription_status ? (
                                  <>
                                    {tenant.subscription_status.charAt(0).toUpperCase() + tenant.subscription_status.slice(1).replace('_', ' ')}
                                    {/* Show billing cycle for active subscriptions */}
                                    {tenant.subscription_status === 'active' && tenant.billing_cycle && (
                                      <span className="ml-1 opacity-75">({tenant.billing_cycle})</span>
                                    )}
                                  </>
                                ) : 'None'}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="View tenant details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {tenant.is_active ? (
                            <button
                              onClick={() => handleSuspendClick(tenant)}
                              className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                              title="Suspend tenant"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivateClick(tenant)}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                              title="Activate tenant"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteClick(tenant)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Delete tenant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Suspend Tenant Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => !actionLoading && setShowSuspendModal(false)}
        title="Suspend Tenant"
        size="md"
      >
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to suspend <strong>{selectedTenant?.company_name}</strong>?
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Users won't be able to access their account while suspended. This can be reversed by activating the tenant again.
          </p>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setShowSuspendModal(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmSuspend} loading={actionLoading}>
            Suspend Tenant
          </Button>
        </ModalActions>
      </Modal>

      {/* Activate Tenant Modal */}
      <Modal
        isOpen={showActivateModal}
        onClose={() => !actionLoading && setShowActivateModal(false)}
        title="Activate Tenant"
        size="md"
      >
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to activate <strong>{selectedTenant?.company_name}</strong>?
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Users will be able to access their account again.
          </p>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setShowActivateModal(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={confirmActivate} loading={actionLoading}>
            Activate Tenant
          </Button>
        </ModalActions>
      </Modal>

      {/* Delete Tenant Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !actionLoading && setShowDeleteModal(false)}
        title="Delete Tenant"
        size="md"
      >
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>{selectedTenant?.company_name}</strong>?
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            This will move the tenant to trash (soft delete). The tenant can be restored from the trash within 90 days.
          </p>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} loading={actionLoading}>
            Move to Trash
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
