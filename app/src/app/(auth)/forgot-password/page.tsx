/**
 * Forgot Password Page
 * Public route for password reset request
 */

import React from 'react';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import Link from 'next/link';

export const metadata = {
  title: 'Forgot Password | Lead360',
  description: 'Reset your Lead360 password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Lead360</h1>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Forgot Password?</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
            No worries, we'll send you reset instructions
          </p>
        </div>

        {/* Forgot Password Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <ForgotPasswordForm />

          {/* Back to Login Link */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              ← Back to login
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} Lead360. All rights reserved.
        </p>
      </div>
    </div>
  );
}
