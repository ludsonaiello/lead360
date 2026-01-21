/**
 * NotificationRuleModal Component
 * Modal for creating/editing notification rules
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { createNotificationRule, updateNotificationRule, getTemplates } from '@/lib/api/communication';
import type { NotificationRule, CreateNotificationRuleDto, UpdateNotificationRuleDto, EmailTemplate } from '@/lib/types/communication';
import { toast } from 'react-hot-toast';

interface NotificationRuleModalProps {
  isOpen: boolean;
  rule?: NotificationRule;
  onClose: () => void;
  onSuccess: () => void;
}

export function NotificationRuleModal({ isOpen, rule, onClose, onSuccess }: NotificationRuleModalProps) {
  const [eventType, setEventType] = useState(rule?.event_type || '');
  const [notifyInApp, setNotifyInApp] = useState(rule?.notify_in_app ?? true);
  const [notifyEmail, setNotifyEmail] = useState(rule?.notify_email ?? false);
  const [emailTemplateKey, setEmailTemplateKey] = useState(rule?.email_template_key || '');
  const [recipientType, setRecipientType] = useState<string>(rule?.recipient_type || 'owner');
  const [specificUserIds, setSpecificUserIds] = useState(rule?.specific_user_ids?.join(', ') || '');
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Fetch email templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const response = await getTemplates({ is_active: true, limit: 100 });
        setTemplates(response.data);
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      } finally {
        setLoadingTemplates(false);
      }
    };

    if (notifyEmail) {
      fetchTemplates();
    }
  }, [notifyEmail]);

  // Event type options (common event types)
  const eventTypeOptions: SelectOption[] = [
    { value: 'lead_created', label: 'Lead Created' },
    { value: 'lead_status_changed', label: 'Lead Status Changed' },
    { value: 'lead_assigned', label: 'Lead Assigned' },
    { value: 'quote_created', label: 'Quote Created' },
    { value: 'quote_sent', label: 'Quote Sent' },
    { value: 'quote_approved', label: 'Quote Approved' },
    { value: 'quote_rejected', label: 'Quote Rejected' },
    { value: 'invoice_created', label: 'Invoice Created' },
    { value: 'invoice_sent', label: 'Invoice Sent' },
    { value: 'invoice_paid', label: 'Invoice Paid' },
    { value: 'payment_received', label: 'Payment Received' },
    { value: 'job_scheduled', label: 'Job Scheduled' },
    { value: 'job_completed', label: 'Job Completed' },
  ];

  const recipientTypeOptions: SelectOption[] = [
    { value: 'owner', label: 'Owner' },
    { value: 'assigned_user', label: 'Assigned User' },
    { value: 'specific_users', label: 'Specific Users' },
    { value: 'all_users', label: 'All Users' },
  ];

  const templateOptions: SelectOption[] = [
    { value: '', label: 'Select a template' },
    ...templates.map(t => ({ value: t.template_key, label: t.template_key })),
  ];

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!eventType) {
      newErrors.event_type = 'Event type is required';
    }

    if (!notifyInApp && !notifyEmail) {
      newErrors.notify = 'At least one notification method must be enabled';
    }

    if (notifyEmail && !emailTemplateKey) {
      newErrors.email_template_key = 'Email template is required when email notifications are enabled';
    }

    if (recipientType === 'specific_users' && !specificUserIds.trim()) {
      newErrors.specific_user_ids = 'User IDs are required for specific users';
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

      const payload: CreateNotificationRuleDto | UpdateNotificationRuleDto = {
        event_type: eventType,
        notify_in_app: notifyInApp,
        notify_email: notifyEmail,
        email_template_key: notifyEmail ? emailTemplateKey : undefined,
        recipient_type: recipientType as any,
        specific_user_ids: recipientType === 'specific_users'
          ? specificUserIds.split(',').map(id => id.trim()).filter(Boolean)
          : undefined,
        is_active: isActive,
      };

      if (rule) {
        await updateNotificationRule(rule.id, payload as UpdateNotificationRuleDto);
        toast.success('Notification rule updated successfully');
      } else {
        await createNotificationRule(payload as CreateNotificationRuleDto);
        toast.success('Notification rule created successfully');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to save notification rule:', error);
      toast.error(error?.response?.data?.message || 'Failed to save notification rule');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rule ? 'Edit Notification Rule' : 'Create Notification Rule'}
    >
      <div className="space-y-4">
        {/* Event Type */}
        <Select
          label="Event Type"
          options={eventTypeOptions}
          value={eventType}
          onChange={(value) => setEventType(value)}
          required
          error={errors.event_type}
          helperText="Which event should trigger this notification?"
        />

        {/* Notification Methods */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notification Methods *
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notify-in-app"
                checked={notifyInApp}
                onChange={(e) => setNotifyInApp(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="notify-in-app" className="text-sm text-gray-900 dark:text-gray-100">
                In-App Notification
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notify-email"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="notify-email" className="text-sm text-gray-900 dark:text-gray-100">
                Email Notification
              </label>
            </div>
          </div>
          {errors.notify && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.notify}</p>
          )}
        </div>

        {/* Email Template (if email enabled) */}
        {notifyEmail && (
          <Select
            label="Email Template"
            options={templateOptions}
            value={emailTemplateKey}
            onChange={(value) => setEmailTemplateKey(value)}
            required={notifyEmail}
            error={errors.email_template_key}
            helperText="Template to use for email notifications"
            disabled={loadingTemplates}
          />
        )}

        {/* Recipient Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recipients *
          </label>
          <div className="space-y-2">
            {recipientTypeOptions.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`recipient-${option.value}`}
                  name="recipient-type"
                  value={option.value}
                  checked={recipientType === option.value}
                  onChange={(e) => setRecipientType(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label
                  htmlFor={`recipient-${option.value}`}
                  className="text-sm text-gray-900 dark:text-gray-100"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Specific User IDs (if specific users selected) */}
        {recipientType === 'specific_users' && (
          <Input
            label="User IDs"
            type="text"
            value={specificUserIds}
            onChange={(e) => setSpecificUserIds(e.target.value)}
            placeholder="user-id-1, user-id-2, user-id-3"
            required
            error={errors.specific_user_ids}
            helperText="Comma-separated list of user IDs"
          />
        )}

        {/* Active Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="is-active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Active
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Rule'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default NotificationRuleModal;
