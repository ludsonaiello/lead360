/**
 * FastActionButtons Component
 * Quick action buttons for Call, Email, SMS
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Phone, Mail, MessageSquare } from 'lucide-react';
import { formatPhone } from '@/lib/api/leads';
import { InitiateCallModal } from '@/components/twilio/InitiateCallModal';
import { SendSMSModal } from '@/components/leads/SendSMSModal';
import { useRBAC } from '@/contexts/RBACContext';

/**
 * Validate if phone number can be converted to E.164 format
 */
function isValidPhoneNumber(phone: string | undefined): boolean {
  if (!phone) return false;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 10 || (digitsOnly.length === 11 && digitsOnly.startsWith('1'));
}

interface FastActionButtonsProps {
  leadId?: string;
  leadName?: string;
  primaryPhone?: string;
  primaryEmail?: string;
  phones?: Array<{
    id: string;
    phone: string;
    phone_type: string;
    is_primary: boolean;
  }>;
  acceptSms?: boolean; // Lead preference to receive SMS
  smsOptOut?: boolean; // Legal opt-out flag (TCPA compliance)
  size?: 'sm' | 'md' | 'lg';
  layout?: 'horizontal' | 'vertical';
  className?: string;
}

const sizeClasses = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-6 py-3.5 text-lg',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function FastActionButtons({
  leadId,
  leadName,
  primaryPhone,
  primaryEmail,
  phones = [],
  acceptSms = true,
  smsOptOut = false,
  size = 'md',
  layout = 'horizontal',
  className = '',
}: FastActionButtonsProps) {
  const { hasRole } = useRBAC();
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);

  const hasPhone = !!primaryPhone;
  const hasEmail = !!primaryEmail;
  const canSendSMS = acceptSms && !smsOptOut;

  // Check if user can initiate Twilio calls (Owner, Admin, Manager, Sales)
  const canInitiateCalls = hasRole(['Owner', 'Admin', 'Manager', 'Sales']);

  // Validate phone number for Twilio
  const hasValidPhone = useMemo(() => isValidPhoneNumber(primaryPhone), [primaryPhone]);

  // Format phone for display
  const formattedPhone = primaryPhone ? formatPhone(primaryPhone) : '';

  // Determine if we should use Twilio modal or fallback to tel: link
  const useTwilioCall = canInitiateCalls && hasValidPhone && leadId && leadName;

  return (
    <div
      className={`
        flex gap-2
        ${layout === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'}
        ${className}
      `}
    >
      {/* Call Button */}
      {useTwilioCall ? (
        // Twilio call button (opens modal)
        <button
          type="button"
          onClick={() => setIsCallModalOpen(true)}
          className={`
            inline-flex items-center justify-center gap-2 rounded-lg font-semibold
            transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
            ${sizeClasses[size]}
            bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 focus:ring-green-500 shadow-sm
          `}
          title={`Call ${formattedPhone} via Twilio`}
        >
          <Phone className={iconSizes[size]} />
          <span className="hidden sm:inline">Call</span>
        </button>
      ) : (
        // Fallback: Direct tel: link (for employees or when Twilio not available)
        <a
          href={hasPhone ? `tel:${primaryPhone}` : '#'}
          className={`
            inline-flex items-center justify-center gap-2 rounded-lg font-semibold
            transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
            ${sizeClasses[size]}
            ${
              hasPhone
                ? 'bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 focus:ring-green-500 shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }
          `}
          onClick={(e) => !hasPhone && e.preventDefault()}
          title={hasPhone ? `Call ${formattedPhone}` : 'No phone number'}
        >
          <Phone className={iconSizes[size]} />
          <span className="hidden sm:inline">Call</span>
        </a>
      )}

      {/* Email Button */}
      <a
        href={hasEmail ? `mailto:${primaryEmail}` : '#'}
        className={`
          inline-flex items-center justify-center gap-2 rounded-lg font-semibold
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
          ${sizeClasses[size]}
          ${
            hasEmail
              ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-blue-500 shadow-sm'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }
        `}
        onClick={(e) => !hasEmail && e.preventDefault()}
        title={hasEmail ? `Email ${primaryEmail}` : 'No email address'}
      >
        <Mail className={iconSizes[size]} />
        <span className="hidden sm:inline">Email</span>
      </a>

      {/* SMS Button */}
      <button
        type="button"
        onClick={() => hasPhone && canSendSMS && leadId && leadName && setIsSMSModalOpen(true)}
        disabled={!hasPhone || !canSendSMS}
        className={`
          inline-flex items-center justify-center gap-2 rounded-lg font-semibold
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
          ${sizeClasses[size]}
          ${
            hasPhone && canSendSMS
              ? 'bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600 focus:ring-purple-500 shadow-sm'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }
        `}
        title={
          !hasPhone
            ? 'No phone number'
            : smsOptOut
            ? 'Lead has opted out of SMS'
            : !acceptSms
            ? 'Lead does not accept SMS'
            : `SMS ${formattedPhone}`
        }
      >
        <MessageSquare className={iconSizes[size]} />
        <span className="hidden sm:inline">SMS</span>
      </button>

      {/* Twilio Call Modal */}
      {isCallModalOpen && useTwilioCall && leadId && leadName && primaryPhone && (
        <InitiateCallModal
          isOpen={isCallModalOpen}
          onClose={() => setIsCallModalOpen(false)}
          leadId={leadId}
          leadName={leadName}
          leadPhone={primaryPhone}
        />
      )}

      {/* Send SMS Modal */}
      {isSMSModalOpen && leadId && leadName && phones.length > 0 && (
        <SendSMSModal
          isOpen={isSMSModalOpen}
          onClose={() => setIsSMSModalOpen(false)}
          leadId={leadId}
          leadName={leadName}
          phones={phones}
          acceptSms={acceptSms}
          smsOptOut={smsOptOut}
        />
      )}
    </div>
  );
}

export default FastActionButtons;
