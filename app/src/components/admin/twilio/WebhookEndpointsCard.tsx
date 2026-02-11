/**
 * WebhookEndpointsCard Component
 * Displays all webhook endpoints organized by type with test functionality
 */

'use client';

import React from 'react';
import { Phone, MessageSquare, Mail, Send, Radio } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { WebhookConfig } from '@/lib/types/twilio-admin';

export interface WebhookEndpointsCardProps {
  baseUrl: string;
  endpoints: WebhookConfig['endpoints'];
  onTest: (type: string) => void;
  testing?: Record<string, boolean>;
}

interface EndpointGroup {
  type: string;
  label: string;
  icon: React.ComponentType<any>;
  paths: { label: string; path: string }[];
}

export function WebhookEndpointsCard({
  baseUrl,
  endpoints,
  onTest,
  testing = {}
}: WebhookEndpointsCardProps) {
  // Organize all endpoints by testable type
  const endpointGroups: EndpointGroup[] = [
    {
      type: 'call',
      label: 'Call Webhooks',
      icon: Phone,
      paths: [
        { label: 'Inbound Call', path: endpoints.twilio.call.inbound },
        { label: 'Call Status', path: endpoints.twilio.call.status },
        { label: 'Recording Ready', path: endpoints.twilio.call.recording_ready },
      ]
    },
    {
      type: 'sms',
      label: 'SMS Webhooks',
      icon: MessageSquare,
      paths: [
        { label: 'Inbound SMS', path: endpoints.twilio.sms.inbound },
        { label: 'SMS Status', path: endpoints.twilio.sms.status },
      ]
    },
    {
      type: 'whatsapp',
      label: 'WhatsApp Webhooks',
      icon: Send,
      paths: [
        { label: 'Inbound WhatsApp', path: endpoints.twilio.whatsapp.inbound },
        { label: 'WhatsApp Status', path: endpoints.twilio.whatsapp.status },
      ]
    },
    {
      type: 'ivr',
      label: 'IVR Webhooks',
      icon: Radio,
      paths: [
        { label: 'IVR Input', path: endpoints.twilio.ivr.input },
      ]
    },
    {
      type: 'email',
      label: 'Email Webhooks',
      icon: Mail,
      paths: [
        { label: 'Brevo', path: endpoints.email.brevo },
        { label: 'SendGrid', path: endpoints.email.sendgrid },
        { label: 'Amazon SES', path: endpoints.email.amazon_ses },
      ]
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Webhook Endpoints
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          All configured webhook endpoints organized by communication type
        </p>
      </div>

      {/* Endpoint Groups */}
      <div className="space-y-4">
        {endpointGroups.map((group) => {
          const Icon = group.icon;
          const isLoading = testing[group.type] || false;

          return (
            <div
              key={group.type}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Group Header with Test Button */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                    <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {group.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {group.paths.length} endpoint{group.paths.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => onTest(group.type)}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  {isLoading ? 'Testing...' : 'Test'}
                </Button>
              </div>

              {/* Endpoint Paths */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {group.paths.map((endpoint) => (
                  <div
                    key={endpoint.path}
                    className="p-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-900/20"
                  >
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {endpoint.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                      {baseUrl}{endpoint.path}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
