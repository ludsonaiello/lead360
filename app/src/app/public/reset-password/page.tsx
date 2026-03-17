/**
 * Portal Reset Password Page
 * Customer resets password using token from email link.
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Eye, EyeOff, Building2, AlertCircle, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getTenantBranding, portalResetPassword } from '@/lib/api/portal';
import { buildFileUrl } from '@/lib/api/files';
import { extractTenantSlug, sanitizeHexColor } from '@/lib/utils/portal';
import type { PortalBranding } from '@/lib/types/portal';

const schema = z.object({
  new_password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'At least one uppercase letter')
    .regex(/[a-z]/, 'At least one lowercase letter')
    .regex(/[0-9]/, 'At least one digit')
    .regex(/[@$!%*?&#^()_\-+=]/, 'At least one special character'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type FormData = z.infer<typeof schema>;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const resetToken = searchParams.get('token') || '';

  const [branding, setBranding] = useState<PortalBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const slug = extractTenantSlug();
    if (!slug) { setBrandingLoading(false); return; }
    getTenantBranding(slug)
      .then(setBranding)
      .catch(() => {})
      .finally(() => setBrandingLoading(false));
  }, []);

  const primaryColor = sanitizeHexColor(branding?.primary_color, '#1e40af');
  const logoUrl = branding?.logo_url ? buildFileUrl(branding.logo_url) : null;

  const onSubmit = async (data: FormData) => {
    if (!resetToken) {
      setError('Missing reset token. Please use the link from your email.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await portalResetPassword({ token: resetToken, new_password: data.new_password });
      setSuccess(true);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(apiErr?.response?.data?.message || 'Invalid or expired reset token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (brandingLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <style jsx global>{`
        .portal-btn {
          background-color: ${primaryColor};
          color: white;
          transition: opacity 0.2s;
        }
        .portal-btn:hover:not(:disabled) { opacity: 0.9; }
        .portal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={branding?.company_name || 'Company'} className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <div className="h-16 w-16 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-500 mt-1">Choose a new password for your account</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                  <CheckCircle className="w-7 h-7" style={{ color: primaryColor }} />
                </div>
              </div>
              <p className="text-gray-700 font-medium">Password reset successfully!</p>
              <p className="text-gray-500 text-sm">You can now sign in with your new password.</p>
              <a
                href="/public/login"
                className="portal-btn inline-block px-6 py-2.5 rounded-lg font-semibold text-sm"
              >
                Sign In
              </a>
            </div>
          ) : !resetToken ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="w-12 h-12 text-red-400" />
              </div>
              <p className="text-gray-700 font-medium">Missing Reset Token</p>
              <p className="text-gray-500 text-sm">
                This link appears to be invalid. Please use the link from your password reset email.
              </p>
              <a
                href="/public/forgot-password"
                className="text-sm font-medium hover:underline"
                style={{ color: primaryColor }}
              >
                Request a new reset link
              </a>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <Input
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Choose a strong password"
                  leftIcon={<Lock className="w-5 h-5" />}
                  rightIcon={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1" tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  error={form.formState.errors.new_password?.message}
                  {...form.register('new_password')}
                />
                <PasswordChecks password={form.watch('new_password') || ''} />
              </div>

              <Input
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                leftIcon={<Lock className="w-5 h-5" />}
                error={form.formState.errors.confirm_password?.message}
                {...form.register('confirm_password')}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="portal-btn w-full py-3 rounded-lg font-semibold text-base flex items-center justify-center gap-2"
              >
                {isSubmitting && <LoadingSpinner size="sm" className="text-white" />}
                Reset Password
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by Lead360</p>
      </div>
    </div>
  );
}

function PasswordChecks({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase', met: /[A-Z]/.test(password) },
    { label: 'Lowercase', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special char', met: /[@$!%*?&#^()_\-+=]/.test(password) },
  ];

  return (
    <div className="mt-2 grid grid-cols-2 gap-1">
      {checks.map((c) => (
        <div key={c.label} className="flex items-center gap-1.5 text-xs">
          <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${c.met ? 'text-green-500' : 'text-gray-300'}`} />
          <span className={c.met ? 'text-green-700' : 'text-gray-400'}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function PortalResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><LoadingSpinner size="lg" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
