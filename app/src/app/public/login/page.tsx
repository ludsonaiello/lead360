/**
 * Portal Login Page
 * Customer-facing login with tenant branding, password change flow,
 * and forgot-password link.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, Eye, EyeOff, Building2, AlertCircle, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getTenantBranding, portalLogin, portalChangePassword } from '@/lib/api/portal';
import { buildFileUrl } from '@/lib/api/files';
import { extractTenantSlug, sanitizeHexColor } from '@/lib/utils/portal';
import type { PortalBranding } from '@/lib/types/portal';
import Cookies from 'js-cookie';

// ============================================================================
// Schemas
// ============================================================================

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Current password is required'),
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

type LoginFormData = z.infer<typeof loginSchema>;
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ============================================================================
// Page
// ============================================================================

export default function PortalLoginPage() {
  const router = useRouter();
  const [branding, setBranding] = useState<PortalBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password change state
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [portalToken, setPortalToken] = useState('');
  const [customerSlug, setCustomerSlug] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [changeError, setChangeError] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const changeForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  // Fetch branding on mount
  useEffect(() => {
    const slug = extractTenantSlug();
    if (!slug) {
      setBrandingLoading(false);
      return;
    }
    getTenantBranding(slug)
      .then(setBranding)
      .catch(() => {})
      .finally(() => setBrandingLoading(false));
  }, []);

  const primaryColor = sanitizeHexColor(branding?.primary_color, '#1e40af');
  const logoUrl = branding?.logo_url ? buildFileUrl(branding.logo_url) : null;

  // Login handler
  const onLogin = async (data: LoginFormData) => {
    setLoginError('');
    setIsSubmitting(true);
    try {
      const tenantSlug = extractTenantSlug();
      const response = await portalLogin({
        tenant_slug: tenantSlug,
        email: data.email,
        password: data.password,
      });

      if (response.must_change_password) {
        // Show password change form — use the temporary password as old_password
        setPortalToken(response.token);
        setCustomerSlug(response.customer_slug);
        const name = response.lead
          ? `${response.lead.first_name} ${response.lead.last_name}`
          : 'Customer';
        setCustomerName(name);
        setMustChangePassword(true);
        changeForm.setValue('old_password', data.password);
      } else {
        // Store portal session and redirect
        Cookies.set('portal_token', response.token, { path: '/', expires: 30, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        Cookies.set('portal_customer_slug', response.customer_slug, { path: '/', expires: 30, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        const name = response.lead
          ? `${response.lead.first_name} ${response.lead.last_name}`
          : 'Customer';
        Cookies.set('portal_customer_name', name, { path: '/', expires: 30, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        router.push(`/public/${response.customer_slug}`);
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = apiErr?.response?.data?.message || apiErr?.message || 'Invalid credentials';
      setLoginError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Change password handler
  const onChangePassword = async (data: ChangePasswordFormData) => {
    setChangeError('');
    setIsChanging(true);
    try {
      await portalChangePassword(portalToken, {
        old_password: data.old_password,
        new_password: data.new_password,
      });

      // Store portal session and redirect
      Cookies.set('portal_token', portalToken, { path: '/', expires: 30, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
      Cookies.set('portal_customer_slug', customerSlug, { path: '/', expires: 30, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
      Cookies.set('portal_customer_name', customerName, { path: '/', expires: 30, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
      router.push(`/public/${customerSlug}`);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = apiErr?.response?.data?.message || apiErr?.message || 'Failed to change password';
      setChangeError(msg);
    } finally {
      setIsChanging(false);
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
        {/* Logo / Company name */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={branding?.company_name || 'Company'}
              className="h-16 mx-auto mb-4 object-contain"
            />
          ) : (
            <div
              className="h-16 w-16 rounded-xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: primaryColor }}
            >
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            {branding?.company_name || 'Customer Portal'}
          </h1>
          <p className="text-gray-500 mt-1">
            {mustChangePassword
              ? 'Please set a new password to continue'
              : 'Sign in to view your projects'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8">
          {!mustChangePassword ? (
            /* ---------- Login Form ---------- */
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
              {loginError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{loginError}</p>
                </div>
              )}

              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                leftIcon={<Mail className="w-5 h-5" />}
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register('email')}
              />

              <div>
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  leftIcon={<Lock className="w-5 h-5" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  error={loginForm.formState.errors.password?.message}
                  {...loginForm.register('password')}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="portal-btn w-full py-3 rounded-lg font-semibold text-base flex items-center justify-center gap-2"
              >
                {isSubmitting && <LoadingSpinner size="sm" className="text-white" />}
                Sign In
              </button>

              <div className="text-center">
                <a
                  href="/public/forgot-password"
                  className="text-sm font-medium hover:underline"
                  style={{ color: primaryColor }}
                >
                  Forgot your password?
                </a>
              </div>
            </form>
          ) : (
            /* ---------- Change Password Form ---------- */
            <form onSubmit={changeForm.handleSubmit(onChangePassword)} className="space-y-5">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  For security, you must change your temporary password before continuing.
                </p>
              </div>

              {changeError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{changeError}</p>
                </div>
              )}

              {/* Old password is auto-filled from login, hidden */}
              <input type="hidden" {...changeForm.register('old_password')} />

              <div>
                <Input
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Choose a strong password"
                  leftIcon={<Lock className="w-5 h-5" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="p-1"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  error={changeForm.formState.errors.new_password?.message}
                  {...changeForm.register('new_password')}
                />
                <PasswordStrength password={changeForm.watch('new_password') || ''} primaryColor={primaryColor} />
              </div>

              <Input
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                leftIcon={<Lock className="w-5 h-5" />}
                error={changeForm.formState.errors.confirm_password?.message}
                {...changeForm.register('confirm_password')}
              />

              <button
                type="submit"
                disabled={isChanging}
                className="portal-btn w-full py-3 rounded-lg font-semibold text-base flex items-center justify-center gap-2"
              >
                {isChanging && <LoadingSpinner size="sm" className="text-white" />}
                Set New Password
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Lead360
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Password Strength Indicator
// ============================================================================

function PasswordStrength({ password, primaryColor }: { password: string; primaryColor: string }) {
  if (!password) return null;

  const checks = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[@$!%*?&#^()_\-+=]/.test(password) },
  ];

  return (
    <div className="mt-2 grid grid-cols-2 gap-1">
      {checks.map((check) => (
        <div key={check.label} className="flex items-center gap-1.5 text-xs">
          <CheckCircle
            className={`w-3.5 h-3.5 flex-shrink-0 ${
              check.met ? 'text-green-500' : 'text-gray-300'
            }`}
          />
          <span className={check.met ? 'text-green-700' : 'text-gray-400'}>
            {check.label}
          </span>
        </div>
      ))}
    </div>
  );
}
