/**
 * Portal Forgot Password Page
 * Customer requests a password reset link via email.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Building2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getTenantBranding, portalForgotPassword } from '@/lib/api/portal';
import { buildFileUrl } from '@/lib/api/files';
import { extractTenantSlug, sanitizeHexColor } from '@/lib/utils/portal';
import type { PortalBranding } from '@/lib/types/portal';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

type FormData = z.infer<typeof schema>;

export default function PortalForgotPasswordPage() {
  const [branding, setBranding] = useState<PortalBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    setIsSubmitting(true);
    try {
      await portalForgotPassword({
        tenant_slug: extractTenantSlug(),
        email: data.email,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(apiErr?.response?.data?.message || 'Something went wrong. Please try again.');
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
        {/* Logo */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={branding?.company_name || 'Company'} className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <div className="h-16 w-16 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
          <p className="text-gray-500 mt-1">
            {submitted
              ? 'Check your email for a reset link'
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                  <CheckCircle className="w-7 h-7" style={{ color: primaryColor }} />
                </div>
              </div>
              <p className="text-gray-600 text-sm">
                If an account with that email exists, a password reset link has been sent. Please check your inbox and spam folder.
              </p>
              <a
                href="/public/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                style={{ color: primaryColor }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
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

              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                leftIcon={<Mail className="w-5 h-5" />}
                error={form.formState.errors.email?.message}
                {...form.register('email')}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="portal-btn w-full py-3 rounded-lg font-semibold text-base flex items-center justify-center gap-2"
              >
                {isSubmitting && <LoadingSpinner size="sm" className="text-white" />}
                Send Reset Link
              </button>

              <div className="text-center">
                <a
                  href="/public/login"
                  className="text-sm font-medium hover:underline"
                  style={{ color: primaryColor }}
                >
                  Back to sign in
                </a>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by Lead360</p>
      </div>
    </div>
  );
}
