/**
 * Login Page
 * Public route for user authentication
 */

import React from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Login | Lead360',
  description: 'Sign in to your Lead360 account',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Lead360</h1>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} Lead360. All rights reserved.
        </p>
      </div>
    </div>
  );
}
