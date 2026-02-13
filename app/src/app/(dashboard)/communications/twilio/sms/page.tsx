/**
 * SMS Configuration Management Page
 * Manage Twilio SMS provider configuration for tenant
 */

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Phone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { CreateSMSConfigModal } from '@/components/twilio/modals/CreateSMSConfigModal';
import { EditSMSConfigModal } from '@/components/twilio/modals/EditSMSConfigModal';
import { TestSMSModal } from '@/components/twilio/modals/TestSMSModal';

import {
  getActiveSMSConfig,
  deactivateSMSConfig,
} from '@/lib/api/twilio-tenant';
import type { SMSConfig } from '@/lib/types/twilio-tenant';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentTenant } from '@/lib/api/tenant';
import { WebhookSetupCard } from '@/components/twilio/WebhookSetupCard';

export default function SMSConfigurationPage() {
  const { user } = useAuth();

  // State
  const [config, setConfig] = useState<SMSConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState(false);
  const [tenantSubdomain, setTenantSubdomain] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // RBAC - Check if user can edit (Owner or Admin)
  const canEdit = user?.roles?.some((role) => ['Owner', 'Admin'].includes(role)) || false;

  // Fetch config and tenant data on mount
  useEffect(() => {
    fetchConfig();
    fetchTenantData();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await getActiveSMSConfig();
      setConfig(data);
    } catch (error: any) {
      if (error.status === 404) {
        // No config exists - this is normal
        setConfig(null);
      } else {
        console.error('Error fetching SMS config:', error);
        toast.error('Failed to load SMS configuration');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantData = async () => {
    try {
      const tenant = await getCurrentTenant();
      setTenantSubdomain(tenant.subdomain);
    } catch (error: any) {
      console.error('Error fetching tenant data:', error);
      // Don't show error toast - webhook card will simply not display if subdomain is missing
    }
  };

  const handleTestSuccess = () => {
    setShowTestModal(false);
  };

  const handleDeactivate = async () => {
    if (!config) return;

    try {
      setDeactivating(true);
      await deactivateSMSConfig(config.id);
      toast.success('SMS configuration deactivated');
      setShowDeactivateModal(false);
      fetchConfig(); // Refresh
    } catch (error: any) {
      const message = error.data?.message || 'Failed to deactivate configuration';
      toast.error(message);
    } finally {
      setDeactivating(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchConfig();
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    fetchConfig();
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { label: 'Communications', href: '/communications/history' },
            { label: 'Twilio', href: '/communications/twilio' },
            { label: 'SMS Configuration' }, // Current page
          ]}
        />

        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            SMS Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure Twilio SMS provider for sending text messages
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // No configuration exists
  if (!config) {
    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { label: 'Communications', href: '/communications/history' },
            { label: 'Twilio', href: '/communications/twilio' },
            { label: 'SMS Configuration' }, // Current page
          ]}
        />

        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            SMS Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure Twilio SMS provider for sending text messages
          </p>
        </div>

        <Card className="text-center py-12 px-6">
          <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No SMS Configuration
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Get started by configuring your Twilio SMS provider
          </p>
          {canEdit ? (
            <Button onClick={() => setShowCreateModal(true)}>
              Configure SMS Provider
            </Button>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Contact your administrator to configure SMS
            </p>
          )}
        </Card>

        {/* Create Modal */}
        {showCreateModal && (
          <CreateSMSConfigModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateSuccess}
          />
        )}
      </div>
    );
  }

  // Configuration exists
  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: 'Communications', href: '/communications/history' },
          { label: 'Twilio', href: '/communications/twilio' },
          { label: 'SMS Configuration' }, // Current page
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            SMS Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your Twilio SMS provider settings
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {canEdit && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowEditModal(true)}
              >
                Edit Configuration
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeactivateModal(true)}
              >
                Deactivate
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Configuration Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
              <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Twilio SMS Provider
              </h3>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Phone Number:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {config.from_phone}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <Badge variant={config.is_active ? 'success' : 'neutral'}>
                    {config.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Verification:</span>
                  {config.is_verified ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Not Verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            {canEdit && config.is_active && (
              <Button
                onClick={() => setShowTestModal(true)}
                variant="secondary"
                size="sm"
              >
                Send Test SMS
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div>
              <span className="font-medium">Created:</span>{' '}
              {new Date(config.created_at).toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Last Updated:</span>{' '}
              {new Date(config.updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </Card>

      {/* Security Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Security Notice
            </h4>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Your Twilio credentials (Account SID and Auth Token) are encrypted and never displayed for security.
              To update credentials, use the Edit Configuration button.
            </p>
          </div>
        </div>
      </div>

      {/* Webhook Setup Card */}
      {tenantSubdomain && (
        <WebhookSetupCard
          tenantSubdomain={tenantSubdomain}
          type="sms"
          phoneNumber={config.from_phone}
        />
      )}

      {/* Test Modal */}
      {showTestModal && (
        <TestSMSModal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          configId={config.id}
          fromPhone={config.from_phone}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditSMSConfigModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
          config={config}
        />
      )}

      {/* Deactivate Confirmation */}
      {showDeactivateModal && (
        <ConfirmModal
          isOpen={showDeactivateModal}
          onClose={() => setShowDeactivateModal(false)}
          onConfirm={handleDeactivate}
          title="Deactivate SMS Configuration?"
          message="Are you sure you want to deactivate this SMS configuration? You will no longer be able to send SMS messages until you reactivate or create a new configuration."
          confirmText="Deactivate"
          variant="danger"
          loading={deactivating}
        />
      )}
    </div>
  );
}
