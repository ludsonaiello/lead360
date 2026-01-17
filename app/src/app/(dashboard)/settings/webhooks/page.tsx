/**
 * Webhook Settings Page
 * Manage webhook API keys for lead capture
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Copy, Loader2, Key, Globe, Check, AlertTriangle, ChevronDown, ChevronUp, Eye, Power } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  getWebhookKeys,
  createWebhookKey,
  toggleWebhookKey,
} from '@/lib/api/leads';
import type { WebhookApiKey, CreateWebhookKeyResponse } from '@/lib/types/leads';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';

export default function WebhookSettingsPage() {
  const { canPerform } = useRBAC();

  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiKeys, setApiKeys] = useState<WebhookApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<CreateWebhookKeyResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showUsageAccordion, setShowUsageAccordion] = useState(true);
  const [activeTab, setActiveTab] = useState<'html' | 'php' | 'json' | 'thirdparty'>('html');
  const [showKeyWarningModal, setShowKeyWarningModal] = useState(false);
  const [selectedKeyName, setSelectedKeyName] = useState('');
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [keyToToggle, setKeyToToggle] = useState<{ id: string; name: string; isActive: boolean } | null>(null);

  const canEdit = canPerform('leads', 'edit');

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const data = await getWebhookKeys();

      // DEBUG: Log the API response to see what we're getting
      console.log('Webhook API Response:', data);
      console.log('Webhook URL from API:', data.webhook_url);

      // Backend provides the webhook_url with correct tenant subdomain
      // NEVER extract subdomain from window.location (it's always "app" when logged in)
      setWebhookUrl(data.webhook_url || '');
      setApiKeys(data.api_keys);
    } catch (error: any) {
      console.error('Failed to load webhook keys:', error);
      toast.error(error.message || 'Failed to load webhook keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }

    try {
      setCreating(true);
      const result = await createWebhookKey(newKeyName.trim());
      setCreatedKey(result);
      setShowCreateModal(false);
      setShowApiKeyModal(true);
      setNewKeyName('');
      await loadKeys();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleKeyClick = (id: string, name: string, isActive: boolean) => {
    setKeyToToggle({ id, name, isActive });
    setShowToggleModal(true);
  };

  const handleConfirmToggle = async () => {
    if (!keyToToggle) return;

    const action = keyToToggle.isActive ? 'deactivate' : 'activate';

    try {
      await toggleWebhookKey(keyToToggle.id);
      toast.success(`API key ${action}d successfully`);
      await loadKeys();
      setShowToggleModal(false);
      setKeyToToggle(null);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} API key`);
    }
  };

  const copyToClipboard = async (text: string, type: 'url' | 'key') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'url') {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      }
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleShowKey = (keyName: string) => {
    setSelectedKeyName(keyName);
    setShowKeyWarningModal(true);
  };

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to manage webhook settings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Webhook Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage API keys for capturing leads via webhook
        </p>
      </div>

      {/* Webhook URL */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-blue-600 dark:text-blue-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Webhook URL</h2>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Use this URL to send lead data to your tenant. Include the API key in the request headers.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={webhookUrl}
            readOnly
            className="flex-1 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100
              font-mono text-sm"
          />
          <Button
            onClick={() => copyToClipboard(webhookUrl, 'url')}
            variant="ghost"
          >
            {copiedUrl ? (
              <>
                <Check className="w-5 h-5 text-green-600 dark:text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Required Header:</strong>{' '}
            <code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">
              x-api-key: YOUR_API_KEY
            </code>
          </p>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">API Keys</h2>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-5 h-5" />
            Create API Key
          </Button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No API keys created yet</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-5 h-5" />
              Create First API Key
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Key Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {key.key_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {key.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {key.created_by?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {key.created_by?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {key.last_used_at
                          ? format(new Date(key.last_used_at), 'MMM d, yyyy HH:mm')
                          : 'Never'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(key.created_at), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Show Key Button */}
                        <button
                          onClick={() => handleShowKey(key.key_name)}
                          className="p-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="View key information"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Active/Inactive Toggle */}
                        <button
                          onClick={() => handleToggleKeyClick(key.id, key.key_name, key.is_active)}
                          className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                            ${key.is_active
                              ? 'bg-green-600 dark:bg-green-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                            }
                          `}
                          title={key.is_active ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                        >
                          <span
                            className={`
                              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                              ${key.is_active ? 'translate-x-6' : 'translate-x-1'}
                            `}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage Instructions - Accordion */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
        {/* Accordion Header */}
        <button
          onClick={() => setShowUsageAccordion(!showUsageAccordion)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            How to Use the Webhook
          </h2>
          {showUsageAccordion ? (
            <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>

        {/* Accordion Content */}
        {showUsageAccordion && (
          <div className="px-6 pb-6 space-y-4">
            {/* Tabs */}
            <div className="flex gap-2 border-b-2 border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('html')}
                className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-0.5 ${
                  activeTab === 'html'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                HTML
              </button>
              <button
                onClick={() => setActiveTab('php')}
                className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-0.5 ${
                  activeTab === 'php'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                PHP
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-0.5 ${
                  activeTab === 'json'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                JSON Format
              </button>
              <button
                onClick={() => setActiveTab('thirdparty')}
                className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-0.5 ${
                  activeTab === 'thirdparty'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Third-Party
              </button>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
              {/* HTML Tab */}
              {activeTab === 'html' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    HTML Form Integration
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    For simple HTML forms, you'll need a server-side script to add the API key header. Here's an example:
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
{`<!-- HTML Form -->
<form id="leadForm">
  <input type="text" name="first_name" placeholder="First Name" required>
  <input type="text" name="last_name" placeholder="Last Name" required>
  <input type="email" name="email" placeholder="Email" required>
  <input type="tel" name="phone" placeholder="Phone" required>
  <input type="text" name="address_line1" placeholder="Address">
  <input type="text" name="city" placeholder="City">
  <input type="text" name="state" placeholder="State">
  <input type="text" name="zip_code" placeholder="Zip Code">
  <button type="submit">Submit</button>
</form>

<script>
document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const data = {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address_line1: formData.get('address_line1'),
    city: formData.get('city'),
    state: formData.get('state'),
    zip_code: formData.get('zip_code')
  };

  const response = await fetch('${webhookUrl}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'YOUR_API_KEY_HERE'
    },
    body: JSON.stringify(data)
  });

  if (response.ok) {
    alert('Lead submitted successfully!');
    e.target.reset();
  } else {
    alert('Error submitting lead');
  }
});
</script>`}
                    </pre>
                  </div>
                </div>
              )}

              {/* PHP Tab */}
              {activeTab === 'php' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    PHP Server-Side Example
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Process form submissions and forward to the webhook:
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
{`<?php
// webhook.php - Form handler
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'first_name' => $_POST['first_name'],
        'last_name' => $_POST['last_name'],
        'email' => $_POST['email'],
        'phone' => $_POST['phone'],
        'address_line1' => $_POST['address_line1'] ?? null,
        'city' => $_POST['city'] ?? null,
        'state' => $_POST['state'] ?? null,
        'zip_code' => $_POST['zip_code'] ?? null
    ];

    $ch = curl_init('${webhookUrl}');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: YOUR_API_KEY_HERE'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 || $httpCode === 201) {
        echo "Success!";
    } else {
        echo "Error: " . $response;
    }
}
?>`}
                    </pre>
                  </div>
                </div>
              )}

              {/* JSON Tab */}
              {activeTab === 'json' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    JSON Payload Format
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    The webhook accepts JSON data in this format:
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-800 dark:text-gray-200">
{`{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "5551234567",
  "address_line1": "123 Main St",
  "city": "Boston",
  "state": "MA",
  "zip_code": "02101"
}`}
                    </pre>
                  </div>
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                      <strong>Note:</strong> The webhook is flexible and accepts various field formats:
                    </p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 ml-4 list-disc space-y-1">
                      <li>Name can be sent as <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">name</code>, <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">full_name</code>, or <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">first_name</code> + <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">last_name</code></li>
                      <li>Phone formatting is automatic (accepts any format, stores digits only)</li>
                      <li>Email and phone can be single fields or arrays</li>
                      <li>Address geocoding is handled automatically if coordinates are missing</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Third-Party Tab */}
              {activeTab === 'thirdparty' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Third-Party Form Builders
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Most form builders (Typeform, Google Forms, Jotform, etc.) support webhook integrations. Configure them with:
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[100px]">Webhook URL:</span>
                        <code className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-xs flex-1 break-all">
                          {webhookUrl}
                        </code>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[100px]">Method:</span>
                        <code className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">POST</code>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[100px]">Content-Type:</span>
                        <code className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">application/json</code>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[100px]">Custom Header:</span>
                        <code className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">x-api-key: YOUR_API_KEY</code>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Security Notice - Always Visible Below Tabs */}
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300 font-semibold mb-2">
                Security Best Practices
              </p>
              <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 ml-4 list-disc">
                <li>Never expose your API key in client-side code (HTML/JavaScript visible to users)</li>
                <li>Always send the API key from your server or use server-side form processing</li>
                <li>Use environment variables to store API keys, never hardcode them</li>
                <li>Rotate API keys periodically and deactivate unused keys</li>
                <li>Monitor the "Last Used" column to detect unauthorized access</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Create API Key Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create API Key"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Key Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Website Form, CRM Integration"
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                placeholder:text-gray-400 dark:placeholder:text-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Choose a descriptive name to identify where this key will be used
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={creating || !newKeyName.trim()}>
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Key'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Show API Key Modal (ONLY SHOWN ONCE) */}
      {createdKey && (
        <Modal
          isOpen={showApiKeyModal}
          onClose={() => {
            setShowApiKeyModal(false);
            setCreatedKey(null);
          }}
          title="API Key Created"
        >
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                    Save this API key now!
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    This is the only time you'll see this key. Make sure to copy and save it securely.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Key Name
              </label>
              <p className="text-gray-900 dark:text-gray-100">{createdKey.key_name}</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={createdKey.api_key}
                  readOnly
                  className="flex-1 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                    bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100
                    font-mono text-sm"
                />
                <Button
                  onClick={() => copyToClipboard(createdKey.api_key, 'key')}
                  variant="ghost"
                >
                  {copiedKey ? (
                    <>
                      <Check className="w-5 h-5 text-green-600 dark:text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Webhook URL
              </label>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">
                {createdKey.webhook_url}
              </p>
            </div>

            <Button
              onClick={() => {
                setShowApiKeyModal(false);
                setCreatedKey(null);
              }}
              className="w-full"
            >
              I've Saved the Key
            </Button>
          </div>
        </Modal>
      )}

      {/* Key Not Retrievable Warning Modal */}
      <Modal
        isOpen={showKeyWarningModal}
        onClose={() => setShowKeyWarningModal(false)}
        title="API Key Cannot Be Retrieved"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex gap-2">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                  Security Notice
                </p>
                <p className="text-sm text-red-700 dark:text-red-400">
                  For security reasons, API keys are encrypted and <strong>cannot be retrieved</strong> after creation.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <p>
              The API key for <strong>"{selectedKeyName}"</strong> was shown only once when it was created.
            </p>

            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="font-semibold mb-2 text-gray-900 dark:text-gray-100">If you've lost the key:</p>
              <ol className="list-decimal ml-5 space-y-1 text-sm">
                <li>Create a new API key with a different name</li>
                <li>Update your integrations with the new key</li>
                <li>Deactivate or delete this old key</li>
              </ol>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="font-semibold mb-1 text-blue-800 dark:text-blue-300">Best Practices:</p>
              <ul className="list-disc ml-5 space-y-1 text-sm text-blue-700 dark:text-blue-400">
                <li>Store API keys in a secure password manager</li>
                <li>Use environment variables in your code</li>
                <li>Never hardcode keys in your source code</li>
                <li>Rotate keys periodically for security</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setShowKeyWarningModal(false);
                setShowCreateModal(true);
              }}
              className="flex-1"
            >
              Create New Key
            </Button>
            <Button
              onClick={() => setShowKeyWarningModal(false)}
              variant="ghost"
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toggle Key Confirmation Modal */}
      {keyToToggle && (
        <Modal
          isOpen={showToggleModal}
          onClose={() => {
            setShowToggleModal(false);
            setKeyToToggle(null);
          }}
          title={keyToToggle.isActive ? 'Deactivate API Key' : 'Activate API Key'}
        >
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${
              keyToToggle.isActive
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            }`}>
              <p className={`text-sm font-semibold ${
                keyToToggle.isActive
                  ? 'text-yellow-800 dark:text-yellow-300'
                  : 'text-green-800 dark:text-green-300'
              }`}>
                {keyToToggle.isActive
                  ? 'This will deactivate the API key and prevent it from authenticating webhook requests.'
                  : 'This will activate the API key and allow it to authenticate webhook requests.'
                }
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Key Name:</strong> {keyToToggle.name}
              </p>
              {keyToToggle.isActive && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Any webhooks using this key will stop working immediately.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleConfirmToggle}
                variant={keyToToggle.isActive ? 'danger' : 'primary'}
                className="flex-1"
              >
                {keyToToggle.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                onClick={() => {
                  setShowToggleModal(false);
                  setKeyToToggle(null);
                }}
                variant="ghost"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
