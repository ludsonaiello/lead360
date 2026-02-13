/**
 * Send SMS Modal Component
 * Allows sending SMS to a lead with phone number selection
 */

'use client';

import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  Phone,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { formatPhone } from '@/lib/api/leads';
import { sendSMS } from '@/lib/api/communication';
import { sanitizePhoneToE164 } from '@/lib/utils/validation';

interface SendSMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  phones: Array<{
    id: string;
    phone: string;
    phone_type: string;
    is_primary: boolean;
  }>;
  acceptSms: boolean; // Lead preference to receive SMS
  smsOptOut: boolean; // Legal opt-out flag (TCPA compliance)
  onSuccess?: () => void;
}

export function SendSMSModal({
  isOpen,
  onClose,
  leadId,
  leadName,
  phones,
  acceptSms,
  smsOptOut,
  onSuccess,
}: SendSMSModalProps) {
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>(
    phones.find((p) => p.is_primary)?.id || phones[0]?.id || ''
  );
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find selected phone
  const selectedPhone = phones.find((p) => p.id === selectedPhoneId);

  // Check if SMS is allowed
  const canSendSMS = acceptSms && !smsOptOut;
  const optOutReason = smsOptOut
    ? 'This lead has opted out of receiving SMS messages'
    : !acceptSms
    ? 'This lead has not consented to receive SMS messages'
    : null;

  const handleSend = async () => {
    if (!selectedPhone || !message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    // Sanitize phone number to E.164 format
    const sanitizedPhone = sanitizePhoneToE164(selectedPhone.phone);
    if (!sanitizedPhone) {
      toast.error('Invalid phone number format');
      return;
    }

    try {
      setSending(true);
      setError(null);

      // Send SMS via API
      const response = await sendSMS({
        lead_id: leadId,
        to_phone: sanitizedPhone,
        text_body: message.trim(),
        related_entity_type: 'lead',
        related_entity_id: leadId,
      });

      toast.success(`SMS sent successfully! (${response.status})`);
      setMessage('');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      const errorMessage = error?.message || 'Failed to send SMS. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const characterCount = message.length;
  const maxCharacters = 1600; // Standard SMS limit (multiple segments)
  const segments = Math.ceil(characterCount / 160) || 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Send SMS to ${leadName}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* SMS Opt-Out Warning */}
        {!canSendSMS && optOutReason && (
          <div className="flex items-start gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                Cannot Send SMS
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {optOutReason}
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Error sending SMS
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Phone Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
            Send to Phone Number
          </label>

          {phones.length === 0 ? (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  This lead has no phone numbers. Please add a phone number first.
                </p>
              </div>
            </div>
          ) : phones.length === 1 ? (
            // Single phone - show as disabled input
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg">
              <Phone className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatPhone(phones[0].phone)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {phones[0].phone_type}
                </p>
              </div>
              {phones[0].is_primary && (
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                  PRIMARY
                </span>
              )}
            </div>
          ) : (
            // Multiple phones - show as radio group
            <div className="space-y-2">
              {phones.map((phone) => (
                <label
                  key={phone.id}
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedPhoneId === phone.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="phone"
                    value={phone.id}
                    checked={selectedPhoneId === phone.id}
                    onChange={(e) => setSelectedPhoneId(e.target.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatPhone(phone.phone)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {phone.phone_type}
                    </p>
                  </div>
                  {phone.is_primary && (
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                      PRIMARY
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={canSendSMS ? "Type your message here..." : "SMS not available for this lead"}
            rows={6}
            maxLength={maxCharacters}
            disabled={phones.length === 0 || !canSendSMS}
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              resize-none"
          />
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {characterCount} / {maxCharacters} characters
              {segments > 1 && ` (${segments} messages)`}
            </span>
            {characterCount > 160 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                This will be sent as {segments} separate messages
              </span>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">SMS Sending Info</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                <li>Standard SMS supports up to 160 characters per message</li>
                <li>Longer messages will be split into multiple segments</li>
                <li>The lead will receive your message from your configured Twilio number</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
          <Button onClick={onClose} variant="secondary" disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !selectedPhone || !message.trim() || phones.length === 0 || !canSendSMS}
            className="min-w-[120px]"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send SMS
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default SendSMSModal;
