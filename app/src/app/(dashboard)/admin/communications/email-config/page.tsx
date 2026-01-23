/**
 * Platform Email Configuration Management (Admin Only)
 * Multi-Provider UI - List, add, edit, activate, delete provider configurations
 * Used for system emails (password resets, user invitations, etc.)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Power, Send, Mail, CheckCircle, AlertCircle, Copy, ExternalLink, Eye, EyeOff } from 'lucide-react';
import {
  getProviders,
  listPlatformConfigs,
  getPlatformConfig,
  createPlatformConfig,
  updatePlatformConfig,
  activatePlatformConfig,
  deletePlatformConfig,
  testPlatformConfig,
} from '@/lib/api/communication';
import type { CommunicationProvider, PlatformEmailConfig } from '@/lib/types/communication';
import { DynamicForm } from '@/components/communication/DynamicForm';
import { EmailSetupGuide } from '@/components/communication/EmailSetupGuide';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';

export default function PlatformEmailConfigPage() {
  const [providers, setProviders] = useState<CommunicationProvider[]>([]);
  const [configurations, setConfigurations] = useState<PlatformEmailConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PlatformEmailConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<CommunicationProvider | null>(null);

  // Form values
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [providerConfig, setProviderConfig] = useState<Record<string, any>>({});
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  // Action states
  const [saving, setSaving] = useState(false);
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

      // Fetch available providers
      const providersData = await getProviders({ type: 'email', is_active: true });
      setProviders(providersData);

      // Fetch all platform configurations
      try {
        const configs = await listPlatformConfigs();
        setConfigurations(configs);
      } catch (error: any) {
        // 404 means no configs exist yet - this is fine
        if (error?.response?.status !== 404) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to load platform email configuration:', error);
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

  // Open modal to edit provider
  const handleEditProvider = async (config: PlatformEmailConfig) => {
    try {
      // Fetch full config with credentials
      const fullConfig = await getPlatformConfig(config.id);
      setEditingConfig(fullConfig);

      const provider = providers.find(p => p.id === fullConfig.provider_id);
      if (provider) {
        setSelectedProvider(provider);
        setCredentials(fullConfig.credentials || {});
        setProviderConfig(fullConfig.provider_config || {});
        setFromEmail(fullConfig.from_email);
        setFromName(fullConfig.from_name);
        setReplyToEmail(fullConfig.reply_to_email || '');
        setWebhookSecret(''); // Don't show webhook secret for security
        setErrors({});
        setShowConfigModal(true);
      }
    } catch (error: any) {
      console.error('Failed to load configuration details:', error);
      toast.error('Failed to load configuration details');
    }
  };

  // Handle provider selection in modal
  const handleProviderChange = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setSelectedProvider(provider);
      if (!editingConfig) {
        setCredentials({});
        setProviderConfig(provider.default_config || {});
      }
      setErrors({});
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

    // Validate credentials against schema (only when creating or if credentials provided on edit)
    if (selectedProvider?.credentials_schema) {
      const required = selectedProvider.credentials_schema.required || [];
      const hasCredentials = Object.keys(credentials).length > 0;

      if (!editingConfig || hasCredentials) {
        required.forEach(field => {
          if (!credentials[field]) {
            newErrors[`credential_${field}`] = `${field} is required`;
          }
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    try {
      setSaving(true);

      const payload: any = {
        provider_id: selectedProvider!.id,
        provider_config: providerConfig,
        from_email: fromEmail,
        from_name: fromName,
      };

      // Only include credentials if they were provided
      if (Object.keys(credentials).length > 0) {
        payload.credentials = credentials;
      }

      if (replyToEmail) {
        payload.reply_to_email = replyToEmail;
      }

      if (webhookSecret) {
        payload.webhook_secret = webhookSecret;
      }

      if (editingConfig) {
        await updatePlatformConfig(editingConfig.id, payload);
        toast.success('Provider updated successfully');
      } else {
        await createPlatformConfig(payload);
        toast.success('Provider added successfully');
      }

      await fetchData();
      setShowConfigModal(false);
    } catch (error: any) {
      console.error('Failed to save configuration:', error);
      toast.error(error?.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Handle activate
  const handleActivate = async (configId: string) => {
    try {
      await activatePlatformConfig(configId);
      toast.success('Provider activated successfully');
      await fetchData();
    } catch (error: any) {
      console.error('Failed to activate provider:', error);
      toast.error(error?.response?.data?.message || 'Failed to activate provider');
    }
  };

  // Handle delete
  const handleDelete = async (config: PlatformEmailConfig) => {
    if (config.is_active) {
      toast.error('Cannot delete active provider. Activate another provider first.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${config.provider?.provider_name}?`)) {
      return;
    }

    try {
      await deletePlatformConfig(config.id);
      toast.success('Provider deleted successfully');
      await fetchData();
    } catch (error: any) {
      console.error('Failed to delete provider:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete provider');
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

    if (!testConfigId) {
      toast.error('No configuration selected');
      return;
    }

    try {
      setTesting(true);
      await testPlatformConfig(testConfigId, { to: testEmail });
      toast.success(`Test email sent to ${testEmail}`);
      setShowTestModal(false);
      setTestEmail('');
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

  const activeConfig = configurations.find(c => c.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Platform Email Configuration
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage email providers for system emails (password resets, user invitations, etc.)
          </p>
        </div>
        <Button onClick={handleAddProvider}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* Active Provider Banner */}
      {activeConfig && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                Active Provider: {activeConfig.provider?.provider_name}
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                All platform system emails are being sent through {activeConfig.from_name} &lt;{activeConfig.from_email}&gt;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Provider Configurations List */}
      {configurations.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Mail className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            No Providers Configured
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Add your first email provider to enable system emails like password resets and notifications.
          </p>
          <Button onClick={handleAddProvider} className="mt-6">
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {configurations.map((config) => (
            <div
              key={config.id}
              className={`bg-white dark:bg-gray-800 border rounded-lg overflow-hidden transition-all ${
                config.is_active
                  ? 'border-green-300 dark:border-green-700 ring-2 ring-green-100 dark:ring-green-900/50'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Provider Card Header */}
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {config.provider?.provider_name}
                        </h3>
                        {config.is_active && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Active
                          </span>
                        )}
                        {config.is_verified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Not Verified
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {config.provider?.provider_type}
                      </p>
                      <div className="flex items-center gap-6 mt-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">From:</span>{' '}
                          <span className="text-gray-900 dark:text-gray-100 font-medium">
                            {config.from_name} &lt;{config.from_email}&gt;
                          </span>
                        </div>
                        {config.reply_to_email && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Reply-To:</span>{' '}
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                              {config.reply_to_email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-shrink-0">
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
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>

                  {!config.is_active && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(config)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Updated: {new Date(config.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium">Platform Email Configuration</p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">
              These providers are used for platform-wide system emails (password resets, user invitations, etc.).
              Only ONE provider can be active at a time. Tenant email configurations are managed separately by each business.
            </p>
          </div>
        </div>
      </div>

      {/* Add/Edit Provider Modal */}
      {showConfigModal && (
        <Modal
          isOpen
          onClose={() => setShowConfigModal(false)}
          title={editingConfig ? 'Edit Provider Configuration' : 'Add Provider Configuration'}
          size="lg"
        >
          <div className="space-y-6">
            {/* Provider Selection */}
            <Select
              label="Email Provider"
              options={providers.map(p => ({ value: p.id, label: p.provider_name }))}
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
              <div className="space-y-4">
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Provider Credentials
                    {editingConfig && (
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                        (leave blank to keep existing)
                      </span>
                    )}
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
              </div>
            )}

            {/* Provider Configuration */}
            {selectedProvider?.config_schema && (
              <div className="space-y-4">
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Provider Settings
                  </h3>
                  <DynamicForm
                    schema={selectedProvider.config_schema}
                    values={providerConfig}
                    onChange={setProviderConfig}
                  />
                </div>
              </div>
            )}

            {/* Email Settings */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Email Settings
              </h3>

              <Input
                label="From Email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@lead360.app"
                required
                error={errors.from_email}
                helperText="Email address for platform system emails"
              />

              <Input
                label="From Name"
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Lead360 Platform"
                required
                error={errors.from_name}
                helperText="Name that will appear alongside the email address"
              />

              <Input
                label="Reply-To Email (Optional)"
                type="email"
                value={replyToEmail}
                onChange={(e) => setReplyToEmail(e.target.value)}
                placeholder="support@lead360.app"
                helperText="Email address for user replies"
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
                              https://api.lead360.app/api/v1/webhooks/communication/{selectedProvider.provider_key}
                            </code>
                            <button
                              onClick={() => {
                                const webhookUrl = `https://api.lead360.app/api/v1/webhooks/communication/${selectedProvider.provider_key}`;
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
                            {selectedProvider.provider_key === 'sendgrid' ? (
                              <ol className="mt-2 text-xs text-blue-700 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
                                <li>Enter a webhook secret above (optional but recommended)</li>
                                <li>Click "Save" to save your settings</li>
                                <li>Copy the Webhook URL</li>
                                <li>Log in to <a href="https://app.sendgrid.com" target="_blank" rel="noopener noreferrer" className="underline">SendGrid Dashboard</a></li>
                                <li>Go to Settings → Mail Settings → Event Webhook</li>
                                <li>Paste the Webhook URL as the HTTP POST URL</li>
                                <li>Select the events you want to track (Delivered, Opened, Clicked, etc.)</li>
                                <li>Save the webhook configuration</li>
                              </ol>
                            ) : selectedProvider.provider_key === 'amazon_ses' || selectedProvider.provider_key === 'ses' ? (
                              <ol className="mt-2 text-xs text-blue-700 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
                                <li>Click "Save" to save your settings</li>
                                <li>Copy the Webhook URL</li>
                                <li>Log in to <a href="https://console.aws.amazon.com/sns" target="_blank" rel="noopener noreferrer" className="underline">AWS SNS Console</a></li>
                                <li>Create a new SNS Topic for SES events</li>
                                <li>Create an HTTPS subscription with the webhook URL</li>
                                <li>In SES, configure SNS notifications for Bounces, Complaints, and Deliveries</li>
                                <li>The webhook will automatically verify the SNS signature</li>
                              </ol>
                            ) : selectedProvider.provider_key === 'brevo' ? (
                              <ol className="mt-2 text-xs text-blue-700 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
                                <li>Enter a webhook secret above</li>
                                <li>Click "Save" to save your settings</li>
                                <li>Copy the Webhook URL and Secret</li>
                                <li>Log in to <a href="https://app.brevo.com" target="_blank" rel="noopener noreferrer" className="underline">Brevo Dashboard</a></li>
                                <li>Go to Settings → Webhooks → Add a new webhook</li>
                                <li>Select "Transactional" webhook type</li>
                                <li>Paste the Webhook URL</li>
                                <li>Under "Authentication", add header: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">X-Brevo-Secret</code> with your webhook secret</li>
                                <li>Select events (delivered, bounced, opened, clicked) and save</li>
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

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button onClick={() => setShowConfigModal(false)} variant="secondary">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingConfig ? 'Update Provider' : 'Add Provider'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Test Email Modal */}
      {showTestModal && (
        <Modal
          isOpen
          onClose={() => setShowTestModal(false)}
          title="Send Test Email"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Send a test email to verify your platform configuration is working correctly.
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
              <Button onClick={() => setShowTestModal(false)} variant="secondary">
                Cancel
              </Button>
              <Button onClick={handleTestEmail} disabled={testing}>
                {testing ? 'Sending...' : 'Send Test'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
