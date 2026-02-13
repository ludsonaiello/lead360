/**
 * IVR Configuration Display Page (Sprint 6)
 * Read-only view of Interactive Voice Response menu settings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  Phone,
  Edit,
  Power,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  PhoneCall,
  Voicemail,
  Link as LinkIcon,
  ArrowRight,
  MessageSquare,
  Copy,
  Check,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

import { getIVRConfiguration, disableIVRConfiguration } from '@/lib/api/ivr';
import type { IVRConfiguration, IVRMenuOption, IVRActionType } from '@/lib/types/ivr';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessToken } from '@/lib/utils/token';

export default function IVRConfigurationPage() {
  const { user } = useAuth();
  const router = useRouter();

  // State
  const [config, setConfig] = useState<IVRConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [disabling, setDisabling] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // RBAC - Check if user can edit (Owner or Admin)
  const canEdit = user?.roles?.some((role) => ['Owner', 'Admin'].includes(role)) || false;
  const canView = user?.roles?.some((role) => ['Owner', 'Admin', 'Manager'].includes(role)) || false;

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const data = await getIVRConfiguration(token);
      setConfig(data);
    } catch (error: any) {
      console.error('Error fetching IVR config:', error);
      setError(error.message || 'Failed to load IVR configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!config) return;

    try {
      setDisabling(true);
      const token = getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      await disableIVRConfiguration(token);
      toast.success('IVR configuration disabled');
      setShowDisableModal(false);
      fetchConfig(); // Refresh
    } catch (error: any) {
      console.error('Error disabling IVR:', error);
      toast.error(error.message || 'Failed to disable IVR configuration');
    } finally {
      setDisabling(false);
    }
  };

  // Helper: Get action icon
  const getActionIcon = (action: IVRActionType) => {
    switch (action) {
      case 'route_to_number':
        return <PhoneCall className="h-5 w-5" />;
      case 'voicemail':
        return <Voicemail className="h-5 w-5" />;
      case 'trigger_webhook':
        return <LinkIcon className="h-5 w-5" />;
      case 'route_to_default':
        return <ArrowRight className="h-5 w-5" />;
    }
  };

  // Helper: Get action color
  const getActionColor = (action: IVRActionType) => {
    switch (action) {
      case 'route_to_number':
        return 'blue';
      case 'voicemail':
        return 'green';
      case 'trigger_webhook':
        return 'purple';
      case 'route_to_default':
        return 'gray';
    }
  };

  // Helper: Format phone number for display
  const formatPhoneNumber = (phone: string): string => {
    // Remove + and split
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      // US number: +1 (978) 123-4567
      const countryCode = cleaned[0];
      const areaCode = cleaned.slice(1, 4);
      const firstPart = cleaned.slice(4, 7);
      const secondPart = cleaned.slice(7, 11);
      return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
    }
    return phone;
  };

  // Helper: Format duration (seconds to minutes)
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes === 0) {
      return `${seconds} seconds`;
    }
    return `${seconds} seconds (${minutes} min)`;
  };

  // Helper: Estimate speaking time (150 words per minute)
  const estimateSpeakingTime = (message: string): string => {
    const wordCount = message.trim().split(/\s+/).length;
    const seconds = Math.ceil((wordCount / 150) * 60);
    return `~${seconds} seconds`;
  };

  // Helper: Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  // Access Control
  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            IVR Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Interactive Voice Response menu settings
          </p>
        </div>

        <Card>
          <div className="p-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Access Denied
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your role does not allow viewing IVR configuration.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { label: 'Communications', href: '/communications/history' },
            { label: 'Twilio', href: '/communications/twilio' },
            { label: 'IVR Configuration' }, // Current page
          ]}
        />

        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            IVR Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Interactive Voice Response menu settings
          </p>
        </div>

        <Card>
          <div className="p-12 text-center">
            <LoadingSpinner className="mx-auto mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading IVR configuration...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && !config) {
    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { label: 'Communications', href: '/communications/history' },
            { label: 'Twilio', href: '/communications/twilio' },
            { label: 'IVR Configuration' }, // Current page
          ]}
        />

        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            IVR Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Interactive Voice Response menu settings
          </p>
        </div>

        <ErrorModal
          isOpen={true}
          title="Error Loading Configuration"
          message={error}
          onClose={() => {
            setError(null);
            fetchConfig();
          }}
        />

        <Card>
          <div className="p-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Failed to Load
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {error}
            </p>
            <Button onClick={fetchConfig}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Empty state - no config exists
  if (!config) {
    return (
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb
          items={[
            { label: 'Communications', href: '/communications/history' },
            { label: 'Twilio', href: '/communications/twilio' },
            { label: 'IVR Configuration' }, // Current page
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              IVR Configuration
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Interactive Voice Response menu settings
            </p>
          </div>
        </div>

        <Card>
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No IVR Configuration
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Set up an Interactive Voice Response menu to route incoming calls
            </p>
            {canEdit && (
              <Button onClick={() => router.push('/communications/twilio/ivr/edit')}>
                <Phone className="h-4 w-4 mr-2" />
                Configure IVR
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Main view - config exists
  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: 'Communications', href: '/communications/history' },
          { label: 'Twilio', href: '/communications/twilio' },
          { label: 'IVR Configuration' }, // Current page
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            IVR Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Interactive Voice Response menu settings
          </p>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => router.push('/communications/twilio/ivr/edit')}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Configuration
            </Button>
            {config.ivr_enabled && (
              <Button
                variant="secondary"
                onClick={() => setShowDisableModal(true)}
                className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                <Power className="h-4 w-4 mr-2" />
                Disable IVR
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Status Card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Status
            </h2>
            <Badge variant={config.status === 'active' ? 'success' : 'neutral'}>
              {config.status === 'active' ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Inactive
                </>
              )}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                IVR Menu
              </p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {config.ivr_enabled ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Enabled
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center">
                    <XCircle className="h-4 w-4 mr-1" />
                    Disabled
                  </span>
                )}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Created
              </p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {new Date(config.created_at).toLocaleDateString()}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Last Updated
              </p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {new Date(config.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Call Routing Explanation */}
          <div className={`p-4 rounded-lg border-l-4 ${
            config.ivr_enabled
              ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'
          }`}>
            <p className={`text-sm font-medium mb-2 ${
              config.ivr_enabled
                ? 'text-green-800 dark:text-green-200'
                : 'text-amber-800 dark:text-amber-200'
            }`}>
              Current Call Behavior:
            </p>
            <p className={`text-sm ${
              config.ivr_enabled
                ? 'text-green-700 dark:text-green-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}>
              {config.ivr_enabled ? (
                <>
                  Callers hear the greeting message and can press digits to route their call.
                  If they don't press a digit or timeout, the call routes to the Default Action below.
                </>
              ) : (
                <>
                  IVR menu is disabled. All incoming calls go directly to the Default Action below
                  without playing greeting or menu options.
                </>
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Greeting Message Card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
              Greeting Message
            </h2>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>{config.greeting_message.length} / 500 characters</span>
              <span>{estimateSpeakingTime(config.greeting_message)}</span>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-900 dark:text-white font-mono leading-relaxed">
              {config.greeting_message}
            </p>
          </div>
        </div>
      </Card>

      {/* Menu Options */}
      {config.menu_options.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Menu Options
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.menu_options
              .sort((a, b) => a.digit.localeCompare(b.digit))
              .map((option) => (
                <MenuOptionCard
                  key={option.digit}
                  option={option}
                  formatPhoneNumber={formatPhoneNumber}
                  formatDuration={formatDuration}
                  getActionIcon={getActionIcon}
                  getActionColor={getActionColor}
                  copyToClipboard={copyToClipboard}
                  copiedUrl={copiedUrl}
                />
              ))}
          </div>
        </div>
      )}

      {/* Default Action Card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center mb-2">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mr-3">
              {getActionIcon(config.default_action.action)}
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Default Action / Call Routing
              </h2>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded mb-4">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Applies when:</strong> IVR is disabled, caller doesn't press a digit, or invalid input after max retries
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {config.default_action.action === 'route_to_number' && 'Route to Phone Number'}
              {config.default_action.action === 'voicemail' && 'Voicemail'}
              {config.default_action.action === 'trigger_webhook' && 'Trigger Webhook'}
              {config.default_action.action === 'route_to_default' && 'Default Routing'}
            </p>

            {config.default_action.action === 'route_to_number' &&
              config.default_action.config.phone_number && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Phone: {formatPhoneNumber(config.default_action.config.phone_number)}
                </p>
              )}

            {config.default_action.action === 'trigger_webhook' &&
              config.default_action.config.webhook_url && (
                <div className="flex items-start gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400 break-all flex-1">
                    Webhook: {config.default_action.config.webhook_url}
                  </span>
                  <button
                    onClick={() => copyToClipboard(config.default_action.config.webhook_url!)}
                    className="flex-shrink-0 p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy URL"
                  >
                    {copiedUrl === config.default_action.config.webhook_url ? (
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}

            {config.default_action.action === 'voicemail' &&
              config.default_action.config.max_duration_seconds && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Max Duration: {formatDuration(config.default_action.config.max_duration_seconds)}
                </p>
              )}
          </div>
        </div>
      </Card>

      {/* Settings Card */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Timeout
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {config.timeout_seconds} seconds
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Time to wait for caller input
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mr-3">
                <RotateCcw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Max Retries
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {config.max_retries} attempts
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Retries for invalid input
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Disable Confirmation Modal */}
      <ConfirmModal
        isOpen={showDisableModal}
        title="Disable IVR Configuration"
        message="Are you sure you want to disable the IVR configuration? Incoming calls will no longer be routed through the IVR menu."
        confirmText="Disable IVR"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDisable}
        onClose={() => setShowDisableModal(false)}
        loading={disabling}
      />
    </div>
  );
}

/**
 * Menu Option Card Component
 */
interface MenuOptionCardProps {
  option: IVRMenuOption;
  formatPhoneNumber: (phone: string) => string;
  formatDuration: (seconds: number) => string;
  getActionIcon: (action: IVRActionType) => React.ReactElement;
  getActionColor: (action: IVRActionType) => string;
  copyToClipboard: (text: string) => Promise<void>;
  copiedUrl: string | null;
}

function MenuOptionCard({
  option,
  formatPhoneNumber,
  formatDuration,
  getActionIcon,
  getActionColor,
  copyToClipboard,
  copiedUrl,
}: MenuOptionCardProps) {
  const actionColor = getActionColor(option.action) as 'blue' | 'green' | 'purple' | 'gray';

  const colorClasses: Record<'blue' | 'green' | 'purple' | 'gray', string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    gray: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  };

  return (
    <Card>
      <div className={`p-6 border-l-4 ${colorClasses[actionColor]}`}>
        {/* Header */}
        <div className="flex items-center mb-3">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mr-3 text-xl font-bold ${
              actionColor === 'blue'
                ? 'bg-blue-600 text-white'
                : actionColor === 'green'
                ? 'bg-green-600 text-white'
                : actionColor === 'purple'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-600 text-white'
            }`}
          >
            {option.digit}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getActionIcon(option.action)}
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {option.action === 'route_to_number' && 'Route to Phone Number'}
                {option.action === 'voicemail' && 'Voicemail'}
                {option.action === 'trigger_webhook' && 'Trigger Webhook'}
                {option.action === 'route_to_default' && 'Default Routing'}
              </p>
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {option.label}
            </p>
          </div>
        </div>

        {/* Config Details */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 mt-3">
          {option.action === 'route_to_number' && option.config.phone_number && (
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900 dark:text-white">
                {formatPhoneNumber(option.config.phone_number)}
              </span>
            </div>
          )}

          {option.action === 'trigger_webhook' && option.config.webhook_url && (
            <div className="flex items-start gap-2">
              <LinkIcon className="h-4 w-4 text-gray-400 mt-0.5" />
              <span className="text-sm text-gray-900 dark:text-white break-all flex-1">
                {option.config.webhook_url}
              </span>
              <button
                onClick={() => copyToClipboard(option.config.webhook_url!)}
                className="flex-shrink-0 p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Copy URL"
              >
                {copiedUrl === option.config.webhook_url ? (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          )}

          {option.action === 'voicemail' && option.config.max_duration_seconds && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900 dark:text-white">
                Max Duration: {formatDuration(option.config.max_duration_seconds)}
              </span>
            </div>
          )}

          {option.action === 'route_to_default' && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Uses default routing configuration
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
