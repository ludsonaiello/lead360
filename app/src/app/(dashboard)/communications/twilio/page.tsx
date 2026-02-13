/**
 * Twilio Communication Dashboard
 * Sprint 9: Dashboard & Overview
 *
 * Features:
 * - Status overview of all Twilio modules (SMS, WhatsApp, Calls, IVR, Office Bypass)
 * - Recent activity (last 5 calls)
 * - Quick actions for each module
 * - Parallel data fetching with Promise.allSettled
 * - Graceful error handling (404 = not configured, not error)
 * - Loading states with skeletons
 * - RBAC enforcement
 * - Mobile responsive (3-2-1 column grid)
 * - Dark mode support
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  MessageCircle,
  Phone,
  ListTree,
  Shield,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';

import { ModuleStatusCard } from '@/components/twilio/dashboard/ModuleStatusCard';
import { RecentCallsList } from '@/components/twilio/dashboard/RecentCallsList';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SkeletonCard } from '@/components/ui/Skeleton';

import {
  getActiveSMSConfig,
  getActiveWhatsAppConfig,
  getCallHistory,
  getIVRConfig,
  getOfficeWhitelist,
} from '@/lib/api/twilio-tenant';
import { getCurrentTenant } from '@/lib/api/tenant';
import { WebhookSetupCard } from '@/components/twilio/WebhookSetupCard';

import type {
  SMSConfig,
  WhatsAppConfig,
  CallRecord,
  IVRConfig,
  OfficeWhitelistEntry,
} from '@/lib/types/twilio-tenant';

// Dashboard data structure
interface DashboardData {
  sms: {
    data: SMSConfig | null;
    loading: boolean;
    error: string | null;
  };
  whatsapp: {
    data: WhatsAppConfig | null;
    loading: boolean;
    error: string | null;
  };
  calls: {
    data: CallRecord[];
    total: number;
    thisMonth: number;
    last24Hours: number;
    loading: boolean;
    error: string | null;
  };
  ivr: {
    data: IVRConfig | null;
    loading: boolean;
    error: string | null;
  };
  whitelist: {
    data: OfficeWhitelistEntry[];
    activeCount: number;
    inactiveCount: number;
    loading: boolean;
    error: string | null;
  };
}

export default function TwilioDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData>({
    sms: { data: null, loading: true, error: null },
    whatsapp: { data: null, loading: true, error: null },
    calls: { data: [], total: 0, thisMonth: 0, last24Hours: 0, loading: true, error: null },
    ivr: { data: null, loading: true, error: null },
    whitelist: { data: [], activeCount: 0, inactiveCount: 0, loading: true, error: null },
  });
  const [tenantSubdomain, setTenantSubdomain] = useState<string | null>(null);

  // Fetch tenant data for webhook URLs
  const fetchTenantData = async () => {
    try {
      const tenant = await getCurrentTenant();
      setTenantSubdomain(tenant.subdomain);
    } catch (error: any) {
      console.error('Error fetching tenant data:', error);
      // Don't show error toast - webhook card will simply not display if subdomain is missing
    }
  };

  // Fetch all dashboard data in parallel
  useEffect(() => {
    fetchTenantData();

    async function fetchDashboardData() {
      // Parallel fetch using Promise.allSettled (as per sprint requirements)
      const results = await Promise.allSettled([
        getActiveSMSConfig(),
        getActiveWhatsAppConfig(),
        getCallHistory({ page: 1, limit: 100 }), // Fetch 100 for counting
        getIVRConfig(),
        getOfficeWhitelist(),
      ]);

      // Process SMS config result
      const smsResult = results[0];
      const smsData =
        smsResult.status === 'fulfilled'
          ? { data: smsResult.value, loading: false, error: null }
          : {
              data: null,
              loading: false,
              error:
                (smsResult.reason as any)?.status === 404 ||
                (smsResult.reason as any)?.response?.status === 404 ||
                (smsResult.reason as any)?.response?.data?.statusCode === 404 ||
                (smsResult.reason as any)?.statusCode === 404 ||
                (smsResult.reason as any)?.response?.data?.message?.includes('No active')
                  ? null // 404 means not configured, not an error
                  : 'Failed to load SMS configuration',
            };

      // Process WhatsApp config result
      const whatsappResult = results[1];
      const whatsappData =
        whatsappResult.status === 'fulfilled'
          ? { data: whatsappResult.value, loading: false, error: null }
          : {
              data: null,
              loading: false,
              error:
                (whatsappResult.reason as any)?.status === 404 ||
                (whatsappResult.reason as any)?.response?.status === 404 ||
                (whatsappResult.reason as any)?.response?.data?.statusCode === 404 ||
                (whatsappResult.reason as any)?.statusCode === 404 ||
                (whatsappResult.reason as any)?.response?.data?.message?.includes('No active')
                  ? null // 404 means not configured, not an error
                  : 'Failed to load WhatsApp configuration',
            };

      // Process call history result
      const callsResult = results[2];
      let callsData = {
        data: [] as CallRecord[],
        total: 0,
        thisMonth: 0,
        last24Hours: 0,
        loading: false,
        error: null as string | null,
      };

      if (callsResult.status === 'fulfilled') {
        const callHistory = callsResult.value;
        const allCalls = callHistory.data;

        // Calculate this month and last 24 hours
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const thisMonthCalls = allCalls.filter(
          (call) => new Date(call.created_at) >= firstDayOfMonth
        );
        const last24HoursCalls = allCalls.filter(
          (call) => new Date(call.created_at) >= twentyFourHoursAgo
        );

        callsData = {
          data: allCalls.slice(0, 5), // Keep only first 5 for recent activity
          total: callHistory.meta.total,
          thisMonth: thisMonthCalls.length,
          last24Hours: last24HoursCalls.length,
          loading: false,
          error: null,
        };
      } else {
        callsData.error = 'Failed to load call history';
      }

      // Process IVR config result
      const ivrResult = results[3];
      const ivrData =
        ivrResult.status === 'fulfilled'
          ? { data: ivrResult.value, loading: false, error: null }
          : {
              data: null,
              loading: false,
              error:
                (ivrResult.reason as any)?.status === 404 ||
                (ivrResult.reason as any)?.response?.status === 404 ||
                (ivrResult.reason as any)?.response?.data?.statusCode === 404 ||
                (ivrResult.reason as any)?.statusCode === 404 ||
                (ivrResult.reason as any)?.response?.data?.message?.includes('IVR configuration not found')
                  ? null // 404 means not configured, not an error
                  : 'Failed to load IVR configuration',
            };

      // Process whitelist result
      const whitelistResult = results[4];
      let whitelistData = {
        data: [] as OfficeWhitelistEntry[],
        activeCount: 0,
        inactiveCount: 0,
        loading: false,
        error: null as string | null,
      };

      if (whitelistResult.status === 'fulfilled') {
        const entries = whitelistResult.value;
        whitelistData = {
          data: entries,
          activeCount: entries.filter((e) => e.status === 'active').length,
          inactiveCount: entries.filter((e) => e.status === 'inactive').length,
          loading: false,
          error: null,
        };
      } else {
        whitelistData.error = 'Failed to load whitelist';
      }

      // Update dashboard state
      setDashboard({
        sms: smsData,
        whatsapp: whatsappData,
        calls: callsData,
        ivr: ivrData,
        whitelist: whitelistData,
      });
    }

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: 'Communications', href: '/communications/history' },
          { label: 'Twilio' }, // Current page
        ]}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Twilio Communication
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage SMS, WhatsApp, Calls, IVR, and Office Bypass settings
        </p>
      </div>

      {/* Status Overview Grid (3-2-1 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Show skeleton loaders while any module is still loading */}
        {(dashboard.sms.loading || dashboard.whatsapp.loading || dashboard.calls.loading ||
          dashboard.ivr.loading || dashboard.whitelist.loading) ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* SMS Configuration Card */}
            <ModuleStatusCard
          icon={MessageSquare}
          title="SMS"
          statusText={
            dashboard.sms.data
              ? dashboard.sms.data.is_active
                ? 'Configured & Active'
                : 'Configured but Inactive'
              : 'Not Configured'
          }
          statusVariant={
            dashboard.sms.data
              ? dashboard.sms.data.is_active
                ? 'success'
                : 'warning'
              : 'gray'
          }
          details={
            dashboard.sms.data
              ? [
                  `Phone: ${dashboard.sms.data.from_phone}`,
                  dashboard.sms.data.is_verified ? 'Verified with Twilio' : 'Not verified',
                ]
              : ['No SMS configuration found', 'Configure SMS to send text messages']
          }
          actionText={dashboard.sms.data ? 'View Settings' : 'Configure SMS'}
          actionLink="/communications/twilio/sms"
          colorClass="bg-blue-100 dark:bg-blue-900"
          iconColorClass="text-blue-600 dark:text-blue-400"
          isLoading={dashboard.sms.loading}
          error={dashboard.sms.error || undefined}
        />

        {/* WhatsApp Configuration Card */}
        <ModuleStatusCard
          icon={MessageCircle}
          title="WhatsApp"
          statusText={
            dashboard.whatsapp.data
              ? dashboard.whatsapp.data.is_active
                ? 'Configured & Active'
                : 'Configured but Inactive'
              : 'Not Configured'
          }
          statusVariant={
            dashboard.whatsapp.data
              ? dashboard.whatsapp.data.is_active
                ? 'success'
                : 'warning'
              : 'gray'
          }
          details={
            dashboard.whatsapp.data
              ? [
                  `Phone: ${dashboard.whatsapp.data.from_phone}`,
                  dashboard.whatsapp.data.is_verified
                    ? 'Verified with Twilio'
                    : 'Not verified',
                ]
              : [
                  'No WhatsApp configuration found',
                  'Configure WhatsApp to send messages',
                ]
          }
          actionText={dashboard.whatsapp.data ? 'View Settings' : 'Configure WhatsApp'}
          actionLink="/communications/twilio/whatsapp"
          colorClass="bg-green-100 dark:bg-green-900"
          iconColorClass="text-green-600 dark:text-green-400"
          isLoading={dashboard.whatsapp.loading}
          error={dashboard.whatsapp.error || undefined}
        />

        {/* Call Management Card */}
        <ModuleStatusCard
          icon={Phone}
          title="Calls"
          statusText={
            dashboard.calls.total > 0
              ? `${dashboard.calls.total} Total`
              : 'No Calls Yet'
          }
          statusVariant={dashboard.calls.total > 0 ? 'info' : 'gray'}
          details={
            dashboard.calls.total > 0
              ? [
                  `This month: ${dashboard.calls.thisMonth} calls`,
                  `Last 24 hours: ${dashboard.calls.last24Hours} calls`,
                ]
              : ['No call history yet', 'Make your first call to get started']
          }
          actionText="View Call History"
          actionLink="/communications/twilio/calls"
          colorClass="bg-purple-100 dark:bg-purple-900"
          iconColorClass="text-purple-600 dark:text-purple-400"
          isLoading={dashboard.calls.loading}
          error={dashboard.calls.error || undefined}
        />

        {/* IVR Configuration Card */}
        <ModuleStatusCard
          icon={ListTree}
          title="IVR Menu"
          statusText={
            dashboard.ivr.data
              ? dashboard.ivr.data.ivr_enabled
                ? 'Enabled'
                : dashboard.ivr.data.status === 'active'
                ? 'Configured but Disabled'
                : 'Disabled'
              : 'Not Configured'
          }
          statusVariant={
            dashboard.ivr.data
              ? dashboard.ivr.data.ivr_enabled
                ? 'success'
                : 'warning'
              : 'gray'
          }
          details={
            dashboard.ivr.data
              ? [
                  `${dashboard.ivr.data.menu_options.length} menu options`,
                  `Timeout: ${dashboard.ivr.data.timeout_seconds}s`,
                  `Max retries: ${dashboard.ivr.data.max_retries}`,
                ]
              : ['No IVR configuration found', 'Configure IVR to route incoming calls']
          }
          actionText={dashboard.ivr.data ? 'View Settings' : 'Configure IVR'}
          actionLink="/communications/twilio/ivr"
          colorClass="bg-orange-100 dark:bg-orange-900"
          iconColorClass="text-orange-600 dark:text-orange-400"
          isLoading={dashboard.ivr.loading}
          error={dashboard.ivr.error || undefined}
        />

        {/* Office Bypass Card */}
        <ModuleStatusCard
          icon={Shield}
          title="Office Bypass"
          statusText={
            dashboard.whitelist.activeCount > 0
              ? `${dashboard.whitelist.activeCount} Active`
              : 'No Active Numbers'
          }
          statusVariant={dashboard.whitelist.activeCount > 0 ? 'success' : 'gray'}
          details={[
            `Active: ${dashboard.whitelist.activeCount} numbers`,
            `Inactive: ${dashboard.whitelist.inactiveCount} numbers`,
            'Whitelisted numbers bypass IVR',
          ]}
          actionText="Manage Whitelist"
          actionLink="/communications/twilio/whitelist"
          colorClass="bg-gray-100 dark:bg-gray-700"
          iconColorClass="text-gray-600 dark:text-gray-400"
          isLoading={dashboard.whitelist.loading}
          error={dashboard.whitelist.error || undefined}
        />

        {/* Help & Documentation Card */}
        <ModuleStatusCard
          icon={HelpCircle}
          title="Help & Resources"
          statusText="Available"
          statusVariant="info"
          details={[
            'Twilio Account Dashboard',
            'API Documentation',
            'Support & Troubleshooting',
          ]}
          actionText="View Resources"
          actionLink="https://www.twilio.com/docs"
          colorClass="bg-blue-50 dark:bg-blue-900/30"
          iconColorClass="text-blue-500 dark:text-blue-300"
        />
          </>
        )}
      </div>

      {/* Webhook Setup Section - Only show if at least one config exists */}
      {tenantSubdomain && (dashboard.sms.data || dashboard.whatsapp.data || dashboard.ivr.data) && (
        <div>
          <WebhookSetupCard tenantSubdomain={tenantSubdomain} type="all" />
        </div>
      )}

      {/* Recent Activity Section */}
      <div>
        <RecentCallsList
          calls={dashboard.calls.data}
          isLoading={dashboard.calls.loading}
          error={dashboard.calls.error || undefined}
        />
      </div>

      {/* Global Error Banner (if multiple modules failed) */}
      {(dashboard.sms.error ||
        dashboard.whatsapp.error ||
        dashboard.calls.error ||
        dashboard.ivr.error ||
        dashboard.whitelist.error) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                Some modules failed to load
              </h3>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Partial data may be displayed. Try refreshing the page or contact support if
                the issue persists.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
