/**
 * Register Page
 * Public route for user registration
 */

import React from 'react';
import { RegisterForm } from '@/components/auth/RegisterForm';
import Link from 'next/link';

export const metadata = {
  title: 'Register | Lead360',
  description: 'Create your Lead360 account',
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Lead360</h1>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Create Your Account</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
            Get started with your 14-day free trial
          </p>
        </div>

        {/* Registration Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <RegisterForm />

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} Lead360. All rights reserved.
        </p>
      </div>
    </div>
  );
}
