/**
 * Webhook Setup Card Component
 * Sprint 11: Webhook Setup, Display & End-to-End Testing
 *
 * Displays tenant-specific webhook URLs with copy functionality
 * and Twilio console configuration instructions.
 *
 * Features:
 * - Generate webhook URLs from tenant subdomain (from API, NOT hardcoded)
 * - Copy to clipboard functionality with success feedback
 * - Collapsible instruction sections
 * - Mobile responsive
 * - Dark mode support
 */

'use client';

import React, { useState } from 'react';
import { Link2, Check, Copy, ChevronDown, ChevronUp, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';

import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface WebhookSetupCardProps {
  tenantSubdomain: string;
  type?: 'sms' | 'whatsapp' | 'calls' | 'ivr' | 'all';
  phoneNumber?: string;
}

interface WebhookURL {
  label: string;
  url: string;
  description: string;
  category: 'sms' | 'whatsapp' | 'calls' | 'ivr';
}

export function WebhookSetupCard({
  tenantSubdomain,
  type = 'all',
  phoneNumber,
}: WebhookSetupCardProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  // Generate webhook URLs based on tenant subdomain
  // URL Format: {protocol}://{subdomain}.{domain}/api/v1/twilio/{category}/{endpoint}

  // Get base domain from environment (e.g., "lead360.app", "staging.lead360.app")
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'lead360.app';
  const protocol = process.env.NEXT_PUBLIC_WEBHOOK_PROTOCOL || 'https';
  const baseUrl = `${protocol}://${tenantSubdomain}.${appDomain}/api/v1/twilio`;

  const allWebhookUrls: WebhookURL[] = [
    {
      label: 'SMS Inbound',
      url: `${baseUrl}/sms/inbound`,
      description: 'Receives inbound SMS messages from Twilio',
      category: 'sms',
    },
    {
      label: 'SMS Status',
      url: `${baseUrl}/sms/status`,
      description: 'Receives SMS delivery status updates',
      category: 'sms',
    },
    {
      label: 'WhatsApp Inbound',
      url: `${baseUrl}/whatsapp/inbound`,
      description: 'Receives inbound WhatsApp messages from Twilio',
      category: 'whatsapp',
    },
    {
      label: 'WhatsApp Status',
      url: `${baseUrl}/whatsapp/status`,
      description: 'Receives WhatsApp message delivery status updates',
      category: 'whatsapp',
    },
    {
      label: 'Call Inbound',
      url: `${baseUrl}/call/inbound`,
      description: 'Handles inbound phone calls',
      category: 'calls',
    },
    {
      label: 'Call Status',
      url: `${baseUrl}/call/status`,
      description: 'Receives call status updates (ringing, completed, failed)',
      category: 'calls',
    },
    {
      label: 'Recording Ready',
      url: `${baseUrl}/recording/ready`,
      description: 'Notified when call recording is available',
      category: 'calls',
    },
    {
      label: 'IVR Menu',
      url: `${baseUrl}/ivr/menu`,
      description: 'Handles IVR menu presentation',
      category: 'ivr',
    },
    {
      label: 'IVR Input',
      url: `${baseUrl}/ivr/input`,
      description: 'Handles IVR menu digit input',
      category: 'ivr',
    },
    {
      label: 'IVR Default',
      url: `${baseUrl}/ivr/default`,
      description: 'Handles IVR default action when no input received',
      category: 'ivr',
    },
    {
      label: 'Bypass Prompt',
      url: `${baseUrl}/bypass/prompt`,
      description: 'Office bypass prompt TwiML',
      category: 'calls',
    },
    {
      label: 'Bypass Dial',
      url: `${baseUrl}/bypass/dial`,
      description: 'Office bypass dial action',
      category: 'calls',
    },
  ];

  // Filter URLs based on type prop
  const filteredUrls =
    type === 'all'
      ? allWebhookUrls
      : allWebhookUrls.filter((webhook) => webhook.category === type);

  // Copy to clipboard function
  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast.success('Webhook URL copied to clipboard');

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedUrl(null);
      }, 2000);
    } catch (error) {
      toast.error('Failed to copy URL');
      console.error('Copy failed:', error);
    }
  };

  // Get instruction content based on type
  const getInstructions = () => {
    if (type === 'sms') {
      return {
        title: 'Configure SMS Webhooks in Twilio Console',
        steps: [
          {
            step: 1,
            text: 'Log in to your Twilio Console',
            link: 'https://console.twilio.com',
          },
          {
            step: 2,
            text: `Navigate to Phone Numbers → Active Numbers → ${phoneNumber || 'Your SMS Number'}`,
          },
          {
            step: 3,
            text: 'Scroll to "Messaging" section',
          },
          {
            step: 4,
            text: 'Under "A MESSAGE COMES IN", select "Webhook" and paste the SMS Inbound URL',
          },
          {
            step: 5,
            text: 'Ensure HTTP POST method is selected',
          },
          {
            step: 6,
            text: 'Click "Save" at the bottom of the page',
          },
        ],
      };
    }

    if (type === 'whatsapp') {
      return {
        title: 'Configure WhatsApp Webhooks in Twilio Console',
        steps: [
          {
            step: 1,
            text: 'Log in to your Twilio Console',
            link: 'https://console.twilio.com',
          },
          {
            step: 2,
            text: 'Navigate to Messaging → Settings → WhatsApp Sandbox Settings',
          },
          {
            step: 3,
            text: 'Under "WHEN A MESSAGE COMES IN", paste the WhatsApp Inbound URL',
          },
          {
            step: 4,
            text: 'Ensure HTTP POST method is selected',
          },
          {
            step: 5,
            text: 'Click "Save"',
          },
        ],
      };
    }

    if (type === 'calls') {
      return {
        title: 'Configure Call Webhooks in Twilio Console',
        steps: [
          {
            step: 1,
            text: 'Log in to your Twilio Console',
            link: 'https://console.twilio.com',
          },
          {
            step: 2,
            text: `Navigate to Phone Numbers → Active Numbers → ${phoneNumber || 'Your Phone Number'}`,
          },
          {
            step: 3,
            text: 'Scroll to "Voice & Fax" section',
          },
          {
            step: 4,
            text: 'Under "A CALL COMES IN", select "Webhook" and paste the Call Inbound URL',
          },
          {
            step: 5,
            text: 'Under "Call Status Changes", paste the Call Status URL',
          },
          {
            step: 6,
            text: 'Under "Recording Status Callback", paste the Recording Ready URL',
          },
          {
            step: 7,
            text: 'Ensure all webhooks use HTTP POST method',
          },
          {
            step: 8,
            text: 'Click "Save"',
          },
        ],
      };
    }

    // Default instructions for 'all' type
    return {
      title: 'Configure Twilio Webhooks',
      steps: [
        {
          step: 1,
          text: 'Log in to your Twilio Console',
          link: 'https://console.twilio.com',
        },
        {
          step: 2,
          text: 'Navigate to Phone Numbers → Active Numbers',
        },
        {
          step: 3,
          text: 'Select the phone number you want to configure',
        },
        {
          step: 4,
          text: 'Configure webhooks for SMS (Messaging section) and/or Calls (Voice & Fax section)',
        },
        {
          step: 5,
          text: 'Copy the appropriate webhook URLs from the list above',
        },
        {
          step: 6,
          text: 'Paste webhook URLs into the corresponding Twilio configuration fields',
        },
        {
          step: 7,
          text: 'Ensure HTTP POST method is selected for all webhooks',
        },
        {
          step: 8,
          text: 'Click "Save" to apply changes',
        },
      ],
    };
  };

  const instructions = getInstructions();

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
          <Link2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Webhook Configuration
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure these webhook URLs in your Twilio Console to enable communication features
          </p>
        </div>
      </div>

      {/* Webhook URLs Section */}
      <div className="space-y-4 mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Webhook URLs
        </h4>

        {filteredUrls.map((webhook) => (
          <div
            key={webhook.url}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {webhook.label}
                  </span>
                </div>
                <code className="block text-xs text-gray-600 dark:text-gray-300 font-mono break-all bg-white dark:bg-gray-900 px-3 py-2 rounded border border-gray-200 dark:border-gray-600">
                  {webhook.url}
                </code>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {webhook.description}
                </p>
              </div>
              <div className="flex-shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(webhook.url)}
                  className="w-full sm:w-auto"
                >
                  {copiedUrl === webhook.url ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Setup Instructions Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {instructions.title}
          </h4>
          {showInstructions ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {showInstructions && (
          <div className="mt-4 space-y-3">
            {instructions.steps.map((step) => (
              <div key={step.step} className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-medium">
                  {step.step}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {step.text}
                    {step.link && (
                      <a
                        href={step.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Important Notice */}
      <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
              Important: Webhook Security
            </h5>
            <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
              All webhooks are secured with Twilio signature verification. Ensure your webhook URLs
              match exactly as shown above (including HTTPS protocol). Do not modify these URLs.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
