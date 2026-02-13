/**
 * Call Button Component
 * Reusable button to initiate calls to leads
 * Opens InitiateCallModal when clicked
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InitiateCallModal } from './InitiateCallModal';
import { useRBAC } from '@/contexts/RBACContext';

/**
 * Validate if phone number can be converted to E.164 format
 * @param phone - Phone number in any format
 * @returns True if phone is valid and has enough digits
 */
function isValidPhoneNumber(phone: string | null): boolean {
  if (!phone) return false;

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Valid if 10 digits (US without country code) or 11 digits (with country code)
  return digitsOnly.length === 10 || (digitsOnly.length === 11 && digitsOnly.startsWith('1'));
}

interface CallButtonProps {
  leadId: string;
  leadName: string;
  leadPhone: string | null;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  iconOnly?: boolean;
}

export function CallButton({
  leadId,
  leadName,
  leadPhone,
  variant = 'primary',
  size = 'md',
  className = '',
  iconOnly = false,
}: CallButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { hasRole } = useRBAC();

  // Check RBAC - only Owner, Admin, Manager, Sales can initiate calls
  // Employee cannot initiate calls
  const canInitiateCalls = hasRole(['Owner', 'Admin', 'Manager', 'Sales']);

  // Validate lead phone number (must have 10 or 11 digits)
  const hasValidPhone = useMemo(() => isValidPhoneNumber(leadPhone), [leadPhone]);

  // Button is disabled if:
  // 1. User doesn't have permission
  // 2. Lead has no phone number or invalid phone
  const isDisabled = !canInitiateCalls || !hasValidPhone;

  // Tooltip message
  const getTooltipMessage = () => {
    if (!canInitiateCalls) {
      return 'You do not have permission to initiate calls';
    }
    if (!leadPhone) {
      return 'Lead has no phone number';
    }
    if (!hasValidPhone) {
      return 'Lead phone number is invalid (must be 10 digits)';
    }
    return 'Call this lead';
  };

  // Don't render button if user doesn't have permission
  if (!canInitiateCalls) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        disabled={isDisabled}
        title={getTooltipMessage()}
        className={className}
      >
        <Phone className="w-4 h-4" />
        {!iconOnly && 'Call Lead'}
      </Button>

      {isModalOpen && hasValidPhone && leadPhone && (
        <InitiateCallModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          leadId={leadId}
          leadName={leadName}
          leadPhone={leadPhone}
        />
      )}
    </>
  );
}

export default CallButton;
