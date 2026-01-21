/**
 * Email Provider Configuration Management
 * Multi-Provider UI - List, add, edit, activate, delete provider configurations
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Save, Send, CheckCircle, AlertCircle, Loader2, Copy, ExternalLink, Eye, EyeOff, Plus, Edit2, Trash2, Power } from 'lucide-react';
import {
  getAvailableProviders,
  listProviderConfigs,
  getProviderConfig,
  createProviderConfig,
  updateProviderConfig,
  activateProviderConfig,
  deleteProviderConfig,
  testTenantEmail,
} from '@/lib/api/communication';
import { getCurrentTenant } from '@/lib/api/tenant';
import type { CommunicationProvider, TenantEmailConfig } from '@/lib/types/communication';
import { DynamicForm } from '@/components/communication/DynamicForm';
import { EmailSetupGuide } from '@/components/communication/EmailSetupGuide';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';

export default function EmailConfigurationPage() {
  const [providers, setProviders] = useState<CommunicationProvider[]>([]);
  const [configurations, setConfigurations] = useState<TenantEmailConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantDomain, setTenantDomain] = useState<string>('');

  // Modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TenantEmailConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<CommunicationProvider | null>(null);

  // Form values
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [providerConfig, setProviderConfig] = useState<Record<string, any>>({});
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  // Action states
  const [saving, setIsSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testConfigId, setTestConfigId] = useState<string | null>(null);

  // Visibility toggles
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch tenant profile to get subdomain for webhook URL
      const tenant = await getCurrentTenant();
      setTenantDomain(`${tenant.subdomain}.lead360.app`);

      // Fetch available providers
      const providersData = await getAvailableProviders({ type: 'email' });
      setProviders(providersData);

      // Fetch all provider configurations
      try {
        const configs = await listProviderConfigs();
        setConfigurations(configs);
      } catch (error: any) {
        // 404 means no configs exist yet - this is fine
        if (error?.response?.status !== 404) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to load email configuration:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  // Open modal to add new provider
  const handleAddProvider = () => {
    setEditingConfig(null);
    setSelectedProvider(null);
    setCredentials({});
    setProviderConfig({});
    setFromEmail('');
    setFromName('');
    setReplyToEmail('');
    setWebhookSecret('');
    setErrors({});
    setShowConfigModal(true);
  };

  // Open modal to edit existing provider
  const handleEditProvider = async (config: TenantEmailConfig) => {
    try {
      // Fetch full config with decrypted credentials
      const fullConfig = await getProviderConfig(config.id);

      setEditingConfig(fullConfig);
      const provider = providers.find(p => p.id === fullConfig.provider_id);
      if (provider) {
        setSelectedProvider(provider);
        setCredentials(fullConfig.credentials || {});
        setProviderConfig(fullConfig.provider_config || {});
        setFromEmail(fullConfig.from_email);
        setFromName(fullConfig.from_name);
        setReplyToEmail(fullConfig.reply_to_email || '');
        setWebhookSecret(fullConfig.webhook_secret || '');
        setErrors({});
        setShowConfigModal(true);
      }
    } catch (error) {
      console.error('Failed to load provider configuration:', error);
      toast.error('Failed to load provider configuration');
    }
  };

  // Handle provider selection in modal
  const handleProviderChange = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setSelectedProvider(provider);
      setErrors({});

      // Reset form to defaults when changing provider
      if (!editingConfig || editingConfig.provider_id !== providerId) {
        setCredentials({});
        setProviderConfig(provider.default_config || {});
        setWebhookSecret('');
      }
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedProvider) {
      newErrors.provider = 'Please select a provider';
    }

    if (!fromEmail) {
      newErrors.from_email = 'From email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      newErrors.from_email = 'Invalid email format';
    }

    if (!fromName) {
      newErrors.from_name = 'From name is required';
    }

    if (replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToEmail)) {
      newErrors.reply_to_email = 'Invalid email format';
    }

    // Validate credentials against schema
    if (selectedProvider?.credentials_schema) {
      const required = selectedProvider.credentials_schema.required || [];
      required.forEach(field => {
        const value = credentials[field];
        if (!value) {
          newErrors[`credential_${field}`] = `${field} is required`;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save (create or update)
  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    try {
      setIsSaving(true);

      const payload: any = {
        provider_id: selectedProvider!.id,
        credentials: credentials,
        provider_config: providerConfig,
        from_email: fromEmail,
        from_name: fromName,
      };

      if (replyToEmail) {
        payload.reply_to_email = replyToEmail;
      }

      if (webhookSecret) {
        payload.webhook_secret = webhookSecret;
      }

      if (editingConfig) {
        // Update existing config
        await updateProviderConfig(editingConfig.id, payload);
        toast.success('Configuration updated successfully');
      } else {
        // Create new config
        await createProviderConfig(payload);
        toast.success('Configuration created successfully');
      }

      // Refresh list
      await fetchData();
      setShowConfigModal(false);
    } catch (error: any) {
      console.error('Failed to save configuration:', error);
      toast.error(error?.response?.data?.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Activate provider configuration
  const handleActivate = async (configId: string) => {
    try {
      await activateProviderConfig(configId);
      toast.success('Provider activated successfully');
      await fetchData();
    } catch (error: any) {
      console.error('Failed to activate provider:', error);
      toast.error(error?.response?.data?.message || 'Failed to activate provider');
    }
  };

  // Delete provider configuration
  const handleDelete = async (config: TenantEmailConfig) => {
    if (config.is_active) {
      toast.error('Cannot delete active provider. Activate another provider first.');
      return;
    }

    if (!confirm(`Delete ${config.provider.provider_name} configuration?`)) {
      return;
    }

    try {
      await deleteProviderConfig(config.id);
      toast.success('Configuration deleted successfully');
      await fetchData();
    } catch (error: any) {
      console.error('Failed to delete configuration:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete configuration');
    }
  };

  // Handle test email
  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      toast.error('Invalid email format');
      return;
    }

    try {
      setTesting(true);
      await testTenantEmail({ to: testEmail });
      toast.success(`Test email sent to ${testEmail}`);
      setShowTestModal(false);
      setTestEmail('');
      setTestConfigId(null);
    } catch (error: any) {
      console.error('Failed to send test email:', error);
      toast.error(error?.response?.data?.message || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const providerOptions: SelectOption[] = providers.map(p => ({
    value: p.id,
    label: p.provider_name,
  }));

  const activeConfig = configurations.find(c => c.is_active);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Email Providers
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your email provider configurations
          </p>
        </div>
        <Button onClick={handleAddProvider}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* Provider List */}
      {configurations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Email Providers Configured
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Add your first email provider to start sending communications
          </p>
          <Button onClick={handleAddProvider}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {configurations.map((config) => (
            <div
              key={config.id}
              className={`bg-white dark:bg-gray-800 border-2 rounded-lg p-6 ${
                config.is_active
                  ? 'border-green-500 dark:border-green-600'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Active Indicator */}
                  <div className="flex-shrink-0 mt-1">
                    {config.is_active ? (
                      <div className="h-3 w-3 rounded-full bg-green-500 dark:bg-green-600" title="Active provider" />
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-gray-300 dark:bg-gray-600" title="Inactive provider" />
                    )}
                  </div>

                  {/* Provider Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {config.provider.provider_name}
                      </h3>
                      {config.is_active && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          Active
                        </span>
                      )}
                      {config.is_verified && (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                    </div>

                    <div className="space-y-1 text-sm">
                      <p className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">From:</span> {config.from_name} &lt;{config.from_email}&gt;
                      </p>
                      {config.reply_to_email && (
                        <p className="text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Reply-To:</span> {config.reply_to_email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  {config.is_active && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setTestConfigId(config.id);
                        setShowTestModal(true);
                      }}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                  )}

                  {!config.is_active && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleActivate(config.id)}
                    >
                      <Power className="h-4 w-4 mr-1" />
                      Activate
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEditProvider(config)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>

                  {!config.is_active && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDelete(config)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
        <Modal
          isOpen
          onClose={() => setShowConfigModal(false)}
          title={editingConfig ? 'Edit Provider Configuration' : 'Add Provider Configuration'}
          size="xl"
        >
          <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
            {/* Provider Selection */}
            <Select
              label="Email Provider"
              options={providerOptions}
              value={selectedProvider?.id || ''}
              onChange={handleProviderChange}
              placeholder="Select an email provider"
              required
              error={errors.provider}
              helperText="Choose your email service provider"
              disabled={!!editingConfig}
            />

            {/* Setup Guide */}
            {selectedProvider && (
              <EmailSetupGuide providerKey={selectedProvider.provider_key} />
            )}

            {/* Provider Credentials */}
            {selectedProvider?.credentials_schema && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Provider Credentials
                </h3>
                <DynamicForm
                  schema={selectedProvider.credentials_schema}
                  values={credentials}
                  onChange={setCredentials}
                  errors={Object.keys(errors)
                    .filter(k => k.startsWith('credential_'))
                    .reduce((acc, k) => ({ ...acc, [k.replace('credential_', '')]: errors[k] }), {})}
                />
              </div>
            )}

            {/* Provider Configuration */}
            {selectedProvider?.config_schema && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Provider Settings
                </h3>
                <DynamicForm
                  schema={selectedProvider.config_schema}
                  values={providerConfig}
                  onChange={setProviderConfig}
                />
              </div>
            )}

            {/* Email Settings */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Email Settings
              </h3>

              <Input
                label="From Email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@yourdomain.com"
                required
                error={errors.from_email}
                helperText="Email address that will appear in the 'From' field"
              />

              <Input
                label="From Name"
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Company Name"
                required
                error={errors.from_name}
                helperText="Name that will appear alongside the email address"
              />

              <Input
                label="Reply-To Email"
                type="email"
                value={replyToEmail}
                onChange={(e) => setReplyToEmail(e.target.value)}
                placeholder="support@yourdomain.com (optional)"
                error={errors.reply_to_email}
                helperText="Email address for replies (optional)"
              />

              {selectedProvider?.supports_webhooks && (
                <>
                  <div className="relative">
                    <Input
                      label="Webhook Secret"
                      type={showWebhookSecret ? "text" : "password"}
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                      placeholder="Enter webhook secret (optional)"
                      helperText="Secret key for verifying webhook signatures (recommended)"
                    />
                    {webhookSecret && (
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                        title={showWebhookSecret ? "Hide secret" : "Show secret"}
                      >
                        {showWebhookSecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Webhook URL Display */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <ExternalLink className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          Webhook Configuration
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                          Configure this webhook URL in your {selectedProvider.provider_name} account to receive email event notifications.
                        </p>

                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-blue-900 dark:text-blue-100">
                            Webhook URL:
                          </label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded px-3 py-2 text-blue-900 dark:text-blue-100 font-mono overflow-x-auto">
                              {tenantDomain
                                ? `https://${tenantDomain}/api/v1/webhooks/communication/${selectedProvider.provider_key}`
                                : 'Loading...'}
                            </code>
                            <button
                              onClick={() => {
                                if (!tenantDomain) return;
                                const webhookUrl = `https://${tenantDomain}/api/v1/webhooks/communication/${selectedProvider.provider_key}`;
                                navigator.clipboard.writeText(webhookUrl);
                                toast.success('Webhook URL copied!');
                              }}
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded"
                              title="Copy to clipboard"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>

                          {webhookSecret && (
                            <>
                              <label className="block text-xs font-medium text-blue-900 dark:text-blue-100 mt-3">
                                Webhook Secret:
                              </label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded px-3 py-2 text-blue-900 dark:text-blue-100 font-mono overflow-x-auto">
                                  {webhookSecret}
                                </code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(webhookSecret);
                                    toast.success('Webhook secret copied!');
                                  }}
                                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded"
                                  title="Copy to clipboard"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </>
                          )}

                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              <strong>Setup Instructions for {selectedProvider.provider_name}:</strong>
                            </p>
                            {selectedProvider.provider_key === 'brevo' ? (
                              <ol className="mt-2 text-xs text-blue-700 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
                                <li>Enter a webhook secret above</li>
                                <li>Click "Save" to save your settings</li>
                                <li>Copy the Webhook URL and Secret</li>
                                <li>Log in to <a href="https://app.brevo.com" target="_blank" rel="noopener noreferrer" className="underline">app.brevo.com</a></li>
                                <li>Go to Settings → Webhooks → Add a new webhook</li>
                                <li><strong>Select "Inbound webhook"</strong> (NOT Transactional)</li>
                                <li>Paste the Webhook URL</li>
                                <li>Under "Authentication", add header: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">x-sib-signature</code> with your webhook secret</li>
                                <li>Select events and save</li>
                              </ol>
                            ) : (
                              <ol className="mt-2 text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                                <li>Enter a webhook secret above</li>
                                <li>Save and copy the URL and secret</li>
                                <li>Configure in your {selectedProvider.provider_name} account</li>
                              </ol>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button onClick={() => setShowConfigModal(false)} variant="secondary">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingConfig ? 'Update' : 'Create'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Test Email Modal */}
      {showTestModal && (
        <Modal
          isOpen
          onClose={() => {
            setShowTestModal(false);
            setTestConfigId(null);
          }}
          title="Send Test Email"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Send a test email using the {activeConfig ? activeConfig.provider.provider_name : 'active'} configuration.
            </p>

            <Input
              label="Test Email Address"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your-email@example.com"
              required
            />

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button onClick={() => {
                setShowTestModal(false);
                setTestConfigId(null);
              }} variant="secondary">
                Cancel
              </Button>
              <Button onClick={handleTestEmail} disabled={testing}>
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
