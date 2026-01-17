/**
 * FastActionButtons Component
 * Quick action buttons for Call, Email, SMS
 */

'use client';

import React from 'react';
import { Phone, Mail, MessageSquare } from 'lucide-react';
import { formatPhone } from '@/lib/api/leads';

interface FastActionButtonsProps {
  primaryPhone?: string;
  primaryEmail?: string;
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
  primaryPhone,
  primaryEmail,
  size = 'md',
  layout = 'horizontal',
  className = '',
}: FastActionButtonsProps) {
  const hasPhone = !!primaryPhone;
  const hasEmail = !!primaryEmail;

  // Format phone for display
  const formattedPhone = primaryPhone ? formatPhone(primaryPhone) : '';

  return (
    <div
      className={`
        flex gap-2
        ${layout === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'}
        ${className}
      `}
    >
      {/* Call Button */}
      <a
        href={hasPhone ? `tel:+1${primaryPhone}` : '#'}
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
      <a
        href={hasPhone ? `sms:+1${primaryPhone}` : '#'}
        className={`
          inline-flex items-center justify-center gap-2 rounded-lg font-semibold
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
          ${sizeClasses[size]}
          ${
            hasPhone
              ? 'bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600 focus:ring-purple-500 shadow-sm'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }
        `}
        onClick={(e) => !hasPhone && e.preventDefault()}
        title={hasPhone ? `SMS ${formattedPhone}` : 'No phone number'}
      >
        <MessageSquare className={iconSizes[size]} />
        <span className="hidden sm:inline">SMS</span>
      </a>
    </div>
  );
}

export default FastActionButtons;
