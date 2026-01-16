/**
 * Tenant Detail Page
 * View and manage a specific tenant - uses actual API response structure
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Users,
  Activity,
  FileText,
  Cog,
  Play,
  Pause,
  Trash2,
  MapPin,
  Phone,
  Mail,
  Globe,
  CreditCard,
  Palette,
  Eye,
} from 'lucide-react';
import { getTenantById, suspendTenant, activateTenant, deleteTenant } from '@/lib/api/admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { SubscriptionTab } from '@/components/admin/tenants/subscription/SubscriptionTab';

type TabType = 'overview' | 'users' | 'contact' | 'addresses' | 'licenses' | 'subscription' | 'settings';

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;
  const { startImpersonation } = useImpersonation();

  const [tenant, setTenant] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    loadTenantData();
  }, [tenantId]);

  const loadTenantData = async () => {
    try {
      setLoading(true);
      const data = await getTenantById(tenantId);
      console.log('TENANT DETAIL RAW API:', JSON.stringify(data, null, 2));
      setTenant(data);
    } catch (error: any) {
      console.error('Load tenant error:', error);
      toast.error(error.message || 'Failed to load tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    try {
      setActionLoading(true);
      await suspendTenant(tenantId);
      toast.success('Tenant suspended successfully');
      setShowSuspendModal(false);
      loadTenantData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to suspend tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    try {
      setActionLoading(true);
      await activateTenant(tenantId);
      toast.success('Tenant activated successfully');
      loadTenantData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLoginAsTenant = () => {
    if (!tenant) return;
    startImpersonation(tenant.id, tenant.company_name);
    toast.success(`Now viewing as ${tenant.company_name}`);
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    try {
      setActionLoading(true);
      await deleteTenant(tenantId);
      toast.success('Tenant deleted successfully');
      router.push('/admin/tenants');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete tenant');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <Card className="p-6">
        <p className="text-red-600 dark:text-red-400">Tenant not found</p>
      </Card>
    );
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: Building2 },
    { id: 'users' as TabType, label: 'Users', icon: Users },
    { id: 'contact' as TabType, label: 'Contact Info', icon: Phone },
    { id: 'addresses' as TabType, label: 'Addresses', icon: MapPin },
    { id: 'licenses' as TabType, label: 'Licenses', icon: FileText },
    { id: 'subscription' as TabType, label: 'Subscription', icon: CreditCard },
    { id: 'settings' as TabType, label: 'Settings', icon: Cog },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/tenants')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{tenant.company_name}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 font-mono">{tenant.subdomain}.lead360.app</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoginAsTenant}
            disabled={actionLoading || !tenant.is_active}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!tenant.is_active ? 'Cannot impersonate suspended tenant' : 'View platform as this tenant'}
          >
            <Eye className="w-4 h-4" />
            Login as Tenant
          </button>

          {tenant.is_active ? (
            <button
              onClick={() => setShowSuspendModal(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              Suspend
            </button>
          ) : (
            <button
              onClick={handleActivate}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Activate
            </button>
          )}

          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Card className="p-0">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Status</h3>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      tenant.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {tenant.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Subscription */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Subscription</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    tenant.subscription_status === 'active'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : tenant.subscription_status === 'trial'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {tenant.subscription_status || 'None'}
                  </span>
                </div>

                {/* Legal Name */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Legal Business Name</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.legal_business_name || 'N/A'}</p>
                </div>

                {/* DBA */}
                {tenant.dba_name && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">DBA Name</h3>
                    <p className="text-gray-900 dark:text-white">{tenant.dba_name}</p>
                  </div>
                )}

                {/* Business Type */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Business Entity Type</h3>
                  <p className="text-gray-900 dark:text-white capitalize">{tenant.business_entity_type || 'N/A'}</p>
                </div>

                {/* State */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">State of Registration</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.state_of_registration || 'N/A'}</p>
                </div>

                {/* EIN */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">EIN</h3>
                  <p className="text-gray-900 dark:text-white font-mono">{tenant.ein || 'N/A'}</p>
                </div>

                {/* Industries - Support both new (industries array) and old (single industry) format */}
                {((tenant.industries && tenant.industries.length > 0) || tenant.industry) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {tenant.industries && tenant.industries.length > 1 ? 'Industries' : 'Industry'}
                    </h3>
                    {tenant.industries && tenant.industries.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {tenant.industries.map((industry: any) => (
                          <div
                            key={industry.id}
                            className="inline-block px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg"
                          >
                            <p className="text-sm font-medium">{industry.name}</p>
                            {industry.description && (
                              <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">{industry.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : tenant.industry ? (
                      <div className="inline-block px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg">
                        <p className="text-sm font-medium">{tenant.industry.name}</p>
                        {tenant.industry.description && (
                          <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">{tenant.industry.description}</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Business Size */}
                {tenant.business_size && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Business Size</h3>
                    <p className="text-gray-900 dark:text-white">
                      {tenant.business_size === '1-5' && '1-5 employees'}
                      {tenant.business_size === '6-10' && '6-10 employees'}
                      {tenant.business_size === '11-25' && '11-25 employees'}
                      {tenant.business_size === '26-50' && '26-50 employees'}
                      {tenant.business_size === '51-100' && '51-100 employees'}
                      {tenant.business_size === '101-250' && '101-250 employees'}
                      {tenant.business_size === '251+' && '251+ employees'}
                    </p>
                  </div>
                )}

                {/* Created */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Created</h3>
                  <p className="text-gray-900 dark:text-white">{new Date(tenant.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Brand Colors */}
              {tenant.primary_brand_color && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Brand Colors</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: tenant.primary_brand_color }}
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Primary</span>
                    </div>
                    {tenant.secondary_brand_color && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: tenant.secondary_brand_color }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Secondary</span>
                      </div>
                    )}
                    {tenant.accent_color && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: tenant.accent_color }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Accent</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              {tenant.users && tenant.users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Roles
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Last Login
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {tenant.users.map((user: any) => (
                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.first_name} {user.last_name}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {user.roles && user.roles.length > 0 ? (
                                user.roles.map((role: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="inline-block px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded"
                                  >
                                    {role}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500 dark:text-gray-400">No roles</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                user.is_active
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                              }`}
                            >
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No users found</p>
              )}
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Primary Contact Phone</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.primary_contact_phone || 'N/A'}</p>
                </div>
                {tenant.secondary_phone && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Secondary Phone</h3>
                    <p className="text-gray-900 dark:text-white">{tenant.secondary_phone}</p>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Primary Contact Email</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.primary_contact_email || 'N/A'}</p>
                </div>
                {tenant.support_email && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Support Email</h3>
                    <p className="text-gray-900 dark:text-white">{tenant.support_email}</p>
                  </div>
                )}
                {tenant.billing_email && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Billing Email</h3>
                    <p className="text-gray-900 dark:text-white">{tenant.billing_email}</p>
                  </div>
                )}
                {tenant.website_url && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Website</h3>
                    <a
                      href={tenant.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {tenant.website_url}
                    </a>
                  </div>
                )}
              </div>

              {/* Social Media */}
              {(tenant.instagram_url || tenant.facebook_url || tenant.tiktok_url || tenant.youtube_url) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Social Media</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {tenant.instagram_url && (
                      <a href={tenant.instagram_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                        Instagram
                      </a>
                    )}
                    {tenant.facebook_url && (
                      <a href={tenant.facebook_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                        Facebook
                      </a>
                    )}
                    {tenant.tiktok_url && (
                      <a href={tenant.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                        TikTok
                      </a>
                    )}
                    {tenant.youtube_url && (
                      <a href={tenant.youtube_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                        YouTube
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="space-y-4">
              {tenant.tenant_address && tenant.tenant_address.length > 0 ? (
                tenant.tenant_address.map((address: any) => (
                  <Card key={address.id} className="p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white capitalize">{address.address_type} Address</h3>
                      {address.is_default && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">
                      {address.line1}
                      {address.line2 && <><br />{address.line2}</>}
                      <br />
                      {address.city}, {address.state} {address.zip_code}
                      <br />
                      {address.country}
                    </p>
                  </Card>
                ))
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No addresses found</p>
              )}
            </div>
          )}

          {activeTab === 'licenses' && (
            <div className="space-y-4">
              {tenant.tenant_license && tenant.tenant_license.length > 0 ? (
                tenant.tenant_license.map((license: any) => (
                  <Card key={license.id} className="p-4 bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">{license.custom_license_type || 'License'}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">License Number:</span>
                        <p className="text-gray-900 dark:text-white">{license.license_number || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">State:</span>
                        <p className="text-gray-900 dark:text-white">{license.state || 'N/A'}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No licenses found</p>
              )}
            </div>
          )}

          {activeTab === 'subscription' && (
            <SubscriptionTab tenant={tenant} onRefresh={loadTenantData} />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Invoice Prefix</h3>
                  <p className="text-gray-900 dark:text-white font-mono">{tenant.invoice_prefix || 'INV'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Next Invoice Number</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.next_invoice_number || 1}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Quote Prefix</h3>
                  <p className="text-gray-900 dark:text-white font-mono">{tenant.quote_prefix || 'Q-'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Next Quote Number</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.next_quote_number || 1}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Quote Validity Days</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.default_quote_validity_days || 30} days</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Timezone</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.timezone || 'UTC'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Sales Tax Rate</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.sales_tax_rate || 0}%</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Default Contingency Rate</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.default_contingency_rate || 0}%</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Default Overhead Rate</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.default_overhead_rate || 0}%</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Default Profit Margin</h3>
                  <p className="text-gray-900 dark:text-white">{tenant.default_profit_margin || 0}%</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Suspend Confirmation Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        title="Suspend Tenant"
        size="md"
      >
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to suspend <strong>{tenant?.company_name}</strong>?
            </p>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This tenant will lose access to the platform immediately. All users under this tenant will be unable to log in.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="secondary"
            onClick={() => setShowSuspendModal(false)}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSuspend}
            loading={actionLoading}
          >
            Suspend Tenant
          </Button>
        </ModalActions>
      </Modal>

      {/* Soft Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText('');
        }}
        title="Delete Tenant"
        size="md"
      >
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{tenant?.company_name}</strong>?
            </p>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> This tenant will be moved to trash and can be restored within 90 days. After 90 days, it will be automatically permanently deleted.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="secondary"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteConfirmText('');
            }}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={actionLoading}
            disabled={deleteConfirmText !== 'DELETE'}
          >
            Move to Trash
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
