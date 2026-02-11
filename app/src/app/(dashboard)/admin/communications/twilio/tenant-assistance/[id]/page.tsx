'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { TenantConfigCard } from '@/components/admin/twilio/tenant-assistance/TenantConfigCard';
import { CreateTenantSmsConfigModal } from '@/components/admin/twilio/tenant-assistance/CreateTenantSmsConfigModal';
import { CreateTenantWhatsAppConfigModal } from '@/components/admin/twilio/tenant-assistance/CreateTenantWhatsAppConfigModal';
import { EditTenantSmsConfigModal } from '@/components/admin/twilio/tenant-assistance/EditTenantSmsConfigModal';
import { EditTenantWhatsAppConfigModal } from '@/components/admin/twilio/tenant-assistance/EditTenantWhatsAppConfigModal';
import { TestTenantConfigModal } from '@/components/admin/twilio/tenant-assistance/TestTenantConfigModal';
import {
  getAllTenantConfigs,
  getTenantConfigs,
  getTenantMetrics,
  createTenantSmsConfig,
  updateTenantSmsConfig,
  createTenantWhatsAppConfig,
  updateTenantWhatsAppConfig,
  testTenantSmsConfig,
  testTenantWhatsAppConfig,
  getOwnedPhoneNumbersDetailed,
} from '@/lib/api/twilio-admin';
import type {
  Tenant,
  TenantSmsConfig,
  TenantWhatsAppConfig,
  CreateTenantSmsConfigDto,
  CreateTenantWhatsAppConfigDto,
  UpdateTenantSmsConfigDto,
  UpdateTenantWhatsAppConfigDto,
  PhoneNumber,
  TenantMetricsResponse,
} from '@/lib/types/twilio-admin';
import { Loader2, Plus, ArrowLeft, Building2, MessageSquare, Phone, Activity } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [smsConfigs, setSmsConfigs] = useState<TenantSmsConfig[]>([]);
  const [whatsappConfigs, setWhatsappConfigs] = useState<TenantWhatsAppConfig[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [metrics, setMetrics] = useState<TenantMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [addSmsModalOpen, setAddSmsModalOpen] = useState(false);
  const [addWhatsAppModalOpen, setAddWhatsAppModalOpen] = useState(false);
  const [editSmsModalOpen, setEditSmsModalOpen] = useState(false);
  const [editWhatsAppModalOpen, setEditWhatsAppModalOpen] = useState(false);
  const [testSmsModalOpen, setTestSmsModalOpen] = useState(false);
  const [testWhatsAppModalOpen, setTestWhatsAppModalOpen] = useState(false);
  const [editingSmsConfig, setEditingSmsConfig] = useState<TenantSmsConfig | null>(null);
  const [editingWhatsAppConfig, setEditingWhatsAppConfig] = useState<TenantWhatsAppConfig | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allConfigs, configs, metricsData, phoneData] = await Promise.all([
        getAllTenantConfigs(),
        getTenantConfigs(tenantId),
        getTenantMetrics(tenantId),
        getOwnedPhoneNumbersDetailed(),
      ]);

      let foundTenant: Tenant | null = null;
      if (allConfigs.sms_configs) {
        for (const config of allConfigs.sms_configs) {
          if (config.tenant?.id === tenantId) {
            foundTenant = config.tenant;
            break;
          }
        }
      }
      if (!foundTenant && allConfigs.whatsapp_configs) {
        for (const config of allConfigs.whatsapp_configs) {
          if (config.tenant?.id === tenantId) {
            foundTenant = config.tenant;
            break;
          }
        }
      }

      setTenant(foundTenant);
      setSmsConfigs(configs.sms_configs || []);
      setWhatsappConfigs(configs.whatsapp_configs || []);
      setMetrics(metricsData);
      setPhoneNumbers(phoneData.phone_numbers || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error(error?.message || 'Failed to load tenant data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSmsConfig = async (dto: CreateTenantSmsConfigDto) => {
    try {
      await createTenantSmsConfig(tenantId, dto);
      toast.success('SMS configuration created successfully');
      await loadData();
    } catch (error: any) {
      console.error('Failed to create SMS config:', error);
      toast.error(error?.message || 'Failed to create SMS configuration');
      throw error;
    }
  };

  const handleCreateWhatsAppConfig = async (dto: CreateTenantWhatsAppConfigDto) => {
    try {
      await createTenantWhatsAppConfig(tenantId, dto);
      toast.success('WhatsApp configuration created successfully');
      await loadData();
    } catch (error: any) {
      console.error('Failed to create WhatsApp config:', error);
      toast.error(error?.message || 'Failed to create WhatsApp configuration');
      throw error;
    }
  };

  const handleEditSms = (config: TenantSmsConfig) => {
    setEditingSmsConfig(config);
    setEditSmsModalOpen(true);
  };

  const handleEditWhatsApp = (config: TenantWhatsAppConfig) => {
    setEditingWhatsAppConfig(config);
    setEditWhatsAppModalOpen(true);
  };

  const handleUpdateSmsConfig = async (configId: string, dto: UpdateTenantSmsConfigDto) => {
    try {
      await updateTenantSmsConfig(tenantId, configId, dto);
      toast.success('SMS configuration updated successfully');
      setEditSmsModalOpen(false);
      await loadData();
    } catch (error: any) {
      console.error('Failed to update SMS config:', error);
      toast.error(error?.message || 'Failed to update SMS configuration');
      throw error;
    }
  };

  const handleUpdateWhatsAppConfig = async (configId: string, dto: UpdateTenantWhatsAppConfigDto) => {
    try {
      await updateTenantWhatsAppConfig(tenantId, configId, dto);
      toast.success('WhatsApp configuration updated successfully');
      setEditWhatsAppModalOpen(false);
      await loadData();
    } catch (error: any) {
      console.error('Failed to update WhatsApp config:', error);
      toast.error(error?.message || 'Failed to update WhatsApp configuration');
      throw error;
    }
  };

  const handleToggleSmsActive = async (config: TenantSmsConfig) => {
    try {
      await updateTenantSmsConfig(tenantId, config.id, {
        is_active: !config.is_active,
      });
      toast.success(`SMS configuration ${!config.is_active ? 'activated' : 'deactivated'}`);
      await loadData();
    } catch (error: any) {
      console.error('Failed to toggle SMS config:', error);
      toast.error(error?.message || 'Failed to update SMS configuration');
    }
  };

  const handleToggleWhatsAppActive = async (config: TenantWhatsAppConfig) => {
    try {
      await updateTenantWhatsAppConfig(tenantId, config.id, {
        is_active: !config.is_active,
      });
      toast.success(`WhatsApp configuration ${!config.is_active ? 'activated' : 'deactivated'}`);
      await loadData();
    } catch (error: any) {
      console.error('Failed to toggle WhatsApp config:', error);
      toast.error(error?.message || 'Failed to update WhatsApp configuration');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <Building2 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Tenant not found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The tenant you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/admin/communications/twilio/tenant-assistance"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenant List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/admin/communications/twilio/tenant-assistance"
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              {tenant.company_name}
            </h1>
            <p className="mt-1 text-base text-gray-600 dark:text-gray-400">
              {tenant.subdomain}.lead360.app
            </p>
          </div>
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                    <Phone className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Calls</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {metrics.calls?.total || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
                    <MessageSquare className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Messages</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {(metrics.sms?.total || 0) + (metrics.whatsapp?.total || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                    <Activity className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Activity</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {(metrics.calls?.total || 0) + (metrics.sms?.total || 0) + (metrics.whatsapp?.total || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* SMS Configuration */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SMS Configuration</h2>
            <Button onClick={() => setAddSmsModalOpen(true)} className="shadow-md">
              <Plus className="h-4 w-4 mr-2" />
              Add Config
            </Button>
          </div>

          {smsConfigs.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700">
              <CardContent className="py-16 text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No SMS configurations
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Get started by creating your first SMS configuration
                </p>
                <Button onClick={() => setAddSmsModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create SMS Config
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {smsConfigs.map((config) => (
                <TenantConfigCard
                  key={config.id}
                  config={config}
                  type="sms"
                  onTest={() => setTestSmsModalOpen(true)}
                  onEdit={() => handleEditSms(config)}
                  onToggleActive={() => handleToggleSmsActive(config)}
                />
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp Configuration */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">WhatsApp Configuration</h2>
            <Button onClick={() => setAddWhatsAppModalOpen(true)} className="shadow-md">
              <Plus className="h-4 w-4 mr-2" />
              Add Config
            </Button>
          </div>

          {whatsappConfigs.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700">
              <CardContent className="py-16 text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No WhatsApp configurations
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Get started by creating your first WhatsApp configuration
                </p>
                <Button onClick={() => setAddWhatsAppModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create WhatsApp Config
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {whatsappConfigs.map((config) => (
                <TenantConfigCard
                  key={config.id}
                  config={config}
                  type="whatsapp"
                  onTest={() => setTestWhatsAppModalOpen(true)}
                  onEdit={() => handleEditWhatsApp(config)}
                  onToggleActive={() => handleToggleWhatsAppActive(config)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateTenantSmsConfigModal
        open={addSmsModalOpen}
        onClose={() => setAddSmsModalOpen(false)}
        tenantId={tenantId}
        tenantName={tenant.company_name}
        availablePhoneNumbers={phoneNumbers}
        onCreate={handleCreateSmsConfig}
      />

      <CreateTenantWhatsAppConfigModal
        open={addWhatsAppModalOpen}
        onClose={() => setAddWhatsAppModalOpen(false)}
        tenantId={tenantId}
        tenantName={tenant.company_name}
        availablePhoneNumbers={phoneNumbers}
        onCreate={handleCreateWhatsAppConfig}
      />

      <TestTenantConfigModal
        open={testSmsModalOpen}
        onClose={() => setTestSmsModalOpen(false)}
        tenantName={tenant.company_name}
        configType="sms"
        onTest={() => testTenantSmsConfig(tenantId)}
      />

      <TestTenantConfigModal
        open={testWhatsAppModalOpen}
        onClose={() => setTestWhatsAppModalOpen(false)}
        tenantName={tenant.company_name}
        configType="whatsapp"
        onTest={() => testTenantWhatsAppConfig(tenantId)}
      />

      {editingSmsConfig && (
        <EditTenantSmsConfigModal
          open={editSmsModalOpen}
          onClose={() => {
            setEditSmsModalOpen(false);
            setEditingSmsConfig(null);
          }}
          config={editingSmsConfig}
          tenantName={tenant.company_name}
          onUpdate={handleUpdateSmsConfig}
        />
      )}

      {editingWhatsAppConfig && (
        <EditTenantWhatsAppConfigModal
          open={editWhatsAppModalOpen}
          onClose={() => {
            setEditWhatsAppModalOpen(false);
            setEditingWhatsAppConfig(null);
          }}
          config={editingWhatsAppConfig}
          tenantName={tenant.company_name}
          onUpdate={handleUpdateWhatsAppConfig}
        />
      )}

      <SuccessModal
        isOpen={!!successMessage}
        onClose={() => setSuccessMessage(null)}
        title="Success"
        message={successMessage || ''}
      />

      <ErrorModal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        message={errorMessage || ''}
      />
    </div>
  );
}
