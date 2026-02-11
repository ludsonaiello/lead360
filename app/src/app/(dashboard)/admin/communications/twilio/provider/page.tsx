/**
 * Provider Settings Page
 * Manage Twilio system provider configuration
 * Sprint 1: Provider Management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Phone, CheckCircle, XCircle, Wifi } from 'lucide-react';
import {
  getSystemProvider,
  testSystemProvider,
  getOwnedPhoneNumbers,
} from '@/lib/api/twilio-admin';
import { getUserFriendlyError } from '@/lib/utils/errors';
import { ProviderCard } from '@/components/admin/twilio/ProviderCard';
import { RegisterProviderModal } from '@/components/admin/twilio/RegisterProviderModal';
import { UpdateProviderModal } from '@/components/admin/twilio/UpdateProviderModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { Badge } from '@/components/ui/Badge';
import type { SystemProvider, SystemProviderConfigured, ConnectivityTestResult, OwnedPhoneNumber } from '@/lib/types/twilio-admin';

export default function ProviderSettingsPage() {
  const [provider, setProvider] = useState<SystemProviderConfigured | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectivityTestResult | null>(null);
  const [ownedNumbers, setOwnedNumbers] = useState<OwnedPhoneNumber[]>([]);
  const [loadingOwnedNumbers, setLoadingOwnedNumbers] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch provider on mount
  useEffect(() => {
    fetchProvider();
  }, []);

  // Fetch owned phone numbers when provider is configured
  useEffect(() => {
    if (provider) {
      fetchOwnedNumbers();
    }
  }, [provider]);

  // Fetch provider
  const fetchProvider = async () => {
    try {
      setLoading(true);
      const data = await getSystemProvider();
      // Check if provider is configured
      if (data && 'configured' in data && data.configured === true) {
        setProvider(data);
      } else {
        setProvider(null);
      }
    } catch (error: any) {
      // Handle errors gracefully
      setProvider(null);
      const message = getUserFriendlyError(error);
      // Only show error modal for non-404 errors
      if (error?.status !== 404 && error?.response?.status !== 404) {
        setErrorMessage(message);
        setErrorModalOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle test connectivity
  const handleTestConnectivity = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await testSystemProvider();
      setTestResult(result);
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
    } finally {
      setTesting(false);
    }
  };

  // Handle provider registered
  const handleProviderRegistered = (newProvider: SystemProvider) => {
    // Convert SystemProvider to SystemProviderConfigured
    const configuredProvider: SystemProviderConfigured = {
      ...newProvider,
      configured: true,
      model_b_tenant_count: 0, // Will be updated on next fetch
    };
    setProvider(configuredProvider);
    setShowRegisterModal(false);
  };

  // Handle provider updated
  const handleProviderUpdated = () => {
    fetchProvider();
    setShowUpdateModal(false);
  };

  // Fetch owned phone numbers
  const fetchOwnedNumbers = async () => {
    setLoadingOwnedNumbers(true);

    try {
      const numbers = await getOwnedPhoneNumbers();
      setOwnedNumbers(numbers || []);
    } catch (error) {
      const message = getUserFriendlyError(error);
      setErrorMessage(message);
      setErrorModalOpen(true);
      setOwnedNumbers([]); // Reset to empty array on error
    } finally {
      setLoadingOwnedNumbers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Twilio Provider Settings
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure and manage your Twilio system provider
        </p>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Provider Status */}
          {provider ? (
            <ProviderCard
              provider={provider}
              onUpdate={() => setShowUpdateModal(true)}
              onTest={handleTestConnectivity}
              testing={testing}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <div className="max-w-md mx-auto">
                <Phone className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  No Provider Configured
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Register your Twilio account to enable SMS and voice communication features.
                </p>
                <Button
                  onClick={() => setShowRegisterModal(true)}
                  variant="primary"
                  className="mt-6"
                >
                  Register Provider
                </Button>
              </div>
            </div>
          )}

          {/* Test Results */}
          {testResult && (
            <div
              className={`p-4 rounded-lg border ${
                testResult.status === 'HEALTHY'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : testResult.status === 'DEGRADED'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.status === 'HEALTHY' ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : testResult.status === 'DEGRADED' ? (
                  <Wifi className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Connectivity Test: {testResult.status}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {testResult.message}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>Response Time: {testResult.response_time_ms}ms</span>
                    <span>Tested: {new Date(testResult.tested_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Owned Phone Numbers Section */}
          {provider && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Owned Phone Numbers
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Phone numbers currently in your Twilio account
                  </p>
                </div>
                <Button
                  onClick={fetchOwnedNumbers}
                  variant="secondary"
                  disabled={loadingOwnedNumbers}
                  size="sm"
                >
                  {loadingOwnedNumbers ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>

              {/* Numbers List */}
              {loadingOwnedNumbers ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : ownedNumbers.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {ownedNumbers.map((number) => (
                    <div
                      key={number.sid}
                      className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      {/* Phone Number Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-mono font-bold text-xl text-gray-900 dark:text-gray-100">
                            {number.phone_number}
                          </p>
                          {number.friendly_name !== number.phone_number && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {number.friendly_name}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            SID: {number.sid}
                          </p>
                        </div>
                        <Badge variant={number.status === 'allocated' ? 'warning' : 'success'}>
                          {number.status === 'allocated' ? 'Allocated' : 'Available'}
                        </Badge>
                      </div>

                      {/* Capabilities */}
                      <div className="flex gap-2 mb-3">
                        {number.capabilities.voice && (
                          <Badge variant="neutral">Voice</Badge>
                        )}
                        {number.capabilities.sms && (
                          <Badge variant="neutral">SMS</Badge>
                        )}
                        {number.capabilities.mms && (
                          <Badge variant="neutral">MMS</Badge>
                        )}
                      </div>

                      {/* Allocation Info */}
                      {number.status === 'allocated' && number.allocated_to_tenant && (
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            Allocated To
                          </p>
                          <div className="bg-white dark:bg-gray-800 rounded p-3">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {number.allocated_to_tenant.company_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Subdomain: {number.allocated_to_tenant.subdomain}
                            </p>
                            {number.allocated_for && number.allocated_for.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {number.allocated_for.map((service) => (
                                  <Badge key={service} variant="info">
                                    {service}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Timestamps */}
                      <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>Created: {new Date(number.date_created).toLocaleDateString()}</span>
                        <span>Updated: {new Date(number.date_updated).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Phone className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No phone numbers found in your Twilio account
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Purchase phone numbers from the Twilio console
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <RegisterProviderModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={handleProviderRegistered}
      />

      <UpdateProviderModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onSuccess={handleProviderUpdated}
      />

      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        message={errorMessage}
      />
    </div>
  );
}
