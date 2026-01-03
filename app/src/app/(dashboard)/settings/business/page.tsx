/**
 * Business Settings Page
 * Complete tenant management with 8-tab navigation
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import {
  Building2,
  MapPin,
  FileText,
  Shield,
  CreditCard,
  Palette,
  Clock,
  Map,
} from 'lucide-react';
import { tenantApi } from '@/lib/api/tenant';
import { TenantProfile, TenantStatistics } from '@/lib/types/tenant';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import TenantProfileHeader from '@/components/tenant/TenantProfileHeader';
import BusinessInfoWizard from '@/components/tenant/BusinessInfoWizard';
import AddressList from '@/components/tenant/AddressList';
import LicenseList from '@/components/tenant/LicenseList';
import InsuranceForm from '@/components/tenant/InsuranceForm';
import PaymentTermsBuilder from '@/components/tenant/PaymentTermsBuilder';
import BrandingForm from '@/components/tenant/BrandingForm';
import BusinessHoursEditor from '@/components/tenant/BusinessHoursEditor';
import CustomHoursList from '@/components/tenant/CustomHoursList';
import ServiceAreaList from '@/components/tenant/ServiceAreaList';

const tabs: TabItem[] = [
  { id: 'business-info', label: 'Business Info', icon: Building2 },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'licenses', label: 'Licenses', icon: FileText },
  { id: 'insurance', label: 'Insurance', icon: Shield },
  { id: 'financial', label: 'Financial', icon: CreditCard },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'hours', label: 'Hours', icon: Clock },
  { id: 'service-areas', label: 'Service Areas', icon: Map },
];

export default function BusinessSettingsPage() {
  const [activeTab, setActiveTab] = useState('business-info');
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [statistics, setStatistics] = useState<TenantStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadTenant();
  }, []);

  // Read initial tab from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && tabs.some((tab) => tab.id === hash)) {
      setActiveTab(hash);
    }
  }, []);

  const loadTenant = async () => {
    try {
      setLoading(true);
      const [tenantData, statsData] = await Promise.all([
        tenantApi.getCurrentTenant(),
        tenantApi.getTenantStatistics().catch(() => null), // Stats are optional
      ]);
      setTenant(tenantData);
      setStatistics(statsData);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load business profile');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await loadTenant();
      toast.success('Business profile refreshed');
    } catch (error: any) {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
        <Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">Business Settings</span>
      </div>

      {/* Profile Header with Stats */}
      <TenantProfileHeader
        tenant={tenant}
        statistics={statistics}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Tab Navigation */}
      <div className="mt-8">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'business-info' && (
          <BusinessInfoWizard tenant={tenant} onUpdate={loadTenant} />
        )}

        {activeTab === 'addresses' && <AddressList />}

        {activeTab === 'licenses' && <LicenseList />}

        {activeTab === 'insurance' && <InsuranceForm />}

        {activeTab === 'financial' && <PaymentTermsBuilder />}

        {activeTab === 'branding' && (
          <BrandingForm tenant={tenant} onUpdate={loadTenant} />
        )}

        {activeTab === 'hours' && (
          <div className="space-y-8">
            <BusinessHoursEditor />
            <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
              <CustomHoursList />
            </div>
          </div>
        )}

        {activeTab === 'service-areas' && <ServiceAreaList />}
      </div>
    </div>
  );
}
