/**
 * Password Strength Meter Component
 * Visual indicator of password strength
 */

import React from 'react';
import { calculatePasswordStrength } from '@/lib/utils/validation';

interface PasswordStrengthMeterProps {
  password: string;
}

const strengthConfig = {
  weak: {
    color: 'bg-red-500 dark:bg-red-400',
    text: 'Weak',
    textColor: 'text-red-600 dark:text-red-400',
    width: 'w-1/3',
  },
  medium: {
    color: 'bg-yellow-500 dark:bg-yellow-400',
    text: 'Medium',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    width: 'w-2/3',
  },
  strong: {
    color: 'bg-green-500 dark:bg-green-400',
    text: 'Strong',
    textColor: 'text-green-600 dark:text-green-400',
    width: 'w-full',
  },
};

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) {
    return null;
  }

  const strength = calculatePasswordStrength(password);
  const config = strengthConfig[strength];

  return (
    <div className="mt-2">
      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${config.color} transition-all duration-300 ${config.width}`}
        />
      </div>

      {/* Strength label */}
      <p className={`mt-1 text-sm font-semibold ${config.textColor}`}>
        Password strength: {config.text}
      </p>

      {/* Requirements */}
      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1 font-medium">
        <p className={password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
          {password.length >= 8 ? '✓' : '○'} At least 8 characters
        </p>
        <p className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
          {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
        </p>
        <p className={/[a-z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
          {/[a-z]/.test(password) ? '✓' : '○'} One lowercase letter
        </p>
        <p className={/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
          {/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]/.test(password) ? '✓' : '○'} One special character
        </p>
      </div>
    </div>
  );
}

export default PasswordStrengthMeter;
