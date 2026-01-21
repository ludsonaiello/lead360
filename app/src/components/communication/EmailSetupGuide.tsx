/**
 * EmailSetupGuide Component
 * Collapsible help guides for common email providers
 * Provides step-by-step instructions for Gmail, Office 365, SendGrid, etc.
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface EmailSetupGuideProps {
  providerKey: string;
}

export function EmailSetupGuide({ providerKey }: EmailSetupGuideProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const guides: Record<string, { title: string; steps: string[]; settings?: Record<string, string> }> = {
    'smtp': {
      title: 'Gmail SMTP Setup',
      steps: [
        'Enable 2-Factor Authentication in your Google Account',
        'Go to Google Account > Security > 2-Step Verification > App Passwords',
        'Generate an "App Password" for "Mail"',
        'Copy the 16-character app password (spaces will be removed automatically)',
        'Use the settings below and paste your app password',
      ],
      settings: {
        smtp_host: 'smtp.gmail.com',
        smtp_port: '587',
        smtp_secure: 'TLS',
      },
    },
    office365: {
      title: 'Office 365 SMTP Setup',
      steps: [
        'Ensure SMTP AUTH is enabled in your Office 365 admin center',
        'Go to Exchange admin center > Mail flow > Connectors (if using custom domain)',
        'For basic setup, use your Office 365 email and password',
        'Use the settings below',
      ],
      settings: {
        smtp_host: 'smtp.office365.com',
        smtp_port: '587',
        smtp_secure: 'TLS',
      },
    },
    sendgrid: {
      title: 'SendGrid Setup',
      steps: [
        'Sign up at sendgrid.com or log in to your account',
        'Go to Settings > API Keys',
        'Click "Create API Key"',
        'Select "Full Access" permissions',
        'Copy the API key (starts with "SG.")',
        'Paste the API key in the field below',
      ],
    },
    'amazon-ses': {
      title: 'Amazon SES API Setup',
      steps: [
        'Log in to AWS Console at console.aws.amazon.com',
        'Select your AWS Region from top-right (e.g., US East (N. Virginia) = us-east-1)',
        'Navigate to Amazon SES service (search "SES")',
        'Go to "Verified identities" → Click "Create identity"',
        'Choose "Domain" (recommended) or "Email address" → Complete verification',
        'Go to "Account dashboard" → If status is "Sandbox", click "Request production access"',
        'Navigate to IAM service (search "IAM" in services)',
        'Click "Users" in left menu → Click "Create user"',
        'Enter username (e.g., "ses-api-user") → Click "Next"',
        'Select "Attach policies directly" → Search and select "AmazonSESFullAccess"',
        'Click "Next" → Click "Create user"',
        'Click on the newly created user → Go to "Security credentials" tab',
        'Scroll to "Access keys" → Click "Create access key"',
        'Select "Application running outside AWS" → Click "Next" → Click "Create access key"',
        'IMPORTANT: Copy the Access Key ID and Secret Access Key (shown only once!)',
        'Enter the Access Key, Secret Key, and Region in the fields below',
      ],
      settings: {
        note: 'API-based (not SMTP)',
      },
    },
    'ses': { // Alias for amazon-ses
      title: 'Amazon SES API Setup',
      steps: [
        'Log in to AWS Console at console.aws.amazon.com',
        'Select your AWS Region from top-right (e.g., US East (N. Virginia) = us-east-1)',
        'Navigate to Amazon SES service (search "SES")',
        'Go to "Verified identities" → Click "Create identity"',
        'Choose "Domain" (recommended) or "Email address" → Complete verification',
        'Go to "Account dashboard" → If status is "Sandbox", click "Request production access"',
        'Navigate to IAM service (search "IAM" in services)',
        'Click "Users" in left menu → Click "Create user"',
        'Enter username (e.g., "ses-api-user") → Click "Next"',
        'Select "Attach policies directly" → Search and select "AmazonSESFullAccess"',
        'Click "Next" → Click "Create user"',
        'Click on the newly created user → Go to "Security credentials" tab',
        'Scroll to "Access keys" → Click "Create access key"',
        'Select "Application running outside AWS" → Click "Next" → Click "Create access key"',
        'IMPORTANT: Copy the Access Key ID and Secret Access Key (shown only once!)',
        'Enter the Access Key, Secret Key, and Region in the fields below',
      ],
      settings: {
        note: 'API-based (not SMTP)',
      },
    },
    'amazon_ses': { // Another alias
      title: 'Amazon SES API Setup',
      steps: [
        'Log in to AWS Console at console.aws.amazon.com',
        'Select your AWS Region from top-right (e.g., US East (N. Virginia) = us-east-1)',
        'Navigate to Amazon SES service (search "SES")',
        'Go to "Verified identities" → Click "Create identity"',
        'Choose "Domain" (recommended) or "Email address" → Complete verification',
        'Go to "Account dashboard" → If status is "Sandbox", click "Request production access"',
        'Navigate to IAM service (search "IAM" in services)',
        'Click "Users" in left menu → Click "Create user"',
        'Enter username (e.g., "ses-api-user") → Click "Next"',
        'Select "Attach policies directly" → Search and select "AmazonSESFullAccess"',
        'Click "Next" → Click "Create user"',
        'Click on the newly created user → Go to "Security credentials" tab',
        'Scroll to "Access keys" → Click "Create access key"',
        'Select "Application running outside AWS" → Click "Next" → Click "Create access key"',
        'IMPORTANT: Copy the Access Key ID and Secret Access Key (shown only once!)',
        'Enter the Access Key, Secret Key, and Region in the fields below',
      ],
      settings: {
        note: 'API-based (not SMTP)',
      },
    },
    brevo: {
      title: 'Brevo (Sendinblue) Setup',
      steps: [
        'Log in to your Brevo account',
        'Go to SMTP & API > SMTP',
        'Copy your SMTP server details',
        'Create an SMTP key if you don\'t have one',
        'Use the key as your SMTP password',
      ],
      settings: {
        smtp_host: 'smtp-relay.brevo.com',
        smtp_port: '587',
      },
    },
  };

  // Normalize provider key and find matching guide
  const normalizedKey = providerKey.toLowerCase().replace(/[_\s]/g, '-');
  const guide = guides[normalizedKey] || guides[providerKey.toLowerCase()] || null;

  // If no guide found, don't show anything
  if (!guide) {
    return null;
  }

  const handleCopySettings = () => {
    if (guide.settings) {
      const settingsText = Object.entries(guide.settings)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      navigator.clipboard.writeText(settingsText);
      toast.success('Settings copied to clipboard');
    }
  };

  return (
    <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-900/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
            ?
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Need Help? {guide.title}
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Click to {isExpanded ? 'hide' : 'show'} setup instructions
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Steps */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Step-by-Step Guide
            </h4>
            <ol className="space-y-2">
              {guide.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="flex-1 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Recommended Settings */}
          {guide.settings && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Recommended Settings
                </h4>
                <button
                  onClick={handleCopySettings}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Settings
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(guide.settings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-900 rounded px-3 py-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                    </span>
                    <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                      {value}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                  Pro Tips
                </h5>
                <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                  <li>Always test your configuration after saving</li>
                  <li>Keep your credentials secure and never share them</li>
                  <li>Use app-specific passwords when available (Gmail, Yahoo)</li>
                  {providerKey === 'smtp' && (
                    <li>For Gmail, make sure "Less secure app access" is OFF (use App Passwords instead)</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailSetupGuide;
