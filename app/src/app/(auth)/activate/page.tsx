/**
 * Activate Account Page
 * Public route for account activation with token
 */

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { authApi } from '@/lib/api/auth';

type ActivationState = 'loading' | 'success' | 'error';

function ActivateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [state, setState] = useState<ActivationState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMessage('No activation token provided');
      return;
    }

    const activateAccount = async () => {
      try {
        await authApi.activateAccount(token);
        setState('success');
      } catch (error: any) {
        setState('error');
        setErrorMessage(error.response?.data?.message || 'Failed to activate account. The link may be invalid or expired.');
      }
    };

    activateAccount();
  }, [token]);

  const handleResendActivation = async () => {
    // This is a placeholder since we don't have the email
    // In a real app, you might want to redirect to a page where they can enter their email
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Lead360</h1>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Account Activation</h2>
        </div>

        {/* Activation Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          {/* Loading State */}
          {state === 'loading' && (
            <div className="text-center">
              <Loader2 className="h-16 w-16 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Activating Your Account</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Please wait while we activate your account...
              </p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && (
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Account Activated!</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-6">
                Your account has been successfully activated. You can now log in to your account.
              </p>

              <Button onClick={() => router.push('/login')} fullWidth>
                Go to Login
              </Button>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="text-center">
              <XCircle className="h-16 w-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Activation Failed</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-6">
                {errorMessage}
              </p>

              <div className="space-y-3">
                <Button onClick={handleResendActivation} fullWidth loading={isResending}>
                  {isResending ? 'Sending...' : 'Request New Activation Link'}
                </Button>

                <Link
                  href="/login"
                  className="block text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                >
                  ← Back to login
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} Lead360. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-16 w-16 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    }>
      <ActivateContent />
    </Suspense>
  );
}
