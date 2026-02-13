/**
 * Initiate Call Modal Component
 * Allows users to initiate outbound calls to leads
 * System calls user's phone first, then bridges to lead
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Textarea } from '@/components/ui/Textarea';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { initiateCall } from '@/lib/api/twilio-tenant';
import type { InitiateCallRequest } from '@/lib/types/twilio-tenant';

/**
 * Sanitize phone number to E.164 format for Twilio
 * Ensures the number has country code +1 for US numbers
 *
 * @param phone - Phone number in any format
 * @returns Phone number in E.164 format (+1XXXXXXXXXX)
 */
function sanitizePhoneForTwilio(phone: string): string {
  if (!phone) return '';

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // If already has country code (11 digits starting with 1)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }

  // If 10 digits (US number without country code)
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }

  // If already starts with +, return as is (international number)
  if (phone.startsWith('+')) {
    return phone.replace(/\D/g, (match, offset) => offset === 0 ? match : '');
  }

  // Default: assume US number, prepend +1
  return `+1${digitsOnly}`;
}

/**
 * Format phone number for display
 * Converts E.164 to friendly format: +1 (555) 123-4567
 *
 * @param phone - Phone number (E.164 or any format)
 * @returns Formatted phone number for display
 */
function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';

  const sanitized = sanitizePhoneForTwilio(phone);
  const digitsOnly = sanitized.replace(/\D/g, '');

  // US number: +1 (XXX) XXX-XXXX
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    const areaCode = digitsOnly.slice(1, 4);
    const firstPart = digitsOnly.slice(4, 7);
    const secondPart = digitsOnly.slice(7, 11);
    return `+1 (${areaCode}) ${firstPart}-${secondPart}`;
  }

  // Return sanitized version if not standard US format
  return sanitized;
}

interface InitiateCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  leadPhone: string;
}

export function InitiateCallModal({
  isOpen,
  onClose,
  leadId,
  leadName,
  leadPhone,
}: InitiateCallModalProps) {
  const [userPhone, setUserPhone] = useState('');
  const [callReason, setCallReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [success, setSuccess] = useState<{ title: string; message: string } | null>(null);
  const [validationError, setValidationError] = useState('');

  // Sanitize lead phone for API (ensure E.164 format with +1)
  const sanitizedLeadPhone = useMemo(() => sanitizePhoneForTwilio(leadPhone), [leadPhone]);

  // Format lead phone for display
  const displayLeadPhone = useMemo(() => formatPhoneForDisplay(leadPhone), [leadPhone]);

  const handleClose = () => {
    // Reset form
    setUserPhone('');
    setCallReason('');
    setValidationError('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setError(null);

    // Validate user phone (E.164 format)
    if (!userPhone || !userPhone.startsWith('+1')) {
      setValidationError('Please enter a valid US phone number');
      return;
    }

    // Validate lead phone is in proper E.164 format
    if (!sanitizedLeadPhone || !sanitizedLeadPhone.startsWith('+1')) {
      setError({
        title: 'Invalid Lead Phone Number',
        message: 'The lead\'s phone number is not in a valid format. Please update the lead\'s phone number before calling.',
      });
      return;
    }

    // Validate call reason length
    if (callReason && callReason.length > 500) {
      setValidationError('Call reason must be 500 characters or less');
      return;
    }

    setIsLoading(true);

    try {
      // Use sanitized phone numbers for Twilio (E.164 format with +1)
      const payload: InitiateCallRequest = {
        lead_id: leadId,
        user_phone_number: userPhone, // Already in E.164 from PhoneInput
        call_reason: callReason || undefined,
      };

      const response = await initiateCall(payload);

      // Show success message
      setSuccess({
        title: 'Call Initiated',
        message: `Your phone will ring shortly. Please answer to connect to ${leadName}.`,
      });

      // Auto-close success modal and main modal after 3 seconds
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err: any) {
      console.error('Error initiating call:', err);

      // Handle specific error codes
      if (err.response?.status === 400) {
        const message = err.response?.data?.message || 'Invalid request';
        if (message.includes('no phone number')) {
          setError({
            title: 'Lead Has No Phone Number',
            message: 'This lead does not have a phone number on file. Please add a phone number before calling.',
          });
        } else if (message.includes('Invalid phone format')) {
          setError({
            title: 'Invalid Phone Format',
            message: 'Please enter your phone number in the correct format (e.g., +1 555 123-4567).',
          });
        } else {
          setError({
            title: 'Invalid Request',
            message: message,
          });
        }
      } else if (err.response?.status === 404) {
        setError({
          title: 'Lead Not Found',
          message: 'The lead you are trying to call could not be found.',
        });
      } else if (err.response?.status === 403) {
        setError({
          title: 'Permission Denied',
          message: 'You do not have permission to initiate calls.',
        });
      } else if (err.response?.status === 401) {
        setError({
          title: 'Authentication Error',
          message: 'Your session has expired. Please log in again.',
        });
      } else {
        setError({
          title: 'Call Failed',
          message: err.response?.data?.message || 'Failed to initiate call. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Call Lead" size="md">
        <form onSubmit={handleSubmit}>
          <ModalContent>
            <div className="space-y-4">
              {/* Lead Information (Read-only) */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                    Lead Name
                  </p>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {leadName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                    Lead Phone
                  </p>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {displayLeadPhone}
                  </p>
                </div>
              </div>

              {/* User Phone Input */}
              <div>
                <PhoneInput
                  label="Your Phone Number"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  required
                  disabled={isLoading}
                  error={validationError}
                  helperText="We'll call this number first, then connect you to the lead"
                  leftIcon={<Phone className="w-4 h-4" />}
                />
              </div>

              {/* Call Reason (Optional) */}
              <div>
                <Textarea
                  label="Call Reason (Optional)"
                  value={callReason}
                  onChange={(e) => setCallReason(e.target.value)}
                  placeholder="e.g., Following up on quote request"
                  rows={3}
                  maxLength={500}
                  disabled={isLoading}
                  helperText={`${callReason.length}/500 characters`}
                />
              </div>

              {/* Call Flow Instructions */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100">How it works:</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-1">
                  <li>We'll call your phone number</li>
                  <li>You answer your phone</li>
                  <li>We connect you to the lead's phone</li>
                  <li>Call begins with automatic recording</li>
                </ol>
              </div>
            </div>
          </ModalContent>

          <ModalActions>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !userPhone}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calling your phone...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  Initiate Call
                </>
              )}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* Error Modal */}
      {error && (
        <ErrorModal
          isOpen={!!error}
          onClose={() => setError(null)}
          title={error.title}
          message={error.message}
        />
      )}

      {/* Success Modal */}
      {success && (
        <SuccessModal
          isOpen={!!success}
          onClose={() => {
            setSuccess(null);
            handleClose();
          }}
          title={success.title}
          message={success.message}
        />
      )}
    </>
  );
}

export default InitiateCallModal;
