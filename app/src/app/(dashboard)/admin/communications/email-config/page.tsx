/**
 * Platform Email Configuration Page (Admin Only)
 * Configure platform-wide email provider for system emails
 * Similar to tenant config but uses platform endpoints
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Save, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  getProviders,
  getPlatformEmailConfig,
  updatePlatformEmailConfig,
  testPlatformEmail,
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
  const [selectedProvider, setSelectedProvider] = useState<CommunicationProvider | null>(null);
  const [existingConfig, setExistingConfig] = useState<PlatformEmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setIsSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Form values
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [providerConfig, setProviderConfig] = useState<Record<string, any>>({});
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch available providers and existing config
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch available providers
        const providersData = await getProviders({ type: 'email', is_active: true });
        setProviders(providersData);

        // Try to fetch existing config
        try {
          const config = await getPlatformEmailConfig();
          setExistingConfig(config);

          // Pre-fill form with existing config
          const provider = providersData.find(p => p.id === config.provider_id);
          if (provider) {
            setSelectedProvider(provider);
            setProviderConfig(config.provider_config || {});
            setFromEmail(config.from_email);
            setFromName(config.from_name);
          }
        } catch (error: any) {
          // 404 means no config exists yet - this is fine
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

    fetchData();
  }, []);

  // Handle provider selection
  const handleProviderChange = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setSelectedProvider(provider);
      setCredentials({});
      setProviderConfig(provider.default_config || {});
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


    // Validate credentials against schema
    if (selectedProvider?.credentials_schema) {
      const required = selectedProvider.credentials_schema.required || [];
      required.forEach(field => {
        if (!credentials[field]) {
          newErrors[`credential_${field}`] = `${field} is required`;
        }
      });
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
      setIsSaving(true);

      const payload = {
        provider_id: selectedProvider!.id,
        credentials,
        provider_config: providerConfig,
        from_email: fromEmail,
        from_name: fromName,
        webhook_secret: webhookSecret || undefined,
      };

      const updatedConfig = await updatePlatformEmailConfig(payload);
      setExistingConfig(updatedConfig);
      setCredentials({}); // Clear credentials after save (security)
      toast.success('Platform email configuration saved successfully');
    } catch (error: any) {
      console.error('Failed to save configuration:', error);
      toast.error(error?.response?.data?.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
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
      await testPlatformEmail({ to: testEmail });
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

  const providerOptions: SelectOption[] = providers.map(p => ({
    value: p.id,
    label: p.provider_name,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Platform Email Configuration
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure the platform-wide email provider for system emails
        </p>
      </div>

      {/* Status Banner */}
      {existingConfig && (
        <div className={`p-4 rounded-lg border ${
          existingConfig.is_verified
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className="flex items-start gap-3">
            {existingConfig.is_verified ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className={`text-sm font-semibold ${
                existingConfig.is_verified
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-yellow-900 dark:text-yellow-100'
              }`}>
                {existingConfig.is_verified ? 'Email Verified' : 'Email Not Verified'}
              </h3>
              <p className={`text-sm mt-1 ${
                existingConfig.is_verified
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-yellow-700 dark:text-yellow-300'
              }`}>
                {existingConfig.is_verified
                  ? 'Platform email configuration is active and verified'
                  : 'Please send a test email to verify the configuration'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
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
        />

        {/* Setup Guide */}
        {selectedProvider && (
          <EmailSetupGuide providerKey={selectedProvider.provider_key} />
        )}

        {/* Provider Credentials */}
        {selectedProvider?.credentials_schema && (
          <div className="space-y-4">
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
          </div>
        )}

        {/* Provider Configuration */}
        {selectedProvider?.config_schema && (
          <div className="space-y-4">
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

          {selectedProvider?.supports_webhooks && (
            <Input
              label="Webhook Secret"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Enter webhook secret (optional)"
              helperText="Secret key for verifying webhook signatures (recommended)"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={() => setShowTestModal(true)}
            variant="secondary"
            disabled={!existingConfig}
          >
            <Send className="h-4 w-4 mr-2" />
            Send Test Email
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
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </div>

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
