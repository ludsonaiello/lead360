/**
 * Invite Accept Page
 * Public route for accepting tenant invitations
 * Validates invite token, displays invite metadata, and handles password setup
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { XCircle, Clock, UserCheck, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { validateInviteToken, acceptInvite } from '@/lib/api/users';
import { setTokens } from '@/lib/utils/token';
import type { InviteTokenInfo } from '@/lib/types/users';

type PageState = 'loading' | 'valid' | 'expired' | 'used' | 'invalid' | 'error' | 'accepting' | 'success';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [inviteInfo, setInviteInfo] = useState<InviteTokenInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Validate invite token on mount
  const validateToken = useCallback(async () => {
    if (!token) {
      setPageState('invalid');
      return;
    }

    try {
      const info = await validateInviteToken(token);
      setInviteInfo(info);
      setPageState('valid');
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      switch (error.status) {
        case 404:
          setPageState('invalid');
          break;
        case 409:
          setPageState('used');
          break;
        case 410:
          setPageState('expired');
          break;
        default:
          setPageState('error');
          break;
      }
    }
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  // Client-side password validation
  function validatePassword(): boolean {
    let valid = true;
    setPasswordError('');
    setConfirmError('');

    if (!PASSWORD_REGEX.test(password)) {
      setPasswordError('Password does not meet complexity requirements.');
      valid = false;
    }

    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match.');
      valid = false;
    }

    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (!validatePassword()) return;
    if (!token) return;

    setPageState('accepting');

    try {
      const response = await acceptInvite(token, { password });
      setTokens(response.access_token, response.refresh_token);
      setPageState('success');
      // Brief success state then redirect
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      setPageState('valid'); // Restore form state

      switch (error.status) {
        case 400:
          setSubmitError('Password does not meet complexity requirements.');
          break;
        case 409:
          if (error.message?.includes('already')) {
            setSubmitError('This invite has already been accepted.');
          } else if (error.message?.includes('active in another')) {
            setSubmitError('User is currently active in another organization.');
          } else {
            setSubmitError(error.message || 'This invite cannot be accepted.');
          }
          break;
        case 410:
          setSubmitError('This invite has expired.');
          break;
        default:
          setSubmitError(error.message || 'An unexpected error occurred. Please try again.');
          break;
      }
    }
  }

  // ===== LOADING STATE =====
  if (pageState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
            Validating invite...
          </p>
        </div>
      </div>
    );
  }

  // ===== SUCCESS STATE =====
  if (pageState === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Lead360</h1>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Welcome!</h2>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              <UserCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                Invitation accepted successfully!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Redirecting to your dashboard...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== ERROR STATES (expired, used, invalid, generic error) =====
  if (pageState === 'expired' || pageState === 'used' || pageState === 'invalid' || pageState === 'error') {
    const errorConfig: Record<string, { title: string; message: string; icon: React.ReactNode }> = {
      expired: {
        title: 'Invite Expired',
        message: 'This invite link has expired. Please contact your administrator to send a new invitation.',
        icon: <Clock className="h-12 w-12 text-orange-500 mx-auto mb-4" />,
      },
      used: {
        title: 'Invite Already Used',
        message: 'This invite link has already been used. If you already have an account, please log in.',
        icon: <UserCheck className="h-12 w-12 text-blue-500 mx-auto mb-4" />,
      },
      invalid: {
        title: 'Invalid Invite Link',
        message: 'This invite link is invalid or does not exist. Please check the link and try again.',
        icon: <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />,
      },
      error: {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred while validating your invite. Please try again later.',
        icon: <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />,
      },
    };

    const config = errorConfig[pageState];

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Lead360</h1>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">
              {config.title}
            </h2>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
            <div className="text-center">
              {config.icon}
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-6">
                {config.message}
              </p>
            </div>
            <div className="text-center">
              <Link
                href="/login"
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
              >
                Go to Login
              </Link>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Lead360. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

  // ===== VALID STATE (form) + ACCEPTING STATE =====
  const isAccepting = pageState === 'accepting';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Lead360</h1>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Accept Invitation</h2>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          {/* Invite Metadata Banner */}
          {inviteInfo && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>{inviteInfo.invited_by_name}</strong> has invited you to join
                <strong> {inviteInfo.tenant_name}</strong> as <strong>{inviteInfo.role_name}</strong>.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Invite expires {formatDate(inviteInfo.expires_at)}
              </p>
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Set a password for <strong>{inviteInfo?.email}</strong> to accept the invitation.
          </p>

          {/* Submit Error */}
          {submitError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">{submitError}</p>
            </div>
          )}

          {/* Password Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <Input
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                  setSubmitError('');
                }}
                error={passwordError}
                placeholder="Enter your password"
                required
                disabled={isAccepting}
                autoComplete="new-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
              />

              <Input
                id="confirmPassword"
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmError('');
                  setSubmitError('');
                }}
                error={confirmError}
                placeholder="Confirm your password"
                required
                disabled={isAccepting}
                autoComplete="new-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
              />

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter,
                1 number, and 1 special character.
              </p>
            </div>

            <div className="mt-6">
              <Button
                type="submit"
                fullWidth
                loading={isAccepting}
                disabled={isAccepting || !password || !confirmPassword}
              >
                Accept Invitation
              </Button>
            </div>
          </form>

          {/* Back to Login Link */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              &larr; Back to login
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
